import * as THREE from "three";
import type { AudioEngine } from "../audio/audio.ts";
import type { Effects } from "../fx/effects.ts";
import type { Player } from "../player/player.ts";
import type { CollisionWorld } from "../world/collision.ts";
import { roll22Damage } from "../weapons/little22.ts";
import { FlowField } from "./flowField.ts";
import { buildGeezer } from "./geezerModel.ts";
import { buildGoblin, type Faction, type GoblinKind, type GoblinRig, type HostileKind } from "./goblinModel.ts";

export interface GoblinDef {
  hp: number;
  speed: number;
  damage: number;
  scale: number;
  score: number;
  attackRange: number;
  windup: number;
  cooldown: number;
  name: string;
  voice: number;
}

export const GOBLINS: Record<GoblinKind, GoblinDef> = {
  grunt: { hp: 100, speed: 4.7, damage: 12, scale: 1, score: 100, attackRange: 24, windup: 0.22, cooldown: 0.85, name: "Grunt", voice: 1 },
  runner: { hp: 55, speed: 8.4, damage: 7, scale: 0.82, score: 120, attackRange: 18, windup: 0.16, cooldown: 0.55, name: "Sneak", voice: 1.35 },
  brute: { hp: 440, speed: 3.2, damage: 28, scale: 1.75, score: 400, attackRange: 22, windup: 0.32, cooldown: 1.05, name: "Brute", voice: 0.6 },
  shaman: { hp: 130, speed: 3.5, damage: 16, scale: 1.02, score: 250, attackRange: 26, windup: 0.8, cooldown: 2.6, name: "Shaman", voice: 1.15 },
  king: { hp: 3600, speed: 3.9, damage: 34, scale: 3.3, score: 5000, attackRange: 28, windup: 0.45, cooldown: 1.1, name: "KRAWK THE GOBLIN KING", voice: 0.42 },
};

export const GEEZER: GoblinDef = {
  hp: 90, speed: 6.6, damage: 8, scale: 1.18, score: 140, attackRange: 32, windup: 0.16, cooldown: 0.48, name: "Emo Geezer", voice: 0.7,
};

export const HOSTILES: Record<HostileKind, GoblinDef> = { ...GOBLINS, geezer: GEEZER };

type State = "rising" | "chase" | "windup" | "recover" | "dead";

export interface Goblin {
  id: number;
  kind: HostileKind;
  faction: Faction;
  def: GoblinDef;
  rig: GoblinRig;
  pos: THREE.Vector3;
  yaw: number;
  hp: number;
  state: State;
  stateT: number;
  phase: number;
  hurtT: number;
  attackCd: number;
  stuckT: number;
  lastPos: THREE.Vector3;
  sidestep: number;
  sidestepT: number;
  deadVel: THREE.Vector3;
  deadSpin: THREE.Vector3;
  deadT: number;
  headless: boolean;
  headGib: THREE.Object3D | null;
  headGibVel: THREE.Vector3;
  alerted: boolean;
  summonT: number;
  dummy: boolean;
  tauntT: number;
  losT: number;
  losClear: boolean;
  targetId: number | "player" | null;
}

export interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  damage: number;
}

export interface GoblinHit {
  goblin: Goblin;
  dist: number;
  head: boolean;
  point: THREE.Vector3;
}

const orbGeo = new THREE.IcosahedronGeometry(0.28, 1);
const orbMat = new THREE.MeshBasicMaterial({ color: "#c27bff" });

export class GoblinManager {
  readonly group = new THREE.Group();
  readonly goblins: Goblin[] = [];
  readonly projectiles: Projectile[] = [];
  private nextId = 1;
  onPlayerHit?: (damage: number, from: THREE.Vector3) => void;
  onKilled?: (g: Goblin, by: "player" | "rival") => void;
  onTaunt?: (g: Goblin) => void;
  onSummon?: (x: number, z: number) => void;

  private readonly flow: FlowField;

  constructor(
    private readonly collision: CollisionWorld,
    private readonly fx: Effects,
    private readonly audio: AudioEngine,
  ) {
    this.flow = new FlowField(collision, collision.terrain.size);
  }

  get alive() {
    return this.goblins.filter((g) => g.state !== "dead" && !g.dummy);
  }

