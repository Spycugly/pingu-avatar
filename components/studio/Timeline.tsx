"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CaretDown, DownloadSimple, Minus, Pause, Play, Plus, X } from "@phosphor-icons/react";
import { PinguAvatar, type ShapeName } from "@/avatar";
import { useI18n } from "@/lib/i18n";
import { clipStarts, getAnimation, MAX_DUR, MIN_DUR, type Clip } from "@/lib/montage";

/* Grok Bot's montage strip: preset picker, transport, ruler, clips sized by duration. */

const PX = 56; // pixels per second
/** Touch picks a clip up after a still press, so a quick swipe still scrolls the strip. */
const LONG_PRESS_MS = 280;
/** Strip edge band (px) where a dragged clip scrolls it. */
const EDGE = 40;

/** A press on a clip: becomes a drag once the mouse moves, or once a finger has held still. */
type Press = { key: string; id: number; x0: number; y0: number; scroll0: number; touch: boolean; active: boolean; timer?: number };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Timeline({
  clips,
  time,
  playing,
  selected,
  shape,
  color,
  outline,
  onPlay,
  onSeek,
  onSelect,
  onRemove,
  onResize,
  onMove,
  onPreset,
  onExport,
}: {
  clips: Clip[];
  time: number;
  playing: boolean;
  selected: string | null;
  shape: ShapeName;
  color: string;
  outline: string;
  onPlay: () => void;
  onSeek: (t: number) => void;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
  onResize: (key: string, dur: number) => void;
  /** Moves a clip to `index` among the other clips. */
  onMove: (key: string, index: number) => void;
  onPreset: (preset: "default" | "empty") => void;
  onExport: () => void;
}) {
  const { t } = useI18n();
  /** The clip being dragged, how far it has travelled and the slot it would drop into. */
  const [drag, setDrag] = useState<{ key: string; dx: number; slot: number } | null>(null);
  const press = useRef<Press | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  /** Clip whose right edge is being dragged to change its duration. */
  const [resizing, setResizing] = useState<string | null>(null);
  const resize = useRef<{ key: string; x: number; dur: number } | null>(null);
  /** Swallows the click that ends a resize or a move, so it does not also select and seek. */
  const justResized = useRef(false);
  const swallowClick = () => {
    justResized.current = true;
    window.setTimeout(() => (justResized.current = false), 0);
  };
  const track = useRef<HTMLDivElement>(null);
  const total = clips.reduce((s, c) => s + c.dur, 0);
  const width = Math.max(total * PX, 300);

  const starts = clipStarts(clips);

  // Once a finger has picked a clip up, its moves drag the clip instead of scrolling the strip or the
  // page. React's touch listeners are passive, so this one is added by hand.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (press.current?.active) e.preventDefault();
    };
    el.addEventListener("touchmove", hold, { passive: false });
    return () => el.removeEventListener("touchmove", hold);
  }, []);

  /** Slot among the other clips for a pointer at `x` (track px): after every clip whose middle it passed. */
  const slotAt = (key: string, x: number) =>
    clips.filter((c, i) => c.key !== key && (starts[i] + c.dur / 2) * PX < x).length;

  const endPress = () => {
    window.clearTimeout(press.current?.timer);
    press.current = null;
    setDrag(null);
  };

  const pickUp = (p: Press) => {
    p.active = true;
    setDrag({ key: p.key, dx: 0, slot: clips.findIndex((c) => c.key === p.key) });
    navigator.vibrate?.(8);
  };

  const onClipDown = (e: PointerEvent<HTMLDivElement>, key: string) => {
    // The remove, +/- buttons and the resize handle have their own gestures.
    if (e.button !== 0 || (e.target as Element).closest("button, [role=separator]")) return;
    const p: Press = {
      key,
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      scroll0: scroller.current?.scrollLeft ?? 0,
      touch: e.pointerType === "touch",
      active: false,
    };
    if (p.touch) p.timer = window.setTimeout(() => press.current === p && pickUp(p), LONG_PRESS_MS);
    press.current = p;
  };

  const onClipMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.active) {
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      // A finger that moves before the long press is scrolling: let it.
      if (p.touch) return void (moved > 8 && endPress());
      if (moved < 5) return;
      pickUp(p);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const sc = scroller.current;
    const tr = track.current;
    if (!sc || !tr) return;
    const box = sc.getBoundingClientRect();
    if (e.clientX < box.left + EDGE) sc.scrollLeft -= 10;
    else if (e.clientX > box.right - EDGE) sc.scrollLeft += 10;
    const dx = e.clientX - p.x0 + sc.scrollLeft - p.scroll0;
    setDrag({ key: p.key, dx, slot: slotAt(p.key, e.clientX - tr.getBoundingClientRect().left) });
  };

  const onClipUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (p.active && drag) {
      if (drag.slot !== clips.findIndex((c) => c.key === p.key)) onMove(p.key, drag.slot);
      swallowClick();
    }
    endPress();
  };

  // Where the dragged clip would land: the left edge of the clip it goes before, or the end.
  const from = drag ? clips.findIndex((c) => c.key === drag.key) : -1;
  const others = drag ? clips.map((c, i) => ({ c, i })).filter(({ c }) => c.key !== drag.key) : [];
  const marker =
    drag && drag.slot !== from
      ? drag.slot < others.length
        ? starts[others[drag.slot].i] * PX
        : (starts[others.at(-1)!.i] + others.at(-1)!.c.dur) * PX
      : null;

  const seekFromPointer = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const x = clientX - el.getBoundingClientRect().left;
    onSeek(Math.min(total - 0.001, Math.max(0, x / PX)));
  };

  return (
    <div className="w-full">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mb-4 sm:gap-3">
        <label className="relative min-w-0 justify-self-start">
          <select
            onChange={(e) => onPreset(e.target.value as "default" | "empty")}
            defaultValue="default"
            className="w-full max-w-full appearance-none truncate bg-transparent py-1 pr-6 text-[15px] font-medium text-st-ink focus:outline-none"
          >
            <option value="default">{t("montage.defaultCycle")}</option>
            <option value="empty">{t("montage.empty")}</option>
          </select>
          <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-st-muted" />
        </label>

        <div className="flex items-center gap-2 text-[15px] tabular-nums text-st-ink sm:gap-4">
          <span className="w-10 text-right">{fmt(time)}</span>
          <button
            onClick={onPlay}
            disabled={!clips.length}
            className="grid size-11 place-items-center sm:size-12 rounded-full bg-st-accent text-st-accent-ink transition hover:scale-105 disabled:opacity-40"
            aria-label={playing ? t("montage.pause") : t("montage.play")}
            title={playing ? t("montage.pause") : t("montage.play")}
          >
            {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
          </button>
          <span className="w-10 text-st-muted">{fmt(total)}</span>
        </div>

        <button
          onClick={onExport}
          disabled={!clips.length}
          className="flex h-10 items-center gap-2 justify-self-end rounded-xl bg-st-accent px-3 text-[14px] text-st-accent-ink transition hover:opacity-90 disabled:opacity-40 sm:px-4"
          aria-label={t("montage.export")}
        >
          <DownloadSimple size={16} weight="bold" />
          {/* Icon only on phones: the label pushed the button off screen. */}
          <span className="max-sm:hidden">{t("montage.export")}</span>
        </button>
      </div>

      <div ref={scroller} className="scroll-thin overflow-x-auto pb-2">
        {clips.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-st-muted">{t("montage.hint")}</p>
        ) : (
          <div ref={track} className="relative" style={{ width }}>
            {/* ruler */}
            <div
              className="relative h-6 cursor-pointer touch-none"
              onPointerDown={(e) => seekFromPointer(e.clientX)}
              onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e.clientX)}
            >
              {Array.from({ length: Math.floor(total) + 1 }, (_, s) => (
                <span
                  key={s}
                  className={`absolute bottom-0 w-px ${s % 2 === 0 ? "h-3 bg-st-line-strong" : "h-1.5 bg-st-line"}`}
                  style={{ left: s * PX }}
                >
                  {s % 2 === 0 && (
                    <span className="absolute bottom-3 left-0.5 text-[12px] leading-none text-st-muted">{s}s</span>
                  )}
                </span>
              ))}
            </div>

            {/* clips */}
            <div className="relative mt-1 flex">
              {clips.map((c, i) => {
                const anim = getAnimation(c.anim);
                const active = c.key === selected;
                const lifted = drag?.key === c.key;
                return (
                  <div
                    key={c.key}
                    onPointerDown={(e) => onClipDown(e, c.key)}
                    onPointerMove={onClipMove}
                    onPointerUp={onClipUp}
                    onPointerCancel={endPress}
                    // A long press would otherwise open the browser's context menu.
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (justResized.current) return;
                      onSelect(c.key);
                      onSeek(starts[i] + 0.001);
                    }}
                    className={`group relative shrink-0 cursor-grab select-none px-0.5 [-webkit-touch-callout:none] ${
                      lifted ? "z-10 cursor-grabbing" : ""
                    }`}
                    style={{ width: c.dur * PX, transform: lifted ? `translateX(${drag.dx}px)` : undefined }}
                    title={t(anim.label)}
                  >
                    <div
                      className={`flex h-[84px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 transition ${
                        lifted
                          ? "scale-105 border-st-selected bg-st-raised shadow-[var(--st-shadow)]"
                          : active
                            ? "border-st-selected bg-st-surface"
                            : "border-transparent bg-st-hover hover:border-st-line"
                      }`}
                    >
                      <PinguAvatar size={34} shape={anim.shape ?? shape} color={color} state={anim.state} animated={false} className={outline} />
                      <span className="flex items-center gap-1 whitespace-nowrap text-[12px] tabular-nums text-st-muted">
                        {active && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResize(c.key, Math.max(MIN_DUR, +(c.dur - 0.2).toFixed(1)));
                            }}
                            className="grid size-4 place-items-center rounded-full hover:bg-st-hover hover:text-st-ink"
                            aria-label={t("montage.shorter")}
                          >
                            <Minus size={10} weight="bold" />
                          </button>
                        )}
                        {c.dur.toFixed(1)} s
                        {active && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResize(c.key, Math.min(MAX_DUR, +(c.dur + 0.2).toFixed(1)));
                            }}
                            className="grid size-4 place-items-center rounded-full hover:bg-st-hover hover:text-st-ink"
                            aria-label={t("montage.longer")}
                          >
                            <Plus size={10} weight="bold" />
                          </button>
                        )}
                      </span>
                    </div>
                    {/* Right edge: drag to change the duration (0.1 s steps). */}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t("montage.resize")}
                      title={t("montage.resize")}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        resize.current = { key: c.key, x: e.clientX, dur: c.dur };
                        setResizing(c.key);
                      }}
                      onPointerMove={(e) => {
                        const r = resize.current;
                        if (!r || r.key !== c.key) return;
                        const dur = Math.round((r.dur + (e.clientX - r.x) / PX) * 10) / 10;
                        const next = Math.min(MAX_DUR, Math.max(MIN_DUR, dur));
                        if (next !== c.dur) onResize(c.key, next);
                      }}
                      onPointerUp={(e) => {
                        if (!resize.current) return;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        resize.current = null;
                        setResizing(null);
                        swallowClick();
                      }}
                      onPointerCancel={() => {
                        resize.current = null;
                        setResizing(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-y-0 right-0 z-[2] flex w-3 cursor-ew-resize touch-none items-center justify-center"
                    >
                      <span
                        className={`h-8 w-1 rounded-full bg-st-line-strong transition-opacity ${
                          active || resizing === c.key ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(c.key);
                      }}
                      // Also shown on the selected clip: touch screens have no hover to reveal it.
                      className={`absolute -top-1.5 right-0 size-5 place-items-center rounded-full bg-st-surface text-[12px] text-st-muted shadow-[var(--st-shadow)] hover:text-st-ink group-hover:grid ${
                        active ? "grid" : "hidden"
                      }`}
                      aria-label={t("montage.remove")}
                      title={t("montage.remove")}
                    >
                      <X size={11} weight="bold" />
                    </button>
                  </div>
                );
              })}
              {marker !== null && (
                <span
                  className="pointer-events-none absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-st-selected"
                  style={{ left: marker }}
                />
              )}
            </div>

            {/* playhead */}
            <div className="pointer-events-none absolute bottom-0 top-3 w-0.5 -translate-x-1/2 bg-st-ink" style={{ left: time * PX }}>
              <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-st-ink" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
