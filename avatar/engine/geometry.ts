/**
 * Closed rings stored as flat [x0, y0, x1, y1, …] arrays. Every eye, beak and body is a ring
 * with a fixed point count, so any shape can morph into any other with a plain lerp.
 */
export type Ring = number[];

export const EYE_N = 40;
export const BODY_N = 96;

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Smooth closed path through the ring (Catmull-Rom → cubic Bézier). */
export function ringPath(ring: Ring): string {
  const n = ring.length / 2;
  if (n < 3) return "";
  const at = (i: number, k: 0 | 1) => ring[((i + n) % n) * 2 + k];
  let d = `M${r2(at(0, 0))} ${r2(at(0, 1))}`;
  for (let i = 0; i < n; i++) {
    const c1x = at(i, 0) + (at(i + 1, 0) - at(i - 1, 0)) / 6;
    const c1y = at(i, 1) + (at(i + 1, 1) - at(i - 1, 1)) / 6;
    const c2x = at(i + 1, 0) - (at(i + 2, 0) - at(i, 0)) / 6;
    const c2y = at(i + 1, 1) - (at(i + 2, 1) - at(i, 1)) / 6;
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(at(i + 1, 0))} ${r2(at(i + 1, 1))}`;
  }
  return d + "Z";
}

/** Straight-edged closed path, for small glyphs. */
export function polyPath(pts: number[], close = true): string {
  let d = "";
  for (let i = 0; i < pts.length; i += 2) d += `${i ? "L" : "M"}${r2(pts[i])} ${r2(pts[i + 1])}`;
  return close ? d + "Z" : d;
}

export function lerpRing(a: Ring, b: Ring, k: number, out: Ring = new Array(a.length)): Ring {
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k;
  return out;
}

export function centroid(ring: Ring): [number, number] {
  let x = 0;
  let y = 0;
  const n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) {
    x += ring[i];
    y += ring[i + 1];
  }
  return [x / n, y / n];
}

/** Scale about the ring's own centre, rotate, then move it to (cx, cy). */
export function placeRing(
  ring: Ring,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  rotDeg: number,
  out: Ring = new Array(ring.length),
): Ring {
  const c = Math.cos((rotDeg * Math.PI) / 180);
  const s = Math.sin((rotDeg * Math.PI) / 180);
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i] * sx;
    const y = ring[i + 1] * sy;
    out[i] = cx + x * c - y * s;
    out[i + 1] = cy + x * s + y * c;
  }
  return out;
}

function signedArea(poly: number[]) {
  let a = 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1];
  }
  return a / 2;
}

/**
 * Resample a closed polygon to `n` evenly spaced points, clockwise on screen, starting from
 * the point closest to straight up from its centre. Shared orientation and start point is
 * what keeps morphs from twisting.
 */
export function resample(poly: number[], n: number): Ring {
  let pts = poly;
  if (signedArea(pts) < 0) {
    const rev: number[] = [];
    for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
    pts = rev;
  }
  const m = pts.length / 2;
  const [cx, cy] = centroid(pts);
  let start = 0;
  let best = Infinity;
  for (let i = 0; i < m; i++) {
    const dx = pts[i * 2] - cx;
    const dy = pts[i * 2 + 1] - cy;
    const ang = Math.abs(Math.atan2(dx, -dy));
    if (ang < best) {
      best = ang;
      start = i;
    }
  }
  const seg: number[] = [];
  let total = 0;
  for (let k = 0; k < m; k++) {
    const i = (start + k) % m;
    const j = (i + 1) % m;
    const len = Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
    seg.push(len);
    total += len;
  }
  const out: Ring = [];
  let k = 0;
  let acc = 0;
  for (let s = 0; s < n; s++) {
    const target = (s / n) * total;
    while (k < m - 1 && acc + seg[k] < target) acc += seg[k++];
    const i = (start + k) % m;
    const j = (i + 1) % m;
    const f = seg[k] ? (target - acc) / seg[k] : 0;
    out.push(pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f);
  }
  return out;
}

export function ellipse(rx: number, ry: number, n = EYE_N): Ring {
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    out.push(Math.cos(a) * rx, Math.sin(a) * ry);
  }
  return out;
}

/** Outline of a thick polyline with round caps: arcs (^ ‿) and chevrons (> <). */
export function stroke(line: number[], width: number, n = EYE_N): Ring {
  const h = width / 2;
  const m = line.length / 2;
  const normal = (i: number): [number, number] => {
    const a = Math.max(0, i - 1);
    const b = Math.min(m - 1, i + 1);
    const dx = line[b * 2] - line[a * 2];
    const dy = line[b * 2 + 1] - line[a * 2 + 1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < m; i++) {
    const [nx, ny] = normal(i);
    left.push(line[i * 2] + nx * h, line[i * 2 + 1] + ny * h);
    right.push(line[i * 2] - nx * h, line[i * 2 + 1] - ny * h);
  }
  const cap = (i: number, from: [number, number]) => {
    const pts: number[] = [];
    const a0 = Math.atan2(from[1], from[0]);
    for (let k = 1; k < 8; k++) {
      const a = a0 - (k / 8) * Math.PI;
      pts.push(line[i * 2] + Math.cos(a) * h, line[i * 2 + 1] + Math.sin(a) * h);
    }
    return pts;
  };
  const poly: number[] = [...left, ...cap(m - 1, normal(m - 1))];
  for (let i = m - 1; i >= 0; i--) poly.push(right[i * 2], right[i * 2 + 1]);
  const [nx, ny] = normal(0);
  poly.push(...cap(0, [-nx, -ny]));
  return resample(poly, n);
}

/** Points along an elliptical arc, angles in radians (screen space, y down). */
export function arcLine(rx: number, ry: number, a0: number, a1: number, dy = 0, steps = 14): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(Math.cos(a) * rx, Math.sin(a) * ry + dy);
  }
  return out;
}

/** Oval with its top sliced off by a slanted line: angry (tilt > 0 lowers the inner side). */
export function cutOval(rx: number, ry: number, cut: number, slope: number, n = EYE_N): Ring {
  const base = ellipse(rx, ry, 160);
  const poly: number[] = [];
  for (let i = 0; i < base.length; i += 2) {
    const x = base[i];
    const lineY = -ry + cut + slope * x;
    poly.push(x, Math.max(base[i + 1], lineY));
  }
  return resample(poly, n);
}

/** Radial body sampling: one point per fixed angle, so any two bodies lerp cleanly. */
export function radialRing(r: (a: number) => number, n = BODY_N): Ring {
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const rad = r(a);
    out.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return out;
}

/** Ray-cast a star-convex polygon (centred on the origin) into a radial ring. */
export function radialFromPolygon(poly: number[], n = BODY_N): Ring {
  const m = poly.length / 2;
  return radialRing((a) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const x1 = poly[i * 2];
      const y1 = poly[i * 2 + 1];
      const ex = poly[j * 2] - x1;
      const ey = poly[j * 2 + 1] - y1;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (x1 * ey - y1 * ex) / den;
      const u = (x1 * dy - y1 * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    return best;
  }, n);
}

/** Polygon with rounded corners (corner radius `rc`), densely sampled. */
export function roundedPolygon(corners: number[], rc: number, steps = 10): number[] {
  const m = corners.length / 2;
  const out: number[] = [];
  for (let i = 0; i < m; i++) {
    const p = (k: number) => [corners[((k + m) % m) * 2], corners[((k + m) % m) * 2 + 1]];
    const [px, py] = p(i - 1);
    const [cx, cy] = p(i);
    const [nx, ny] = p(i + 1);
    const l1 = Math.hypot(px - cx, py - cy);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(rc, l1 / 2, l2 / 2);
    const ax = cx + ((px - cx) / l1) * r;
    const ay = cy + ((py - cy) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r;
    const by = cy + ((ny - cy) / l2) * r;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
    }
  }
  return out;
}

/** Convex hull (monotone chain) of a point cloud, returned clockwise on screen. */
export function convexHull(pts: number[]): number[] {
  const p: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return pts.slice();
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return hull.flat();
}
