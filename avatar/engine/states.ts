import type { BeakName, EyeName } from "./faces";
import { clamp, lerp } from "./spring";

/** Everything the motion functions steer each frame (springs smooth the result). */
export type Targets = {
  rot: number;
  x: number;
  y: number;
  sy: number;
  lid: number;
  eye: number;
  turn: number;
  tilt: number;
  /** Mouth opening; null keeps the beak preset's own value. */
  open: number | null;
};

export type FxName = "sound" | "bang" | "question" | "zz" | "sweat";
export type GlyphName =
  | "dots"
  | "orbit"
  | "radar"
  | "progress"
  | "gather"
  | "wave"
  | "send"
  | "receive"
  | "dock"
  | "pencil"
  | "bang"
  | "standby";

/** What a state may ask of the engine (one-shot actions). */
export type Actions = {
  spin(turns?: number): void;
  spinBounce(): void;
  spinDizzy(): void;
  spinWild(): void;
  bounce(): void;
  burst(count?: number, speed?: number, swirl?: number): void;
  nod(depth?: number): void;
  shake(amount?: number): void;
  kick(channel: "rot" | "y" | "x", velocity: number): void;
  sigh(): void;
  nodOff(): void;
  setEyes(name: EyeName): void;
  /** Runs `run` after `ms`, unless the state has changed by then. */
  after(ms: number, run: () => void): void;
  /** Mouth value from lip-sync, 0…1, decays on its own. */
  lip(): number;
  /** Seconds since the last lip-sync syllable. */
  lipAge(): number;
};

type Every = { range: [number, number]; first?: [number, number]; run: (a: Actions) => void };

export type StateDef = {
  eyes: EyeName[];
  /** ms between eye-set changes. */
  cadence?: [number, number];
  /** ms between blinks; null = never. */
  blink?: [number, number] | null;
  beak?: BeakName;
  fx?: FxName;
  /** ms between gaze saccades, and their range in px. */
  saccade?: [number, number];
  gaze?: [number, number];
  gazeBias?: [number, number];
  /** How much the head follows the pointer (0…1). */
  attention?: number;
  morph?: GlyphName;
  /** Body radius while morphed into a glyph. */
  morphR?: number;
  wink?: boolean;
  flourish?: boolean;
  eyeSpeed?: number;
  enter?: (a: Actions) => void;
  every?: Every[];
  motion?: (t: number, o: Targets, a: Actions) => void;
};

const S = Math.sin;
const PI = Math.PI;

const idleMotion = (t: number, o: Targets) => {
  o.rot = 1.5 * S(0.5 * t) + 0.6 * S(0.17 * t);
  o.x = S(0.27 * t);
  o.y = 1.2 * S(0.85 * t);
  o.sy = 1 + 0.007 * S(0.85 * t);
};

const morph = (glyph: GlyphName, r: number): StateDef => ({
  eyes: ["neutral"],
  blink: null,
  morph: glyph,
  morphR: r,
  attention: 0,
  motion: (t, o) => {
    o.y = 1.2 * S(0.85 * t);
  },
});

