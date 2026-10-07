"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CaretDown, Check, Copy, Desktop, DownloadSimple, GithubLogo, Moon, Sun, X } from "@phosphor-icons/react";
import { PINGU_AUTO, PinguAvatar, syllableFor, type EngineState, type PinguHandle, type ShapeName } from "@/avatar";
import NavRail, { useTheme, type RailItem, type ThemePref } from "./NavRail";
import Timeline, { type DropTarget, type TimelineHandle } from "./studio/Timeline";
import { useTileDrag } from "./studio/useTileDrag";
import MontageDialog, { type MontageBackground, type MontageFormat } from "./studio/MontageDialog";
import {
  copyPng,
  copySvg,
  downloadPng,
  downloadSvg,
  framesToAnimatedSvg,
  framesToGif,
  framesToVideo,
  recordFrames,
  save,
} from "@/avatar/export";
import { LANGS, useI18n, type Key } from "@/lib/i18n";
import { play, setSoundOn, useSoundOn } from "@/lib/sound";
import { GITHUB_URL, LINKEDIN_URL } from "@/lib/links";
import { ANIMATIONS, clipStarts, defaultCycle, getAnimation, makeClip, type AnimId, type Clip } from "@/lib/montage";

/* A port of the Grok Bot customizer: shape, expression and colour on the right, tools on a
   floating rail, the big Pingu in the middle with its export menu, and a montage timeline. */

const SHAPES: ShapeName[] = ["mochi", "blob", "pebble", "egg", "squircle", "wedge", "hex", "cloud"];

const EXPRESSIONS: EngineState[] = [
  "idle", "listening", "surprised", "excited",
  "happy", "laughing", "angry", "sad",
  "scared", "suspicious", "confused", "curious",
  "proud", "shy", "bored", "drowsy",
];

const COLORS: { hex: string; label: Key }[] = [
  // Black in light mode, white in dark mode: one half-and-half swatch.
  { hex: PINGU_AUTO, label: "color.auto" },
  { hex: "#8b5a3c", label: "color.brown" },
  { hex: "#e8443a", label: "color.red" },
  { hex: "#f08a24", label: "color.orange" },
  { hex: "#f2b824", label: "color.yellow" },
  { hex: "#3ccf86", label: "color.green" },
  { hex: "#2bbf9f", label: "color.teal" },
  { hex: "#3b8be8", label: "color.blue" },
  { hex: "#8b5cf6", label: "color.purple" },
  { hex: "#e44aa8", label: "color.pink" },
  { hex: "#a3a3a3", label: "color.grey" },
];

/** The app's theme, picked under the colours: the "auto" swatch above follows it. */
const THEMES: { id: ThemePref; icon: typeof Sun }[] = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Desktop },
];

type Tab = Exclude<RailItem, "chat">;
/** Length of the "animated SVG / GIF" export of the current pose. */
const CLIP_MS = 3000;

/** Rough luminance, to tell when a body would melt into the page. */
function luma(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));


const parseTab = (t: string | null): Tab => (t === "motion" || t === "settings" ? t : "style");

