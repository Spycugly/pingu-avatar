import { BODY_N, radialFromPolygon, radialRing, roundedPolygon, type Ring } from "./geometry";

/** Superellipse radius at angle `a`, with separate top and bottom half-heights and exponents. */
function superR(a: number, rx: number, top: number, bottom: number, nTop: number, nBottom: number) {
  const below = Math.sin(a) > 0;
  const ry = below ? bottom : top;
  const n = below ? nBottom : nTop;
  const c = Math.abs(Math.cos(a)) / rx;
  const s = Math.abs(Math.sin(a)) / ry;
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
}

function heartPolygon() {
  const pts: number[] = [];
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push(x * 5.6, y * 5.6 + 8);
  }
  return pts;
}

function regular(sides: number, r: number, rot: number) {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

const BUILDERS = {
  /** The penguin from the reference sheet: wide dome, softer flat base. */
  mochi: () => radialRing((a) => superR(a, 90, 76, 58, 2.05, 2.5)),
  blob: () => radialRing((a) => superR(a, 95, 96, 91, 2.05, 2.15) * (1 + 0.012 * Math.sin(3 * a + 0.6))),
  pebble: () => radialRing((a) => superR(a, 98, 84, 80, 2.2, 2.4) * (1 + 0.025 * Math.sin(2 * a + 1.1))),
  egg: () => radialRing((a) => superR(a, 82, 100, 84, 2, 2.2)),
  squircle: () => radialRing((a) => superR(a, 90, 90, 90, 4, 4)),
  gem: () => radialRing((a) => superR(a, 94, 96, 96, 1.5, 1.5)),
  wedge: () => radialFromPolygon(roundedPolygon([0, -112, 104, 78, -104, 78], 58, 14)),
  hex: () => radialFromPolygon(roundedPolygon(regular(6, 104, Math.PI / 6), 22, 8)),
  heart: () => radialFromPolygon(heartPolygon()),
  cloud: () => radialRing((a) => 84 + 10 * Math.pow(Math.abs(Math.sin(2.5 * (a + Math.PI / 2))), 0.6)),
} satisfies Record<string, () => Ring>;

export type ShapeName = keyof typeof BUILDERS;
export const SHAPE_NAMES = Object.keys(BUILDERS) as ShapeName[];

/** Ellipsoid the face is projected on: centre and radii, found once per shape. */
export type Face = { cx: number; cy: number; rx: number; ry: number };
export type Shape = { ring: Ring; face: Face; halfW: number; halfH: number; bottom: number };

/**
 * Face finder: the biggest ellipse (with the body's aspect ratio) that fits inside the
 * outline, searched on a coarse grid. Gives every shape a sensible place for eyes and beak.
 */
function findFace(ring: Ring): Face {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    minX = Math.min(minX, ring[i]);
    maxX = Math.max(maxX, ring[i]);
    minY = Math.min(minY, ring[i + 1]);
    maxY = Math.max(maxY, ring[i + 1]);
  }
  const a = (maxX - minX) / 2;
  const b = (maxY - minY) / 2;
  const mx = (maxX + minX) / 2;
  const my = (maxY + minY) / 2;
  let best = { s: 0, cx: mx, cy: my };
  for (let gy = -6; gy <= 6; gy++) {
    for (let gx = -3; gx <= 3; gx++) {
      const cx = mx + (gx / 6) * a * 0.3;
      const cy = my + (gy / 6) * b * 0.4;
      let s = Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        const dx = (ring[i] - cx) / a;
        const dy = (ring[i + 1] - cy) / b;
        s = Math.min(s, Math.hypot(dx, dy));
      }
      if (s > best.s) best = { s, cx, cy };
    }
  }
  // Square-ish shapes have room in the corners: let the face spread a little past the fit.
  const k = Math.min(1, best.s * 1.06);
  return { cx: best.cx, cy: best.cy, rx: a * k, ry: b * k };
}

const cache = new Map<ShapeName, Shape>();

export function getShape(name: ShapeName): Shape {
  let s = cache.get(name);
  if (!s) {
    const ring = BUILDERS[name]();
    let top = Infinity;
    let bottom = -Infinity;
    let halfW = 0;
    for (let i = 0; i < ring.length; i += 2) {
      halfW = Math.max(halfW, Math.abs(ring[i]));
      top = Math.min(top, ring[i + 1]);
      bottom = Math.max(bottom, ring[i + 1]);
    }
    s = { ring, face: findFace(ring), halfW, halfH: (bottom - top) / 2, bottom };
    cache.set(name, s);
  }
  return s;
}

export function circleRing(r: number): Ring {
  return radialRing(() => r, BODY_N);
}
