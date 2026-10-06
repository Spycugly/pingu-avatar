import type { Face } from "./shapes";

/**
 * Fake 3D: eyes and beak live on an ellipsoid fitted to the face. Turning the head (yaw)
 * or tilting it (pitch) rotates those points and slides them across the flat silhouette,
 * which is what produces the 3/4 and profile views of the reference sheet.
 */
export type Projected = { x: number; y: number; z: number; nx: number; ny: number };

const RAD = Math.PI / 180;
const SPREAD = 0.9;

/** Rotate a unit vector by yaw (turn, + = right) then pitch (tilt, + = up). */
export function rotate(vx: number, vy: number, vz: number, turnDeg: number, tiltDeg: number) {
  const ct = Math.cos(turnDeg * RAD);
  const st = Math.sin(turnDeg * RAD);
  const x1 = vx * ct + vz * st;
  const z1 = -vx * st + vz * ct;
  const cp = Math.cos(tiltDeg * RAD);
  const sp = Math.sin(tiltDeg * RAD);
  const y2 = vy * cp + z1 * sp;
  const z2 = -vy * sp + z1 * cp;
  return [x1, y2, z2] as const;
}

/** A point on the head at longitude/latitude (degrees, lat + = up), seen from the front. */
export function project(lon: number, lat: number, turn: number, tilt: number, face: Face): Projected {
  const cl = Math.cos(lat * RAD);
  const [x, y, z] = rotate(Math.sin(lon * RAD) * cl, Math.sin(lat * RAD), Math.cos(lon * RAD) * cl, turn, tilt);
  // Features stay a little inside the outline, like a cartoon head, so 3/4 views keep both eyes.
  return { x: face.cx + x * face.rx * SPREAD, y: face.cy - y * face.ry * 0.94, z, nx: x, ny: y };
}

/** Screen direction of the head's forward axis (where the beak points). */
export function forward(turn: number, tilt: number, droop: number) {
  const [x, y, z] = rotate(0, -droop, Math.sqrt(1 - droop * droop), turn, tilt);
  return { x, y: -y, z };
}

/** How squashed a flat feature looks at that spot on the sphere (soft, cartoon-friendly). */
export const foreshorten = (n: number) => 0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - n * n));
