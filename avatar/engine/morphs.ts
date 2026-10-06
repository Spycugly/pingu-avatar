import type { GlyphName } from "./states";
import { easeInCubic, easeOutBack, easeOutCubic } from "./spring";

/**
 * "Morph" states: the body shrinks into a dot and plays a small glyph animation
 * (Grok's thinking dots, radar, progress ring…). Parts and glyphs use the body colour,
 * marks drawn on top of the body use the eye colour.
 */
export type GlyphEls = {
  parts: SVGCircleElement[];
  rings: SVGCircleElement[];
  paths: SVGPathElement[];
};

/** Where the morphed body sits and how big it is this frame. */
export type GlyphOut = { dx: number; dy: number; r: number };

type Draw = (t: number, k: number, e: GlyphEls, out: GlyphOut) => void;

const set = (el: Element, attrs: Record<string, string | number>) => {
  for (const key in attrs) {
    const v = attrs[key];
    el.setAttribute(key, typeof v === "number" ? String(Math.round(v * 100) / 100) : v);
  }
};
const hide = (el: Element) => el.getAttribute("opacity") !== "0" && el.setAttribute("opacity", "0");

const TAU = Math.PI * 2;

const GLYPHS: Record<GlyphName, Draw> = {
  dots(t, k, e, out) {
    const lift = (i: number) => -9 * Math.max(0, Math.sin(TAU * (t / 1.4) - i * 0.9));
    [-1, 1].forEach((side, j) => {
      const i = side < 0 ? 0 : 2;
      set(e.parts[j], { cx: side * 62 * k, cy: lift(i), r: 26 * k, opacity: k });
    });
    out.dy = lift(1);
    out.r = 26;
  },
  orbit(t, k, e, out) {
    // Two moons on a tilted ellipse. They grow and brighten smoothly as they swing to the front;
    // the phase starts at 45° so a still frame shows one moon in front and one behind.
    [0, 1].forEach((j) => {
      const a = t * 2.6 + Math.PI / 4 + j * Math.PI;
      const front = (Math.sin(a) + 1) / 2;
      set(e.parts[j], {
        cx: Math.cos(a) * 76,
        cy: Math.sin(a) * 26,
        r: (10 + 4 * front) * k,
        opacity: k * (0.6 + 0.4 * front),
      });
    });
    // The track as a real ellipse (a scaled circle would thin its stroke at the top and bottom).
    set(e.paths[0], {
      d: "M-76 0A76 26 0 1 0 76 0A76 26 0 1 0 -76 0",
      fill: "none",
      stroke: "var(--pingu-body)",
      "stroke-width": 3,
      transform: "",
      opacity: 0.25 * k,
    });
    out.r = 34;
  },
  radar(t, k, e, out) {
    for (let i = 0; i < 3; i++) {
      const p = (t / 1.3 + i / 3) % 1;
      set(e.rings[i], { cx: 0, cy: 0, r: 34 + 70 * easeOutCubic(p), opacity: (1 - p) * 0.8 * k, "stroke-width": 1 + 6 * (1 - p), transform: "" });
    }
    out.r = 34 * (1 + 0.04 * Math.sin(TAU * (t / 1.3)));
  },
  progress(t, k, e, out) {
    const p = easeOutCubic((t % 2.5) / 2.5);
    set(e.rings[0], { cx: 0, cy: 0, r: 62, opacity: 0.2 * k, "stroke-width": 9, transform: "" });
    const a1 = -Math.PI / 2 + TAU * Math.min(p, 0.999);
    const large = p > 0.5 ? 1 : 0;
    set(e.paths[0], {
      d: `M0 -62A62 62 0 ${large} 1 ${Math.cos(a1) * 62} ${Math.sin(a1) * 62}`,
      fill: "none",
      stroke: "var(--pingu-body)",
      "stroke-width": 9,
      "stroke-linecap": "round",
      opacity: k,
    });
    out.r = 36 + 2 * Math.sin(t * 4);
  },
  gather(t, k, e, out) {
    const p = (t % 2) / 2;
    const fly = Math.min(1, p / 0.6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      const d = 120 * (1 - easeInCubic(fly));
      set(e.parts[i], { cx: Math.cos(a) * d, cy: Math.sin(a) * d, r: 12 * (1 - 0.6 * fly) * k, opacity: fly < 1 ? k : 0 });
    }
    out.r = p < 0.6 ? 18 : 18 + 14 * easeOutBack(Math.min(1, (p - 0.6) / 0.25));
  },
  wave(t, k, e, out) {
    let d = "";
    for (const i of [-2, -1, 1, 2]) {
      const h = 14 + 30 * Math.abs(Math.sin(t * 6 + i * 1.3));
      const x = i * 40;
      d += `M${x} ${-h / 2}L${x} ${h / 2}`;
    }
    set(e.paths[0], { d, fill: "none", stroke: "var(--pingu-body)", "stroke-width": 14, "stroke-linecap": "round", opacity: k });
    out.r = 24 * (1 + 0.18 * Math.abs(Math.sin(t * 6)));
  },
  send(t, k, e, out) {
    const p = (t % 1.3) / 1.3;
    const x = 20 + 90 * easeInCubic(p);
    const y = -20 - 90 * easeInCubic(p);
    set(e.paths[0], {
      d: `M${x - 16} ${y + 6}L${x + 16} ${y - 16}L${x + 2} ${y + 16}L${x - 3} ${y + 4}Z`,
      fill: "var(--pingu-body)",
      stroke: "none",
      opacity: k * (1 - p),
    });
    set(e.paths[1], {
      d: `M${x - 26} ${y + 20}L${x - 44} ${y + 38}M${x - 14} ${y + 28}L${x - 26} ${y + 40}`,
      fill: "none",
      stroke: "var(--pingu-body)",
      "stroke-width": 4,
      "stroke-linecap": "round",
      opacity: 0.6 * k * (1 - p),
    });
    out.r = 30 - 4 * Math.max(0, 1 - p * 4);
  },
  receive(t, k, e, out) {
    const p = (t % 1.4) / 1.4;
    const y = -130 + 100 * easeInCubic(Math.min(1, p / 0.7));
    set(e.paths[0], {
      d: `M0 ${y - 22}L0 ${y + 10}M-13 ${y - 3}L0 ${y + 10}L13 ${y - 3}`,
      fill: "none",
      stroke: "var(--pingu-body)",
      "stroke-width": 7,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: k * (p < 0.7 ? 1 : 0),
    });
    const hit = p >= 0.7 ? (p - 0.7) / 0.3 : 0;
    set(e.rings[0], { cx: 0, cy: 0, r: 32 + 40 * hit, opacity: hit ? (1 - hit) * 0.7 * k : 0, "stroke-width": 4, transform: "" });
    out.r = 32 + (hit ? 6 * Math.sin(Math.PI * hit) : 0);
  },
  dock(t, k, e, out) {
    const p = (t % 1.4) / 1.4;
    const y = -40 - 70 * easeOutCubic(p);
    set(e.paths[0], {
      d: `M0 ${y + 22}L0 ${y - 10}M-13 ${y + 3}L0 ${y - 10}L13 ${y + 3}`,
      fill: "none",
      stroke: "var(--pingu-body)",
      "stroke-width": 7,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: k * (1 - p),
    });
    set(e.paths[1], { d: "M-40 -122L40 -122", fill: "none", stroke: "var(--pingu-body)", "stroke-width": 7, "stroke-linecap": "round", opacity: 0.5 * k });
    out.r = 30;
  },
  pencil(t, k, e, out) {
    const p = (t % 1.8) / 1.8;
    const x = -60 + 120 * p;
    const wob = (u: number) => 7 * Math.sin(u * 0.32);
    let d = "";
    for (let u = -60; u <= x; u += 6) d += `${d ? "L" : "M"}${u} ${30 + wob(u)}`;
    set(e.paths[0], { d: d || "M0 0", fill: "none", stroke: "var(--pingu-body)", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.75 * k * (p < 0.9 ? 1 : (1 - p) / 0.1) });
    out.dx = x;
    out.dy = 30 + wob(x) - 26;
    out.r = 24;
  },
  bang(t, k, e, out) {
    const local = t % 1.6;
    const shake = 2.2 * Math.sin(42 * local) * Math.exp(-5.5 * local) * 6;
    set(e.paths[0], {
      d: `M${shake} -24L${shake} 6M${shake} 22L${shake} 22.5`,
      fill: "none",
      stroke: "var(--pingu-eye)",
      "stroke-width": 11,
      "stroke-linecap": "round",
      opacity: k,
    });
    out.dx = shake * 0.5;
    out.r = 46;
  },
  standby(t, k, e, out) {
    const pulse = 0.55 + 0.45 * Math.cos(t * 2.2);
    set(e.paths[0], {
      d: "M-15 -14A22 22 0 1 0 15 -14M0 -26L0 -2",
      fill: "none",
      stroke: "var(--pingu-eye)",
      "stroke-width": 7,
      "stroke-linecap": "round",
      opacity: k * pulse,
    });
    out.r = 42;
  },
};

export function drawGlyph(name: GlyphName | null, t: number, k: number, e: GlyphEls, out: GlyphOut) {
  out.dx = 0;
  out.dy = 0;
  e.parts.forEach(hide);
  e.rings.forEach(hide);
  e.paths.forEach(hide);
  if (!name || k < 0.01) return;
  GLYPHS[name](t, k, e, out);
}
