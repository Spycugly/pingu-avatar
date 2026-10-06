import { arcLine, cutOval, ellipse, placeRing, stroke, type Ring } from "./geometry";

/*
 * Units: the body is ~180 wide and ~134 tall (the mochi from the reference sheet), so an eye
 * ends up ~20×37 and the closed beak ~74×43. Rings are centred on the eye/beak anchor.
 */

const W = 3.6; // line weight for ^ ‿ > < eyes (before EYE_SIZE)
/** The sheet's eyes are big: ~11% of the body width, ~27% of its height. */
const EYE_SIZE = 1.6;
const big = (r: Ring) => placeRing(r, 0, 0, EYE_SIZE, EYE_SIZE, 0);

const oval = (rx: number, ry: number) => ellipse(rx, ry);
const up = stroke(arcLine(10, 9, Math.PI + 0.3, Math.PI * 2 - 0.3, 4), W); // ^
const down = stroke(arcLine(10, 8, 0.3, Math.PI - 0.3, -3), W); // ‿
const toRight = stroke([-7, -8.5, -2.5, -4.2, 6, 0, -2.5, 4.2, -7, 8.5], W); // >
const toLeft = stroke([7, -8.5, 2.5, -4.2, -6, 0, 2.5, 4.2, 7, 8.5], W); // <
const half = cutOval(6.8, 12, 10, 0);

const RAW = {
  neutral: [oval(6.4, 11.5), oval(6.4, 11.5)],
  tall: [oval(6.6, 14), oval(6.6, 14)],
  big: [oval(8.4, 13.4), oval(8.4, 13.4)],
  wide: [oval(9.6, 15.6), oval(9.6, 15.6)],
  small: [oval(5, 8.6), oval(5, 8.6)],
  focus: [oval(5.4, 10.4), oval(5.4, 10.4)],
  squint: [oval(7.6, 5.4), oval(7.6, 5.4)],
  slit: [oval(8.4, 2.3), oval(8.4, 2.3)],
  happy: [up, up],
  content: [down, down],
  wink: [toRight, oval(6.4, 11.5)],
  winkR: [oval(6.4, 11.5), toLeft],
  laugh: [toRight, toLeft],
  angry: [cutOval(7.2, 12, 7.5, 0.6), cutOval(7.2, 12, 7.5, -0.6)],
  sad: [cutOval(6.8, 12, 7, -0.55), cutOval(6.8, 12, 7, 0.55)],
  half: [half, half],
  suspicious: [half, oval(6.6, 13.6)],
  confused: [oval(5.2, 8.8), oval(7.4, 13.8)],
  curious: [oval(7.4, 13.6), oval(6, 11)],
} satisfies Record<string, [Ring, Ring]>;

export type EyeName = keyof typeof RAW;

export const EYE_SETS = Object.fromEntries(
  Object.entries(RAW).map(([k, [l, r]]) => [k, [big(l), big(r)]]),
) as Record<EyeName, [Ring, Ring]>;

/** Beak: closed size, mouth opening (0…1, the dark inside) and how round it is. */
export type Beak = { rx: number; ry: number; open: number };

export const BEAKS = {
  closed: { rx: 37, ry: 21.5, open: 0 },
  small: { rx: 31, ry: 19, open: 0 },
  o: { rx: 30, ry: 27, open: 0.62 },
  talk: { rx: 38, ry: 23, open: 0 },
  shout: { rx: 38, ry: 25, open: 1 },
  laugh: { rx: 40, ry: 24, open: 0.78 },
  pout: { rx: 26, ry: 20, open: 0.18 },
} satisfies Record<string, Beak>;

export type BeakName = keyof typeof BEAKS;

/** Where the face sits on the head sphere (degrees). */
export const EYE_LON = 37;
export const EYE_LAT = 2;
export const BEAK_LAT = -33;
