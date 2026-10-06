"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { flushSync } from "react-dom";
import { ChatCircle, FilmSlate, GearSix, Moon, Palette, Sun, type Icon } from "@phosphor-icons/react";
import Tooltip from "./Tooltip";
import { useI18n, type Key } from "@/lib/i18n";

/* The floating rail shared by the studio (home page) and the chat, identical on both: the chat
   first, then the studio tabs and the theme switch. In the chat every studio item links
   home with ?tab=; in the studio they switch tabs in place and "Chat" links to /chat. */

export type RailItem = "chat" | "style" | "motion" | "settings";
export type Theme = "light" | "dark";

const THEME_KEY = "pingu-studio-theme";

/** Light/dark theme of the studio and the chat, shared by both pages and kept in localStorage.
    Switching cross-fades the whole page through a view transition where the browser has one. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);
  const change = useCallback((next: Theme) => {
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

const itemClass = (active: boolean) =>
  `relative z-[1] grid size-11 place-items-center rounded-xl transition-colors duration-300 ${
    active ? "text-st-accent-ink" : "text-st-muted hover:bg-st-hover hover:text-st-ink"
  }`;

/** Sun and moon share one cell and swap with a turn and a fade. */
const swap = (shown: boolean) =>
  `[grid-area:1/1] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
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
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // The active highlight is one pill that slides between items, measured from the DOM so it
  // follows the rail's orientation and gaps at every breakpoint.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const place = (item: RailItem, animate: boolean) => {
      const el = nav.querySelector<HTMLElement>(`[data-rail="${item}"]`);
      if (!el) return;
      pill.style.transition = animate ? "" : "none";
      pill.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
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
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 size-11 rounded-xl bg-st-accent opacity-0 transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        />

        {ITEMS.map((item) => {
          const label = t(LABELS[item]);
          const isActive = item === active;
          const ItemIcon = ICONS[item];
          const icon = <ItemIcon size={20} weight="fill" />;
          if (item === "chat" || !onTab) {
            const href = item === "chat" ? "/chat" : `/?tab=${item}`;
            return (
              <div key={item} data-rail={item} className="group relative">
                <Link href={href} className={itemClass(isActive)} aria-label={label} aria-current={isActive ? "page" : undefined}>
                  {icon}
                </Link>
                {tip(label)}
              </div>
            );
          }
          return (
            <div key={item} data-rail={item} className="group relative">
              <button onClick={() => onTab(item)} className={itemClass(isActive)} aria-label={label} aria-pressed={isActive}>
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
                onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
                className={itemClass(false)}
                aria-label={theme === "dark" ? t("nav.toLight") : t("nav.toDark")}
              >
                <Sun size={20} weight="fill" className={swap(theme === "dark")} />
                <Moon size={20} weight="fill" className={swap(theme !== "dark")} />
              </button>
              {tip(t("nav.theme"))}
            </div>
          </>
        )}
      </nav>
    </ViewTransition>
  );
}
