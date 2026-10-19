import type { WorldData } from "../../../shared/types.ts";
import { renderTacMap } from "./tacmap.ts";

const $ = <T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string) => root.querySelector(sel) as T;

export class Hud {
  readonly el: HTMLDivElement;
  private mapImage: HTMLCanvasElement;
  private mini: HTMLCanvasElement;
  private lastBoomAt = 0;
  private feedCount = 0;

  constructor(parent: HTMLElement, private readonly world: WorldData) {
    this.el = document.createElement("div");
    this.el.className = "hud";
    this.el.innerHTML = `
      <div class="crosshair"><i class="ch-t"></i><i class="ch-b"></i><i class="ch-l"></i><i class="ch-r"></i><i class="ch-dot"></i></div>
      <div class="hitmarker"></div>
      <div class="hud-top">
        <div class="hud-chip wave"><small>WAVE</small><b class="wave-n">1</b><small class="wave-t">/ 6</small></div>
        <div class="hud-chip score"><b class="score-n">0</b><span class="combo">x1</span></div>
        <div class="hud-chip enemies"><b class="enemy-n">0</b><small>GOBLINS</small></div>
      </div>
      <div class="boss-bar"><b></b><div><i></i></div></div>
      <canvas class="minimap" width="420" height="420"></canvas>
      <div class="minimap-label"></div>
      <div class="killfeed"></div>
      <div class="hud-health">
        <div class="hp-label"><span>VITALS</span><span class="hp-cond">COMBAT READY</span></div>
        <div class="hp-bar"><i></i></div>
        <b class="hp-num">100</b>
      </div>
      <div class="hud-ammo">
        <div class="weapon-name"></div>
        <div class="weapon-sub"></div>
        <div class="ammo"><b class="mag">14</b><span class="reserve">/ ∞</span></div>
        <div class="rounds"></div>
        <div class="reload-ring"><i></i></div>
        <div class="reload-hint">PRESS R TO RELOAD</div>
      </div>
      <div class="announce"></div>
      <div class="boom-layer"></div>
      <div class="damage-vignette"></div>
      <div class="dmg-indicators"></div>
      <div class="sarge"><div class="sarge-avatar">SGT</div><div class="sarge-body"><b>SGT. GRIMSBY · DRILL INSTRUCTOR</b><p></p></div><div class="shame"><small>SHAME</small><b>0%</b></div></div>
      <div class="objective"><small>OBJECTIVE</small><span></span></div>
      <div class="interstitial"><h2></h2><p></p><div class="count"></div></div>
    `;
    parent.appendChild(this.el);
    this.mini = $<HTMLCanvasElement>(this.el, ".minimap");
    this.mapImage = renderTacMap(world, 768, "mini");
    $(this.el, ".minimap-label").textContent = `${world.place.name.toUpperCase()}, ${world.place.stateAbbr} · ${world.place.zip}`;
  }

  show(v: boolean) {
    this.el.classList.toggle("hidden", !v);
  }

  setAmmo(name: string, sub: string, mag: number, magSize: number, reserve: number, revolver: boolean, reloadProgress: number) {
    $(this.el, ".weapon-name").textContent = name;
    $(this.el, ".weapon-sub").textContent = sub;
    const magEl = $(this.el, ".mag");
    magEl.textContent = String(mag);
    magEl.classList.toggle("empty", mag === 0);
    $(this.el, ".reserve").textContent = `/ ${Number.isFinite(reserve) ? reserve : "∞"}`;
    const rounds = $(this.el, ".rounds");
    rounds.classList.toggle("big", revolver);
    if (rounds.childElementCount !== magSize) rounds.innerHTML = "<i></i>".repeat(magSize);
    [...rounds.children].forEach((c, i) => c.classList.toggle("spent", i >= mag));
    $(this.el, ".reload-hint").classList.toggle("on", mag === 0 && reloadProgress === 0);
    const ring = $(this.el, ".reload-ring");
    ring.classList.toggle("on", reloadProgress > 0);
    ($(ring, "i") as HTMLElement).style.width = `${reloadProgress * 100}%`;
  }

  setHealth(hp: number, max: number) {
    const f = hp / max;
    ($(this.el, ".hp-bar i") as HTMLElement).style.width = `${f * 100}%`;
    $(this.el, ".hp-bar").classList.toggle("low", f < 0.3);
    $(this.el, ".hp-num").textContent = String(Math.ceil(hp));
    $(this.el, ".hp-cond").textContent = f > 0.7 ? "COMBAT READY" : f > 0.3 ? "WOUNDED" : "CRITICAL";
    ($(this.el, ".damage-vignette") as HTMLElement).style.opacity = String(Math.max(0, (0.55 - f) * 1.6));
  }

  setWave(n: number, total: number) {
    $(this.el, ".wave-n").textContent = String(n);
    $(this.el, ".wave-t").textContent = `/ ${total}`;
  }

  setEnemies(n: number) {
    $(this.el, ".enemy-n").textContent = String(n);
  }

  setScore(score: number, combo: number) {
    $(this.el, ".score-n").textContent = score.toLocaleString();
    const c = $(this.el, ".combo");
    const txt = `x${combo}`;
    if (c.textContent !== txt) {
      c.textContent = txt;
      c.classList.remove("big");
      void c.offsetWidth;
      c.classList.add("big");
    }
  }

