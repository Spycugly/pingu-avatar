# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The repo root is the Next.js app; `avatar/` is the reusable avatar that other projects copy (see below). `lib/intro-frames.ts` (the `IntroSplash` animation) was traced from a source video that is not in the repo; do not edit it by hand, and never commit videos (`*.mp4`/`*.mov` are gitignored).

Next.js 16 (App Router) + React 19 + Tailwind v4. Per AGENTS.md, check `node_modules/next/dist/docs/` before using a Next API you are unsure of. Machine-specific notes, if any, go in `CLAUDE.local.md` (gitignored), never here: this repo is public.

## Commands

```bash
npm run dev                 # dev server
npm run build               # production build
npm run lint                # eslint (flat config, next core-web-vitals + typescript)
npx eslint components/Foo.tsx   # lint one file
npm run typecheck           # tsc --noEmit
```

There is no test suite.

**Checking the UI in a browser:** drive headless Chrome over the DevTools protocol: launch Chrome with `--headless=new --remote-debugging-port=<port> --user-data-dir=<fresh dir>` and use a small Node script (Node has a global `WebSocket`) for `Page.navigate`, `Runtime.evaluate`, `Input.dispatchMouseEvent`, `Page.captureScreenshot`, and `Emulation.setEmulatedMedia` to test reduced motion.

## What this is

"Pingu": an avatar studio (customizer, montage, exports) plus a fake chat assistant (modelled on the Grok Bot demo on x.ai/bot) where penguin personas answer with one dry one-liner, in the interface language. **Everything runs in the browser**: there are no API routes, no backend and no LLM. Replies come from regex rules.

