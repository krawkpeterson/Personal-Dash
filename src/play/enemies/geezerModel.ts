import * as THREE from "three";
import { buildLittle22 } from "../weapons/little22.ts";
import type { GoblinRig } from "./goblinModel.ts";

const G = {
  torso: new THREE.CapsuleGeometry(0.2, 0.42, 4, 10),
  belly: new THREE.SphereGeometry(0.22, 12, 10),
  head: new THREE.SphereGeometry(0.22, 16, 12),
  nose: new THREE.SphereGeometry(0.05, 8, 6),
  eye: new THREE.SphereGeometry(0.038, 10, 8),
  makeup: new THREE.SphereGeometry(0.07, 10, 8),
  brow: new THREE.BoxGeometry(0.14, 0.03, 0.04),
  jaw: new THREE.BoxGeometry(0.26, 0.07, 0.16),
  arm: new THREE.CapsuleGeometry(0.055, 0.28, 3, 8),
  hand: new THREE.SphereGeometry(0.06, 8, 6),
  leg: new THREE.CapsuleGeometry(0.07, 0.38, 3, 8),
  foot: new THREE.BoxGeometry(0.12, 0.06, 0.22),
  hoodie: new THREE.ConeGeometry(0.34, 0.7, 10, 1, true),
  bang: new THREE.BoxGeometry(0.12, 0.22, 0.08),
};

function m(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Hunched old man in a black hoodie, drowning in emo makeup, packing a .22. */
export function buildGeezer(): GoblinRig {
  const skinMat = new THREE.MeshStandardMaterial({ color: "#c9b8a8", roughness: 0.78 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#1a1020", emissive: "#5a1a6a", emissiveIntensity: 1.6 });
  const makeup = new THREE.MeshStandardMaterial({ color: "#09090c", roughness: 0.55 });
  const lipstick = new THREE.MeshStandardMaterial({ color: "#14040a", roughness: 0.35 });
  const hair = new THREE.MeshStandardMaterial({ color: "#0a0a0c", roughness: 0.85 });
  const gray = new THREE.MeshStandardMaterial({ color: "#c8c4bc", roughness: 0.9 });
  const hoodie = new THREE.MeshStandardMaterial({ color: "#121216", roughness: 0.95, side: THREE.DoubleSide });
  const jeans = new THREE.MeshStandardMaterial({ color: "#1a1a22", roughness: 0.92 });
  const wrinkle = new THREE.MeshStandardMaterial({ color: "#a89888", roughness: 0.9 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  torso.rotation.x = 0.18;
  body.add(torso);
  torso.add(m(G.torso, hoodie, 0, 0.12, 0));
  const belly = m(G.belly, hoodie, 0, -0.02, 0.04);
  belly.scale.set(1.15, 0.85, 1.05);
  torso.add(belly);
  const robe = m(G.hoodie, hoodie, 0, -0.18, 0.02);
  robe.rotation.x = Math.PI;
  torso.add(robe);

  const head = new THREE.Group();
  head.position.set(0, 0.52, -0.02);
  torso.add(head);
  const skull = m(G.head, skinMat);
  skull.scale.set(0.95, 1.05, 0.95);
  head.add(skull);

  const bagsL = m(G.makeup, makeup, -0.08, 0.02, -0.175);
  bagsL.scale.set(1.35, 1.1, 0.55);
  const bagsR = m(G.makeup, makeup, 0.08, 0.02, -0.175);
  bagsR.scale.set(1.35, 1.1, 0.55);
  head.add(bagsL, bagsR);
  const tearL = m(new THREE.BoxGeometry(0.025, 0.12, 0.02), makeup, -0.08, -0.08, -0.185);
  tearL.rotation.z = 0.15;
  const tearR = m(new THREE.BoxGeometry(0.02, 0.1, 0.02), makeup, 0.09, -0.07, -0.185);
  tearR.rotation.z = -0.2;
  head.add(tearL, tearR);

  head.add(m(G.eye, eyeMat, -0.08, 0.04, -0.19), m(G.eye, eyeMat, 0.08, 0.04, -0.19));
  const browL = m(G.brow, makeup, -0.08, 0.12, -0.18);
  browL.rotation.z = 0.45;
  const browR = m(G.brow, makeup, 0.08, 0.12, -0.18);
  browR.rotation.z = -0.45;
  head.add(browL, browR);

  const nose = m(G.nose, skinMat, 0, -0.02, -0.22);
  nose.scale.set(1.1, 1.4, 1.2);
  head.add(nose);
  head.add(m(new THREE.BoxGeometry(0.12, 0.012, 0.04), wrinkle, 0, 0.16, -0.16));
  head.add(m(new THREE.BoxGeometry(0.1, 0.01, 0.03), wrinkle, 0.02, -0.04, -0.2));

  const jaw = new THREE.Group();
  jaw.position.set(0, -0.14, -0.04);
  jaw.add(m(G.jaw, skinMat, 0, 0, -0.04));
  jaw.add(m(new THREE.BoxGeometry(0.16, 0.035, 0.08), lipstick, 0, 0.02, -0.1));
  head.add(jaw);

  const bangs = new THREE.Group();
  bangs.position.set(-0.04, 0.16, -0.16);
  for (let i = 0; i < 7; i++) {
    const strand = m(G.bang, hair, (i - 3) * 0.035, -0.02 - (i % 3) * 0.04, -0.01);
    strand.scale.set(0.55, 1.1 + (i % 2) * 0.35, 0.45);
    strand.rotation.set(0.35, 0, (i - 3) * 0.12);
    bangs.add(strand);
  }
  head.add(bangs);
  const mop = m(new THREE.SphereGeometry(0.2, 10, 8), hair, 0.04, 0.12, 0.04);
  mop.scale.set(1.05, 0.7, 1.1);
  head.add(mop);
  head.add(m(new THREE.BoxGeometry(0.08, 0.14, 0.06), gray, -0.2, -0.02, 0.02));
  head.add(m(new THREE.BoxGeometry(0.08, 0.12, 0.06), gray, 0.2, -0.02, 0.02));

  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 0.28, 0.04);
    shoulder.add(m(G.arm, hoodie, 0, -0.2, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.38;
    elbow.rotation.x = -0.45;
    elbow.add(m(G.arm, hoodie, 0, -0.16, 0));
    elbow.add(m(G.hand, skinMat, 0, -0.34, 0));
    shoulder.add(elbow);
    shoulder.userData.hand = elbow;
    return shoulder;
  };
  const armL = arm(-1), armR = arm(1);
  torso.add(armL, armR);

  const gun = buildLittle22();
  gun.root.scale.setScalar(1.15);
  gun.root.position.set(0.02, -0.38, -0.04);
  gun.root.rotation.set(Math.PI / 2, 0, 0.15);
  (armR.userData.hand as THREE.Group).add(gun.root);

  const leg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.78, 0);
    hip.add(m(G.leg, jeans, 0, -0.32, 0));
    hip.add(m(G.foot, darkShoe(), 0, -0.58, -0.04));
    return hip;
  };
  const legL = leg(-1), legR = leg(1);
  body.add(legL, legR);

  return { root, body, torso, head, armL, armR, legL, legR, jaw, eyeMat, skinMat, muzzle: gun.muzzle };
}

function darkShoe() {
  return new THREE.MeshStandardMaterial({ color: "#0c0c10", roughness: 0.8 });
}
