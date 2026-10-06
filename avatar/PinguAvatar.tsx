"use client";

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";
import { onPingu } from "./engine/bus";
import { C, PinguEngine, VIEW, type Frozen, type PinguEls } from "./engine/engine";
import type { ShapeName } from "./engine/shapes";
import { resolveState, type PinguState } from "./engine/states";
import { reducedMotion } from "./engine/ticker";

export type { PinguState } from "./engine/states";
export type { Frozen } from "./engine/engine";

export type PinguHandle = {
  spin(turns?: number): void;
  spinBounce(): void;
  spinDizzy(): void;
  spinWild(): void;
  bounce(): void;
  burst(count?: number): void;
  syllable(open: number): void;
};

export type PinguAvatarProps = {
  size?: number;
  /** Body colour: any CSS hex colour, or PINGU_AUTO (the default), which follows the theme through
      pingu-avatar.css: black in light mode, white in dark mode. */
  color?: string;
  state?: PinguState;
  /** Forces a state regardless of `state` (kept for older callers). */
  expression?: PinguState;
  shape?: ShapeName;
  /** Listens to lip-sync and actions sent for this agent on the Pingu bus. */
  agentId?: string;
  /** Pins the head pose (degrees); missing fields keep animating. */
  pose?: { turn?: number; tilt?: number; roll?: number };
  /** A hand-picked still frame. */
  frozen?: Frozen | null;
  /** Off renders one still frame (small or inactive avatars). Defaults to size ≥ 16. */
  animated?: boolean;
  mouseInteractive?: boolean;
  /** Doze off, then sleep, when nobody touches anything for a while. */
  autoDoze?: boolean;
  badge?: boolean;
  /** "tight" crops close to the body (list avatars); "roomy" leaves space for beak and confetti. */
  fit?: "tight" | "roomy";
  /** Outline around the body in this colour (CSS colour or var), to separate overlapping avatars. */
  ring?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  ref?: Ref<PinguHandle>;
};

export const PINGU_WHITE = "#f7f7f4";
/** Theme-following body: --pingu-auto-body / --pingu-auto-eye, set by pingu-avatar.css. */
export const PINGU_AUTO = "auto";
const EYE = "#0b0b0b";
const BEAK = "#ff5236";
/** Red beaks vanish on red, orange, pink and purple bodies: those get an amber one. */
const BEAK_ON_WARM = "#ffc233";
const MOUTH = "#5c1610";

const EYE_ON_DARK = "#f7f7f4";

/** Eye colour for a body: coloured bodies follow the theme like the auto Pingu, light eyes on
    light pages and dark eyes on dark ones. Only near-black bodies always get light eyes and
    near-white ones dark eyes, where the face would otherwise vanish. */
function eyeFor(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return EYE;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma < 0.22) return EYE_ON_DARK;
  if (luma > 0.85) return EYE;
  return `var(--pingu-auto-eye, ${EYE})`;
}

/** Beak colour for a body: amber on saturated reds, oranges, pinks and purples (hue 0–36° or
    250–360°), where the red beak would melt in; the usual red everywhere else. */
function beakFor(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return BEAK;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.35) return BEAK;
  const hue = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return hue <= 36 || hue >= 250 ? BEAK_ON_WARM : BEAK;
}

