import "./landing.css";
import type { HostileKind } from "../play/enemies/goblinModel.ts";
import { AudioEngine, type GunKind } from "../play/audio/audio.ts";
import { fetchHealth, fetchLeaderboard, lookupZip } from "../play/net/api.ts";
import { ContourFlyover } from "../play/ui/menuBackground.ts";
import { escapeHtml } from "../play/ui/menu.ts";
import { GoblinLineup } from "./lineup.ts";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

let audio: AudioEngine | null = null;
const sfx = () => {
  audio ??= new AudioEngine();
  audio.unlock();
  return audio;
};

function lazyFlyover(canvas: HTMLCanvasElement, accent?: string) {
  let fly: ContourFlyover | null = null;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) fly ??= new ContourFlyover(canvas, accent);
    if (fly) fly.paused = !e.isIntersecting;
  }).observe(canvas);
}
lazyFlyover($<HTMLCanvasElement>(".hero-bg"));
lazyFlyover($<HTMLCanvasElement>(".final-bg"), "#ffb22e");

const nav = $(".nav");
const hero = $(".hero");
const pipeline = $(".pipeline");
const boom = $(".boom");
const steps = $$(".pipeline-steps li");
const onScroll = () => {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty("--scroll", String(max > 0 ? y / max : 0));
  nav.classList.toggle("solid", y > 40);
  hero.style.setProperty("--hero-p", String(Math.min(1, y / (innerHeight * 0.7))));

  const pr = pipeline.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -pr.top / Math.max(1, pr.height - innerHeight)));
  pipeline.style.setProperty("--pipe", p.toFixed(3));
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999));
  steps.forEach((s, i) => s.classList.toggle("on", i <= active));

  const br = boom.getBoundingClientRect();
  const bp = Math.min(1, Math.max(0, 1 - br.top / innerHeight));
  boom.style.setProperty("--boom-p", bp.toFixed(3));
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
onScroll();

const countUp = (el: HTMLElement) => {
  const target = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimals ?? 0);
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / 1600);
    const v = target * (1 - Math.pow(1 - k, 4));
    el.textContent = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

for (const group of $$(".stat-row, .feature-grid, .gun-grid, .gallery-grid")) {
  [...group.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
}
const revealer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
      revealer.unobserve(e.target);
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
);
$$(".reveal").forEach((el) => revealer.observe(el));

for (const f of $$(".feature")) {
  f.addEventListener("pointermove", (e) => {
    const r = f.getBoundingClientRect();
    f.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    f.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  });
}

