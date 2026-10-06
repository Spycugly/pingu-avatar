import { BEAKS, BEAK_LAT, EYE_LAT, EYE_LON, EYE_SETS, type BeakName, type EyeName } from "./faces";
import { fxPaths } from "./fx";
import { convexHull, ellipse, lerpRing, placeRing, resample, ringPath, type Ring } from "./geometry";
import { drawGlyph, type GlyphEls, type GlyphOut } from "./morphs";
import { Confetti, Trails } from "./particles";
import { foreshorten, forward, project } from "./projection";
import { circleRing, getShape, type ShapeName } from "./shapes";
import {
  clamp,
  easeInCubic,
  easeInOutCubic,
  lerp,
  pick,
  rand,
  smoothstep,
  spring,
  stepSpring,
  STEP,
  type Spring,
} from "./spring";
import { getState, type Actions, type EngineState, type FxName, type GlyphName, type StateDef, type Targets } from "./states";
import { activity, pointer, subscribe, watchVisibility } from "./ticker";

export const VIEW = 256;
export const C = VIEW / 2;

export type PinguEls = {
  svg: SVGSVGElement;
  body: SVGGElement;
  bodyPath: SVGPathElement;
  clipPath: SVGPathElement;
  eyes: [SVGPathElement, SVGPathElement];
  beak: SVGPathElement;
  mouth: SVGPathElement;
  beakBack: SVGPathElement;
  fx: SVGGElement;
  fxStroke: SVGPathElement;
  fxFill: SVGPathElement;
  glyphLayer: SVGGElement;
  glyph: GlyphEls;
  back: SVGGElement;
  front: SVGGElement;
};

/** A hand-picked still frame (used by the expression sheet and reduced motion). */
export type Frozen = {
  eyes?: EyeName;
  beak?: BeakName;
  open?: number;
  turn?: number;
  tilt?: number;
  roll?: number;
  lid?: number;
  fx?: FxName | null;
  gx?: number;
  gy?: number;
  y?: number;
};

export type EngineOptions = {
  shape: ShapeName;
  state: EngineState;
  mouseInteractive: boolean;
  /** Eyes and beak scale (bigger at small sizes so the face still reads). */
  boost: number;
  /** Doze off when nobody touches anything (idle only). */
  autoDoze: boolean;
  /** Override the head pose (degrees); undefined fields stay animated. */
  pose?: { turn?: number; tilt?: number; roll?: number };
  frozen?: Frozen | null;
  /** Render a single frame and never subscribe to the ticker. */
  still: boolean;
};

type Offsets = { x: number; y: number; rot: number; turn: number; tilt: number; sy: number; lid: number | null };
/** `fromState`: started by a state's enter/every hooks, dropped when the state changes. */
type Tween = { start: number; dur: number; fn: (p: number, o: Offsets) => void; done?: () => void; fromState: boolean };
type Timer = { at: number; range: [number, number]; run: (a: Actions) => void };

const DOZE_AFTER = 15_000;
const SLEEP_AFTER = 40_000;

const now = () => performance.now();

export class PinguEngine {
  private o: EngineOptions;
  private visible = true;
  private unsub: (() => void) | null = null;
  private unwatch: (() => void) | null = null;

  // Channels: (ω, ζ) from Grok Bot.
  private s = {
    rot: spring(0, 5, 0.9),
    x: spring(0, 3.5, 1),
    y: spring(0, 4, 1),
    sy: spring(1, 10, 0.8),
    lid: spring(1, 26, 1),
    eye: spring(1, 9, 0.85),
    turn: spring(0, 6, 0.9),
    tilt: spring(0, 6, 0.9),
    gx: spring(0, 13, 1),
    gy: spring(0, 13, 1),
    open: spring(0, 28, 0.7),
    brx: spring(37, 14, 0.8),
    bry: spring(21.5, 14, 0.8),
    eyeK: spring(1, 7, 1),
    morph: spring(0, 14, 1),
    morphR: spring(30, 10, 0.8),
    shapeK: spring(1, 10, 1),
    spin: spring(0, 6.2, 1),
    fx: spring(0, 12, 0.55),
  } satisfies Record<string, Spring>;

