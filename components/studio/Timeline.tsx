"use client";

import { useRef, useState } from "react";
import { CaretDown, DownloadSimple, Minus, Pause, Play, Plus, X } from "@phosphor-icons/react";
import { PinguAvatar, type ShapeName } from "@/avatar";
import { useI18n } from "@/lib/i18n";
import { clipStarts, getAnimation, MAX_DUR, MIN_DUR, type Clip } from "@/lib/montage";

/* Grok Bot's montage strip: preset picker, transport, ruler, clips sized by duration. */

const PX = 56; // pixels per second
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
  onReorder,
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
  onReorder: (from: string, to: string) => void;
  onPreset: (preset: "default" | "empty") => void;
  onExport: () => void;
}) {
  const { t } = useI18n();
  const [dragKey, setDragKey] = useState<string | null>(null);
  /** Clip whose right edge is being dragged to change its duration. */
  const [resizing, setResizing] = useState<string | null>(null);
  const resize = useRef<{ key: string; x: number; dur: number } | null>(null);
  /** Swallows the click that ends a resize drag, so it does not also select and seek. */
  const justResized = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const total = clips.reduce((s, c) => s + c.dur, 0);
  const width = Math.max(total * PX, 300);

  const starts = clipStarts(clips);

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

      <div className="scroll-thin overflow-x-auto pb-2">
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
            <div className="mt-1 flex">
              {clips.map((c, i) => {
                const anim = getAnimation(c.anim);
                const active = c.key === selected;
                return (
                  <div
                    key={c.key}
                    draggable={resizing === null}
                    onDragStart={() => setDragKey(c.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragKey && dragKey !== c.key) onReorder(dragKey, c.key);
                      setDragKey(null);
                    }}
                    // A drop outside any clip never fires onDrop: clear the faded state here too.
                    onDragEnd={() => setDragKey(null)}
                    onClick={() => {
                      if (justResized.current) return;
                      onSelect(c.key);
                      onSeek(starts[i] + 0.001);
                    }}
                    className="group relative shrink-0 cursor-grab px-0.5 active:cursor-grabbing"
                    style={{ width: c.dur * PX }}
                    title={t(anim.label)}
                  >
                    <div
                      className={`flex h-[84px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 transition ${
                        active ? "border-st-selected bg-st-surface" : "border-transparent bg-st-hover hover:border-st-line"
                      } ${dragKey === c.key ? "opacity-40" : ""}`}
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
                        justResized.current = true;
                        window.setTimeout(() => (justResized.current = false), 0);
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
