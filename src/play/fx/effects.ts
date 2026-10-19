import * as THREE from "three";
import { ParticlePool } from "./particles.ts";

interface Tracer { mesh: THREE.Mesh; life: number }
interface Shell { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; bounced: number }
interface Ring { mesh: THREE.Mesh; life: number; max: number; scale: number }
interface FlashLight { light: THREE.PointLight; life: number; max: number; peak: number }

export class Effects {
  readonly group = new THREE.Group();
  readonly add = new ParticlePool(3500, true, 0.0);
  readonly soft = new ParticlePool(3000, false, 0.2);
  private tracers: Tracer[] = [];
  private shells: Shell[] = [];
  private rings: Ring[] = [];
  private decals: THREE.Mesh[] = [];
  private decalCursor = 0;
  private lights: FlashLight[] = [];
  private tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.023, 8);
  private shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.95, roughness: 0.25 });
  private bulletHole: THREE.MeshBasicMaterial;
  private gooMat: THREE.MeshBasicMaterial;
  private bloodMat: THREE.MeshBasicMaterial;
  private scorch: THREE.MeshBasicMaterial;
  onShellLand?: () => void;

  constructor(private groundAt: (x: number, z: number) => number) {
    this.group.add(this.add.points, this.soft.points);
    this.bulletHole = this.decalMat((g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.25, "rgba(10,8,6,0.95)");
      grad.addColorStop(0.45, "rgba(40,32,24,0.6)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    this.gooMat = this.decalMat((g, s) => {
      g.fillStyle = "rgba(70,160,20,0.9)";
      for (let i = 0; i < 14; i++) {
        const r = Math.random() * s * 0.18 + 4;
        const a = Math.random() * Math.PI * 2, d = Math.random() * s * 0.3;
        g.beginPath();
        g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2);
      g.fill();
    });
    this.bloodMat = this.decalMat((g, s) => {
      g.fillStyle = "rgba(120,12,28,0.92)";
      for (let i = 0; i < 16; i++) {
        const r = Math.random() * s * 0.16 + 3;
        const a = Math.random() * Math.PI * 2, d = Math.random() * s * 0.32;
        g.beginPath();
        g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.18, 0, Math.PI * 2);
      g.fill();
    });
    this.scorch = this.decalMat((g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, "rgba(0,0,0,0.95)");
      grad.addColorStop(0.6, "rgba(20,15,10,0.6)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffb25a, 0, 30, 2);
      this.group.add(light);
      this.lights.push({ light, life: 1, max: 1, peak: 0 });
    }
  }

  private decalMat(draw: (g: CanvasRenderingContext2D, s: number) => void) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    draw(c.getContext("2d")!, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
  }

  resize() {
    this.add.resize();
    this.soft.resize();
  }

  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, duration: number, distance = 30) {
    const l = this.lights.reduce((a, b) => (a.life / a.max > b.life / b.max ? a : b));
    l.light.position.copy(pos);
    l.light.color.set(color);
    l.light.distance = distance;
    l.life = 0;
    l.max = duration;
    l.peak = intensity;
  }

  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, big: boolean) {
    this.add.emit({ pos, vel: dir, spread: 0.25, speed: [big ? 9 : 6, big ? 22 : 14], life: [0.03, 0.08], size: [big ? 0.5 : 0.32, 0.05], color: 0xfff0b0, color2: 0xff5a00, count: big ? 26 : 14 });
    this.add.emit({ pos, vel: dir, spread: 1.2, speed: [1, 4], life: [0.03, 0.06], size: [big ? 1.1 : 0.7, 0.2], color: 0xffe6a0, color2: 0xff7a10, count: 3 });
    this.add.emit({ pos, vel: dir, spread: 0.6, speed: [3, 12], life: [0.2, 0.45], size: [0.03, 0.01], color: 0xffd080, color2: 0xff4000, gravity: 9, count: big ? 16 : 6 });
    this.soft.emit({ pos, vel: dir, spread: 0.5, speed: [0.5, 2.5], life: [0.8, 1.8], size: [0.15, big ? 1.4 : 0.8], color: 0xb8b8b8, color2: 0x7a7a7a, alpha: big ? 0.35 : 0.22, drag: 1.5, gravity: -0.6, count: big ? 8 : 4 });
    this.flash(pos, 0xffb25a, big ? 60 : 30, big ? 0.09 : 0.06, big ? 40 : 25);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, big: boolean) {
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    mesh.position.copy(from);
    mesh.lookAt(to);
    mesh.scale.set(big ? 2.2 : 1.3, big ? 2.2 : 1.3, from.distanceTo(to));
    this.group.add(mesh);
    this.tracers.push({ mesh, life: big ? 0.09 : 0.06 });
  }

  impact(pos: THREE.Vector3, normal: THREE.Vector3, surface: "dirt" | "hard" | "glass", big: boolean) {
    const m = big ? 1.8 : 1;
    if (surface === "dirt") {
      this.soft.emit({ pos, vel: normal, spread: 0.7, speed: [1.5 * m, 5 * m], life: [0.5, 1.2], size: [0.2, 0.9 * m], color: 0x7a6a50, color2: 0x544838, alpha: 0.6, gravity: 6, drag: 2, count: Math.round(10 * m) });
      this.soft.emit({ pos, vel: normal, spread: 0.4, speed: [3, 9 * m], life: [0.4, 0.8], size: [0.05, 0.04], color: 0x4a3f2e, gravity: 18, count: Math.round(10 * m) });
    } else {
      this.add.emit({ pos, vel: normal, spread: 0.9, speed: [4, 14 * m], life: [0.15, 0.4], size: [0.05, 0.02], color: 0xfff2c0, color2: 0xff7a00, gravity: 14, count: Math.round(14 * m) });
      this.soft.emit({ pos, vel: normal, spread: 0.6, speed: [0.5, 2], life: [0.6, 1.2], size: [0.2, 0.8 * m], color: 0xc8c4bc, color2: 0x8a8680, alpha: 0.45, drag: 2, count: Math.round(5 * m) });
    }
    this.decal(pos, normal, big ? 0.22 : 0.14, this.bulletHole);
  }

  goo(pos: THREE.Vector3, dir: THREE.Vector3, amount: number, floorY: number) {
    this.soft.emit({ pos, vel: dir, spread: 0.6, speed: [2, 7 * amount], life: [0.4, 1.0], size: [0.12, 0.05], color: 0x7cff2a, color2: 0x2f7a08, gravity: 16, floor: floorY, count: Math.round(22 * amount) });
    this.soft.emit({ pos, vel: dir, spread: 1.2, speed: [0.5, 2], life: [0.3, 0.7], size: [0.25, 1.1 * amount], color: 0x9cff4a, color2: 0x3a8a10, alpha: 0.55, drag: 3, count: Math.round(6 * amount) });
  }

  gooSplat(x: number, z: number, size: number) {
    const y = this.groundAt(x, z);
    this.decal(new THREE.Vector3(x, y + 0.03, z), new THREE.Vector3(0, 1, 0), size, this.gooMat);
  }

  blood(pos: THREE.Vector3, dir: THREE.Vector3, amount: number, floorY: number) {
    this.soft.emit({ pos, vel: dir, spread: 0.6, speed: [2, 7 * amount], life: [0.4, 1.0], size: [0.12, 0.05], color: 0x9a1028, color2: 0x3a050c, gravity: 16, floor: floorY, count: Math.round(22 * amount) });
    this.soft.emit({ pos, vel: dir, spread: 1.2, speed: [0.5, 2], life: [0.3, 0.7], size: [0.25, 1.1 * amount], color: 0x6a0818, color2: 0x1a0206, alpha: 0.55, drag: 3, count: Math.round(6 * amount) });
  }

  bloodSplat(x: number, z: number, size: number) {
    const y = this.groundAt(x, z);
    this.decal(new THREE.Vector3(x, y + 0.03, z), new THREE.Vector3(0, 1, 0), size, this.bloodMat);
  }

  explosion(pos: THREE.Vector3, scale = 1) {
    this.add.emit({ pos, spread: 1, speed: [4 * scale, 16 * scale], life: [0.3, 0.9], size: [2.5 * scale, 5 * scale], color: 0xfff1b8, color2: 0xff3d00, drag: 3, gravity: -2, count: 60, jitter: 1.5 });
    this.add.emit({ pos, spread: 1, speed: [10, 40], life: [0.5, 1.6], size: [0.12, 0.04], color: 0xffd27a, color2: 0xff2000, gravity: 18, count: 90 });
    this.soft.emit({ pos, vel: new THREE.Vector3(0, 1, 0), spread: 0.8, speed: [2, 8], life: [2.5, 5], size: [2 * scale, 9 * scale], color: 0x3a3430, color2: 0x15120f, alpha: 0.7, drag: 0.8, gravity: -1.8, count: 45, jitter: 2 });
    this.soft.emit({ pos, spread: 1, speed: [6, 18], life: [0.8, 1.8], size: [0.25, 0.18], color: 0x1a1a1a, gravity: 18, count: 40 });
    this.flash(pos, 0xff8a2a, 400 * scale, 0.6, 70);
    this.ring(pos, 14 * scale, 0.6, 0xffb060);
    this.decal(new THREE.Vector3(pos.x, this.groundAt(pos.x, pos.z) + 0.04, pos.z), new THREE.Vector3(0, 1, 0), 7 * scale, this.scorch);
  }

  spawnBurst(pos: THREE.Vector3) {
    this.soft.emit({ pos, vel: new THREE.Vector3(0, 1, 0), spread: 0.7, speed: [3, 9], life: [0.6, 1.3], size: [0.3, 1.4], color: 0x6b5a40, color2: 0x3a3020, alpha: 0.75, gravity: 10, drag: 1, count: 26, jitter: 1 });
    this.add.emit({ pos, vel: new THREE.Vector3(0, 1, 0), spread: 0.3, speed: [2, 6], life: [0.4, 0.9], size: [0.5, 0.05], color: 0xb6ff1f, color2: 0x00ff6a, count: 18, jitter: 1 });
    this.ring(pos, 4, 0.5, 0x9dff3a);
  }

  magic(pos: THREE.Vector3, color: THREE.ColorRepresentation = 0x9dff3a) {
    this.add.emit({ pos, spread: 1, speed: [0.2, 1.2], life: [0.2, 0.5], size: [0.7, 0.1], color, color2: 0x6a00ff, count: 3, jitter: 0.25 });
  }

  pickupGlow(pos: THREE.Vector3, color: THREE.ColorRepresentation) {
    this.add.emit({ pos, vel: new THREE.Vector3(0, 1, 0), spread: 0.4, speed: [0.5, 1.5], life: [0.5, 1], size: [0.18, 0.02], color, count: 1, jitter: 0.6 });
  }

  ring(pos: THREE.Vector3, radius: number, duration: number, color: THREE.ColorRepresentation) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(pos);
    mesh.position.y = this.groundAt(pos.x, pos.z) + 0.2;
    this.group.add(mesh);
    this.rings.push({ mesh, life: 0, max: duration, scale: radius });
  }

  ejectShell(pos: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) {
    let s = this.shells.find((x) => x.life <= 0);
    if (!s) {
      if (this.shells.length >= 40) s = this.shells.shift()!;
      else s = { mesh: new THREE.Mesh(this.shellGeo, this.shellMat), vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, bounced: 0 };
      this.shells.push(s);
      this.group.add(s.mesh);
    }
    s.mesh.position.copy(pos);
    s.mesh.scale.setScalar(2.4);
    s.vel.copy(right).multiplyScalar(2.6 + Math.random()).addScaledVector(up, 2.2 + Math.random());
    s.spin.set(Math.random() * 30, Math.random() * 30, Math.random() * 30);
    s.life = 3;
    s.bounced = 0;
    s.mesh.visible = true;
  }

  private decal(pos: THREE.Vector3, normal: THREE.Vector3, size: number, mat: THREE.Material) {
    let d = this.decals[this.decalCursor];
    if (!d) {
      d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      d.renderOrder = 1;
      this.decals.push(d);
      this.group.add(d);
    }
    d.material = mat;
    this.decalCursor = (this.decalCursor + 1) % 260;
    d.position.copy(pos).addScaledVector(normal, 0.02);
    d.lookAt(pos.clone().add(normal));
    d.rotateZ(Math.random() * Math.PI * 2);
    d.scale.setScalar(size * (0.85 + Math.random() * 0.3));
  }

  update(dt: number) {
    this.add.update(dt);
    this.soft.update(dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life * 14);
      if (t.life <= 0) {
        this.group.remove(t.mesh);
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (const s of this.shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 14 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      const g = this.groundAt(s.mesh.position.x, s.mesh.position.z) + 0.02;
      if (s.mesh.position.y < g) {
        s.mesh.position.y = g;
        if (s.bounced < 2 && s.vel.y < -1) {
          s.vel.y *= -0.35;
          s.vel.x *= 0.5;
          s.vel.z *= 0.5;
          s.spin.multiplyScalar(0.5);
          s.bounced++;
          this.onShellLand?.();
        } else {
          s.vel.set(0, 0, 0);
          s.spin.set(0, 0, 0);
        }
      }
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const t = r.life / r.max;
      r.mesh.scale.setScalar(1 + t * r.scale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
    for (const l of this.lights) {
      if (l.life >= l.max) {
        l.light.intensity = 0;
        continue;
      }
      l.life += dt;
      l.light.intensity = l.peak * Math.max(0, 1 - l.life / l.max);
    }
  }
}
