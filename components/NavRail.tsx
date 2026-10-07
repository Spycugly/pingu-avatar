"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, ViewTransition } from "react";
import { flushSync } from "react-dom";
import { ChatCircle, FilmSlate, GearSix, Palette, type Icon } from "@phosphor-icons/react";
import Tooltip from "./Tooltip";
import { useI18n, type Key } from "@/lib/i18n";
import { play } from "@/lib/sound";

/* The floating rail shared by the studio (home page) and the chat, identical on both: the chat
   first, then the studio tabs. In the chat every studio item links
   home with ?tab=; in the studio they switch tabs in place and "Chat" links to /chat.
   On phones (below md) it is an iOS-style tab bar instead: a floating glass capsule at the bottom,
   above the home indicator, with a 10px label under each 24px icon (Apple's tab bar sizes). */

export type RailItem = "chat" | "style" | "motion" | "settings";
export type Theme = "light" | "dark";
/** What the visitor picked: a fixed theme, or whatever the OS says. */
export type ThemePref = Theme | "system";

/** Read by the inline script in app/layout.tsx too. (The old "pingu-studio-theme" key saved the
    default on every first visit, so it can't tell a choice from a default: it is ignored.) */
const THEME_KEY = "pingu-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const subscribeScheme = (cb: () => void) => {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");

/** Light/dark theme of the studio and the chat, shared by both pages. Dark by default; only a
    choice made in the studio (light, dark or system) is kept in localStorage. Returns the theme
    to draw, the saved choice and its setter.
    Picking a theme cross-fades the whole page through a view transition where the browser has one. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === "light" || saved === "system" ? saved : "dark";
    } catch {
      return "dark";
    }
  });
  const system = useSyncExternalStore(subscribeScheme, systemTheme, () => "dark" as Theme);
  const theme: Theme = pref === "system" ? system : pref;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const change = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) return setPref(next);
    document.startViewTransition(() => flushSync(() => setPref(next)));
  }, []);
  return [theme, pref, change] as const;
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
  "grid size-11 place-items-center rounded-xl text-st-muted transition-colors duration-150 hover:bg-st-hover hover:text-st-ink max-md:flex max-md:h-[54px] max-md:w-full max-md:flex-col max-md:justify-center max-md:gap-0.5 max-md:rounded-[22px] max-md:hover:bg-transparent";

/** An item's icon and, on phones, its label: drawn twice, muted below and in the highlight's ink above. */
function ItemFace({ item, label }: { item: RailItem; label: string }) {
  const ItemIcon = ICONS[item];
  return (
    <>
      <ItemIcon size={20} weight="fill" className="max-md:size-6" />
      <span className="whitespace-nowrap text-[10px] font-medium leading-3 tracking-[0.01em] md:hidden">{label}</span>
    </>
  );
}

export default function NavRail({
  active,
  onTab,
  hideOnMobile = false,
  className = "",
  tooltipClassName = "left-1/2 top-[calc(100%+8px)] -translate-x-1/2 md:left-[calc(100%+12px)] md:top-1/2 md:translate-x-0 md:-translate-y-1/2",
}: {
  active: RailItem;
  /** Studio only: switch tab in place instead of navigating. */
  onTab?: (item: Exclude<RailItem, "chat">) => void;
  /** Hide the phone tab bar, e.g. inside a chat conversation where the composer owns the bottom edge. */
  hideOnMobile?: boolean;
  className?: string;
  /** Tooltip placement: below the horizontal rail, beside the vertical one (match the breakpoint where the rail turns vertical). */
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
        if (!at) continue;
        ink.style.transform = `translate(${at.offsetLeft}px, ${at.offsetTop}px)`;
        ink.style.width = `${at.offsetWidth}px`;
        ink.style.height = `${at.offsetHeight}px`;
      }
      // The highlight takes the item's own corner radius: a small square on the rail, a capsule on phones.
      const radius = getComputedStyle(el.firstElementChild ?? el).borderTopLeftRadius;
      const top = el.offsetTop;
      const left = el.offsetLeft;
      const right = nav.clientWidth - left - el.offsetWidth;
      const bottom = nav.clientHeight - top - el.offsetHeight;
      pill.style.transition = animate ? "" : "none";
      pill.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius})`;
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

  // Phones show the labels under the icons, so no tooltips there.
  const tip = (label: string) => <Tooltip label={label} className={`max-md:hidden ${tooltipClassName}`} />;

  // Both pages render their own rail under the same view-transition name: on a page change the
  // browser pairs them and .rail-anchor (globals.css) keeps it still while the page cross-fades.
  return (
    <ViewTransition name="nav-rail" share="rail-anchor" default="none">
      <nav
        ref={navRef}
        className={`relative z-10 flex gap-1 rounded-2xl min-[400px]:gap-2 bg-st-surface p-2 shadow-[var(--st-shadow)] transition-[background-color,box-shadow] duration-300 max-md:fixed max-md:inset-x-4 max-md:bottom-[max(12px,env(safe-area-inset-bottom))] max-md:z-40 max-md:mx-auto max-md:max-w-[440px] max-md:gap-0 max-md:rounded-[30px] max-md:bg-st-surface/75 max-md:p-1 max-md:ring-[0.5px] max-md:ring-st-line max-md:backdrop-blur-xl max-md:backdrop-saturate-150 ${
          hideOnMobile ? "max-md:hidden" : ""
        } ${className}`}
        aria-label="Pingu"
      >
        {ITEMS.map((item) => {
          const label = t(LABELS[item]);
          const isActive = item === active;
          const icon = <ItemFace item={item} label={label} />;
          if (item === "chat" || !onTab) {
            const href = item === "chat" ? "/chat" : `/?tab=${item}`;
            return (
              <div key={item} data-rail={item} className="group relative max-md:flex-1">
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
            <div key={item} data-rail={item} className="group relative max-md:flex-1">
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

        <div
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-st-accent text-st-accent-ink opacity-0 max-md:bg-st-hover max-md:text-st-ink transition-[clip-path,background-color,color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        >
          {ITEMS.map((item) => (
            <span
              key={item}
              data-ink={item}
              className="absolute left-0 top-0 grid size-11 place-items-center max-md:flex max-md:flex-col max-md:justify-center max-md:gap-0.5"
            >
              <ItemFace item={item} label={t(LABELS[item])} />
            </span>
          ))}
        </div>
      </nav>
    </ViewTransition>
  );
}
