import * as THREE from "three";

/** Tiny snub-nose .22 revolver for goblin and geezer hands. */
export function buildLittle22(): { root: THREE.Group; muzzle: THREE.Object3D } {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#6a7076", metalness: 0.9, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1c1e", metalness: 0.85, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: "#3a2416", roughness: 0.7 });

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };

  root.add(mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.07, 10).rotateX(Math.PI / 2), steel, 0, 0.012, -0.08));
  root.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.072, 8).rotateX(Math.PI / 2), dark, 0, 0.012, -0.081));
  root.add(mesh(new THREE.BoxGeometry(0.028, 0.028, 0.05), steel, 0, 0.004, -0.02));
  root.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 12).rotateX(Math.PI / 2), steel, 0, 0.004, -0.028));
  const guard = mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 12, Math.PI), steel, 0, -0.02, -0.008);
  guard.rotation.set(0, Math.PI / 2, Math.PI);
  root.add(guard);
  const grip = mesh(new THREE.BoxGeometry(0.02, 0.055, 0.028), wood, 0, -0.034, 0.018);
  grip.rotation.x = -0.4;
  root.add(grip);
  root.add(mesh(new THREE.BoxGeometry(0.008, 0.016, 0.01), dark, 0, 0.02, 0.012));

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, -0.12);
  root.add(muzzle);
  return { root, muzzle };
}

export function roll22Damage() {
  return 2 + Math.floor(Math.random() * 14);
}