  setSpread(px: number, ads: boolean) {
    const ch = $(this.el, ".crosshair");
    ch.style.setProperty("--spread", `${px.toFixed(1)}px`);
    ch.classList.toggle("ads", ads);
  }

  hitmarker(kind: "hit" | "head" | "kill") {
    const h = $(this.el, ".hitmarker");
    h.className = "hitmarker";
    void h.offsetWidth;
    h.classList.add("show", kind);
  }

  killfeed(html: string, headshot: boolean) {
    const feed = $(this.el, ".killfeed");
    const d = document.createElement("div");
    if (headshot) d.className = "hs";
    d.innerHTML = html;
    feed.prepend(d);
    this.feedCount++;
    setTimeout(() => d.classList.add("out"), 3600);
    setTimeout(() => d.remove(), 4000);
    while (feed.childElementCount > 6) feed.lastElementChild?.remove();
  }

  announce(text: string, sub = "", cls = "") {
    const a = $(this.el, ".announce");
    a.innerHTML = "";
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
    a.appendChild(d);
  }

  /** Comic-book onomatopoeia burst for every Magnum shot. */
  boom(big: boolean) {
    const now = performance.now();
    if (!big && now - this.lastBoomAt < 600) return;
    this.lastBoomAt = now;
    const layer = $(this.el, ".boom-layer");
    const b = document.createElement("div");
    b.className = "boom";
    const words = big
      ? ["BOPOOOOOOM!!!", "BOPOOOOOOOM!!", "KA-BOPOOOOM!!!", "BOPOOOOOOOOM!!!!"]
      : ["BOPOOM!", "BOOM!", "BOP!"];
    b.textContent = words[Math.floor(Math.random() * words.length)];
    b.style.left = `${50 + (Math.random() - 0.3) * 30}%`;
    b.style.top = `${48 + (Math.random() - 0.5) * 24}%`;
    b.style.fontSize = `${big ? 92 + Math.random() * 40 : 48 + Math.random() * 16}px`;
    b.style.setProperty("--r", `${(Math.random() - 0.5) * 24}deg`);
    layer.appendChild(b);
    setTimeout(() => b.remove(), 950);
  }

  damageFrom(angle: number) {
    const host = $(this.el, ".dmg-indicators");
    const i = document.createElement("i");
    i.style.transform = `rotate(${angle}rad)`;
    host.appendChild(i);
    setTimeout(() => i.remove(), 1200);
  }

  objective(text: string | null) {
    const o = $(this.el, ".objective");
    o.classList.toggle("on", !!text);
    if (text) $(o, "span").textContent = text;
  }

  sarge(text: string | null, shame = 0) {
    const s = $(this.el, ".sarge");
    s.classList.toggle("on", !!text);
    if (!text) return;
    $(s, "p").textContent = text;
    $(s, ".shame b").textContent = `${Math.round(shame)}%`;
    s.classList.remove("yell");
    void s.offsetWidth;
    s.classList.add("yell");
  }

  interstitial(title: string | null, sub = "", count = "") {
    const el = $(this.el, ".interstitial");
    el.classList.toggle("on", !!title);
    if (!title) return;
    $(el, "h2").textContent = title;
    $(el, "p").textContent = sub;
    $(el, ".count").textContent = count;
  }

  bossBar(name: string | null, frac = 1) {
    const el = $(this.el, ".boss-bar");
    el.classList.toggle("on", !!name);
    if (!name) return;
    $(el, "b").textContent = name;
    ($(el, "i") as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`;
  }

  drawMinimap(px: number, pz: number, yaw: number, goblins: { x: number; z: number; boss: boolean; geezer?: boolean }[], pickups: { x: number; z: number }[]) {
    const g = this.mini.getContext("2d")!;
    const W = this.mini.width;
    const size = this.world.sizeMeters;
    const range = 120;
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#0b1012";
    g.fillRect(0, 0, W, W);
    g.translate(W / 2, W / 2);
    g.rotate(yaw);
    const k = W / (range * 2);
    g.scale(k, k);
    const half = size / 2;
    g.drawImage(this.mapImage, -(px + half), -(pz + half), size, size);
    for (const p of pickups) {
      g.fillStyle = "#ffb22e";
      g.beginPath();
      g.arc(p.x - px, p.z - pz, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    for (const e of goblins) {
      const dx = e.x - px, dz = e.z - pz;
      const d = Math.hypot(dx, dz);
      const cl = d > range * 0.95 ? (range * 0.95) / d : 1;
      g.fillStyle = e.boss ? "#ff7a00" : e.geezer ? "#c45cff" : "#ff2d55";
      g.shadowColor = g.fillStyle;
      g.shadowBlur = 8;
      g.beginPath();
      g.arc(dx * cl, dz * cl, e.boss ? 6 : 3.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.shadowBlur = 0;
    g.fillStyle = "#b6ff1f";
    g.beginPath();
    g.moveTo(W / 2, W / 2 - 14);
    g.lineTo(W / 2 + 10, W / 2 + 10);
    g.lineTo(W / 2, W / 2 + 4);
    g.lineTo(W / 2 - 10, W / 2 + 10);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(182,255,31,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.font = "bold 22px JetBrains Mono";
    g.textAlign = "center";
    const nx = W / 2 + Math.sin(yaw) * (W / 2 - 22), ny = W / 2 - Math.cos(yaw) * (W / 2 - 22);
    g.fillText("N", nx, ny + 8);
  }

  destroy() {
    this.el.remove();
  }
}