/** Robot-free Pingu: a white mochi penguin driven by the Pingu Bot engine (a Grok Bot port). */
export default function PinguAvatar({
  size = 40,
  color = PINGU_AUTO,
  state = "idle",
  expression,
  shape = "mochi",
  agentId,
  pose,
  frozen,
  animated,
  mouseInteractive = true,
  autoDoze = false,
  badge = false,
  fit,
  ring,
  className = "",
  title,
  onClick,
  ref,
}: PinguAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<PinguEngine | null>(null);

  const engineState = resolveState(expression ?? state);
  const still = !(animated ?? size >= 16) || !!frozen;
  const boost = size < 40 ? 1.3 : size < 90 ? 1.12 : 1;
  const poseKey = pose ? JSON.stringify(pose) : "";
  const frozenKey = frozen ? JSON.stringify(frozen) : "";
  const tight = (fit ?? (size < 64 ? "tight" : "roomy")) === "tight";
  const box = tight ? 200 : VIEW;
  const origin = C - box / 2;

  useLayoutEffect(() => {
    const options = {
      shape,
      state: engineState,
      mouseInteractive,
      boost,
      autoDoze,
      pose: poseKey ? JSON.parse(poseKey) : undefined,
      frozen: frozenKey ? (JSON.parse(frozenKey) as Frozen) : null,
      still: still || reducedMotion(),
    };
    if (engineRef.current) {
      engineRef.current.update(options);
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const q = <T extends Element>(name: string) => svg.querySelector(`[data-p="${name}"]`) as T;
    const els: PinguEls = {
      svg,
      body: q("body"),
      bodyPath: q("body-path"),
      clipPath: q("clip-path"),
      eyes: [q("eye-l"), q("eye-r")],
      beak: q("beak"),
      mouth: q("mouth"),
      beakBack: q("beak-back"),
      fx: q("fx"),
      fxStroke: q("fx-stroke"),
      fxFill: q("fx-fill"),
      glyphLayer: q("glyph"),
      glyph: {
        parts: Array.from(svg.querySelectorAll('[data-p="part"]')) as SVGCircleElement[],
        rings: Array.from(svg.querySelectorAll('[data-p="ring"]')) as SVGCircleElement[],
        paths: Array.from(svg.querySelectorAll('[data-p="glyph-path"]')) as SVGPathElement[],
      },
      back: q("back"),
      front: q("front"),
    };
    engineRef.current = new PinguEngine(els, options);
  }, [shape, engineState, mouseInteractive, boost, autoDoze, poseKey, frozenKey, still]);

  useLayoutEffect(
    () => () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!agentId) return;
    return onPingu(agentId, (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.type === "syllable") engine.syllable(e.open);
      else if (e.type === "keystroke") engine.actions.nod(2.5);
      else if (e.name === "burst") engine.actions.burst();
      else engine.actions[e.name]();
    });
  }, [agentId]);

  useImperativeHandle(
    ref,
    () => ({
      spin: (n) => engineRef.current?.actions.spin(n),
      spinBounce: () => engineRef.current?.actions.spinBounce(),
      spinDizzy: () => engineRef.current?.actions.spinDizzy(),
      spinWild: () => engineRef.current?.actions.spinWild(),
      bounce: () => engineRef.current?.actions.bounce(),
      burst: (n) => engineRef.current?.actions.burst(n),
      syllable: (open) => engineRef.current?.syllable(open),
    }),
    [],
  );

  const clip = `${uid}-clip`;
  const auto = color === PINGU_AUTO;

  return (
    <svg
      ref={svgRef}
      viewBox={`${origin} ${origin} ${box} ${box}`}
      width={size}
      height={size}
      className={`pingu ${className}`}
      // Plain inline styles so the component needs no CSS framework. Overflow stays visible:
      // confetti, comic marks and the beak in profile reach past the viewBox.
      style={
        {
          overflow: "visible",
          flexShrink: 0,
          cursor: onClick ? "pointer" : undefined,
          WebkitTapHighlightColor: "transparent",
          // "auto" follows the theme through pingu-avatar.css; without it, the white Pingu.
          "--pingu-body": auto ? `var(--pingu-auto-body, ${PINGU_WHITE})` : color,
          "--pingu-eye": auto ? `var(--pingu-auto-eye, ${EYE})` : eyeFor(color),
          "--pingu-beak": auto ? BEAK : beakFor(color),
          "--pingu-mouth": MOUTH,
        } as CSSProperties
      }
      onClick={onClick}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <path data-p="clip-path" />
        </clipPath>
      </defs>
      <g data-p="back" />
      <g data-p="body">
        <path data-p="beak-back" fill="var(--pingu-beak)" />
        <path
          data-p="body-path"
          fill="var(--pingu-body)"
          stroke={ring ?? "none"}
          strokeWidth={ring ? 32 : 0}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
        <g clipPath={`url(#${clip})`} fill="var(--pingu-eye)">
          <path data-p="eye-l" />
          <path data-p="eye-r" />
        </g>
        <path
          data-p="beak"
          fill="var(--pingu-beak)"
        />
        <path data-p="mouth" fill="var(--pingu-mouth)" />
      </g>
      <g data-p="glyph">
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={`r${i}`} data-p="ring" fill="none" stroke="var(--pingu-body)" opacity={0} r={0} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={`p${i}`} data-p="part" fill="var(--pingu-body)" opacity={0} r={0} />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={`g${i}`} data-p="glyph-path" opacity={0} />
        ))}
      </g>
      <g data-p="fx" opacity={0}>
        <path
          data-p="fx-stroke"
          fill="none"
          stroke="var(--pingu-fx, currentColor)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Only the sweat drop fills: a blue outline keeps it readable on any body colour. */}
        <path
          data-p="fx-fill"
          fill="var(--pingu-sweat, #6ec4ff)"
          stroke="var(--pingu-sweat-line, #2b8fd6)"
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      </g>
      <g data-p="front" />
      {badge && (
        <circle
          cx={origin + box * 0.86}
          cy={origin + box * 0.16}
          r={box * 0.12}
          fill="#ff3b30"
          stroke="var(--pingu-badge-ring, #151514)"
          strokeWidth={box * 0.04}
        />
      )}
    </svg>
  );
}
