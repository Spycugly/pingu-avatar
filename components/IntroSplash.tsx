"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PinguAvatar } from "@/avatar";
import { CAST_COLORS, HEARTS, HEART_TRACK, INTRO_CAST, INTRO_FPS, INTRO_FRAMES, INTRO_SIZE } from "@/lib/intro-frames";

const FADE_MS = 200;
/** The fade starts during the last heart hold, so the whole intro ends with the loop (~1.8 s). */
const FADE_AT = INTRO_FRAMES - (FADE_MS / 1000) * INTRO_FPS;
/** Mochi bodies are wider than the video's shapes: a touch smaller keeps the gaps between them. */
const FIT = 0.9;
/** Fill per heart: the outline follows the theme, the filled heart keeps the video's pink. */
const HEART_FILLS = ["var(--intro-line)", "#e7007d"];

/** Once per page load: client-side navigation back to the home page does not replay it. */
let played = false;

/** True when this page load landed on the home page. Opening the editor from the chat is a
    client-side navigation from /chat and must not play the intro over it. (During that render
    location.pathname still reads /chat, so compare with the home path itself.) */
function landedHere() {
  if (typeof window === "undefined") return true;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return !nav || new URL(nav.name).pathname === "/";
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pct = (v: number) => `${(v / INTRO_SIZE) * 100}%`;

/** Heart at fractional frame `f`, interpolated with the next frame when it shows the same heart. */
function heartAt(f: number) {
  const i = Math.floor(f);
  const a = HEART_TRACK[i];
  const b = HEART_TRACK[i + 1];
  if (!a) return null;
  if (!b || b[0] !== a[0]) return a;
  const t = f - i;
  return [a[0], lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

/** Opening animation: the traced intro loop (lib/intro-frames.ts) replayed frame by frame, with the five shapes recast as Pingus. */
export default function IntroSplash() {
  const [phase, setPhase] = useState<"play" | "fade" | "done">(() => (played || !landedHere() ? "done" : "play"));
  /** Eyelids change a handful of times per loop, so they go through React; motion does not. */
  const [lids, setLids] = useState("1,1,1,1,1");
  const hearts = useRef<(SVGPathElement | null)[]>([]);
  const cast = useRef<(HTMLDivElement | null)[]>([]);
  // Read at first render: StrictMode re-runs the effect after it has already set `played`.
  const replay = useRef(phase === "done");

  useEffect(() => {
    if (replay.current) return;
    played = true;
    // Reduced motion: the overlay is hidden by CSS from the first paint, nothing to play.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start: number | null = null;
    const draw = (f: number) => {
      const heart = heartAt(f);
      hearts.current.forEach((el, i) => {
        if (!el) return;
        if (!heart || heart[0] !== i) {
          el.setAttribute("visibility", "hidden");
          return;
        }
        const [, cx, cy, s] = heart;
        el.setAttribute("visibility", "visible");
        el.setAttribute("transform", `translate(${cx} ${cy}) scale(${s}) translate(${-HEARTS[i].ox} ${-HEARTS[i].oy})`);
      });
      const i0 = Math.floor(f);
      const t = f - i0;
      const a = INTRO_CAST[i0];
      const b = INTRO_CAST[i0 + 1] ?? a;
      cast.current.forEach((el, i) => {
        if (!el) return;
        if (!a || !b) {
          el.style.visibility = "hidden";
          return;
        }
        const [cx, cy, size, rot] = a[i].map((v, k) => lerp(v, b[i][k], t));
        el.style.visibility = "visible";
        el.style.left = pct(cx);
        el.style.top = pct(cy);
        el.style.width = el.style.height = pct(size * FIT);
        el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      });
      // Lids snap to tenths: fine enough for a blink, few enough to keep React out of the frame loop.
      if (a && b) setLids(a.map((p, i) => Math.round(lerp(p[4], b[i][4], t) * 10) / 10).join(","));
    };
    const tick = (now: number) => {
      start ??= now;
      // Fractional frame from elapsed time: smooth at any refresh rate, never slower than the video.
      const f = Math.min(INTRO_FRAMES - 1, ((now - start) / 1000) * INTRO_FPS);
      draw(f);
      if (f >= FADE_AT) setPhase((p) => (p === "play" ? "fade" : p));
      if (f < INTRO_FRAMES - 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => setPhase((p) => (p === "play" ? "fade" : p));
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const lidList = useMemo(() => lids.split(",").map(Number), [lids]);

  if (phase === "done") return null;

  const first = HEART_TRACK[0]!;
  return (
    <div
      aria-hidden
      onClick={() => setPhase("fade")}
      // Page background of each theme: white in light mode, the chat's #0d0d0d in dark mode.
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white [--intro-line:#a3a3a3] transition-opacity ease-out motion-reduce:hidden dark:bg-gb-page dark:[--intro-line:#bababa]"
      style={{ opacity: phase === "fade" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="relative size-[min(100vw,100dvh)]">
        <svg viewBox={`0 0 ${INTRO_SIZE} ${INTRO_SIZE}`} fillRule="evenodd" className="absolute inset-0 size-full">
          {HEARTS.map((h, i) => (
            <path
              key={i}
              ref={(el) => {
                hearts.current[i] = el;
              }}
              fill={HEART_FILLS[i]}
              d={h.path}
              visibility={i === first[0] ? "visible" : "hidden"}
              transform={`translate(${first[1]} ${first[2]}) scale(${first[3]}) translate(${-h.ox} ${-h.oy})`}
            />
          ))}
        </svg>
        {CAST_COLORS.map((color, i) => (
          <div
            key={color}
            ref={(el) => {
              cast.current[i] = el;
            }}
            className="invisible absolute will-change-transform"
          >
            <PinguAvatar
              size={200}
              color={color}
              fit="roomy"
              frozen={{ lid: lidList[i] }}
              mouseInteractive={false}
              className="size-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