  spawn(kind: HostileKind, x: number, z: number, opts: { dummy?: boolean; instant?: boolean } = {}): Goblin {
    const def = HOSTILES[kind];
    const rig = kind === "geezer" ? buildGeezer() : buildGoblin(kind);
    rig.root.scale.setScalar(def.scale);
    rig.root.rotation.order = "YXZ";
    const y = this.collision.groundAt(x, z);
    const g: Goblin = {
      id: this.nextId++, kind, faction: kind === "geezer" ? "geezer" : "goblin", def, rig,
      pos: new THREE.Vector3(x, y, z), yaw: Math.random() * Math.PI * 2, hp: def.hp,
      state: opts.instant ? "chase" : "rising", stateT: 0, phase: Math.random() * 10, hurtT: 0,
      attackCd: 1 + Math.random(), stuckT: 0, lastPos: new THREE.Vector3(x, y, z), sidestep: 0, sidestepT: 0,
      deadVel: new THREE.Vector3(), deadSpin: new THREE.Vector3(), deadT: 0, headless: false, headGib: null,
      headGibVel: new THREE.Vector3(), alerted: false, summonT: 8, dummy: !!opts.dummy, tauntT: 4 + Math.random() * 10,
      losT: Math.random() * 0.3, losClear: true, targetId: "player",
    };
    rig.root.position.copy(g.pos);
    if (!opts.instant) {
      rig.root.position.y -= 1.8 * def.scale;
      this.fx.spawnBurst(g.pos.clone());
    }
    this.group.add(rig.root);
    this.goblins.push(g);
    return g;
  }

