import * as THREE from "three";
import { buildGoblin, type GoblinRig, type HostileKind } from "../play/enemies/goblinModel.ts";
import { buildGeezer } from "../play/enemies/geezerModel.ts";
import { HOSTILES } from "../play/enemies/goblins.ts";

const ORDER: HostileKind[] = ["runner", "grunt", "geezer", "shaman", "brute", "king"];

/** Turntable lineup of the real in-game goblin rigs for the bestiary section. */
export class GoblinLineup {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private rigs: { kind: HostileKind; rig: GoblinRig; x: number; phase: number }[] = [];
  private focus: HostileKind | null = null;
  private raf = 0;
  private visible = false;
  private t0 = performance.now();
  private mouseX = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a2410, 1.1));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.6);
    key.position.set(4, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -2 });
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb6ff1f, 2.2);
    rim.position.set(-6, 4, -8);
    this.scene.add(rim);
    const ember = new THREE.PointLight(0xff6a00, 30, 18, 2);
    ember.position.set(9, 2, 3);
    this.scene.add(ember);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.55 }));
    floor.receiveShadow = true;
    this.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11.4, 11.5, 128).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xb6ff1f, transparent: true, opacity: 0.25 }),
    );
    ring.position.y = 0.01;
    this.scene.add(ring);

    const xs = [-9.4, -6.0, -2.8, 0.4, 3.6, 8.6];
    ORDER.forEach((kind, i) => {
      const rig = kind === "geezer" ? buildGeezer() : buildGoblin(kind);
      const s = HOSTILES[kind].scale;
      rig.root.scale.setScalar(s);
      rig.root.position.set(xs[i], 0, kind === "king" ? -2.5 : 0);
      rig.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      this.scene.add(rig.root);
      this.rigs.push({ kind, rig, x: xs[i], phase: i * 1.3 });
    });

    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.raf) this.raf = requestAnimationFrame(this.frame);
    }).observe(canvas);
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    });
    addEventListener("resize", () => this.resize());
    this.resize();
  }

  setFocus(kind: HostileKind | null) {
    this.focus = kind;
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.6 ? 46 : 32;
    this.camera.updateProjectionMatrix();
  }

  private frame = () => {
    if (!this.visible) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
    const t = (performance.now() - this.t0) / 1000;
    this.camera.position.set(this.mouseX * 1.5, 3.6, 17);
    this.camera.lookAt(0.6, 2.1, 0);

    for (const { kind, rig, phase } of this.rigs) {
      const focused = this.focus === kind;
      const k = t * (kind === "runner" ? 2.4 : kind === "king" ? 0.9 : 1.4) + phase;
      const toCamX = this.camera.position.x - rig.root.position.x, toCamZ = this.camera.position.z - rig.root.position.z;
      const targetYaw = focused ? Math.atan2(-toCamX, -toCamZ) : Math.PI + Math.sin(t * 0.35 + phase) * 0.6;
      rig.root.rotation.y += (targetYaw - rig.root.rotation.y) * 0.08;
      rig.body.position.y = Math.abs(Math.sin(k)) * 0.05;
      rig.torso.rotation.x = 0.12 + Math.sin(k) * 0.05;
      rig.head.rotation.z = Math.sin(k * 0.5) * 0.12;
      rig.armL.rotation.x = -0.4 + Math.sin(k) * 0.35 - (focused ? 1.2 : 0);
      rig.armR.rotation.x = -0.4 - Math.sin(k) * 0.35 - (focused ? 1.4 : 0);
      rig.jaw.rotation.x = focused ? 0.35 + Math.sin(t * 18) * 0.15 : Math.max(0, Math.sin(k * 0.7)) * 0.2;
      rig.eyeMat.emissiveIntensity = focused ? 8 + Math.sin(t * 20) * 2 : 3.5;
    }
    this.renderer.render(this.scene, this.camera);
  };
}