  private state: EngineState;
  private def: StateDef;
  private effective: EngineState;
  private stateStart = 0;
  private wakeUntil = 0;

  private eyeName: EyeName = "neutral";
  private eyeFrom: [Ring, Ring] = [EYE_SETS.neutral[0].slice(), EYE_SETS.neutral[1].slice()];
  private eyeTo: [Ring, Ring] = [EYE_SETS.neutral[0], EYE_SETS.neutral[1]];

  private shapeName: ShapeName;
  private shapeFrom: Ring;
  private glyph: GlyphName | null = null;
  private glyphStart = 0;
  private fxName: FxName | null = null;
  /** The mark still on screen: it fades out after the state that drew it has ended. */
  private fxShown: FxName | null = null;
  /** True while a state hook runs, so the tweens it starts are tagged `fromState`. */
  private inStateHook = false;

  private blinkKeys: { at: number; v: number }[] = [];
  private nextBlink = 0;
  private nextExpr = 0;
  private nextSaccade = 0;
  private nextWink = 0;
  private nextFlourish = 0;
  private timers: Timer[] = [];
  private tweens: Tween[] = [];
  private off: Offsets = { x: 0, y: 0, rot: 0, turn: 0, tilt: 0, sy: 0, lid: null };
  private winkUntil = 0;
  private winkBack: EyeName = "neutral";

  private lipValue = 0;
  private lipAt = -1e9;
  private attn = { x: 0, y: 0 };
  private rect = { x: 0, y: 0, w: 1, h: 1, at: -1e9 };
  private lastTurn = 0;
  private gaze = { x: 0, y: 0 };
  private spinSpeed = 0;
  private time = 0;

  private confetti: Confetti;
  private trails: Trails;
  private glyphOut: GlyphOut = { dx: 0, dy: 0, r: 30 };
  private tg: Targets = { rot: 0, x: 0, y: 0, sy: 1, lid: 1, eye: 1, turn: 0, tilt: 0, open: null };
  private cache = new Map<Element, string>();
  private ringBuf: Ring = [];
  private eyeBuf: Ring = [];

  readonly actions: Actions;

  constructor(
    private el: PinguEls,
    options: EngineOptions,
  ) {
    this.o = options;
    this.state = options.state;
    this.effective = options.state;
    this.def = getState(options.state);
    this.shapeName = options.shape;
    this.shapeFrom = getShape(options.shape).ring.slice();
    this.confetti = new Confetti(el.front);
    this.trails = new Trails(el.back);
    this.actions = this.makeActions();
    this.time = now();
    this.enterState(this.effective, this.time);
    this.snap();
    this.render();
    if (!options.still && !options.frozen) this.start();
  }

  /* ---------- lifecycle ---------- */

  private start() {
    if (this.unsub) return;
    this.unsub = subscribe(this);
    this.unwatch = watchVisibility(this.el.svg, (v) => (this.visible = v));
  }

  private stop() {
    this.unsub?.();
    this.unwatch?.();
    this.unsub = this.unwatch = null;
  }

  destroy() {
    this.stop();
    this.confetti.clear();
  }

  awake() {
    return this.visible;
  }

  update(options: Partial<EngineOptions>) {
    const prev = this.o;
    this.o = { ...prev, ...options };
    if (options.shape && options.shape !== this.shapeName) this.setShape(options.shape);
    if (options.state && options.state !== prev.state) {
      this.state = options.state;
      this.wakeUntil = 0;
      this.enterState(this.resolveEffective(now()), now());
    }
    if (this.o.still || this.o.frozen) {
      this.stop();
      this.enterState(this.resolveEffective(now()), now());
      this.snap();
      this.render();
    } else {
      this.start();
      if (prev.still || prev.frozen) this.time = now();
    }
  }

  /* ---------- public actions ---------- */

