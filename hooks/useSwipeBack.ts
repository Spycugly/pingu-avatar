"use client";

import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";

const EASE = "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * iOS-style swipe back on phones: dragging `pane` to the right follows the finger and reveals
 * `under` (which slides in from -30%, like the screen below on iOS). Released past a third of the
 * width, or flicked, the pane slides off and `onBack` runs; otherwise it springs back.
 * Per-frame movement is written to the DOM directly; `onPeek` tells the caller to show `under`
 * while the gesture runs. `paneKey` re-binds the listeners when the pane remounts.
 */
export function useSwipeBack({
  pane,
  under,
  active,
  paneKey,
  onPeek,
  onBack,
}: {
  pane: RefObject<HTMLElement | null>;
  under: RefObject<HTMLElement | null>;
  active: boolean;
  paneKey: string;
  onPeek: (peek: boolean) => void;
  onBack: () => void;
}) {
  const latest = useRef({ onPeek, onBack });
  useEffect(() => {
    latest.current = { onPeek, onBack };
  });

  useEffect(() => {
    const el = pane.current;
    if (!active || !el) return;
    type Swipe = { id: number; x0: number; y0: number; dx: number; on: boolean; lastX: number; lastT: number; v: number };
    let s: Swipe | null = null;
    let timer = 0;

    const paint = (dx: number) => {
      el.style.transform = dx ? `translateX(${dx}px)` : "";
      el.style.boxShadow = dx ? "-12px 0 32px rgb(0 0 0 / 0.25)" : "";
      const u = under.current;
      if (u) u.style.transform = `translateX(${-30 * (1 - dx / el.offsetWidth)}%)`;
    };
    const settle = (back: boolean) => {
      const u = under.current;
      el.style.transition = EASE;
      if (u) u.style.transition = EASE;
      paint(back ? el.offsetWidth : 0);
      timer = window.setTimeout(() => {
        // Swap the screens first, then drop the inline styles: in the other order the pane would
        // flash back in place for a frame.
        flushSync(() => {
          if (back) latest.current.onBack();
          latest.current.onPeek(false);
        });
        el.style.transition = el.style.transform = el.style.boxShadow = "";
        if (u) u.style.transition = u.style.transform = "";
      }, 270);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !window.matchMedia("(max-width: 767px)").matches) return;
      // Typing fields keep their own horizontal gestures (moving the caret).
      if ((e.target as Element).closest("input, textarea")) return;
      s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, on: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    };
    const move = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;
      if (!s.on) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        // Only a rightward, mostly horizontal drag is a swipe back; anything else is a scroll.
        if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) return void (s = null);
        s.on = true;
        el.setPointerCapture(e.pointerId);
        el.style.transition = "none";
        latest.current.onPeek(true);
      }
      const dt = e.timeStamp - s.lastT;
      if (dt > 0) s.v = (e.clientX - s.lastX) / dt;
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
      s.dx = Math.max(0, dx);
      paint(s.dx);
    };
    const up = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const done = s;
      s = null;
      if (done.on) settle(done.dx > el.offsetWidth / 3 || done.v > 0.5);
    };
    const cancel = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const done = s;
      s = null;
      if (done.on) settle(false);
    };

    // Once the drag is a swipe back, the finger moves the pane, not the page (React's touch
    // listeners are passive, so this one is added by hand).
    const hold = (e: TouchEvent) => {
      if (s?.on) e.preventDefault();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("touchmove", hold, { passive: false });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("touchmove", hold);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [pane, under, active, paneKey]);
}