Routes are thin server shells:
- `/` → `ClientStudio` → `PinguStudio` (avatar customizer + exports) plus `IntroSplash`. The customizer is the primary page.
- `/chat` → `ClientApp` → `ChatApp` (chat UI), secondary.
- `/espressioni` → `ExpressionSheet` (grid of every engine state)
- `/esplora` (the customizer's old URL) redirects to `/` in `next.config.ts`, keeping `?tab=`.

`ClientApp`/`ClientStudio` wrap their component in `components/ClientOnly.tsx` because they read `localStorage`, local time and the viewport during the first render. Use it for new pages that touch browser-only state. Not `dynamic(..., { ssr: false })`: its loading fallback also shows on client-side navigations, so switching between the studio and the chat flashed an empty screen. Route changes cross-fade through React `<ViewTransition>` (`enter`/`exit="page-swap"` in `ClientStudio`/`ClientApp`, CSS in `globals.css`); the rail is wrapped in a `ViewTransition` named `nav-rail` with `share="rail-anchor"`, so it stays still above the fade. Don't fade pages in from opacity 0 with a CSS animation: that leaves an empty frame.

## Chat flow

- `hooks/useChat.ts` owns all state: one thread per agent, persisted to `localStorage` under `pingu-chat-v2` (bump the key if you change the `Message` shape incompatibly). Pingu and system messages store a `line` id (`"post.2"`, `"greeting:chef.0"`, `"persona:pingu.1"`) and render through `messageText(m, lang)`, so switching language re-translates the history; `text` keeps the Italian line as a fallback, and threads saved before line ids are mapped back with `lineForItalian`. All `localStorage` access is wrapped in try/catch.
- `send()` adds the user message, sets status `thinking`, waits a fake delay, then calls `getPinguReply()` and appends a reply with `typing: true` (status `talking`). `ChatPane`'s typewriter calls `onTyped` → `finishTyping()` → status `idle`. While "thinking", `ChatPane` cycles through `THINKING_BEATS` from `lib/agents.ts` (avatar states; labels are the `beat.<state>` i18n keys).
- `lib/pingu-brain.ts`: every line exists in it/en/es/zh (`Lines = Record<Lang, string[]>`; the arrays must line up, since ids are indexes). The `rule()` regexes match keywords in all four languages whatever the interface language: Latin words as whole words, Chinese anywhere (no word boundaries). `REPLIES` categories are tested **in insertion order, first regex match wins**, against lowercased, accent-stripped text. Before that, a `FOLLOW_UP` opener answering Pingu's last line gets a `CLOSERS` reply; after that come questions (`?`, `？`, or a leading `¿`), then the agent's own `fallback` lines (60%) or the generic `FALLBACK`. Each reply carries a `mood` (an `EngineState`) the avatar shows once typing ends. Recent line ids are avoided via `recent`. `getPinguReply` returns a line id, not text.
- `lib/agents.ts` defines the personas (colour, body `shape`, and per-language `copy`: name, tagline, greeting, fallback lines) plus the per-language composer `SUGGESTIONS` (each must trip a rule in its own language). An agent with `members` is a group chat: each reply comes from a random member, recorded in `Message.from`.
- Avatar side effects go through the per-agent event bus `avatar/engine/bus.ts` (`emitPingu(agentId, …)` / `onPingu`), not props: the typewriter emits `syllable` events for lip-sync, the composer emits `keystroke`, and one-shot `action`s (spin, burst…) go the same way. `useChat.react()` sets short-lived "flourish" states (e.g. after an emoji reaction) that override the avatar state.

## Avatar (`avatar/`)

A port of the Grok Bot avatar, rendered as imperative SVG. `avatar/` is distributed copy-paste style (like shadcn/ui): developers copy the folder into their own project, so it must stay self-contained. Relative imports only, no Tailwind classes, no `--gb-*`/`--st-*` tokens, no i18n, no app imports; anything themeable is a `--pingu-*` CSS variable with an inline fallback. The app imports it through the barrels `@/avatar` and `@/avatar/export`, never deep paths. Keep `avatar/README.md` (props, states, shapes, variables) in step with the code.
- `avatar/PinguAvatar.tsx` renders the SVG skeleton once and hands its elements to a `PinguEngine` (`engine.ts`), which mutates path `d` attributes every frame. Do not drive per-frame animation through React state.
- `ticker.ts` runs **one** shared `requestAnimationFrame` for every avatar on the page, plus shared pointer/activity tracking. A shared `IntersectionObserver` pauses off-screen avatars, and `reducedMotion()` / `animated={false}` / `still` render a single frame instead.
- `states.ts`: `STATES` is the catalogue of expressions. A `StateDef` declares eye sets, beak, fx, an optional `morph` glyph, timers (`every`), an `enter` hook, and a `motion(t, targets, actions)` function that writes `Targets`; springs (`spring.ts`, fixed 1/120 s step) smooth the result. `EngineState` is derived from the keys of `STATES`. Legacy names (`loading`, `sleepy`…) map through `ALIASES`/`resolveState`.
- `shapes.ts`: body shapes are radial rings of `BODY_N` points (built with `radialRing` / `radialFromPolygon`), so any two shapes can morph via `lerpRing`. New shapes must go through those builders. The face is projected onto an ellipsoid fitted to each shape (`projection.ts`).
- Colours are CSS variables on the SVG (`--pingu-body`, `--pingu-eye`, `--pingu-beak`, `--pingu-mouth`, plus `--pingu-sweat` for the sweat drop). `color="auto"` (`PINGU_AUTO`, the default, used by Pingu and Colonia) follows the theme through `--pingu-auto-body`/`--pingu-auto-eye`, set by `avatar/pingu-avatar.css` (imported by `globals.css`): black with white eyes in light mode, white with black eyes in dark mode. The beak is red, or amber on saturated red/orange/pink/purple bodies (`beakFor`); never outline it. `ring` outlines the body (Colonia's huddled members). `avatar/export/pingu-export.ts#standalone` resolves them to computed values before serialising, so any new colour must also be a CSS variable or it will be lost on export.

## Exports

- `avatar/export/pingu-export.ts`: still PNG/SVG download and clipboard copy (`PinguStudio` exports from a separate front-facing still copy, never the live spinning avatar).
- `avatar/export/pingu-media.ts`: animated export. The engine runs on the real clock, so `recordFrames` serialises the live SVG at a fixed fps, then frames are rasterised and encoded (`gifenc` for GIF, `mediabunny` for MP4/WebM, SMIL for animated SVG). `avatar/export/gifenc.d.ts` provides the missing types.

## Styling and copy

- Tailwind v4, configured in CSS only (`app/globals.css`). Chat colours are the `gb-*` tokens (`bg-gb-main`, `text-gb-side-2`…) declared under `@theme inline` and mapped to `--gb-*` variables. Layout dimensions mirror the Grok demo on x.ai/bot (976×660 shell, 280px sidebar). The studio has its own light/dark theme via `.studio[data-theme=…]`.
- UI copy and Pingu's jokes are translated into it/en/es/zh (Italian is the source; adapt jokes rather than translating puns literally); code comments are English.
- `lib/i18n.ts` (it/en/es/zh, a `useSyncExternalStore` store kept in `localStorage` under `pingu-lang`) translates the interface of both the chat and the studio via `useI18n().t(key)`; first-time visitors get their browser's language (`navigator.languages`, first of it/en/es/zh found, else English); only a manual choice is saved. Add new copy as a key in all four dictionaries (`it` defines the `Key` type). Chat copy (jokes, persona names, greetings, suggestions) is not in `i18n.ts`: it lives in `lib/pingu-brain.ts` and `lib/agents.ts`, also in all four languages.
- Icons everywhere are `@phosphor-icons/react` components (listed in `experimental.optimizePackageImports`); don't hand-draw SVG icons. Tooltips use the CSS-only `components/Tooltip.tsx` inside a `group relative` wrapper, not `title`.
- `components/NavRail.tsx` is the floating rail, and it must look identical on both pages: Chat, Personalizza, Animazioni, Impostazioni, GitHub, then a divider and the light/dark switch, all Phosphor fill-weight icons with tooltips. The active highlight is one pill that slides between items (measured from the DOM); a module-level `lastActive` makes the rail mounted by a page change slide from the previous page's item. In the studio the tab items switch tabs in place; in the chat they link to `/?tab=…` (the studio reads `?tab=` on load through `useSearchParams()`, never `window.location`: on a client-side navigation from the chat it mounts while the address bar still reads `/chat`; it writes the URL only when a tab is clicked). Pass `dividerClassName` and `tooltipClassName` matching the breakpoint where the rail turns vertical (`md` in the studio, `min-[1180px]` in the chat).
- Theme: `useTheme()` in `NavRail.tsx` (shared `localStorage` key `pingu-studio-theme`) drives both pages: `.studio[data-theme]` sets the `--st-*` tokens, `.chat[data-theme="light"]` overrides the `--gb-*` tokens (dark is the `:root` default). Any new chat colour must be a `--gb-*` token with a light value, not a hex literal. Switching runs inside `document.startViewTransition` + `flushSync` for a page cross-fade (skipped under reduced motion). An inline script in `app/layout.tsx` copies the saved theme to `<html data-theme>` before the first paint, and Tailwind's `dark:` variant is redefined in `globals.css` to follow it (not the OS setting); `useTheme` keeps it in sync.
- The studio's Animazioni tab is a montage editor (`lib/montage.ts` catalogue + `components/studio/Timeline.tsx`); `MontageDialog` exports it as MP4 or GIF by replaying and recording it live.