  /** Ray vs head spheres and body capsules (approximated as stacked spheres). */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): GoblinHit[] {
    const hits: GoblinHit[] = [];
    const tmp = new THREE.Vector3();
    const sphere = (c: THREE.Vector3, r: number) => {
      tmp.subVectors(origin, c);
      const b = tmp.dot(dir);
      const cc = tmp.lengthSq() - r * r;
      const disc = b * b - cc;
      if (disc < 0) return Infinity;
      const t = -b - Math.sqrt(disc);
      return t >= 0 && t <= maxDist ? t : Infinity;
    };
    for (const g of this.goblins) {
      if (g.state === "dead") continue;
      const s = g.def.scale;
      const rise = g.rig.root.position.y - g.pos.y;
      const base = new THREE.Vector3(g.pos.x, g.pos.y + rise, g.pos.z);
      if (base.distanceToSquared(origin) > (maxDist + 6) ** 2) continue;
      const headC = new THREE.Vector3();
      g.rig.head.getWorldPosition(headC);
      const th = g.headless ? Infinity : sphere(headC, 0.27 * s);
      let tb = Infinity;
      for (const [hy, r] of [[0.85, 0.34], [0.55, 0.3], [0.25, 0.22]] as const) {
        tb = Math.min(tb, sphere(base.clone().setY(base.y + hy * s), r * s));
      }
      const t = Math.min(th, tb);
      if (t < Infinity) hits.push({ goblin: g, dist: t, head: th <= tb, point: origin.clone().addScaledVector(dir, t) });
    }
    return hits.sort((a, b) => a.dist - b.dist);
  }

  /** Returns true if this hit killed the goblin. */
  damage(g: Goblin, amount: number, dir: THREE.Vector3, head: boolean, big: boolean, by: "player" | "rival" = "player"): boolean {
    if (g.state === "dead") return false;
    g.hp -= amount;
    g.hurtT = 0.25;
    g.alerted = true;
    const dist = g.pos.distanceTo(this.listener);
    if (g.hp > 0) {
      if (Math.random() < 0.6) {
        if (g.faction === "geezer") this.audio.geezer("hurt", g.def.voice, this.panFor(g.pos), dist);
        else this.audio.goblin("hurt", g.def.voice, this.panFor(g.pos), dist);
      }
      if (g.kind !== "king" && g.kind !== "brute") {
        g.pos.addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), big ? 0.9 : 0.25);
      }
      return false;
    }
    this.kill(g, dir, head, big, by);
    return true;
  }

  private kill(g: Goblin, dir: THREE.Vector3, head: boolean, big: boolean, by: "player" | "rival" = "player") {
    g.state = "dead";
    g.deadT = 0;
    const force = (big ? 9 : 4.5) / Math.sqrt(g.def.scale);
    g.deadVel.set(dir.x, 0, dir.z).normalize().multiplyScalar(force);
    g.deadVel.y = big ? 5 : 2.5;
    g.deadSpin.set((Math.random() - 0.5) * 4 - 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
    if (g.faction === "geezer") this.audio.geezer("death", g.def.voice, this.panFor(g.pos), g.pos.distanceTo(this.listener));
    else this.audio.goblin("death", g.def.voice, this.panFor(g.pos), g.pos.distanceTo(this.listener));
    const headPos = new THREE.Vector3();
    g.rig.head.getWorldPosition(headPos);
    if (head && g.kind !== "king") {
      g.headless = true;
      const gib = g.rig.head;
      gib.parent?.remove(gib);
      gib.position.copy(headPos);
      gib.scale.setScalar(g.def.scale);
      this.group.add(gib);
      g.headGib = gib;
      g.headGibVel.copy(dir).multiplyScalar(big ? 14 : 8).add(new THREE.Vector3(0, big ? 8 : 6, 0));
      if (g.faction === "geezer") this.fx.blood(headPos, new THREE.Vector3(0, 1, 0), 2.2, g.pos.y);
      else this.fx.goo(headPos, new THREE.Vector3(0, 1, 0), 2.2, g.pos.y);
    } else {
      if (g.faction === "geezer") this.fx.blood(headPos, dir, 1.4, g.pos.y);
      else this.fx.goo(headPos, dir, 1.4, g.pos.y);
    }
    if (g.faction === "geezer") this.fx.bloodSplat(g.pos.x + dir.x * 1.2, g.pos.z + dir.z * 1.2, 1.2 * g.def.scale);
    else this.fx.gooSplat(g.pos.x + dir.x * 1.2, g.pos.z + dir.z * 1.2, 1.4 * g.def.scale);
    this.onKilled?.(g, by);
  }

  private listener = new THREE.Vector3();
  private listenerYaw = 0;

  private panFor(p: THREE.Vector3) {
    const dx = p.x - this.listener.x, dz = p.z - this.listener.z;
    const rightX = Math.cos(this.listenerYaw), rightZ = -Math.sin(this.listenerYaw);
    const d = Math.hypot(dx, dz) || 1;
    return (dx * rightX + dz * rightZ) / d;
  }

  update(dt: number, player: Player, now: number) {
    this.listener.copy(player.pos);
    this.listenerYaw = player.yaw;
    const target = player.pos;
    this.flow.update(dt, target.x, target.z);

    for (let i = this.goblins.length - 1; i >= 0; i--) {
      const g = this.goblins[i];
      g.stateT += dt;
      g.hurtT = Math.max(0, g.hurtT - dt);
      const rig = g.rig;
      const s = g.def.scale;

      if (g.state === "dead") {
        this.updateDead(g, dt);
        if (g.deadT > 6) {
          this.group.remove(rig.root);
          if (g.headGib) this.group.remove(g.headGib);
          this.goblins.splice(i, 1);
        }
        continue;
      }

      if (g.state === "rising") {
        const k = Math.min(1, g.stateT / 0.9);
        rig.root.position.set(g.pos.x, g.pos.y - (1 - easeOut(k)) * 1.8 * s, g.pos.z);
        rig.root.rotation.y = g.yaw;
        if (k >= 1) {
          g.state = "chase";
          g.stateT = 0;
          if (Math.random() < 0.5) {
            if (g.faction === "geezer") this.audio.geezer("alert", g.def.voice, this.panFor(g.pos), g.pos.distanceTo(target));
            else this.audio.goblin("alert", g.def.voice, this.panFor(g.pos), g.pos.distanceTo(target));
          }
        }
        this.animateLimbs(g, dt, 0.2);
        continue;
      }

      if (g.dummy) {
        rig.root.position.copy(g.pos);
        rig.root.rotation.y = g.yaw;
        this.animateLimbs(g, dt, 0);
        continue;
      }

      const aim = this.pickTarget(g, player);
      const dx = aim.x - g.pos.x, dz = aim.z - g.pos.z;
      const dist = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(-dx, -dz);
      g.yaw = lerpAngle(g.yaw, desiredYaw, 1 - Math.exp(-dt * 8));
      g.attackCd -= dt;

      g.tauntT -= dt;
      if (g.tauntT <= 0 && dist < 40) {
        g.tauntT = 12 + Math.random() * 18;
        if (Math.random() < 0.35) {
          if (g.faction === "geezer") this.audio.geezer("laugh", g.def.voice, this.panFor(g.pos), dist);
          else this.audio.goblin("laugh", g.def.voice, this.panFor(g.pos), dist);
          this.onTaunt?.(g);
        }
      }

      let moveSpeed = 0;
      const revolver = g.kind !== "shaman" || !!aim.rival;
      const ranged = revolver || g.kind === "shaman";
      if (g.state === "chase") {
        const preferred = g.kind === "geezer" ? 16 : ranged ? 14 : g.def.attackRange * 0.8;
        const los = !this.collision.lineBlocked(g.pos.x, g.pos.y + 1.2 * s, g.pos.z, aim.x, aim.y, aim.z);
        const canAttack = dist < g.def.attackRange && los && (aim.rival || player.alive);
        if (canAttack && g.attackCd <= 0) {
          g.state = "windup";
          g.stateT = 0;
          if (g.faction === "geezer") this.audio.geezer("attack", g.def.voice, this.panFor(g.pos), dist);
          else this.audio.goblin("attack", g.def.voice, this.panFor(g.pos), dist);
        } else if (g.kind === "geezer" || dist > preferred || dist < 9) {
          moveSpeed = g.def.speed * (g.hurtT > 0 ? 0.4 : 1);
          if (ranged && dist < 9 && !aim.rival) moveSpeed = -g.def.speed * 0.75;
          if (g.kind === "geezer" && dist < preferred) {
            g.sidestep = g.sidestep || (Math.random() < 0.5 ? -1 : 1);
            if (g.sidestepT <= 0) g.sidestepT = 1.1 + Math.random();
          }
        }
        if (g.kind === "king") {
          g.summonT -= dt;
          if (g.summonT <= 0) {
            g.summonT = 11;
            this.audio.goblin("laugh", 0.35, 0, dist);
            this.onSummon?.(g.pos.x, g.pos.z);
          }
        }
      } else if (g.state === "windup") {
        if (g.stateT >= g.def.windup) {
          this.resolveAttack(g, player, dist, now, aim.rival);
          g.state = "recover";
          g.stateT = 0;
          g.attackCd = g.def.cooldown * (0.8 + Math.random() * 0.4);
        }
      } else if (g.state === "recover") {
        if (g.stateT > 0.28) { g.state = "chase"; g.stateT = 0; }
      }

      if (moveSpeed !== 0 && dist > 0.01) {
        g.losT -= dt;
        if (g.losT <= 0) {
          g.losT = 0.3;
          g.losClear = !this.collision.lineBlocked(g.pos.x, g.pos.y + 0.8 * s, g.pos.z, aim.x, aim.y, aim.z);
        }
        let mx = (dx / dist) * Math.sign(moveSpeed), mz = (dz / dist) * Math.sign(moveSpeed);
        if (moveSpeed > 0 && !g.losClear && !aim.rival) {
          const f = this.flow.direction(g.pos.x, g.pos.z);
          if (f) {
            mx = f[0];
            mz = f[1];
            g.yaw = lerpAngle(g.yaw, Math.atan2(-mx, -mz), 1 - Math.exp(-dt * 6));
          }
        }
        for (const o of this.goblins) {
          if (o === g || o.state === "dead") continue;
          const ox = g.pos.x - o.pos.x, oz = g.pos.z - o.pos.z;
          const od = Math.hypot(ox, oz);
          const minD = (g.def.scale + o.def.scale) * 0.55;
          if (od < minD && od > 0.001) { mx += (ox / od) * (minD - od) * 2; mz += (oz / od) * (minD - od) * 2; }
        }
        if (g.sidestepT > 0) {
          g.sidestepT -= dt;
          mx += -dz / dist * g.sidestep * 1.4;
          mz += dx / dist * g.sidestep * 1.4;
        }
        const ml = Math.hypot(mx, mz) || 1;
        const sp = Math.abs(moveSpeed);
        g.pos.x += (mx / ml) * sp * dt;
        g.pos.z += (mz / ml) * sp * dt;
        this.collision.resolve(g.pos, 0.38 * s, 1.4 * s);
        g.pos.y = this.collision.terrain.heightAt(g.pos.x, g.pos.z);

        g.stuckT += dt;
        if (g.stuckT > 1.1) {
          if (g.pos.distanceTo(g.lastPos) < 0.6 * sp * 0.3 && g.sidestepT <= 0) {
            g.sidestep = Math.random() < 0.5 ? -1 : 1;
            g.sidestepT = 1.4;
          }
          g.lastPos.copy(g.pos);
          g.stuckT = 0;
        }
      }

      rig.root.position.copy(g.pos);
      rig.root.rotation.y = g.yaw;
      this.animateLimbs(g, dt, moveSpeed !== 0 ? Math.abs(moveSpeed) / 4.5 : 0);
      if (ranged && rig.root.userData.orb) this.fx.magic((rig.root.userData.orb as THREE.Object3D).getWorldPosition(new THREE.Vector3()), 0xb06bff);
    }

    this.updateProjectiles(dt, player, now);
  }

  private pickTarget(g: Goblin, player: Player) {
    const playerDist = Math.hypot(player.pos.x - g.pos.x, player.pos.z - g.pos.z);
    let best: Goblin | null = null;
    let bestD = Infinity;
    for (const o of this.goblins) {
      if (o === g || o.state === "dead" || o.dummy || o.faction === g.faction) continue;
      const d = Math.hypot(o.pos.x - g.pos.x, o.pos.z - g.pos.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    const wantRival = !!best && bestD < 44 && (bestD < playerDist + 12 || bestD < 24 || !player.alive);
    if (wantRival && best) {
      g.targetId = best.id;
      return { x: best.pos.x, y: best.pos.y + 1.3 * best.def.scale, z: best.pos.z, rival: best, dist: bestD };
    }
    g.targetId = "player";
    return { x: player.pos.x, y: player.pos.y + 1.5, z: player.pos.z, rival: null as Goblin | null, dist: playerDist };
  }

  private resolveAttack(g: Goblin, player: Player, dist: number, _now: number, rival: Goblin | null) {
    const s = g.def.scale;
    if (!rival && g.kind === "king" && dist < 6.8) {
      this.fx.ring(g.pos.clone(), 9, 0.55, 0xff6a00);
      this.fx.soft.emit({ pos: g.pos.clone(), spread: 1, speed: [4, 10], life: [0.6, 1.2], size: [0.6, 2.4], color: 0x7a6a50, color2: 0x3a3020, alpha: 0.7, gravity: 4, count: 40, jitter: 3 });
      this.audio.explosion(dist);
      player.shake(0.5);
      if (player.onGround) this.onPlayerHit?.(g.def.damage, g.pos);
      return;
    }
    if (!rival && g.kind === "shaman") {
      const from = new THREE.Vector3(g.pos.x, g.pos.y + 1.6 * s, g.pos.z);
      const aim = player.eyePos.clone().add(new THREE.Vector3(0, -0.3, 0));
      const vel = aim.sub(from).normalize().multiplyScalar(17);
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.position.copy(from);
      this.group.add(mesh);
      this.projectiles.push({ mesh, vel, life: 4, damage: g.def.damage });
      this.audio.fireball(this.panFor(g.pos));
      return;
    }
    this.fireRevolver(g, player, rival);
  }

  private muzzleWorld(g: Goblin) {
    const p = new THREE.Vector3();
    if (g.rig.muzzle) g.rig.muzzle.getWorldPosition(p);
    else p.set(g.pos.x, g.pos.y + 1.15 * g.def.scale, g.pos.z);
    return p;
  }

  private fireRevolver(g: Goblin, player: Player, rival: Goblin | null) {
    const from = this.muzzleWorld(g);
    const aim = rival
      ? new THREE.Vector3(rival.pos.x, rival.pos.y + 1.25 * rival.def.scale, rival.pos.z)
      : player.eyePos.clone();
    const dir = aim.sub(from);
    if (dir.lengthSq() < 0.01) return;
    dir.normalize();
    const spread = g.kind === "geezer" ? 0.055 : g.kind === "runner" ? 0.04 : 0.032;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    dir.applyAxisAngle(up, (Math.random() - 0.5) * spread * 2);
    dir.applyAxisAngle(right, (Math.random() - 0.5) * spread * 2);
    dir.normalize();

    const maxDist = 48;
    let stop = maxDist;
    const endGuess = from.clone().addScaledVector(dir, maxDist);
    if (this.collision.lineBlocked(from.x, from.y, from.z, endGuess.x, endGuess.y, endGuess.z)) {
      stop = Math.min(stop, 18);
    }

    const dmg = roll22Damage();
    this.audio.pop22(this.panFor(g.pos), from.distanceTo(this.listener));
    this.fx.muzzle(from, dir, false);

    const hits = this.raycast(from, dir, stop);
    for (const h of hits) {
      if (h.goblin === g || h.goblin.faction === g.faction) continue;
      this.damage(h.goblin, dmg, dir, h.head, false, "rival");
      if (h.goblin.faction === "geezer") this.fx.blood(h.point, dir.clone().negate(), 0.55, h.goblin.pos.y);
      else this.fx.goo(h.point, dir.clone().negate(), 0.45, h.goblin.pos.y);
      this.fx.tracer(from, h.point, false);
      return;
    }

    if (!rival && player.alive) {
      const hitAt = this.playerRayHit(from, dir, stop, player);
      if (hitAt) {
        this.onPlayerHit?.(dmg, from);
        this.fx.tracer(from, hitAt, false);
        return;
      }
    }
    this.fx.tracer(from, from.clone().addScaledVector(dir, Math.min(stop, 28)), false);
  }

  private playerRayHit(from: THREE.Vector3, dir: THREE.Vector3, stop: number, player: Player) {
    const centers = [
      player.eyePos.clone(),
      new THREE.Vector3(player.pos.x, player.pos.y + 1.05, player.pos.z),
    ];
    for (const c of centers) {
      const t = c.clone().sub(from).dot(dir);
      if (t <= 0 || t >= stop) continue;
      const closest = from.clone().addScaledVector(dir, t);
      if (closest.distanceTo(c) < 0.62) return closest;
    }
    return null;
  }

  private updateProjectiles(dt: number, player: Player, _now: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const toPlayer = player.eyePos.sub(p.mesh.position);
      p.vel.addScaledVector(toPlayer.normalize(), dt * 6);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 11;
      this.fx.magic(p.mesh.position, 0xb06bff);
      this.fx.add.emit({ pos: p.mesh.position, spread: 1, speed: [0, 0.5], life: [0.25, 0.45], size: [0.5, 0.05], color: 0xd9a6ff, color2: 0x5a00ff, count: 2 });
      const hitPlayer = p.mesh.position.distanceTo(player.eyePos) < 1.0;
      const ground = this.collision.groundAt(p.mesh.position.x, p.mesh.position.z);
      const hitWorld = p.mesh.position.y < ground || !!this.collision.buildingAt(p.mesh.position.x, p.mesh.position.z);
      if (hitPlayer || hitWorld || p.life <= 0) {
        if (hitPlayer) this.onPlayerHit?.(p.damage, p.mesh.position.clone());
        this.fx.add.emit({ pos: p.mesh.position, spread: 1, speed: [2, 8], life: [0.2, 0.6], size: [0.6, 0.05], color: 0xe0b0ff, color2: 0x6a00ff, count: 30 });
        this.fx.flash(p.mesh.position, 0xa04dff, 30, 0.25, 15);
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private animateLimbs(g: Goblin, dt: number, speed01: number) {
    const r = g.rig;
    g.phase += dt * (4 + speed01 * 6);
    const sw = Math.sin(g.phase) * Math.min(1, speed01) * 0.85;
    r.legL.rotation.x = sw;
    r.legR.rotation.x = -sw;
    r.armL.rotation.x = -sw * 0.8;
    r.body.position.y = Math.abs(Math.cos(g.phase)) * 0.06 * Math.min(1, speed01);
    r.torso.rotation.x = -0.18 * Math.min(1, speed01) - (g.hurtT > 0 ? -0.35 * (g.hurtT / 0.25) : 0);
    r.jaw.rotation.x = 0.15 + Math.sin(g.phase * 1.7) * 0.12;
    r.head.rotation.z = Math.sin(g.phase * 0.5) * 0.08;

    if (g.state === "windup") {
      const k = Math.min(1, g.stateT / g.def.windup);
      r.armR.rotation.x = -1.55 * easeOut(k);
      r.armR.rotation.z = 0.18 * k;
      r.jaw.rotation.x = 0.5;
      r.eyeMat.emissiveIntensity = 4 + k * 8;
    } else if (g.state === "recover") {
      const k = Math.min(1, g.stateT / 0.12);
      r.armR.rotation.x = -1.55 + 0.35 * easeOut(k);
      r.eyeMat.emissiveIntensity = 4;
    } else {
      const hold = -1.05 - Math.min(1, speed01) * 0.15;
      r.armR.rotation.x += (hold - r.armR.rotation.x) * 0.18;
      r.armR.rotation.z *= 0.9;
    }
  }

  private updateDead(g: Goblin, dt: number) {
    g.deadT += dt;
    const r = g.rig;
    const ground = this.collision.terrain.heightAt(g.pos.x, g.pos.z);
    if (g.deadT < 2.5) {
      g.deadVel.y -= 20 * dt;
      g.pos.addScaledVector(g.deadVel, dt);
      if (g.pos.y < ground) {
        g.pos.y = ground;
        g.deadVel.multiplyScalar(0.4);
        g.deadVel.y = Math.abs(g.deadVel.y) * 0.2;
        g.deadSpin.multiplyScalar(0.5);
      }
      const targetX = Math.PI / 2;
      r.root.rotation.x += (targetX - r.root.rotation.x) * Math.min(1, dt * 6);
      r.root.rotation.z += g.deadSpin.z * dt;
      r.legL.rotation.x += (0.3 - r.legL.rotation.x) * dt * 4;
      r.armL.rotation.x += (-2.8 - r.armL.rotation.x) * dt * 4;
      r.armR.rotation.x += (-2.6 - r.armR.rotation.x) * dt * 4;
      r.eyeMat.emissiveIntensity = Math.max(0, 4 - g.deadT * 6);
      if (g.headless && g.deadT < 1.2) {
        const neck = new THREE.Vector3();
        r.torso.getWorldPosition(neck);
        if (g.faction === "geezer") this.fx.blood(neck.add(new THREE.Vector3(0, 0.4 * g.def.scale, 0)), new THREE.Vector3(0, 1, 0), 0.25, ground);
        else this.fx.goo(neck.add(new THREE.Vector3(0, 0.4 * g.def.scale, 0)), new THREE.Vector3(0, 1, 0), 0.25, ground);
      }
    } else if (g.deadT > 4) {
      g.pos.y -= dt * 0.6;
    }
    r.root.position.copy(g.pos).add(new THREE.Vector3(0, 0.25 * g.def.scale, 0));
    if (g.headGib) {
      g.headGibVel.y -= 20 * dt;
      g.headGib.position.addScaledVector(g.headGibVel, dt);
      g.headGib.rotation.x += dt * 9;
      g.headGib.rotation.z += dt * 5;
      const gy = this.collision.terrain.heightAt(g.headGib.position.x, g.headGib.position.z) + 0.2 * g.def.scale;
      if (g.headGib.position.y < gy) {
        g.headGib.position.y = gy;
        if (Math.abs(g.headGibVel.y) > 2) this.fx.gooSplat(g.headGib.position.x, g.headGib.position.z, 0.8);
        g.headGibVel.multiplyScalar(0.45);
        g.headGibVel.y = Math.abs(g.headGibVel.y);
      }
    }
  }

  clear() {
    for (const g of this.goblins) {
      this.group.remove(g.rig.root);
      if (g.headGib) this.group.remove(g.headGib);
    }
    this.goblins.length = 0;
    for (const p of this.projectiles) this.group.remove(p.mesh);
    this.projectiles.length = 0;
  }
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
