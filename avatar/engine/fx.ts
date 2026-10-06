import type { FxName } from "./states";

/**
 * Comic marks from the reference sheet, drawn beside the head on the side it faces:
 * sound lines (talking, laughing, noot), "!!" ticks, a "?" and sleepy "z"s.
 */
const f = (v: number) => Math.round(v * 10) / 10;
const seg = (x1: number, y1: number, x2: number, y2: number) => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;

const Z = (x: number, y: number, s: number) =>
  `M${f(x - 6 * s)} ${f(y - 6 * s)}L${f(x + 6 * s)} ${f(y - 6 * s)}L${f(x - 6 * s)} ${f(y + 6 * s)}L${f(x + 6 * s)} ${f(y + 6 * s)}`;

const QUESTION = (x: number, y: number) =>
  `M${f(x - 8)} ${f(y - 10)}C${f(x - 8)} ${f(y - 21)} ${f(x + 9)} ${f(y - 21)} ${f(x + 9)} ${f(y - 10)}` +
  `C${f(x + 9)} ${f(y - 3)} ${f(x)} ${f(y - 3)} ${f(x)} ${f(y + 5)}M${f(x)} ${f(y + 14)}L${f(x)} ${f(y + 14.5)}`;

/** Classic sweat drop: a soft point on top, a full round belly. `k` scales it (1 ≈ 23×32 units). */
const DROP = (x: number, y: number, k: number) =>
  `M${f(x)} ${f(y - 16 * k)}` +
  `C${f(x + 3 * k)} ${f(y - 10 * k)} ${f(x + 11.5 * k)} ${f(y - 3 * k)} ${f(x + 11.5 * k)} ${f(y + 4 * k)}` +
  `C${f(x + 11.5 * k)} ${f(y + 11 * k)} ${f(x + 6 * k)} ${f(y + 16 * k)} ${f(x)} ${f(y + 16 * k)}` +
  `C${f(x - 6 * k)} ${f(y + 16 * k)} ${f(x - 11.5 * k)} ${f(y + 11 * k)} ${f(x - 11.5 * k)} ${f(y + 4 * k)}` +
  `C${f(x - 11.5 * k)} ${f(y - 3 * k)} ${f(x - 3 * k)} ${f(y - 10 * k)} ${f(x)} ${f(y - 16 * k)}Z`;

/**
 * @param side  +1 when the head faces right, -1 when it faces left
 * @param edge  x of the silhouette (or beak tip) on that side
 * @param y     vertical anchor (mouth height for sound lines)
 * @param pulse 0…1, how loud (sound lines spread with the beak)
 * @returns stroke path, fill path, and the fill's own opacity (the sweat drop fades as it falls)
 */
export function fxPaths(
  name: FxName | null,
  t: number,
  side: number,
  edge: number,
  y: number,
  pulse: number,
): [string, string, number?] {
  if (!name) return ["", ""];
  const s = side;
  switch (name) {
    case "sound": {
      const x = edge + s * (10 + 4 * pulse);
      const l = 12 + 5 * pulse;
      return [
        seg(x, y - 22, x + s * l * 0.8, y - 34) + seg(x + s * 4, y, x + s * (4 + l), y) + seg(x, y + 22, x + s * l * 0.8, y + 34),
        "",
      ];
    }
    case "bang":
      return [seg(s * 86, -84, s * 93, -101) + seg(s * 99, -70, s * 114, -81), ""];
    case "question": {
      const bob = 2.5 * Math.sin(t * 3.4);
      return [QUESTION(s * 102, -86 + bob), ""];
    }
    case "zz": {
      const p = (t % 2.6) / 2.6;
      const q = ((t + 1.3) % 2.6) / 2.6;
      return [Z(s * (78 + 18 * p), -78 - 34 * p, 0.7 + 0.5 * p) + Z(s * (78 + 18 * q), -78 - 34 * q, 0.7 + 0.5 * q), ""];
    }
    case "sweat": {
      // Every 1.8 s a drop swells on the temple, just inside the silhouette on the facing side,
      // slides down with gravity (ease-in) and fades before the next one forms.
      const p = (t % 1.8) / 1.8;
      const grow = Math.min(1, p / 0.15);
      const k = 1 - (1 - grow) ** 3;
      const fall = p < 0.15 ? 0 : ((p - 0.15) / 0.85) ** 2;
      const alpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
      return ["", DROP(edge - s * 18, -50 + 26 * fall, k), alpha];
    }
  }
}
