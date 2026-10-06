import { MAX_DT } from "./spring";

/** One requestAnimationFrame for every avatar on the page, plus shared pointer/activity state. */
export type Tickable = { tick(now: number, dt: number): void; awake(): boolean };

const members = new Set<Tickable>();
let raf = 0;
let last = 0;

export const pointer = { x: 0, y: 0, has: false, at: 0 };
/** Last time the person moved, typed or clicked (ms, performance.now clock). */
export const activity = { at: typeof performance !== "undefined" ? performance.now() : 0 };

let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const touch = () => (activity.at = performance.now());
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.has = true;
      pointer.at = performance.now();
      touch();
    },
    { passive: true },
  );
  window.addEventListener("pointerdown", touch, { passive: true });
  window.addEventListener("keydown", touch);
  document.documentElement.addEventListener("pointerleave", () => (pointer.has = false));
}

function frame(now: number) {
  const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
  last = now;
  if (!document.hidden) members.forEach((m) => m.awake() && m.tick(now, dt));
  raf = members.size ? requestAnimationFrame(frame) : 0;
}

export function subscribe(m: Tickable) {
  listen();
  members.add(m);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  return () => {
    members.delete(m);
    if (!members.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

let observer: IntersectionObserver | null = null;
const visibility = new WeakMap<Element, (v: boolean) => void>();

/** Shared IntersectionObserver: avatars off screen stop animating. */
export function watchVisibility(el: Element, cb: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") {
    cb(true);
    return () => {};
  }
  observer ??= new IntersectionObserver((entries) =>
    entries.forEach((e) => visibility.get(e.target)?.(e.isIntersecting)),
  );
  visibility.set(el, cb);
  observer.observe(el);
  return () => {
    visibility.delete(el);
    observer?.unobserve(el);
  };
}

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
