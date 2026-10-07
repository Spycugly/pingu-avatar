import { useSyncExternalStore } from "react";

/* Interface sounds: tiny synthesized tones (an oscillator through a low-pass filter, a few tens of
   milliseconds, very quiet), no audio files. Off by default; one setting for the whole app, shared
   with the chat's noot noot and saved in localStorage. */

const KEY = "pingu-sound";

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export function soundOn() {
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
}

export function useSoundOn() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
    () => false,
  );
}

/* ---------- audio context ---------- */

let ctx: AudioContext | null = null;

/** Browsers keep an AudioContext created outside a user gesture suspended, and some sounds fire
    from timers (Pingu's replies). So the context is created (or resumed) on the first click, tap
    or key press, and each sound resumes it again in case the browser suspended it since. */
export function audio() {
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== "undefined") {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = (e: Event) => {
    if (!e.isTrusted) return;
    audio()
      ?.resume()
      .then(() => events.forEach((name) => window.removeEventListener(name, unlock, true)))
      .catch(() => {});
  };
  events.forEach((name) => window.addEventListener(name, unlock, true));
}

/* ---------- cues ---------- */

type Tone = {
  hz: number;
  /** Glide to this pitch over the tone. */
  to?: number;
  ms: number;
  gain: number;
  wave?: OscillatorType;
  /** Low-pass cutoff: lower is softer. */
  cut?: number;
  /** Attack in ms: a slower attack sounds rounder. */
  atk?: number;
  /** Delay from the cue's start, in ms. */
  at?: number;
};

const CUES = {
  /** Any small press: tiles, menu items, chats in the list. */
  tap: [{ hz: 300, ms: 26, gain: 0.05, wave: "triangle", cut: 1600, atk: 4 }],
  /** Rail: moving to another tab or page. */
  slide: [{ hz: 340, to: 290, ms: 200, gain: 0.05, cut: 900, atk: 30 }],
  /** Theme switch and other toggles. */
  on: [{ hz: 520, to: 640, ms: 70, gain: 0.04, cut: 1400, atk: 6 }],
  off: [{ hz: 440, to: 330, ms: 90, gain: 0.04, cut: 1100, atk: 6 }],
  /** A menu opening and closing. */
  open: [{ hz: 260, to: 360, ms: 110, gain: 0.045, cut: 1000, atk: 12 }],
  close: [{ hz: 330, to: 230, ms: 90, gain: 0.04, cut: 900, atk: 8 }],
  /** Sending a chat message. */
  send: [{ hz: 420, to: 600, ms: 100, gain: 0.045, cut: 1500, atk: 8 }],
  /** An export finished. */
  done: [
    { hz: 520, ms: 90, gain: 0.04, cut: 1500, atk: 6 },
    { hz: 700, ms: 140, gain: 0.04, cut: 1500, atk: 6, at: 80 },
  ],
} satisfies Record<string, Tone[]>;

export type Cue = keyof typeof CUES;

/** Plays an interface sound, if sound is on and the audio has been unlocked by a gesture. */
export function play(cue: Cue) {
  if (!enabled) return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  try {
    for (const tone of CUES[cue] as Tone[]) {
      const start = ac.currentTime + (tone.at ?? 0) / 1000;
      const end = start + tone.ms / 1000;
      const osc = ac.createOscillator();
      osc.type = tone.wave ?? "sine";
      osc.frequency.setValueAtTime(tone.hz, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
      const gain = ac.createGain();
      const attack = Math.min((tone.atk ?? 4) / 1000, (tone.ms / 1000) * 0.6);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      let node: AudioNode = osc;
      if (tone.cut) {
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = tone.cut;
        node = node.connect(filter);
      }
      node.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    // Audio not available: stay silent.
  }
}
