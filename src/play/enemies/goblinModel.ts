import * as THREE from "three";
import { buildLittle22 } from "../weapons/little22.ts";

export type GoblinKind = "grunt" | "runner" | "brute" | "shaman" | "king";
export type HostileKind = GoblinKind | "geezer";
export type Faction = "goblin" | "geezer";

export interface GoblinRig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  jaw: THREE.Object3D;
  eyeMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  muzzle?: THREE.Object3D;
}

const G = {
  torso: new THREE.CapsuleGeometry(0.24, 0.32, 4, 10),
  belly: new THREE.SphereGeometry(0.26, 12, 10),
  head: new THREE.SphereGeometry(0.25, 16, 12),
  ear: new THREE.ConeGeometry(0.08, 0.42, 6),
  nose: new THREE.ConeGeometry(0.06, 0.24, 6),
  eye: new THREE.SphereGeometry(0.048, 10, 8),
  brow: new THREE.BoxGeometry(0.16, 0.035, 0.06),
  jaw: new THREE.BoxGeometry(0.3, 0.08, 0.2),
  tooth: new THREE.ConeGeometry(0.018, 0.07, 4),
  upperArm: new THREE.CapsuleGeometry(0.065, 0.24, 3, 8),
  foreArm: new THREE.CapsuleGeometry(0.06, 0.22, 3, 8),
  hand: new THREE.SphereGeometry(0.075, 8, 6),
  leg: new THREE.CapsuleGeometry(0.08, 0.26, 3, 8),
  foot: new THREE.BoxGeometry(0.14, 0.07, 0.24),
  loin: new THREE.CylinderGeometry(0.27, 0.32, 0.18, 10),
  club: new THREE.CylinderGeometry(0.05, 0.11, 0.7, 7),
  spike: new THREE.ConeGeometry(0.025, 0.08, 4),
  dagger: new THREE.BoxGeometry(0.035, 0.36, 0.012),
  staff: new THREE.CylinderGeometry(0.022, 0.03, 1.5, 6),
  orb: new THREE.IcosahedronGeometry(0.1, 1),
  plate: new THREE.BoxGeometry(0.5, 0.36, 0.1),
  shoulder: new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  crown: new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8, 1, true),
  crownSpike: new THREE.ConeGeometry(0.04, 0.14, 4),
  robe: new THREE.ConeGeometry(0.36, 0.8, 10, 1, true),
};

const M = {
  cloth: new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: "#4a2f1a", roughness: 0.95 }),
  bone: new THREE.MeshStandardMaterial({ color: "#e8dcc0", roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: "#8a8f94", metalness: 0.85, roughness: 0.35 }),
  rust: new THREE.MeshStandardMaterial({ color: "#6b5a4a", metalness: 0.6, roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: "#e0b030", metalness: 1, roughness: 0.25, emissive: "#3a2400" }),
  robe: new THREE.MeshStandardMaterial({ color: "#3b1f5c", roughness: 0.9, side: THREE.DoubleSide }),
  mouth: new THREE.MeshStandardMaterial({ color: "#2a0a08", roughness: 1 }),
};

const SKIN: Record<GoblinKind, string> = { grunt: "#6fa83a", runner: "#a4c63e", brute: "#4f7d2d", shaman: "#86b25e", king: "#3f6b22" };
const EYES: Record<GoblinKind, string> = { grunt: "#ff3b1f", runner: "#ffd21f", brute: "#ff1f4a", shaman: "#c45cff", king: "#ff7a00" };

