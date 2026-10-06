# Pingu avatar

An animated penguin avatar for React: 36 expressions, 10 body shapes, any colour, lip-sync,
spins and confetti. It renders as one inline SVG driven by a small spring engine (one shared
`requestAnimationFrame` for every avatar on the page). No dependencies besides React.

It is distributed the shadcn way: **copy this folder into your project** and import from it.
You own the code and can change anything.

## Install

1. Copy the whole `avatar/` folder into your project, for example to `src/components/avatar/`.
2. Optional: import `pingu-avatar.css` once (see [Themes](#themes-and-colours)).
3. Optional: install the encoders if you use the GIF or video exports (see [Exports](#exports)).

Requirements: React 18 or 19 and TypeScript. The component starts with `"use client"`, so it
works as is in the Next.js App Router; in Vite, CRA and the like the directive is ignored.

## Usage

```tsx
import { PinguAvatar } from "./avatar";

export function Hello() {
  return <PinguAvatar size={120} state="happy" />;
}
```

Shapes and colours:

```tsx
<PinguAvatar size={80} shape="egg" color="#3b8be8" state="curious" />
```

Imperative actions through a ref:

```tsx
import { useRef } from "react";
import { PinguAvatar, type PinguHandle } from "./avatar";

export function Clicky() {
  const pingu = useRef<PinguHandle>(null);
  return (
    <PinguAvatar
      ref={pingu}
      size={160}
      onClick={() => pingu.current?.spinBounce()}
      title="Pingu"
    />
  );
}
```

`PinguHandle` methods: `spin(turns?)`, `spinBounce()`, `spinDizzy()`, `spinWild()`,
`bounce()`, `burst(count?)` (confetti), `syllable(open)` (lip-sync, `open` is 0 to 1).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `number` | `40` | Width and height in px. |
| `state` | `PinguState` | `"idle"` | The expression, see [States](#states). |
| `shape` | `ShapeName` | `"mochi"` | Body shape, see [Shapes](#shapes). Changing it morphs smoothly. |
| `color` | `string` | `PINGU_AUTO` | Any hex colour, or `"auto"` to follow the theme. Eyes follow the theme too (light on light pages, dark on dark ones, via `--pingu-auto-eye`), except near-black bodies (always light eyes) and near-white ones (always dark); red, orange, pink and purple bodies get an amber beak. |
| `animated` | `boolean` | `size >= 16` | `false` renders a single still frame (lists, thumbnails). |
| `mouseInteractive` | `boolean` | `true` | The head follows the pointer. |
| `autoDoze` | `boolean` | `false` | Dozes off after 15 s without input, sleeps after 40 s, wakes on activity. |
| `pose` | `{ turn?, tilt?, roll? }` | | Pins the head pose in degrees; missing fields keep animating. |
| `frozen` | `Frozen \| null` | | A hand-picked still frame (eyes, beak, pose, fx). |
| `fit` | `"tight" \| "roomy"` | `"tight"` under 64 px | `"roomy"` leaves space for the beak in profile and confetti. |
| `agentId` | `string` | | Subscribes the avatar to the [event bus](#event-bus) under this id. |
| `badge` | `boolean` | `false` | Red unread dot in the corner. |
| `ring` | `string` | | Outline around the body in this CSS colour, to separate overlapping avatars. |
| `title` | `string` | | Accessible name; without it the SVG is `aria-hidden`. |
| `onClick` | `() => void` | | |
| `className` | `string` | | Added after the `pingu` class. |
| `ref` | `Ref<PinguHandle>` | | See above. |

## States

`idle`, `waking`, `sleeping`, `drowsy`, `listening`, `thinking`, `searching`, `working`,
`excited`, `surprised`, `suspicious`, `angry`, `happy`, `curious`, `confused`, `bored`, `proud`,
`shy`, `sad`, `laughing`, `scared`, `playful`, `celebrate`, `talking`, `noot`.

Morph states turn the body into a small animated glyph: `orbit`, `radar`, `progress`,
`spawning`, `dictating`, `writing`, `sending`, `receiving`, `uploading`, `alerting`,
`powering-down`.

Aliases: `loading` → `working`, `sleepy` → `drowsy`, `bouncing` → `excited`,
`dragging` → `uploading`, `normal` and `notifying` → `idle`.

The list is exported as `STATE_NAMES`; `resolveState(name)` maps aliases and unknown names.

## Shapes

`mochi`, `blob`, `pebble`, `egg`, `squircle`, `gem`, `wedge`, `hex`, `heart`, `cloud`
(exported as `SHAPE_NAMES`). Every shape is a radial ring of the same number of points, so any
two can morph into each other.

## Themes and colours

Colours are CSS variables on the SVG, so they can be themed from outside:

| Variable | Default | Used for |
|---|---|---|
| `--pingu-auto-body` / `--pingu-auto-eye` | `#f7f7f4` / `#0b0b0b` | Body and eyes when `color="auto"`; custom colours use the same eye colour |
| `--pingu-fx` | `currentColor` | Comic marks: sound lines, `!`, `?`, `z` |
| `--pingu-sweat` / `--pingu-sweat-line` | `#6ec4ff` / `#2b8fd6` | The sweat drop in `scared` |
| `--pingu-badge-ring` | `#151514` | Ring around the unread badge (set it to your background) |

`pingu-avatar.css` sets the `auto` colours for you: a black Pingu with white eyes on light pages,
a white one on dark pages. It follows `prefers-color-scheme`, and a `data-theme="light|dark"`
attribute or a `.light` / `.dark` class on any ancestor wins over it. Without the file, `auto`
is always the white Pingu.

## Event bus

To drive many avatars without passing refs around, give them an `agentId` and emit events:

```ts
import { emitPingu, syllableFor } from "./avatar";

emitPingu("support-bot", { type: "action", name: "spinBounce" });
emitPingu("support-bot", { type: "keystroke" }); // a small nod, e.g. while the user types

// Lip-sync a typewriter: one event per character.
for (const ch of "Ciao!") {
  const open = syllableFor(ch); // null for characters that do not move the beak
  if (open !== null) emitPingu("support-bot", { type: "syllable", open });
}
```

Actions: `spin`, `bounce`, `burst`, `spinDizzy`, `spinWild`, `spinBounce`, `nod`, `shake`, `sigh`.

## Exports

`avatar/export/` turns a rendered avatar (any `SVGSVGElement`) into files. It is optional:
delete the folder if you do not need it.

```ts
import { downloadPng, downloadSvg, copyPng, recordFrames, framesToGif, save } from "./avatar/export";

const svg = document.querySelector<SVGSVGElement>("svg.pingu")!;
await downloadPng(svg, "pingu", { background: null }); // transparent PNG

const frames = await recordFrames(() => svg, 3000, 15, undefined, 480); // 3 s at 15 fps
save(await framesToGif(frames, { size: 480, fps: 15, background: null }), "pingu.gif");
```

- GIF needs `npm i gifenc` (MIT). MP4 and WebM (`framesToVideo`) need `npm i mediabunny` (MPL-2.0).
  Both are loaded with a dynamic `import()` only when you call them.
- `framesToAnimatedSvg` needs nothing extra.
- `gifenc.d.ts` provides the types `gifenc` does not ship.

## Notes

- **SSR:** importing is safe on the server; the engine starts in the browser after mount.
- **Performance:** one shared animation loop for all avatars. Avatars outside the viewport and
  hidden tabs pause, and `animated={false}` avatars cost one frame.
- **Reduced motion:** with `prefers-reduced-motion: reduce` every avatar renders still.
- **Files:** `PinguAvatar.tsx` renders the SVG skeleton once; `engine/` mutates it every frame
  (`engine.ts` animation, `states.ts` expressions, `shapes.ts` bodies, `faces.ts` eyes and beaks,
  `fx.ts` comic marks, `morphs.ts` glyphs, `particles.ts` confetti, `ticker.ts` the shared loop).

## Credits and licence

MIT, see [LICENSE](../LICENSE). The avatar's design and motion are based on xAI's Grok Bot
(x.ai/bot); all rights to the original design belong to their owners. "Pingu" is a trademark of
its respective owners; this project is not affiliated with xAI or with them.
