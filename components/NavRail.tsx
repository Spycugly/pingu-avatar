"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { flushSync } from "react-dom";
import { ChatCircle, FilmSlate, GearSix, Moon, Palette, Sun, type Icon } from "@phosphor-icons/react";
import Tooltip from "./Tooltip";
import { useI18n, type Key } from "@/lib/i18n";
import { play } from "@/lib/sound";

/* The floating rail shared by the studio (home page) and the chat, identical on both: the chat
   first, then the studio tabs and the theme switch. In the chat every studio item links
   home with ?tab=; in the studio they switch tabs in place and "Chat" links to /chat. */

export type RailItem = "chat" | "style" | "motion" | "settings";
export type Theme = "light" | "dark";

/** Read by the inline script in app/layout.tsx too. (The old "pingu-studio-theme" key saved the
    default on every first visit, so it can't tell a choice from a default: it is ignored.) */
const THEME_KEY = "pingu-theme";

/** Light/dark theme of the studio and the chat, shared by both pages. Dark by default; only a
    theme picked with the switch is kept in localStorage.
    Switching cross-fades the whole page through a view transition where the browser has one. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const change = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) return setTheme(next);
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  }, []);
  return [theme, change] as const;
}

const ICONS: Record<RailItem, Icon> = {
  chat: ChatCircle,
  style: Palette,
  motion: FilmSlate,
  settings: GearSix,
};

const LABELS: Record<RailItem, Key> = {
  chat: "nav.chat",
  style: "nav.style",
  motion: "nav.motion",
  settings: "nav.settings",
};

const ITEMS: RailItem[] = ["chat", "style", "motion", "settings"];

/** The rail item that was active when the last rail unmounted: a rail mounted by a page change
    starts its highlight there and slides it to the new item. */
let lastActive: RailItem | null = null;

/** Every item is drawn muted: the active colours come from the highlight layer above it. */
const itemClass =
  "grid size-11 place-items-center rounded-xl text-st-muted transition-colors duration-150 hover:bg-st-hover hover:text-st-ink";

/** Sun and moon share one cell and swap with a turn and a fade. */
const swap = (shown: boolean) =>
  `[grid-area:1/1] transition-[opacity,rotate,scale] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
    shown ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
  }`;

export default function NavRail({
  active,
  onTab,
  theme,
  onTheme,
  className = "",
  dividerClassName = "h-7 w-px md:h-px md:w-7",
  tooltipClassName = "left-1/2 top-[calc(100%+8px)] -translate-x-1/2 md:left-[calc(100%+12px)] md:top-1/2 md:translate-x-0 md:-translate-y-1/2",
}: {
  active: RailItem;
  /** Studio only: switch tab in place instead of navigating. */
  onTab?: (item: Exclude<RailItem, "chat">) => void;
  theme?: Theme;
  onTheme?: (t: Theme) => void;
  className?: string;
  /** Orientation of the line before the theme switch: match the breakpoint where the rail turns vertical. */
  dividerClassName?: string;
  /** Tooltip placement: below the horizontal rail, beside the vertical one (same breakpoint as above). */
  tooltipClassName?: string;
}) {
  const { t } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  // The active highlight is one layer over the whole rail: the accent fill plus a copy of every
  // icon in the accent ink, clipped to the active item. Sliding the clip moves the fill and
  // recolours each icon exactly where the highlight covers it, instead of each icon fading on
  // its own clock (dark ink on the dark rail for a moment). Measured from the DOM so it follows
  // the rail's orientation and gaps at every breakpoint.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const place = (item: RailItem, animate: boolean) => {
      const el = nav.querySelector<HTMLElement>(`[data-rail="${item}"]`);
      if (!el) return;
      for (const ink of pill.querySelectorAll<HTMLElement>("[data-ink]")) {
        const at = nav.querySelector<HTMLElement>(`[data-rail="${ink.dataset.ink}"]`);
        if (at) ink.style.transform = `translate(${at.offsetLeft}px, ${at.offsetTop}px)`;
      }
      const top = el.offsetTop;
      const left = el.offsetLeft;
      const right = nav.clientWidth - left - el.offsetWidth;
      const bottom = nav.clientHeight - top - el.offsetHeight;
      pill.style.transition = animate ? "" : "none";
      pill.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`;
      pill.style.opacity = "1";
    };
    const from = placed.current ? null : lastActive;
    if (from && from !== active) {
      place(from, false);
      void pill.offsetWidth; // commit the start position so the move below animates
    }
    place(active, placed.current || !!from);
    placed.current = true;
    lastActive = active;
    // Re-measure without animating when the rail changes orientation. The observer also reports
    // once right away: skip that one, or it would cancel the slide started above.
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) first = false;
      else place(active, false);
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active]);

  const tip = (label: string) => <Tooltip label={label} className={tooltipClassName} />;

  // Both pages render their own rail under the same view-transition name: on a page change the
  // browser pairs them and .rail-anchor (globals.css) keeps it still while the page cross-fades.
  return (
    <ViewTransition name="nav-rail" share="rail-anchor" default="none">
      <nav
        ref={navRef}
        className={`relative z-10 flex gap-1 rounded-2xl min-[400px]:gap-2 bg-st-surface p-2 shadow-[var(--st-shadow)] transition-[background-color,box-shadow] duration-300 ${className}`}
        aria-label="Pingu"
      >
        {ITEMS.map((item) => {
          const label = t(LABELS[item]);
          const isActive = item === active;
          const ItemIcon = ICONS[item];
          const icon = <ItemIcon size={20} weight="fill" />;
          if (item === "chat" || !onTab) {
            const href = item === "chat" ? "/chat" : `/?tab=${item}`;
            return (
              <div key={item} data-rail={item} className="group relative">
                <Link
                  href={href}
                  onClick={() => !isActive && play("slide")}
                  className={itemClass}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {icon}
                </Link>
                {tip(label)}
              </div>
            );
          }
          return (
            <div key={item} data-rail={item} className="group relative">
              <button
                onClick={() => {
                  if (!isActive) play("slide");
                  onTab(item);
                }}
                className={itemClass}
                aria-label={label}
                aria-pressed={isActive}
              >
                {icon}
              </button>
              {tip(label)}
            </div>
          );
        })}

        {theme && onTheme && (
          <>
            <span className={`self-center bg-st-line transition-colors duration-300 ${dividerClassName}`} aria-hidden />
            <div className="group relative">
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                onClick={() => {
                  play(theme === "dark" ? "on" : "off");
                  onTheme(theme === "dark" ? "light" : "dark");
                }}
                className={itemClass}
                aria-label={theme === "dark" ? t("nav.toLight") : t("nav.toDark")}
              >
                <Sun size={20} weight="fill" className={swap(theme === "dark")} />
                <Moon size={20} weight="fill" className={swap(theme !== "dark")} />
              </button>
              {tip(t("nav.theme"))}
            </div>
          </>
        )}

        <div
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-st-accent text-st-accent-ink opacity-0 transition-[clip-path,background-color,color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        >
          {ITEMS.map((item) => {
            const ItemIcon = ICONS[item];
            return (
              <span key={item} data-ink={item} className="absolute left-0 top-0 grid size-11 place-items-center">
                <ItemIcon size={20} weight="fill" />
              </span>
            );
          })}
        </div>
      </nav>
    </ViewTransition>
  );
}
