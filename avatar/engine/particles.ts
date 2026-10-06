import { pick, rand } from "./spring";

const NS = "http://www.w3.org/2000/svg";
const COLORS = ["#f9705c", "#5b95f0", "#3fbe86", "#f5b13f", "#9a72ee", "#35c3bd"];
const STAR = "#f4c34e";
const MAX = 120;

/** 10-point star, inner radius .42, unit size. */
const STAR_PATH = (() => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.42 : 1;
    d += `${i ? "L" : "M"}${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;
  }
  return d + "Z";
})();

type Kind = "dot" | "dash" | "star";
type Particle = {
  el: SVGElement;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  age: number;
  life: number;
};

/** Grok's confetti: a ring of colourful bits flung outward, with drag and a little gravity. */
export class Confetti {
  private list: Particle[] = [];
  constructor(private layer: SVGGElement) {}

  get active() {
    return this.list.length > 0;
  }

  burst(cx: number, cy: number, count = 20, speed = 1, swirl = 0) {
    for (let i = 0; i < count && this.list.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const ring = rand(96, 116) * 0.85;
      const v = rand(170, 360) * speed;
      const tangential = swirl * 0.2 * v;
      const star = Math.random() < 0.18;
      const kind: Kind = star ? "star" : Math.random() < 0.3 ? "dot" : "dash";
      const el = document.createElementNS(NS, kind === "star" ? "path" : kind === "dot" ? "circle" : "rect");
      el.setAttribute("fill", star ? STAR : pick(COLORS));
      if (kind === "star") el.setAttribute("d", STAR_PATH);
      this.layer.appendChild(el);
      this.list.push({
        el,
        kind,
        x: cx + Math.cos(a) * ring,
        y: cy + Math.sin(a) * ring,
        vx: Math.cos(a) * v - Math.sin(a) * tangential,
        vy: Math.sin(a) * v + Math.cos(a) * tangential - rand(20, 75),
        r: star ? rand(4, 7) : rand(3.5, 8),
        rot: Math.random() * 360,
        spin: rand(-260, 260),
        age: 0,
        life: rand(0.45, 0.85),
      });
    }
  }

  update(dt: number) {
    const drag = Math.pow(0.94, 60 * dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.el.remove();
        this.list.splice(i, 1);
        continue;
      }
      p.vx *= drag;
      p.vy = p.vy * drag + 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const k = p.age / p.life;
      const alpha = k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.7);
      const r = p.r * (1 - 0.4 * k);
      p.el.setAttribute("opacity", alpha.toFixed(3));
      if (p.kind === "dot") {
        p.el.setAttribute("cx", p.x.toFixed(2));
        p.el.setAttribute("cy", p.y.toFixed(2));
        p.el.setAttribute("r", r.toFixed(2));
      } else if (p.kind === "star") {
        p.el.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(1)}) scale(${r.toFixed(2)})`);
      } else {
        // Capsules stretch along their velocity, like streamers.
        const sp = Math.hypot(p.vx, p.vy);
        const w = Math.max(2 * r, Math.min(0.05 * sp, 30));
        const h = 1.5 * r;
        const ang = (Math.atan2(p.vy, p.vx) * 180) / Math.PI;
        p.el.setAttribute("x", (-w / 2).toFixed(2));
        p.el.setAttribute("y", (-h / 2).toFixed(2));
        p.el.setAttribute("width", w.toFixed(2));
        p.el.setAttribute("height", h.toFixed(2));
        p.el.setAttribute("rx", (h / 2).toFixed(2));
        p.el.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${ang.toFixed(1)})`);
      }
    }
  }

  clear() {
    this.list.forEach((p) => p.el.remove());
    this.list = [];
  }
}

/** Comet trails that whip around the body during fast spins. */
export class Trails {
  private els: SVGPathElement[] = [];
  private seeds: { r: number; tilt: number; hue: number; len: number }[] = [];
  constructor(layer: SVGGElement) {
    for (let i = 0; i < 4; i++) {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("fill", "none");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("opacity", "0");
      layer.appendChild(el);
      this.els.push(el);
      this.seeds.push({ r: rand(104, 126), tilt: rand(-0.35, 0.35), hue: rand(0, 360), len: rand(0.9, 1.6) });
    }
  }

  /** `speed` in rad/s, `angle` the current spin angle (rad). */
  update(cx: number, cy: number, angle: number, speed: number) {
    const k = Math.min(1, Math.max(0, (Math.abs(speed) - 5) / 8));
    this.els.forEach((el, i) => {
      const s = this.seeds[i];
      if (k <= 0 || i >= 3 + Math.round(k)) {
        if (el.getAttribute("opacity") !== "0") el.setAttribute("opacity", "0");
        return;
      }
      const dir = Math.sign(speed) || 1;
      const head = angle * dir * 1.15 + i * 2.1;
      let d = "";
      for (let j = 0; j <= 12; j++) {
        const a = head - (j / 12) * s.len * dir;
        const x = Math.cos(a) * s.r;
        const y = Math.sin(a) * s.r * 0.32;
        d += `${j ? "L" : "M"}${(cx + x).toFixed(1)} ${(cy + y + x * s.tilt).toFixed(1)}`;
      }
      el.setAttribute("d", d);
      el.setAttribute("stroke", `hsl(${(s.hue + angle * 40) % 360} 56% ${56 + 11 * k}%)`);
      el.setAttribute("stroke-width", (3 + 3 * k).toFixed(1));
      el.setAttribute("opacity", (0.75 * k).toFixed(2));
    });
  }
}