export default function PinguStudio() {
  const { t, lang, setLang } = useI18n();
  const sound = useSoundOn();
  // Read ?tab= through the router, not window.location: when the chat rail opens a tab, this
  // component mounts while the address bar still reads /chat.
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(params.get("tab")));
  const [shape, setShape] = useState<ShapeName>("mochi");
  const [expression, setExpression] = useState<EngineState>("idle");
  const [live, setLive] = useState<EngineState | null>(null);
  const [color, setColor] = useState(PINGU_AUTO);
  const [follow, setFollow] = useState(true);
  const [doze, setDoze] = useState(false);
  const [pinPose, setPinPose] = useState(false);
  const [pose, setPose] = useState({ turn: 0, tilt: 0, roll: 0 });
  const [transparent, setTransparent] = useState(true);
  const [line, setLine] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [theme, themePref, setThemePref] = useTheme();

  // Montage
  const [clips, setClips] = useState<Clip[]>(defaultCycle);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const timeline = useRef<TimelineHandle>(null);
  /** A catalogue tile being dragged onto the timeline: the animation, where the finger is, where it would land. */
  const [lift, setLift] = useState<{ anim: AnimId; x: number; y: number; target: DropTarget | null } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const recording = useRef(false);

  const pingu = useRef<PinguHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** A still, front-facing copy used for still exports, so a file never catches Pingu mid-spin. */
  const exportRef = useRef<HTMLDivElement>(null);
  const speaking = useRef(0);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => window.clearInterval(speaking.current), []);
  useEffect(() => {
    if (!toast || busy) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast, busy]);

  // Keep the URL in step with the tab so a reload stays on it. Written on tab clicks only: an
  // effect on mount could run before the router has committed the new URL and overwrite it.
  const selectTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  /* ---------- montage playback ---------- */

  const total = clips.reduce((s, c) => s + c.dur, 0);
  const starts = clipStarts(clips);
  const activeIndex = clips.findIndex((c, i) => time >= starts[i] && time < starts[i] + c.dur);
  const activeClip = activeIndex >= 0 ? clips[activeIndex] : null;
  const activeAnim = activeClip ? getAnimation(activeClip.anim) : null;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((prev) => {
        const next = prev + dt;
        if (next < total) return next;
        return recording.current ? total - 0.001 : next % Math.max(total, 0.001);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  // One-shot actions fire when their clip starts.
  const activeKey = tab === "motion" ? activeClip?.key : undefined;
  const activeAction = activeAnim?.action;
  useEffect(() => {
    if (activeKey && activeAction) pingu.current?.[activeAction]();
  }, [activeKey, activeAction]);

  /** Adds a 2 s clip at `index` (the end by default), selects it and moves the playhead onto it. */
  const addClip = (anim: AnimId, index = clips.length) => {
    const clip = makeClip(anim, 2);
    setClips((c) => [...c.slice(0, index), clip, ...c.slice(index)]);
    setSelected(clip.key);
    setTime((index < clips.length ? clipStarts(clips)[index] : total) + 0.001);
  };

  const dropTile = (anim: AnimId, target: DropTarget) => {
    play("tap");
    if (target.kind === "insert") return addClip(anim, target.index);
    // Replacing keeps the clip's length and place.
    setClips((c) => c.map((x) => (x.key === target.key ? { ...x, anim } : x)));
    setSelected(target.key);
    const i = clips.findIndex((c) => c.key === target.key);
    if (i >= 0) setTime(clipStarts(clips)[i] + 0.001);
  };

  // Catalogue tiles can be dragged onto the timeline: onto a clip to replace it, between clips to insert.
  const tileDrag = useTileDrag<AnimId>({
    onMove: (anim, x, y) => setLift({ anim, x, y, target: timeline.current?.aim(x, y) ?? null }),
    onDrop: (anim, x, y) => {
      const target = timeline.current?.aim(x, y);
      if (target) dropTile(anim, target);
    },
    onEnd: () => setLift(null),
  });

  const move = (key: string, index: number) =>
    setClips((list) => {
      const moving = list.find((c) => c.key === key);
      if (!moving) return list;
      const rest = list.filter((c) => c.key !== key);
      rest.splice(index, 0, moving);
      return rest;
    });

  // The export menu closes on a click outside it or on Escape.
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      play("close");
      setMenu(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      play("close");
      setMenu(false);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  /* ---------- what the big Pingu shows ---------- */

  const montageOn = tab === "motion" && !!activeAnim;
  const state: EngineState = live ?? (montageOn ? activeAnim!.state : expression);
  const bigShape: ShapeName = montageOn ? (activeAnim!.shape ?? shape) : shape;
  // The auto body always contrasts with the page; fixed colours close to it get a soft shadow.
  const outline =
    color !== PINGU_AUTO && (theme === "light" ? luma(color) > 0.85 : luma(color) < 0.12) ? "pingu-outline" : "";
  // On phones the stage sticks to the top while the controls scroll under it, so it stays small;
  // it is the same size on every tab, so Pingu does not shrink when the timeline joins it.
  const bigSize =
    viewport.w < 768
      ? Math.round(clamp(Math.min(viewport.w * 0.5, viewport.h * 0.26), 130, 230))
      : Math.round(clamp(Math.min(viewport.w * 0.3, viewport.h * (tab === "motion" ? 0.4 : 0.55)), 260, 560));
  const filename = `pingu-${t(`shape.${shape}` as Key)}-${t(`expr.${expression}` as Key)}`.toLowerCase().replace(/\s+/g, "-");
  const bg = (transparentWanted: boolean) => (transparentWanted ? null : theme === "light" ? "#ffffff" : "#0d0d0d");

  const talk = () => {
    const text = line ?? t("studio.talkLine");
    window.clearInterval(speaking.current);
    setPlaying(false);
    setLive("talking");
    let i = 0;
    speaking.current = window.setInterval(() => {
      const open = syllableFor(text[i] ?? ".");
      if (open !== null) pingu.current?.syllable(open);
      if (++i > text.length) {
        window.clearInterval(speaking.current);
        window.setTimeout(() => setLive(null), 300);
      }
    }, 55);
  };

  /* ---------- exports ---------- */

  const stillSvg = () => exportRef.current?.querySelector("svg") ?? null;
  const liveSvg = () => stage.current?.querySelector("svg") ?? null;

  /** The running export, if any: aborting it cancels the recording or the encoding. */
  const abort = useRef<AbortController | null>(null);
  /** An animated export is running: the export button turns into "Cancel export". */
  const [cancellable, setCancellable] = useState(false);
  const cancelExport = () => {
    play("close");
    abort.current?.abort();
  };

  const run = async (job: (signal: AbortSignal) => Promise<string | void>, failure: Key = "export.failed", animated = false) => {
    setMenu(false);
    if (busy) return;
    setBusy(true);
    setCancellable(animated);
    const controller = (abort.current = new AbortController());
    try {
      const done = await job(controller.signal);
      setToast(done ?? t("export.started"));
      play("done");
    } catch {
      setToast(t(controller.signal.aborted ? "export.cancelled" : failure));
    } finally {
      abort.current = null;
      setCancellable(false);
      setBusy(false);
    }
  };

  const recordLive = (ms: number, fps: number, size: number, signal: AbortSignal) =>
    recordFrames(
      liveSvg,
      ms,
      fps,
      (d, n) => setToast(t("export.recording", { done: Math.floor(d / fps), total: Math.round(n / fps) })),
      size,
      signal,
    );

  const exportAs = (kind: "png" | "svg" | "animSvg" | "gif" | "copyPng" | "copySvg") => {
    const el = stillSvg();
    if (!el) return;
    if (kind === "png") return run(() => downloadPng(el, filename, { background: bg(transparent) }));
    if (kind === "svg") return run(async () => downloadSvg(el, filename));
    if (kind === "copyPng")
      return run(async () => {
        await copyPng(el, { background: bg(transparent) });
        return t("export.copied");
      }, "export.copyFailed");
    if (kind === "copySvg")
      return run(async () => {
        await copySvg(el);
        return t("export.copied");
      }, "export.copyFailed");
    if (kind === "animSvg")
      return run(async (signal) => {
        const frames = await recordLive(CLIP_MS, 15, 512, signal);
        save(new Blob([framesToAnimatedSvg(frames, 15)], { type: "image/svg+xml" }), `${filename}.svg`);
      }, undefined, true);
    return run(async (signal) => {
      const frames = await recordLive(CLIP_MS, 15, 480, signal);
      const gif = await framesToGif(frames, {
        size: 480,
        fps: 15,
        background: bg(transparent),
        onProgress: (d, n) => setToast(t("export.encoding", { pct: Math.round((d / n) * 100) })),
        signal,
      });
      save(gif, `${filename}.gif`);
    }, undefined, true);
  };

  const exportMontage = async (format: MontageFormat, background: MontageBackground) => {
    if (busy || !clips.length) return;
    setBusy(true);
    const controller = (abort.current = new AbortController());
    const signal = controller.signal;
    const fps = format === "mp4" ? 24 : 15;
    const size = format === "mp4" ? 720 : 480;
    const fill = background === "white" || format === "mp4" ? "#ffffff" : null;
    try {
      // Play the montage once from the top and record it live.
      recording.current = true;
      setSelected(null);
      setTime(0);
      setPlaying(true);
      const frames = await recordFrames(
        liveSvg,
        total * 1000,
        fps,
        (d, n) => setProgress(t("export.recording", { done: Math.floor(d / fps), total: Math.round(n / fps) })),
        size,
        signal,
      );
      setPlaying(false);
      recording.current = false;
      const onProgress = (d: number, n: number) => setProgress(t("export.encoding", { pct: Math.round((d / n) * 100) }));
      if (format === "gif") {
        save(await framesToGif(frames, { size, fps, background: fill, onProgress, signal }), "pingu-montage.gif");
        setToast(t("export.started"));
      } else {
        const { blob, ext } = await framesToVideo(frames, { size, fps, background: fill ?? "#ffffff", onProgress, signal });
        save(blob, `pingu-montage.${ext}`);
        setToast(ext === "mp4" ? t("export.started") : t("export.webm"));
      }
      setDialog(false);
    } catch {
      if (signal.aborted) {
        setToast(t("export.cancelled"));
        setDialog(false);
      } else setToast(t("export.failed"));
    } finally {
      abort.current = null;
      recording.current = false;
      setPlaying(false);
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <main
      data-theme={theme}
      className="studio relative flex min-h-dvh flex-col overflow-x-clip bg-st-bg pb-[calc(max(12px,env(safe-area-inset-bottom))+80px)] text-st-ink transition-colors md:h-dvh md:flex-row md:overflow-hidden md:pb-0"
    >
      <NavRail
        active={tab}
        onTab={selectTab}
        className="md:absolute md:left-5 md:top-1/2 md:-translate-y-1/2 md:flex-col"
      />

      {/* Stage */}
      <section className="sticky top-0 z-[5] flex min-w-0 flex-col items-center justify-center gap-3 bg-st-bg px-4 pb-2 pt-[max(24px,env(safe-area-inset-top))] transition-colors md:relative md:flex-1 md:gap-8 md:overflow-hidden md:px-6 md:py-10 md:pl-28">
        <div ref={stage}>
          <PinguAvatar
            ref={pingu}
            size={bigSize}
            fit="roomy"
            shape={bigShape}
            color={color}
            state={state}
            mouseInteractive={follow && !busy}
            autoDoze={doze}
            pose={pinPose ? pose : undefined}
            className={outline}
            onClick={() => pingu.current?.spinBounce()}
            title="Pingu"
          />
        </div>

        {tab === "motion" ? (
          <>
            {/* On wider screens the timeline is pinned to the bottom, out of the flow, and this spacer
                stands in for the export button, so Pingu sits exactly where it does in the other tabs. */}
            <div className="hidden h-11 md:block" aria-hidden />
            <div className="flex w-full justify-center md:absolute md:inset-x-0 md:bottom-10 md:pl-28 md:pr-6">
              <div className="w-full max-w-[1100px]">
                <Timeline
                  ref={timeline}
                  hint={lift?.target}
                  clips={clips}
                  time={Math.min(time, Math.max(0, total - 0.001))}
                  playing={playing}
                  selected={selected}
                  shape={shape}
                  color={color}
                  outline={outline}
                  onPlay={() => setPlaying((p) => !p)}
                  onSeek={(s) => setTime(s)}
                  onSelect={setSelected}
                  onRemove={(key) => {
                    setClips((c) => c.filter((x) => x.key !== key));
                    if (selected === key) setSelected(null);
                  }}
                  onResize={(key, dur) => setClips((c) => c.map((x) => (x.key === key ? { ...x, dur } : x)))}
                  onMove={move}
                  onPreset={(p) => {
                    setPlaying(false);
                    setTime(0);
                    setSelected(null);
                    setClips(p === "default" ? defaultCycle() : []);
                  }}
                  onExport={() => setDialog(true)}
                />
              </div>
            </div>
          </>
        ) : (
          <div ref={menuRef} className="relative">
            <div className="flex h-11 overflow-hidden rounded-xl bg-st-accent text-[15px] text-st-accent-ink shadow-[var(--st-shadow)]">
              {cancellable ? (
                <button
                  onClick={cancelExport}
                  className="flex items-center gap-2 px-4 transition hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)]"
                >
                  <X size={18} weight="bold" />
                  {t("export.cancel")}
                </button>
              ) : (
                <button
                  onClick={() => exportAs("png")}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 transition hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] disabled:opacity-60"
                >
                  <DownloadIcon />
                  {t("export.png")}
                </button>
              )}
              <span className="w-px bg-[color-mix(in_srgb,currentColor_18%,transparent)]" />
              <button
                onClick={() => {
                  play(menu ? "close" : "open");
                  setMenu(!menu);
                }}
                disabled={busy}
                className="grid w-11 place-items-center transition hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)]"
                aria-label={t("export.more")}
                aria-expanded={menu}
              >
                <CaretDown
                  size={15}
                  weight="bold"
                  className={`transition-transform duration-300 motion-reduce:transition-none ${menu ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {/* Unfolds vertically out of the button: downwards on phones, where the stage is too short
                to hold it, upwards on wider screens. Always mounted so it can animate both ways. */}
            <div
              aria-hidden={!menu}
              inert={!menu}
              // Scale, translate and blur are separate CSS properties in Tailwind v4, so each is listed
              // in the transition (a plain `transform` would leave them snapping). Opens with a soft
              // ease-out, closes quicker with an ease-in, shrinking back towards the button.
              className={`absolute left-1/2 top-[calc(100%+10px)] z-20 w-[280px] origin-top -translate-x-1/2 rounded-2xl bg-st-raised p-1.5 text-[15px] shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-st-line transition-[opacity,scale,translate,filter,visibility] motion-reduce:transition-none md:top-auto md:bottom-[calc(100%+10px)] md:origin-bottom ${
                menu
                  ? "visible translate-y-0 scale-100 opacity-100 blur-none duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  : "invisible -translate-y-1.5 scale-95 opacity-0 blur-[2px] duration-150 ease-[cubic-bezier(0.4,0,1,1)] md:translate-y-1.5"
              }`}
            >
                <MenuItem icon={<DownloadIcon />} onClick={() => exportAs("png")}>
                  {t("export.downloadPng")}
                </MenuItem>
                <MenuItem icon={<DownloadIcon />} onClick={() => exportAs("svg")}>
                  {t("export.downloadSvg")}
                </MenuItem>
                <MenuItem icon={<DownloadIcon />} onClick={() => exportAs("animSvg")}>
                  {t("export.downloadAnimSvg")}
                </MenuItem>
                <MenuItem icon={<DownloadIcon />} onClick={() => exportAs("gif")}>
                  {t("export.downloadGif")}
                </MenuItem>
                <div className="mx-2 my-1.5 h-px bg-st-line" />
                <MenuItem icon={<CopyIcon />} onClick={() => exportAs("copyPng")}>
                  {t("export.copyImage")}
                </MenuItem>
                <MenuItem icon={<CopyIcon />} onClick={() => exportAs("copySvg")}>
                  {t("export.copySvg")}
                </MenuItem>
            </div>
          </div>
        )}

        <p className="h-4 text-[13px] tabular-nums text-st-muted md:h-5" role="status">
          {toast}
        </p>

        <div ref={exportRef} className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <PinguAvatar size={512} fit="roomy" shape={shape} color={color} state={expression} animated={false} pose={pinPose ? pose : undefined} />
        </div>
      </section>

      {/* Panel */}
      <aside className="no-scrollbar w-full shrink-0 px-5 pb-10 pt-4 md:w-[440px] md:overflow-y-auto md:py-10 md:pl-4 md:pr-8">
        {/* Keyed by tab: each tab's sections rise in (.tab-panel in globals.css). */}
        <div key={tab} className="tab-panel">
          {tab === "style" && (
            <>
              <Section title={t("studio.shape")}>
                <div className="grid grid-cols-4 gap-1">
                  {SHAPES.map((s) => (
                    <Tile key={s} active={s === shape} label={t(`shape.${s}` as Key)} onClick={() => setShape(s)}>
                      <PinguAvatar size={46} shape={s} color={color} state="idle" animated={false} className={outline} />
                    </Tile>
                  ))}
                </div>
              </Section>
              <Section title={t("studio.expression")}>
                <div className="grid grid-cols-4 gap-1">
                  {EXPRESSIONS.map((e) => (
                    <Tile
                      key={e}
                      active={!live && e === expression}
                      label={t(`expr.${e}` as Key)}
                      onClick={() => {
                        setLive(null);
                        setExpression(e);
                      }}
                    >
                      <PinguAvatar size={46} shape={shape} color={color} state={e} animated={false} className={outline} />
                    </Tile>
                  ))}
                </div>
              </Section>
              <Section title={t("studio.colour")}>
                <div className="grid grid-cols-6 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setColor(c.hex)}
                      className={`size-11 rounded-full border border-st-line transition ${
                        c.hex === color ? "ring-2 ring-st-selected ring-offset-[3px] ring-offset-st-bg" : "hover:scale-105"
                      }`}
                      style={{
                        // border-box: from the padding box, the gradient repeats under the border as slivers.
                        background: c.hex === PINGU_AUTO ? "linear-gradient(90deg, #0b0b0b 50%, #f7f7f4 50%) border-box" : c.hex,
                      }}
                      aria-label={t(c.label)}
                      aria-pressed={c.hex === color}
                      title={t(c.label)}
                    />
                  ))}
                </div>
              </Section>
              <Section title={t("studio.theme")}>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map(({ id, icon: ThemeIcon }) => (
                    <button
                      key={id}
                      onClick={() => {
                        if (id === themePref) return;
                        play("tap");
                        setThemePref(id);
                      }}
                      className={`flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-[15px] transition ${
                        id === themePref
                          ? "border-st-selected bg-st-surface text-st-ink"
                          : "border-st-line bg-st-surface text-st-muted hover:border-st-line-strong hover:text-st-ink"
                      }`}
                      aria-pressed={id === themePref}
                    >
                      <ThemeIcon size={18} weight="fill" />
                      {t(`studio.theme.${id}` as Key)}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {tab === "motion" && (
            <>
              <Section title={t("studio.animation")}>
                <div className="grid grid-cols-4 gap-1">
                  {ANIMATIONS.map((a) => (
                    <Tile
                      key={a.id}
                      active={activeAnim?.id === a.id}
                      label={t(a.label)}
                      onClick={() => !tileDrag.justDropped() && addClip(a.id)}
                      onPointerDown={(e) => tileDrag.start(e, a.id)}
                    >
                      <PinguAvatar size={46} shape={a.shape ?? shape} color={color} state={a.state} animated={false} className={outline} />
                    </Tile>
                  ))}
                </div>
              </Section>
              <Section title={t("studio.talk")}>
                <div className="flex gap-2">
                  <input
                    value={line ?? t("studio.talkLine")}
                    onChange={(e) => setLine(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-st-line bg-st-surface px-3 py-2 text-[16px] text-st-ink focus:border-st-line-strong md:text-[14px] focus:outline-none"
                  />
                  <Pill onClick={talk}>{t("studio.talkButton")}</Pill>
                </div>
              </Section>
            </>
          )}

          {tab === "settings" && (
            <>
              <Section title={t("studio.language")}>
                <div className="flex flex-col gap-2">
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        play("tap");
                        setLang(l.id);
                      }}
                      className={`flex h-12 items-center gap-3 rounded-xl border px-4 text-left text-[15px] transition ${
                        l.id === lang
                          ? "border-st-selected bg-st-surface text-st-ink"
                          : "border-st-line bg-st-surface text-st-muted hover:border-st-line-strong hover:text-st-ink"
                      }`}
                      aria-pressed={l.id === lang}
                      lang={l.id}
                    >
                      <span className="text-[17px] leading-none">{l.flag}</span>
                      <span className="flex-1">{l.label}</span>
                      {l.id === lang && (
                        <Check size={16} weight="bold" />
                      )}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title={t("studio.sound")}>
                <Toggle checked={sound} onChange={setSoundOn} label={t("studio.soundToggle")} />
              </Section>
              <Section title={t("studio.pose")}>
                <Toggle checked={pinPose} onChange={setPinPose} label={t("studio.pinPose")} />
                {(["turn", "tilt", "roll"] as const).map((k) => (
                  <label key={k} className="mt-3 flex items-center gap-3 text-[14px] text-st-muted">
                    <span className="w-24">{t(`studio.${k}` as Key)}</span>
                    <input
                      type="range"
                      min={k === "turn" ? -100 : -40}
                      max={k === "turn" ? 100 : 40}
                      value={pose[k]}
                      onChange={(e) => {
                        setPinPose(true);
                        setPose((p) => ({ ...p, [k]: Number(e.target.value) }));
                      }}
                      className="flex-1 accent-st-accent"
                    />
                    <span className="w-9 text-right tabular-nums">{pose[k]}</span>
                  </label>
                ))}
              </Section>
              <Section title={t("studio.behaviour")}>
                <Toggle checked={follow} onChange={setFollow} label={t("studio.follow")} />
                <Toggle checked={doze} onChange={setDoze} label={t("studio.doze")} />
              </Section>
              <Section title={t("studio.export")}>
                <Toggle checked={transparent} onChange={setTransparent} label={t("studio.transparent")} />
              </Section>
              <Section title={t("studio.about")}>
                <p className="text-[14px] text-st-muted">
                  {t("studio.madeWith", { heart: "❤️" })}{" "}
                  <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="font-medium text-st-ink underline-offset-4 hover:underline">
                    Gabriel Spicuglia
                  </a>
                </p>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-[14px] font-medium text-st-ink underline-offset-4 hover:underline"
                >
                  <GithubLogo size={18} weight="fill" />
                  {t("chat.github")}
                </a>
                <p className="mt-3 text-[13px] leading-5 text-st-muted">{t("studio.disclaimer")}</p>
              </Section>
            </>
          )}
        </div>
      </aside>

      {dialog && (
        <MontageDialog
          busy={busy}
          progress={progress}
          // While it exports, "Cancel" stops the export (exportMontage then closes the dialog).
          onCancel={() => (busy ? cancelExport() : setDialog(false))}
          onDownload={exportMontage}
        />
      )}

      {/* The tile being dragged onto the timeline, held just above the finger so it stays visible. */}
      {lift && (
        <div
          className="pointer-events-none fixed z-50 grid size-16 -translate-x-1/2 -translate-y-full place-items-center rounded-2xl bg-st-raised shadow-[var(--st-shadow)]"
          style={{ left: lift.x, top: lift.y - 12 }}
        >
          <PinguAvatar
            size={46}
            shape={getAnimation(lift.anim).shape ?? shape}
            color={color}
            state={getAnimation(lift.anim).state}
            animated={false}
            className={outline}
          />
        </div>
      )}
    </main>
  );
}

const DownloadIcon = () => <DownloadSimple size={17} weight="bold" />;
const CopyIcon = () => <Copy size={17} weight="bold" />;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[16px] font-semibold text-st-ink-2">{title}</h2>
      {children}
    </section>
  );
}

function Tile({
  active,
  label,
  onClick,
  onPointerDown,
  children,
}: {
  active: boolean;
  label: string;
  /** Return false to skip the tap sound (the click was swallowed). */
  onClick: () => unknown;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        if (onClick() !== false) play("tap");
      }}
      onPointerDown={onPointerDown}
      // A long press would otherwise select the label or open the callout instead of lifting the tile.
      onContextMenu={(e) => e.preventDefault()}
      className={`flex touch-manipulation select-none flex-col items-center gap-1.5 rounded-[14px] border-2 px-1 pb-2 pt-3 transition [-webkit-touch-callout:none] ${
        active ? "border-st-selected" : "border-transparent hover:bg-st-hover"
      }`}
      aria-pressed={active}
    >
      {children}
      <span className="text-[13px] text-st-muted">{label}</span>
    </button>
  );
}

function Pill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        play("tap");
        onClick();
      }}
      className="h-9 shrink-0 rounded-full border border-st-line bg-st-surface px-4 text-[14px] text-st-ink-2 transition hover:border-st-line-strong"
    >
      {children}
    </button>
  );
}

function MenuItem({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        play("tap");
        onClick();
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-st-ink hover:bg-st-hover">
      <span className="text-st-muted">{icon}</span>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="mb-2 flex cursor-pointer items-center justify-between gap-3 text-[14px] text-st-ink-2">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        // After onChange, so switching the sound itself on is heard (and switching it off is not).
        onClick={() => {
          onChange(!checked);
          play(checked ? "off" : "on");
        }}
        className={`relative h-6 w-10 rounded-full transition ${checked ? "bg-st-accent" : "bg-st-track"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-st-knob shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
