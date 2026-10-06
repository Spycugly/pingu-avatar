import type { Key } from "./i18n";
import type { EngineState, ShapeName } from "@/avatar";

/* Montage building blocks: each animation is an engine state, optionally a shape change
   and a one-shot action fired when the clip starts. */

export type ActionName = "spin" | "spinBounce" | "spinDizzy" | "spinWild" | "bounce" | "burst";

export type AnimId =
  | "idle"
  | "thinking"
  | "wink"
  | "wide"
  | "alert"
  | "notification"
  | "exclamation"
  | "sleep"
  | "egg"
  | "hex"
  | "play"
  | "orbit"
  | "burst"
  | "comet"
  | "noot"
  | "laugh";

export type Animation = { id: AnimId; label: Key; state: EngineState; shape?: ShapeName; action?: ActionName };

export const ANIMATIONS: Animation[] = [
  { id: "idle", label: "anim.idle", state: "idle" },
  { id: "thinking", label: "anim.thinking", state: "thinking" },
  { id: "wink", label: "anim.wink", state: "playful" },
  { id: "wide", label: "anim.wide", state: "surprised" },
  { id: "alert", label: "anim.alert", state: "alerting" },
  { id: "notification", label: "anim.notification", state: "receiving" },
  { id: "exclamation", label: "anim.exclamation", state: "excited", action: "bounce" },
  { id: "sleep", label: "anim.sleep", state: "sleeping" },
  { id: "egg", label: "anim.egg", state: "happy", shape: "egg" },
  { id: "hex", label: "anim.hex", state: "curious", shape: "hex" },
  { id: "play", label: "anim.play", state: "playful", shape: "wedge" },
  { id: "orbit", label: "anim.orbit", state: "orbit" },
  { id: "burst", label: "anim.burst", state: "celebrate", action: "burst" },
  { id: "comet", label: "anim.comet", state: "excited", action: "spinWild" },
  { id: "noot", label: "anim.noot", state: "noot" },
  { id: "laugh", label: "anim.laugh", state: "laughing" },
];

export const getAnimation = (id: AnimId) => ANIMATIONS.find((a) => a.id === id) ?? ANIMATIONS[0];

export type Clip = { key: string; anim: AnimId; dur: number };

let n = 0;
export const makeClip = (anim: AnimId, dur = 2): Clip => ({ key: `c${Date.now().toString(36)}${n++}`, anim, dur });

export const DEFAULT_CYCLE: [AnimId, number][] = [
  ["idle", 2.4],
  ["thinking", 2.6],
  ["wink", 1.6],
  ["wide", 1.8],
  ["alert", 2.4],
  ["notification", 2.2],
  ["exclamation", 2.0],
  ["sleep", 2.4],
  ["egg", 1.8],
  ["hex", 1.6],
  ["play", 2.0],
  ["orbit", 2.4],
  ["burst", 2.2],
  ["comet", 2.0],
  ["noot", 2.0],
  ["laugh", 2.0],
];

export const defaultCycle = () => DEFAULT_CYCLE.map(([a, d]) => makeClip(a, d));

export const MIN_DUR = 0.6;
export const MAX_DUR = 6;

/** Start time (s) of every clip. */
export function clipStarts(clips: Clip[]) {
  const starts: number[] = [];
  let at = 0;
  for (const c of clips) {
    starts.push(at);
    at += c.dur;
  }
  return starts;
}