/* ---------- zip launchers ---------- */
for (const form of $$<HTMLFormElement>(".zip-launch")) {
  const input = $<HTMLInputElement>(".zip-input", form);
  const field = $(".zip-field", form);
  const place = $(".zip-place", form);
  let seq = 0;
  input.addEventListener("input", async () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 5);
    field.classList.remove("ok", "bad");
    place.textContent = "";
    if (input.value.length !== 5) return;
    const my = ++seq;
    place.textContent = "LOCATING…";
    const p = await lookupZip(input.value);
    if (my !== seq) return;
    if (p) {
      field.classList.add("ok");
      place.textContent = `${p.name.toUpperCase()}, ${p.stateAbbr}`;
    } else {
      place.textContent = "NOT A US ZIP";
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(input.value)) {
      field.classList.remove("bad");
      void field.offsetWidth;
      field.classList.add("bad");
      input.focus();
      return;
    }
    sfx().uiDeploy();
    setTimeout(() => (location.href = `play.html?zip=${input.value}`), 220);
  });
}
for (const chip of $$<HTMLButtonElement>(".hero-chips button")) {
  chip.addEventListener("click", () => {
    const input = $<HTMLInputElement>(".hero .zip-input");
    input.value = chip.dataset.zip!;
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
}

/* ---------- BOPOOOOOOM ---------- */
const boomText = $(".boom-text");
function fire(kind: GunKind) {
  const a = sfx();
  a.gunshot(kind);
  document.body.classList.remove("shake");
  void document.body.offsetWidth;
  document.body.classList.add("shake");
  boomText.classList.remove("hit");
  void boomText.offsetWidth;
  boomText.classList.add("hit");
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}
$$<HTMLButtonElement>("[data-fire]").forEach((b) => b.addEventListener("click", () => fire(b.dataset.fire as GunKind)));
boomText.addEventListener("click", () => fire("anaconda"));
boomText.style.cursor = "pointer";

/* ---------- bestiary ---------- */
const lineup = new GoblinLineup($<HTMLCanvasElement>(".lineup-canvas"));
for (const foe of $$(".foe")) {
  foe.addEventListener("pointerenter", () => {
    $$(".foe").forEach((f) => f.classList.toggle("on", f === foe));
    lineup.setFocus(foe.dataset.kind as HostileKind);
  });
}
$(".lineup-cards").addEventListener("pointerleave", () => {
  $$(".foe").forEach((f) => f.classList.remove("on"));
  lineup.setFocus(null);
});

/* ---------- Sgt. Grimsby ---------- */
const ROASTS: [string, number][] = [
  ["\"Listen up, maggot. The goblins took your zip code, and the Pentagon sent… you.\"", 12],
  ["\"It's a GIANT GLOWING PILLAR. You are walking like a Roomba with a head injury.\"", 27],
  ["\"Every round you miss is now a resident of Beverly Hills. Pays more taxes than you.\"", 41],
  ["\"You're shooting a hand cannon like it owes you money and you're scared to ask.\"", 58],
  ["\"HEAD. Shot. Not toe shot. Not 'somewhere near Ohio' shot.\"", 73],
  ["\"You died. In the TUTORIAL. I'm putting that on your tombstone.\"", 100],
];
const line = $(".sarge-line");
const shameV = $(".shame-v");
const shameBar = $(".shame-bar");
let roast = 0;
setInterval(() => {
  if (line.getBoundingClientRect().bottom < 0 || line.getBoundingClientRect().top > innerHeight) return;
  roast = (roast + 1) % ROASTS.length;
  line.classList.add("swap");
  setTimeout(() => {
    line.textContent = ROASTS[roast][0];
    shameV.textContent = `${ROASTS[roast][1]}%`;
    shameBar.style.setProperty("--shame", `${ROASTS[roast][1]}%`);
    line.classList.remove("swap");
  }, 350);
}, 4200);

/* ---------- gallery lightbox ---------- */
const lightbox = $(".lightbox");
for (const shot of $$(".shot")) {
  shot.addEventListener("click", () => {
    $<HTMLImageElement>("img", lightbox).src = $<HTMLImageElement>("img", shot).src;
    lightbox.hidden = false;
  });
}
lightbox.addEventListener("click", () => (lightbox.hidden = true));
addEventListener("keydown", (e) => {
  if (e.key === "Escape") lightbox.hidden = true;
});

/* ---------- live killboard ---------- */
async function loadBoard() {
  const [health, board] = await Promise.all([fetchHealth(), fetchLeaderboard()]);
  const status = $(".shard-status");
  status.textContent = health
    ? `${health.local ? "BROWSER MODE · SCORES SAVED ON THIS DEVICE" : `${health.shards.length} SHARDS ONLINE`} · AI DIRECTOR: ${health.ai === "openai" ? "OPENAI" : "RULES ENGINE"}`
    : "COMMAND OFFLINE";
  const list = $(".board");
  const rows = board.filter((e) => e.score > 0).slice(0, 8);
  list.innerHTML = rows.length
    ? rows
        .map(
          (e, i) => `<li><span class="rk">${String(i + 1).padStart(2, "0")}</span>
            <span class="nm"><b>${escapeHtml(e.playerName)}</b><small>${escapeHtml(e.placeName)} · ${e.zip} · W${e.wave} · ${e.kills} KILLS</small></span>
            <span class="sc">${e.score.toLocaleString()}</span></li>`,
        )
        .join("")
    : `<li class="board-empty">The wall is empty. Your name could be first.</li>`;
}
void loadBoard();
