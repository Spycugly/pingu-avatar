"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { LONG_PRESS_MS } from "./Timeline";

type Press<T> = { item: T; id: number; x0: number; y0: number; touch: boolean; active: boolean; timer?: number };

type Handlers<T> = {
  /** The tile is lifted and the pointer is at (x, y), in client px. */
  onMove: (item: T, x: number, y: number) => void;
  /** The lifted tile was released at (x, y). */
  onDrop: (item: T, x: number, y: number) => void;
  /** The drag is over (dropped or cancelled). */
  onEnd: () => void;
};

/**
 * Drags catalogue tiles, with the same gestures as the timeline's clips: a mouse lifts a tile once it
 * moves, a finger once it has held still for a moment, so a quick swipe still scrolls the page.
 */
export function useTileDrag<T>(handlers: Handlers<T>) {
  const press = useRef<Press<T> | null>(null);
  /** Set right after a drop, so the click that follows does not also add the animation. */
  const dropped = useRef(false);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const end = () => {
      const p = press.current;
      if (!p) return;
      window.clearTimeout(p.timer);
      press.current = null;
      if (p.active) latest.current.onEnd();
    };
    const move = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (!p.active) {
        const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
        // A finger that moves before the long press is scrolling: let it.
        if (p.touch) return void (moved > 8 && end());
        if (moved < 5) return;
        p.active = true;
      }
      latest.current.onMove(p.item, e.clientX, e.clientY);
    };
    const up = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (p.active) {
        latest.current.onDrop(p.item, e.clientX, e.clientY);
        dropped.current = true;
        window.setTimeout(() => (dropped.current = false), 0);
      }
      end();
    };
    const cancel = (e: globalThis.PointerEvent) => {
      if (press.current?.id === e.pointerId) end();
    };
    // While a tile is lifted, the finger drags it instead of scrolling the page.
    const hold = (e: TouchEvent) => {
      if (press.current?.active) e.preventDefault();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", hold, { passive: false });
    return () => {
      end();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", hold);
    };
  }, []);

  /** Pointer-down handler for a tile carrying `item`. */
  const start = (e: PointerEvent<HTMLElement>, item: T) => {
    if (e.button !== 0) return;
    const p: Press<T> = {
      item,
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      touch: e.pointerType === "touch",
      active: false,
    };
    if (p.touch)
      p.timer = window.setTimeout(() => {
        if (press.current !== p) return;
        p.active = true;
        navigator.vibrate?.(8);
        latest.current.onMove(item, p.x0, p.y0);
      }, LONG_PRESS_MS);
    press.current = p;
  };

  return { start, justDropped: () => dropped.current };
}