export const STATES = {
  idle: {
    eyes: ["neutral", "neutral", "tall"],
    cadence: [9000, 16000],
    blink: [6000, 14000],
    saccade: [2500, 5500],
    attention: 1,
    wink: true,
    motion: idleMotion,
  },
  waking: {
    eyes: ["wide"],
    blink: null,
    attention: 0.4,
    enter: (a) => {
      a.after(200, () => a.burst(9 + Math.floor(Math.random() * 5), 0.8));
      a.after(750, () => a.setEyes("neutral"));
    },
    motion: (t, o) => {
      if (t < 0.75) {
        o.y = lerp(4, -6, t / 0.75);
        o.eye = 1.08;
        o.sy = 1.02;
      } else {
        const u = clamp((t - 0.75) / 0.65, 0, 1);
        o.turn = 14 * S(3 * PI * u) * (1 - u);
        idleMotion(t, o);
      }
    },
  },
  sleeping: {
    eyes: ["content"],
    blink: null,
    beak: "small",
    fx: "zz",
    attention: 0,
    motion: (t, o) => {
      o.rot = 4 + 2 * S(0.25 * t);
      o.x = -2;
      o.y = 8 + 3 * S(0.55 * t);
      o.sy = 1 + 0.016 * S(0.55 * t);
      o.tilt = -10;
      o.lid = 0.9;
    },
  },
  drowsy: {
    eyes: ["neutral", "half"],
    cadence: [5000, 9000],
    blink: [3000, 6000],
    beak: "small",
    attention: 0.25,
    every: [{ range: [5200, 8000], first: [1500, 3000], run: (a) => a.nodOff() }],
    motion: (t, o) => {
      idleMotion(t, o);
      o.lid = 0.34;
      o.tilt = -6;
    },
  },
  listening: {
    eyes: ["tall", "neutral", "big"],
    cadence: [2800, 5000],
    blink: [3000, 7000],
    saccade: [1800, 3200],
    gaze: [6, 3],
    attention: 0.35,
    every: [{ range: [1800, 3200], run: (a) => a.nod() }],
    motion: (t, o) => {
      o.rot = 8;
      o.y = -2;
      o.sy = 1.015;
      o.tilt = -12;
      o.turn = 6;
    },
  },
  thinking: morph("dots", 30),
  searching: {
    eyes: ["neutral", "big", "focus", "tall", "small", "curious"],
    cadence: [1000, 1800],
    blink: [1600, 4000],
    saccade: [550, 1150],
    attention: 0.15,
    eyeSpeed: 15,
    every: [{ range: [4000, 7000], run: (a) => a.spin() }],
    motion: (t, o) => {
      o.rot = 13 * S(1.3 * t);
      o.x = 7 * S(1.3 * t);
      o.turn = 40 * S(1.3 * t);
      o.tilt = 6 * S(0.7 * t);
    },
  },
  working: {
    eyes: ["focus", "neutral", "squint", "tall"],
    cadence: [1800, 3400],
    blink: [4000, 9000],
    saccade: [900, 1800],
    gaze: [8, 3],
    attention: 0.2,
    every: [{ range: [6000, 9000], run: (a) => a.spin() }],
    motion: (t, o) => {
      const s = S(3.2 * PI * t);
      o.rot = 4 + 2.5 * s;
      o.y = 1.5 + 3 * Math.max(0, s);
      o.tilt = -14;
      o.turn = -10 + 4 * S(0.6 * t);
      o.eye = 1 + 0.06 * Math.max(0, S(0.4 * t));
    },
  },
  excited: {
    eyes: ["big", "happy", "wide", "tall"],
    cadence: [1200, 2400],
    blink: [3000, 6000],
    beak: "o",
    fx: "bang",
    attention: 0.5,
    eyeSpeed: 15,
    wink: true,
    flourish: true,
    motion: (t, o) => {
      const p = (t * 2.2) % 1;
      o.y = -10 * S(PI * p);
      o.sy = p < 0.14 ? lerp(0.92, 1.05, p / 0.14) : 1 + 0.05 * (1 - p);
      o.rot = 7 * S(2.2 * PI * t);
      o.eye = 1.06;
    },
  },
  surprised: {
    eyes: ["wide", "big"],
    cadence: [2500, 4000],
    blink: [2000, 4000],
    beak: "o",
    fx: "bang",
    attention: 0.3,
    motion: (t, o) => {
      o.eye = lerp(1.07, 1.15, Math.exp(-5 * t));
      o.y = -8 * Math.exp(-4 * t);
      o.sy = t < 0.2 ? 1.08 : 1;
      o.tilt = 6;
    },
  },
  suspicious: {
    eyes: ["suspicious", "half", "squint"],
    cadence: [2500, 4500],
    blink: [5000, 9000],
    beak: "small",
    gazeBias: [8, 0],
    attention: 0.3,
    every: [{ range: [1500, 3200], run: (a) => a.kick("rot", 30) }],
    motion: (t, o) => {
      idleMotion(t, o);
      o.rot = -6;
      o.lid = 0.85;
      o.turn = 20;
    },
  },
  angry: {
    eyes: ["angry"],
    blink: [4000, 8000],
    beak: "closed",
    attention: 0.4,
    every: [
      {
        range: [900, 1800],
        run: (a) => {
          a.kick("y", 70);
          a.shake(4.5);
        },
      },
    ],
    motion: (t, o) => {
      o.sy = 0.975;
      o.turn = 12;
      o.tilt = -6;
      o.rot = 1.2 * S(9 * t);
    },
  },
  happy: {
    eyes: ["happy", "happy", "content", "big"],
    cadence: [2200, 4200],
    blink: [5000, 10000],
    attention: 0.6,
    wink: true,
    flourish: true,
    motion: (t, o) => {
      idleMotion(t, o);
      o.y = -3 * Math.abs(S(2.4 * t));
      o.eye = 1.05;
    },
  },
  curious: {
    eyes: ["curious", "big", "neutral"],
    cadence: [2000, 3800],
    blink: [3500, 7000],
    gazeBias: [-6, -5],
    attention: 0.5,
    wink: true,
    motion: (t, o) => {
      o.rot = 10;
      o.eye = 1.08;
      o.turn = -30;
      o.tilt = 12 + 5 * Math.max(0, S(1.6 * t));
      o.y = 1.2 * S(0.85 * t);
    },
  },
  confused: {
    eyes: ["confused", "suspicious"],
    cadence: [1800, 3200],
    blink: [3000, 6000],
    fx: "question",
    attention: 0.2,
    motion: (t, o) => {
      o.rot = 12 * S(0.8 * t);
      o.lid = 0.9;
      o.turn = 32;
      o.tilt = 5;
    },
  },
  bored: {
    eyes: ["half", "neutral"],
    cadence: [4000, 7000],
    blink: [5000, 9000],
    beak: "small",
    attention: 0.15,
    every: [{ range: [3000, 5000], run: (a) => a.sigh() }],
    motion: (t, o) => {
      idleMotion(t, o);
      o.lid = 0.6;
      o.turn = -10;
      o.tilt = -4;
    },
  },
  proud: {
    eyes: ["content", "happy"],
    cadence: [3000, 5000],
    blink: null,
    attention: 0.3,
    flourish: true,
    motion: (t, o) => {
      idleMotion(t, o);
      o.y = -4;
      o.sy = 1.03;
      o.tilt = 14;
      o.turn = -16;
    },
  },
  shy: {
    eyes: ["happy", "content", "winkR"],
    cadence: [2000, 3600],
    blink: [3000, 6000],
    beak: "small",
    attention: 0.2,
    wink: true,
    motion: (t, o) => {
      idleMotion(t, o);
      o.rot = -8;
      o.eye = 0.95;
      o.lid = 0.85;
      o.turn = -26;
      o.tilt = -10;
    },
  },
  sad: {
    eyes: ["sad"],
    blink: [6000, 10000],
    beak: "small",
    gazeBias: [0, 6],
    attention: 0.15,
    motion: (t, o) => {
      o.y = 7 + 0.8 * S(0.6 * t);
      o.sy = 0.97;
      o.lid = 0.7;
      o.tilt = -16;
      o.rot = -3;
    },
  },
  laughing: {
    eyes: ["laugh", "happy"],
    cadence: [1400, 2600],
    blink: null,
    beak: "laugh",
    fx: "sound",
    attention: 0.2,
    motion: (t, o) => {
      o.y = -5 * Math.abs(S(PI * 6.4 * t * 0.5));
      o.rot = 3 * S(6.4 * t);
      o.lid = 0.7;
      o.open = 0.55 + 0.35 * Math.abs(S(PI * 6.4 * t * 0.5));
      o.tilt = 8;
      o.turn = 8;
    },
  },
  scared: {
    eyes: ["wide"],
    blink: [1200, 3000],
    beak: "o",
    fx: "sweat",
    attention: 0.6,
    motion: (t, o) => {
      o.x = 1.6 * S(47 * t);
      o.rot = 2.2 * S(53 * t);
      o.eye = 1.12;
      o.lid = 1.05;
      o.tilt = -6;
      o.y = 2;
    },
  },
  playful: {
    eyes: ["happy", "winkR", "wink", "big"],
    cadence: [1600, 3000],
    blink: [3000, 6000],
    attention: 0.4,
    wink: true,
    flourish: true,
    motion: (t, o) => {
      idleMotion(t, o);
      o.rot = 8 * S(1.4 * t);
      o.turn = 30 * S(0.9 * t);
    },
  },
  celebrate: {
    eyes: ["happy", "big", "wide"],
    cadence: [1200, 2200],
    blink: null,
    beak: "o",
    attention: 0,
    every: [
      { range: [6200, 6200], first: [140, 140], run: (a) => a.spinWild() },
      { range: [1600, 2600], first: [400, 600], run: (a) => a.burst(22, 1.1, 0.3) },
    ],
    motion: (t, o) => {
      o.eye = 1.1;
      o.y = -3 * Math.abs(S(2.4 * t));
    },
  },
  /** Penguin extra: beak driven by the typewriter (or babbling on its own). */
  talking: {
    eyes: ["neutral", "big", "tall"],
    cadence: [2000, 3600],
    blink: [3000, 7000],
    beak: "talk",
    fx: "sound",
    attention: 0.35,
    motion: (t, o, a) => {
      const synthetic = a.lipAge() > 0.45;
      const lip = synthetic ? 0.35 + 0.35 * Math.abs(S(9 * t) * S(5.3 * t + 1)) : a.lip();
      o.open = lip;
      o.rot = 1.5 * S(5 * t);
      o.y = -1.5 * lip + 0.8 * S(0.85 * t);
      o.turn = 16;
      o.tilt = 2 + 3 * lip;
    },
  },
  /** Penguin extra: the trumpet honk, in profile with the beak wide open. */
  noot: {
    eyes: ["neutral"],
    blink: null,
    beak: "shout",
    fx: "sound",
    attention: 0,
    motion: (t, o) => {
      o.turn = 72;
      o.tilt = 10 + 4 * S(14 * t);
      o.open = 0.75 + 0.25 * S(22 * t);
      o.y = -2 + 1.5 * S(22 * t);
      o.rot = -4;
    },
  },
  orbit: morph("orbit", 34),
  radar: morph("radar", 34),
  progress: morph("progress", 38),
  spawning: morph("gather", 30),
  dictating: morph("wave", 26),
  writing: morph("pencil", 30),
  sending: morph("send", 30),
  receiving: morph("receive", 32),
  uploading: morph("dock", 30),
  alerting: morph("bang", 46),
  "powering-down": morph("standby", 44),
} satisfies Record<string, StateDef>;

export type EngineState = keyof typeof STATES;

/** Grok's aliases, plus the old Pingu names so existing callers keep working. */
const ALIASES: Record<string, EngineState> = {
  loading: "working",
  notifying: "idle",
  bouncing: "excited",
  dragging: "uploading",
  normal: "idle",
  sleepy: "drowsy",
};

export type PinguState = EngineState | "loading" | "notifying" | "bouncing" | "dragging" | "normal" | "sleepy";

export const resolveState = (s: string): EngineState =>
  (s in STATES ? s : (ALIASES[s] ?? "idle")) as EngineState;

export const STATE_NAMES = Object.keys(STATES) as EngineState[];

export const getState = (s: EngineState): StateDef => STATES[s];
