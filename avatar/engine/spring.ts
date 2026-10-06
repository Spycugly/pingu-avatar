/** Damped springs, integrated in fixed 1/120s substeps (the same integrator Grok Bot uses). */
export type Spring = { x: number; v: number; t: number; w: number; z: number };

export const STEP = 1 / 120;
export const MAX_DT = 0.1;

export const spring = (x: number, w: number, z = 1): Spring => ({ x, v: 0, t: x, w, z });

export function stepSpring(s: Spring, dt: number) {
  s.v += (-2 * s.z * s.w * s.v - s.w * s.w * (s.x - s.t)) * dt;
  s.x += s.v * dt;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInCubic = (p: number) => p * p * p;
export const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
export const smoothstep = (p: number) => {
  const x = clamp(p, 0, 1);
  return x * x * (3 - 2 * x);
};
