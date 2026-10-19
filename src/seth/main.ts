import "./seth.css";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function el<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

const clock = el<HTMLTimeElement>(".clock");
const paintClock = () => {
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
};
paintClock();
setInterval(paintClock, 1000);

const progress = el<HTMLElement>(".progress");
const nav = el<HTMLElement>(".nav");
let lastY = 0;
const onScroll = () => {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle("solid", y > 20);
  const menuOpen = document.body.classList.contains("menu-open");
  nav.classList.toggle("hide", y > lastY && y > 140 && !menuOpen);
  lastY = y;
};
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const toggle = el<HTMLButtonElement>(".nav-toggle");
const panel = el<HTMLElement>("#nav-panel");
const setMenu = (open: boolean) => {
  document.body.classList.toggle("menu-open", open);
  panel.inert = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  if (open) nav.classList.remove("hide");
};
toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
for (const link of document.querySelectorAll<HTMLAnchorElement>("#nav-panel a")) {
  link.addEventListener("click", () => setMenu(false));
}
addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

const hero = el<HTMLElement>(".hero");
if (!reduce && matchMedia("(pointer: fine)").matches) {
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    hero.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
}

function countUp(node: HTMLElement) {
  const target = Number(node.dataset.count);
  if (!Number.isFinite(target)) return;
  if (reduce) {
    node.textContent = Math.round(target).toLocaleString();
    return;
  }
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / 1400);
    const v = target * (1 - (1 - k) ** 4);
    node.textContent = Math.round(v).toLocaleString();
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const revealer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      entry.target.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
      if (entry.target.matches("[data-count]")) countUp(entry.target as HTMLElement);
      revealer.unobserve(entry.target);
    }
  },
  { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
);
for (const node of document.querySelectorAll<HTMLElement>(".reveal")) revealer.observe(node);

const rows = [...document.querySelectorAll<HTMLElement>(".build-row")];
const bar = document.querySelector<HTMLElement>(".build-bar i");
const paintBuild = (i: number) => {
  rows.forEach((row, n) => {
    row.classList.toggle("done", n < i);
    row.classList.toggle("on", n === i);
  });
  if (bar) bar.style.transform = `scaleX(${rows.length ? (i + 1) / rows.length : 0})`;
};
if (rows.length) {
  if (reduce) paintBuild(rows.length - 1);
  else {
    let step = 0;
    paintBuild(0);
    setInterval(() => {
      step = (step + 1) % rows.length;
      paintBuild(step);
    }, 1200);
  }
}

const deploy = document.querySelector<HTMLButtonElement>(".phone-go");
const note = document.querySelector<HTMLElement>(".phone-note");
deploy?.addEventListener("click", () => {
  const armed = deploy.classList.toggle("armed");
  deploy.textContent = armed ? "Standing by" : "Deploy";
  if (note) note.hidden = !armed;
});