  private makeActions(): Actions {
    return {
      spin: (turns = 1) => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.s.spin.t += 360 * turns * dir;
      },
      spinBounce: () => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.tween(700, (p, o) => (o.turn += 360 * dir * easeInOutCubic(p)), () => this.actions.bounce());
      },
      spinDizzy: () => {
        const n = 3 + Math.round(Math.random());
        const dir = Math.random() < 0.5 ? -1 : 1;
        const dur = (0.55 + 0.16 * n) * 1000;
        // The dazed eyes belong to the state the spin started in: skip them if it has changed.
        const started = this.stateStart;
        this.tween(dur, (p, o) => (o.turn += 360 * n * dir * easeInCubic(p)), () => {
          if (this.stateStart !== started) return;
          const back = this.eyeName;
          this.setEyes("confused");
          this.tween(1500, (p, o) => {
            o.rot += 17 * Math.sin(10 * p * 1.5) * (1 - p);
            o.lid = lerp(0.46, 1, p * p);
          }, () => this.stateStart === started && this.setEyes(back));
        });
      },
      spinWild: () => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.tween(5490, (p, o) => {
          const e = easeInOutCubic(p);
          o.turn += 360 * 9 * dir * e;
          o.rot += 1080 * dir * e;
        });
      },
      bounce: () => {
        const hops = [
          { h: 48, d: 0.5 },
          { h: 28, d: 0.382 },
          { h: 14, d: 0.27 },
          { h: 6, d: 0.177 },
        ];
        const total = hops.reduce((a, b) => a + b.d, 0);
        this.tween(total * 1000, (p, o) => {
          let t = p * total;
          for (const hop of hops) {
            if (t <= hop.d) {
              const l = t / hop.d;
              o.y -= 4 * hop.h * l * (1 - l) * 0.55;
              o.sy += l < 0.12 || l > 0.9 ? -0.05 : 0.03;
              return;
            }
            t -= hop.d;
          }
        });
      },
      burst: (count = 22, speed = 1.1, swirl = 0.3) => {
        if (this.o.still) return;
        this.confetti.burst(C + this.s.x.x, C + this.s.y.x, count, speed, swirl);
      },
      nod: (depth = 4.5) =>
        this.tween(380, (p, o) => {
          const k = Math.sin(Math.PI * p);
          o.y += depth * k;
          o.tilt -= 8 * k;
          o.rot += 2 * k;
        }),
      shake: (amount = 6) => this.tween(500, (p, o) => (o.rot += amount * Math.sin(6 * Math.PI * p) * (1 - p))),
      kick: (ch, v) => {
        this.s[ch].v += v;
      },
      sigh: () =>
        this.tween(1400, (p, o) => {
          const k = Math.sin(Math.PI * p);
          o.sy += 0.05 * k;
          o.y -= 2 * k;
          o.lid = 1 - 0.35 * k;
        }),
      nodOff: () =>
        this.tween(3450, (p, o) => {
          const t = p * 3.45;
          if (t < 1.7) {
            const k = easeInOutCubic(t / 1.7);
            o.y += 19 * k;
            o.tilt -= 14 * k;
            o.lid = lerp(1, 0.04 / 0.34, k);
          } else if (t < 1.95) {
            const k = (t - 1.7) / 0.25;
            o.y += lerp(19, -4, k);
            o.tilt -= lerp(14, -4, k);
            o.lid = 2.9;
          } else {
            const k = easeInOutCubic((t - 1.95) / 1.5);
            o.y += lerp(-4, 0, k);
            o.tilt -= lerp(-4, 0, k);
            o.lid = lerp(2.9, 1, k);
          }
        }),
      setEyes: (name) => this.setEyes(name),
      after: (ms, run) => this.tween(ms, () => {}, () => run()),
      lip: () => this.lipValue,
      lipAge: () => (now() - this.lipAt) / 1000,
    };
  }

  /** Lip-sync input from the typewriter. */
  syllable(open: number) {
    this.lipValue = open;
    this.lipAt = now();
  }

  /* ---------- state machine ---------- */

  private resolveEffective(t: number): EngineState {
    if (!this.o.autoDoze || this.state !== "idle") return this.state;
    const idleFor = t - activity.at;
    if (idleFor > SLEEP_AFTER) return "sleeping";
    if (idleFor > DOZE_AFTER) return "drowsy";
    if (t < this.wakeUntil) return "waking";
    return "idle";
  }

  private enterState(name: EngineState, t: number) {
    const was = this.effective;
    this.effective = name;
    this.def = getState(name);
    this.stateStart = t;
    const d = this.def;
    this.winkUntil = 0;
    // Leftover motion from the previous state (a slow nod-off, a dizzy spin) would blend into the
    // new expression: drop it. Tweens started by the person (click spins) keep running.
    this.tweens = this.tweens.filter((tw) => !tw.fromState);
    this.setEyes(d.eyes.includes(this.eyeName) ? this.eyeName : d.eyes[0]);
    // Critically damped at ω=13 the eyes reach 90% in about 0.3 s, in step with the beak.
    this.s.eyeK.w = d.eyeSpeed ?? 13;
    const beak = BEAKS[d.beak ?? "closed"];
    this.s.brx.t = beak.rx;
    this.s.bry.t = beak.ry;
    const fx = d.fx ?? null;
    // A different mark replaces the old one with its own pop instead of swapping in place.
    if (fx && this.fxShown && fx !== this.fxShown) {
      this.s.fx.x = 0;
      this.s.fx.v = 0;
    }
    this.fxName = fx;
    if (fx) this.fxShown = fx;
    if (d.morph) {
      if (this.glyph !== d.morph) this.glyphStart = t;
      this.glyph = d.morph;
    }
    this.s.morphR.t = d.morphR ?? 30;
    this.nextExpr = t + (d.cadence ? rand(...d.cadence) : Infinity);
    this.nextBlink = t + (d.blink ? rand(1500, 7000) : Infinity);
    this.blinkKeys = [];
    this.nextSaccade = t + (d.saccade ? rand(...d.saccade) : Infinity);
    this.nextWink = t + (d.wink ? rand(4500, 10000) : Infinity);
    this.nextFlourish = t + (d.flourish ? rand(9000, 18000) : Infinity);
    this.timers = (d.every ?? []).map((e) => ({ at: t + rand(...(e.first ?? e.range)), range: e.range, run: e.run }));
    if (!this.o.still) this.stateHook(() => d.enter?.(this.actions));
    if ((was === "sleeping" || was === "drowsy") && name === "idle" && this.o.autoDoze) {
      this.wakeUntil = t + 1400;
      this.enterState("waking", t);
    }
  }

  private setEyes(name: EyeName) {
    if (name === this.eyeName && this.s.eyeK.t === 1) return;
    const k = clamp(this.s.eyeK.x, 0, 1);
    this.eyeFrom = [lerpRing(this.eyeFrom[0], this.eyeTo[0], k), lerpRing(this.eyeFrom[1], this.eyeTo[1], k)];
    this.eyeTo = [EYE_SETS[name][0], EYE_SETS[name][1]];
    this.eyeName = name;
    this.s.eyeK.x = 0;
    this.s.eyeK.v = 0;
    this.s.eyeK.t = 1;
  }

  private setShape(name: ShapeName) {
    const k = clamp(this.s.shapeK.x, 0, 1);
    this.shapeFrom = lerpRing(this.shapeFrom, getShape(this.shapeName).ring, k);
    this.shapeName = name;
    this.s.shapeK.x = 0;
    this.s.shapeK.v = 0;
    if (this.o.still) this.s.shapeK.x = 1;
  }

  private tween(ms: number, fn: Tween["fn"], done?: () => void) {
    if (this.o.still) return;
    this.tweens.push({ start: now(), dur: ms, fn, done, fromState: this.inStateHook });
  }

  private stateHook(run: () => void) {
    this.inStateHook = true;
    try {
      run();
    } finally {
      this.inStateHook = false;
    }
  }

  private blink(t: number) {
    this.blinkKeys = [
      { at: t, v: 0.05 },
      { at: t + 70, v: 0.05 },
      { at: t + 150, v: 1.08 },
      { at: t + 300, v: 1 },
    ];
    if (Math.random() < 0.14) this.blinkKeys.push({ at: t + 370, v: 0.05 }, { at: t + 480, v: 1 });
  }

  private wink(t: number) {
    if (this.winkUntil > t) return;
    this.winkBack = this.eyeName;
    this.setEyes(Math.random() < 0.5 ? "wink" : "winkR");
    this.winkUntil = t + 320;
  }

  /* ---------- frame ---------- */

  tick(t: number) {
    const dt = clamp((t - this.time) / 1000, 0, 0.1);
    this.time = t;
    if (this.o.frozen) return;

    const eff = this.resolveEffective(t);
    if (eff !== this.effective) this.enterState(eff, t);
    const d = this.def;

    // Scheduled micro-behaviours.
    if (t >= this.nextBlink && d.blink) {
      this.blink(t);
      this.nextBlink = t + rand(...d.blink);
    }
    if (t >= this.nextExpr && d.cadence) {
      const pool = d.eyes.filter((e) => e !== this.eyeName);
      if (this.winkUntil < t) this.setEyes(pool.length ? pick(pool) : d.eyes[0]);
      this.nextExpr = t + rand(...d.cadence);
    }
    if (t >= this.nextWink) {
      this.wink(t);
      this.nextWink = t + rand(4500, 10000);
    }
    if (this.winkUntil && t >= this.winkUntil) {
      this.winkUntil = 0;
      this.setEyes(this.winkBack);
    }
    if (t >= this.nextFlourish) {
      this.stateHook(() => this.flourish());
      this.nextFlourish = t + rand(9000, 18000);
    }
    if (t >= this.nextSaccade && d.saccade) {
      const [rx, ry] = d.gaze ?? [15, 9];
      const center = this.effective === "idle" && Math.random() < 0.45;
      this.s.gx.t = center ? 0 : rand(-rx, rx);
      this.s.gy.t = center ? 0 : rand(-ry, ry);
      this.nextSaccade = t + rand(...d.saccade);
    }
    for (const timer of this.timers) {
      if (t >= timer.at) {
        this.stateHook(() => timer.run(this.actions));
        timer.at = t + rand(...timer.range);
      }
    }

    // Base motion from the state.
    const tg = this.tg;
    tg.rot = 0;
    tg.x = 0;
    tg.y = 0;
    tg.sy = 1;
    tg.lid = 1;
    tg.eye = 1;
    tg.turn = 0;
    tg.tilt = 0;
    tg.open = null;
    d.motion?.((t - this.stateStart) / 1000, tg, this.actions);

    // One-shot tweens on top.
    const off = this.off;
    off.x = off.y = off.rot = off.turn = off.tilt = off.sy = 0;
    off.lid = null;
    this.tweens = this.tweens.filter((tw) => {
      const p = clamp((t - tw.start) / tw.dur, 0, 1);
      tw.fn(p, off);
      if (p >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });

    // Pointer attention: head turns toward the cursor, eyes lead a little.
    const attention = this.o.mouseInteractive ? (d.attention ?? 0) : 0;
    let ax = 0;
    let ay = 0;
    if (attention > 0 && pointer.has) {
      if (t - this.rect.at > 200) {
        const r = this.el.svg.getBoundingClientRect();
        this.rect = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, at: t };
      }
      ax = clamp((pointer.x - this.rect.x) / Math.max(this.rect.w * 3, 260), -1, 1);
      ay = clamp((pointer.y - this.rect.y) / Math.max(this.rect.h * 3, 260), -1, 1);
    }
    const k = 1 - Math.pow(0.84, 60 * dt);
    this.attn.x += (ax * attention - this.attn.x) * k;
    this.attn.y += (ay * attention - this.attn.y) * k;
    const recentPointer = t - pointer.at < 3000 && attention > 0;
    const sacc = recentPointer ? 0.2 : 1;
    const bias = d.gazeBias ?? [0, 0];

    // Blink keyframes.
    let blink = 1;
    for (const key of this.blinkKeys) if (t >= key.at) blink = key.v;
    if (this.blinkKeys.length && t > this.blinkKeys[this.blinkKeys.length - 1].at + 100) this.blinkKeys = [];

    const pose = this.o.pose ?? {};
    const s = this.s;
    s.rot.t = (pose.roll ?? tg.rot) + off.rot;
    s.x.t = tg.x + off.x;
    s.y.t = tg.y + off.y;
    s.sy.t = tg.sy + off.sy;
    s.lid.t = tg.lid * (off.lid ?? 1) * blink;
    s.eye.t = tg.eye;
    s.turn.t = (pose.turn ?? tg.turn + 34 * this.attn.x) + off.turn;
    s.tilt.t = (pose.tilt ?? tg.tilt - 16 * this.attn.y) + off.tilt;
    s.open.t = tg.open ?? BEAKS[d.beak ?? "closed"].open;
    s.morph.t = d.morph ? 1 : 0;
    s.fx.t = this.fxName ? 1 : 0;

    // Integrate in fixed substeps.
    let acc = dt;
    const all = Object.values(s);
    while (acc > 1e-6) {
      const h = Math.min(STEP, acc);
      for (const sp of all) stepSpring(sp, h);
      acc -= h;
    }
    // Rotations along the tween channels are applied directly (they would lag behind springs).
    this.lipValue *= Math.exp(-dt * 7);

    // Gaze = saccade + pointer lead + state bias.
    this.gaze = {
      x: s.gx.x * sacc + 8 * this.attn.x + bias[0],
      y: s.gy.x * sacc + 6 * this.attn.y + bias[1],
    };

    const turnNow = s.turn.x + s.spin.x;
    this.spinSpeed = dt > 0 ? (((turnNow - this.lastTurn) * Math.PI) / 180) / dt : 0;
    this.lastTurn = turnNow;

    this.confetti.update(dt);
    this.render();
  }

  private flourish() {
    const a = this.actions;
    if (this.effective === "playful") pick([a.bounce, a.spinDizzy, () => a.spin()])();
    else if (Math.random() < 0.55) a.spin();
    else a.spinBounce();
  }

  /** Jump every channel to its target (still frames, first paint). */
  private snap() {
    const fz = this.o.frozen;
    const d = this.def;
    const tg = this.tg;
    tg.rot = 0;
    tg.x = 0;
    tg.y = 0;
    tg.sy = 1;
    tg.lid = 1;
    tg.eye = 1;
    tg.turn = 0;
    tg.tilt = 0;
    tg.open = null;
    if (!fz) d.motion?.(this.effective === "waking" ? 2 : 0.6, tg, this.actions);
    const pose = this.o.pose ?? {};
    const s = this.s;
    const beak = BEAKS[fz?.beak ?? d.beak ?? "closed"];
    const set = (sp: Spring, v: number) => {
      sp.x = sp.t = v;
      sp.v = 0;
    };
    set(s.rot, fz?.roll ?? pose.roll ?? tg.rot);
    set(s.x, fz ? 0 : tg.x);
    set(s.y, fz?.y ?? tg.y);
    set(s.sy, fz ? 1 : tg.sy);
    set(s.lid, fz?.lid ?? tg.lid);
    set(s.eye, fz ? 1 : tg.eye);
    set(s.turn, fz?.turn ?? pose.turn ?? tg.turn);
    set(s.tilt, fz?.tilt ?? pose.tilt ?? tg.tilt);
    set(s.gx, fz?.gx ?? 0);
    set(s.gy, fz?.gy ?? 0);
    set(s.open, fz?.open ?? tg.open ?? beak.open);
    set(s.brx, beak.rx);
    set(s.bry, beak.ry);
    set(s.eyeK, 1);
    set(s.morph, !fz && d.morph ? 1 : 0);
    set(s.morphR, d.morphR ?? 30);
    set(s.shapeK, 1);
    set(s.spin, 0);
    const fx = fz ? (fz.fx ?? null) : this.fxName;
    this.fxName = fx;
    this.fxShown = fx;
    set(s.fx, fx ? 1 : 0);
    const eyes = fz?.eyes ?? (d.eyes.includes(this.eyeName) ? this.eyeName : d.eyes[0]);
    this.eyeName = eyes;
    this.eyeFrom = [EYE_SETS[eyes][0], EYE_SETS[eyes][1]];
    this.eyeTo = this.eyeFrom;
    this.shapeFrom = getShape(this.shapeName).ring;
    this.blinkKeys = [];
    this.tweens = [];
    this.gaze = { x: fz?.gx ?? (d.gazeBias?.[0] ?? 0), y: fz?.gy ?? (d.gazeBias?.[1] ?? 0) };
    this.lastTurn = s.turn.x;
    this.spinSpeed = 0;
  }

  /* ---------- drawing ---------- */

  private attr(el: Element, name: string, value: string) {
    const key = el as Element & { __pingu?: Record<string, string> };
    const memo = (key.__pingu ??= {});
    if (memo[name] === value) return;
    memo[name] = value;
    el.setAttribute(name, value);
  }

  render() {
    const s = this.s;
    const el = this.el;
    const shape = getShape(this.shapeName);
    const face = shape.face;
    const morphK = clamp(s.morph.x, 0, 1);
    const faceK = 1 - smoothstep(morphK * 1.4);

    // Glyph first: it decides where the morphed body sits.
    const glyphT = (this.time - this.glyphStart) / 1000;
    drawGlyph(morphK > 0.01 ? this.glyph : null, glyphT, morphK, el.glyph, this.glyphOut);
    if (morphK <= 0.01 && this.s.morph.t === 0) this.glyph = null;
    const morphR = this.glyph ? this.glyphOut.r : s.morphR.x;

    // Body outline: shape morph, then morph toward the glyph dot.
    const shapeK = clamp(s.shapeK.x, 0, 1);
    let ring = shapeK < 0.999 ? lerpRing(this.shapeFrom, shape.ring, shapeK, this.ringBuf) : shape.ring;
    if (morphK > 0.001) ring = lerpRing(ring, circleRing(morphR), morphK, this.ringBuf);
    const bodyD = ringPath(ring);
    this.attr(el.bodyPath, "d", bodyD);
    this.attr(el.clipPath, "d", bodyD);

    const bx = s.x.x + this.glyphOut.dx * morphK;
    const by = s.y.x + this.glyphOut.dy * morphK;
    const bottom = morphK > 0.5 ? morphR : shape.bottom;
    this.attr(
      el.body,
      "transform",
      `translate(${(C + bx).toFixed(2)} ${(C + by).toFixed(2)}) rotate(${s.rot.x.toFixed(2)}) translate(0 ${bottom.toFixed(1)}) scale(1 ${s.sy.x.toFixed(4)}) translate(0 ${(-bottom).toFixed(1)})`,
    );
    this.attr(el.glyphLayer, "transform", `translate(${(C + s.x.x).toFixed(2)} ${(C + s.y.x).toFixed(2)})`);

    // Face on the head sphere.
    const turn = s.turn.x + s.spin.x;
    const tilt = s.tilt.x;
    const faceScale = Math.min(face.rx / 90, face.ry / 67);
    const boost = this.o.boost * faceScale;
    const eyeK = clamp(s.eyeK.x, 0, 1);
    const eyeScale = s.eye.x * boost * faceK;
    const lid = Math.max(0.04, s.lid.x);
    for (let i = 0; i < 2; i++) {
      const lon = i === 0 ? -EYE_LON : EYE_LON;
      const p = project(lon, EYE_LAT, turn, tilt, face);
      const vis = smoothstep((p.z - 0.02) / 0.2);
      if (vis < 0.01 || eyeScale < 0.01) {
        this.attr(el.eyes[i], "d", "");
        continue;
      }
      const src = eyeK < 0.999 ? lerpRing(this.eyeFrom[i], this.eyeTo[i], eyeK, this.eyeBuf) : this.eyeTo[i];
      const placed = placeRing(
        src,
        p.x + this.gaze.x * p.z,
        p.y + this.gaze.y * Math.max(0.3, p.z),
        foreshorten(p.nx) * eyeScale * vis,
        lid * eyeScale,
        0,
        this.eyeBuf,
      );
      this.attr(el.eyes[i], "d", ringPath(placed));
    }

    // Beak: base on the surface, tip pushed along the head's forward axis.
    const base = project(0, BEAK_LAT, turn, tilt, face);
    const fwd = forward(turn, tilt, 0.3);
    const open = clamp(s.open.x, 0, 1.2);
    // At small sizes the eyes get a big boost to stay readable; the beak only a little.
    const beakScale = (1 + (this.o.boost - 1) * 0.3) * faceScale * faceK;
    const rx = s.brx.x * beakScale;
    const ry = s.bry.x * (1 + 0.28 * open) * beakScale;
    const depth = 30 * beakScale;
    const tipX = base.x + fwd.x * depth;
    const tipY = base.y + fwd.y * depth + ry * 0.12 * open;
    const side = clamp(Math.abs(fwd.x), 0, 1);
    let beakD = "";
    let mouthD = "";
    if (rx > 0.5) {
      const baseE = placeRing(ellipse(rx * Math.max(0.72, foreshorten(base.nx)), ry, 24), base.x, base.y + ry * 0.1 * open, 1, 1, 0);
      const tipE = placeRing(ellipse(rx * 0.6, ry * 0.8, 24), tipX, tipY, 1, 1, 0);
      beakD = ringPath(resample(convexHull([...baseE, ...tipE]), 40));
      if (open > 0.03) {
        const mrx = rx * 0.64 * Math.sqrt(open);
        const mry = ry * 0.46 * open;
        const mx = lerp(base.x, tipX, 0.15 + 0.5 * side);
        const my = lerp(base.y, tipY, 0.15 + 0.5 * side) + ry * 0.12 * (1 - side);
        const ang = side * ((Math.atan2(fwd.y, fwd.x) * 180) / Math.PI);
        mouthD = ringPath(placeRing(ellipse(lerp(mrx, mry * 0.8, side), lerp(mry, mrx * 0.9, side), 20), mx, my, 1, 1, ang));
      }
    }
    const behind = base.z < -0.05;
    this.attr(el.beak, "d", behind ? "" : beakD);
    this.attr(el.mouth, "d", behind ? "" : mouthD);
    this.attr(el.beakBack, "d", behind ? beakD : "");

    // Comic marks, on the side the head faces.
    const fxK = clamp(s.fx.x, 0, 1.3) * faceK;
    const fxName = this.fxName ?? this.fxShown;
    if (fxK > 0.01 && fxName) {
      const facing = Math.sin((turn * Math.PI) / 180);
      const sgn = Math.abs(facing) < 0.07 ? 1 : Math.sign(facing);
      const sound = fxName === "sound";
      const profile = side > 0.55 && sound;
      const edge = profile ? tipX + sgn * rx * 0.5 : sgn * (shape.halfW + 2);
      const y = profile ? tipY - ry * 0.4 : base.y - 18 * faceScale;
      const [strokeD, fillD, fillAlpha = 1] = fxPaths(fxName, this.time / 1000, sgn, edge, y, open);
      this.attr(el.fxStroke, "d", strokeD);
      this.attr(el.fxFill, "d", fillD);
      this.attr(el.fxFill, "opacity", fillAlpha.toFixed(3));
      this.attr(el.fx, "opacity", Math.min(1, fxK).toFixed(3));
      this.attr(
        el.fx,
        "transform",
        `translate(${(C + s.x.x).toFixed(2)} ${(C + s.y.x).toFixed(2)}) scale(${(0.6 + 0.4 * fxK).toFixed(3)})`,
      );
    } else {
      this.attr(el.fx, "opacity", "0");
      if (!this.fxName) this.fxShown = null;
    }

    this.trails.update(C + s.x.x, C + s.y.x + 8, (turn * Math.PI) / 180, this.spinSpeed);
  }
}