function m(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Goblin rig facing -z, feet at y=0, about 1.35 m tall at scale 1. */
export function buildGoblin(kind: GoblinKind): GoblinRig {
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN[kind], roughness: 0.62, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#000", emissive: EYES[kind], emissiveIntensity: 4 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Group();
  torso.position.y = 0.62;
  body.add(torso);
  torso.add(m(G.torso, skinMat, 0, 0.2, 0));
  const belly = m(G.belly, skinMat, 0, 0.08, -0.06);
  belly.scale.set(1, 0.9, 0.95);
  torso.add(belly);
  torso.add(m(G.loin, kind === "shaman" ? M.robe : M.cloth, 0, -0.06, 0));

  const head = new THREE.Group();
  head.position.set(0, 0.56, -0.04);
  torso.add(head);
  const skull = m(G.head, skinMat);
  skull.scale.set(1.05, 0.95, 1);
  head.add(skull);
  const earL = m(G.ear, skinMat, -0.26, 0.05, 0.02);
  earL.rotation.set(0.2, 0, Math.PI / 2 + 0.35);
  const earR = m(G.ear, skinMat, 0.26, 0.05, 0.02);
  earR.rotation.set(0.2, 0, -Math.PI / 2 - 0.35);
  head.add(earL, earR);
  const nose = m(G.nose, skinMat, 0, -0.02, -0.27);
  nose.rotation.x = -Math.PI / 2 - 0.25;
  head.add(nose);
  head.add(m(G.eye, eyeMat, -0.09, 0.04, -0.21), m(G.eye, eyeMat, 0.09, 0.04, -0.21));
  const browL = m(G.brow, skinMat, -0.09, 0.1, -0.2);
  browL.rotation.z = -0.4;
  const browR = m(G.brow, skinMat, 0.09, 0.1, -0.2);
  browR.rotation.z = 0.4;
  head.add(browL, browR);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.13, -0.08);
  jaw.add(m(G.jaw, skinMat, 0, 0, -0.04));
  jaw.add(m(new THREE.BoxGeometry(0.22, 0.04, 0.12), M.mouth, 0, 0.04, -0.07));
  for (const x of [-0.09, 0.09]) {
    const tusk = m(G.tooth, M.bone, x, 0.08, -0.13);
    tusk.scale.setScalar(kind === "brute" || kind === "king" ? 1.8 : 1.1);
    jaw.add(tusk);
  }
  head.add(jaw);

  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 0.36, 0);
    const upper = m(G.upperArm, skinMat, 0, -0.17, 0);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    elbow.rotation.x = -0.5;
    elbow.add(m(G.foreArm, skinMat, 0, -0.15, 0));
    elbow.add(m(G.hand, skinMat, 0, -0.32, 0));
    shoulder.add(elbow);
    shoulder.userData.hand = elbow;
    return shoulder;
  };
  const armL = arm(-1), armR = arm(1);
  torso.add(armL, armR);

  const handR = armR.userData.hand as THREE.Group;
  const handL = armL.userData.hand as THREE.Group;
  const gun = buildLittle22();
  gun.root.scale.setScalar(kind === "brute" || kind === "king" ? 1.35 : 1.05);
  gun.root.position.set(0.02, -0.4, -0.03);
  gun.root.rotation.set(Math.PI / 2, 0, 0.12);
  if (kind === "shaman") {
    const staff = m(G.staff, M.wood, 0, -0.32, -0.02);
    handL.add(staff);
    const orb = m(G.orb, new THREE.MeshStandardMaterial({ color: "#000", emissive: "#a94dff", emissiveIntensity: 5 }), 0, 0.42, -0.02);
    handL.add(orb);
    root.userData.orb = orb;
    const robe = m(G.robe, M.robe, 0, -0.28, 0);
    torso.add(robe);
    handR.add(gun.root);
  } else {
    if (kind === "king") {
      const club = new THREE.Group();
      club.position.set(0, -0.36, -0.02);
      club.rotation.x = -1.2;
      club.add(m(G.club, M.wood, 0, -0.3, 0));
      for (let i = 0; i < 6; i++) {
        const s = m(G.spike, M.gold, Math.cos(i) * 0.09, -0.48 - (i % 3) * 0.07, Math.sin(i) * 0.09);
        s.rotation.z = Math.cos(i) * -1.4;
        s.rotation.x = Math.sin(i) * 1.4;
        club.add(s);
      }
      handL.add(club);
    }
    handR.add(gun.root);
  }

  if (kind === "brute" || kind === "king") {
    torso.add(m(G.plate, kind === "king" ? M.gold : M.rust, 0, 0.22, -0.2));
    const sL = m(G.shoulder, kind === "king" ? M.gold : M.rust, -0.32, 0.4, 0);
    const sR = m(G.shoulder, kind === "king" ? M.gold : M.rust, 0.32, 0.4, 0);
    torso.add(sL, sR);
  }
  if (kind === "king") {
    const crown = new THREE.Group();
    crown.position.y = 0.22;
    crown.add(m(G.crown, M.gold));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      crown.add(m(G.crownSpike, M.gold, Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2));
    }
    head.add(crown);
  }

  const leg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.56, 0);
    hip.add(m(G.leg, skinMat, 0, -0.24, 0));
    hip.add(m(G.foot, skinMat, 0, -0.52, -0.05));
    return hip;
  };
  const legL = leg(-1), legR = leg(1);
  body.add(legL, legR);

  return { root, body, torso, head, armL, armR, legL, legR, jaw, eyeMat, skinMat, muzzle: gun.muzzle };
}
