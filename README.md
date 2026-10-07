<div align="center">

https://github.com/user-attachments/assets/ebb7d630-bd49-4a8f-9329-f3450fb0f3b9

# Pingu Avatar

**An animated avatar for your AI assistant**, inspired by xAI's Grok Bot. Noot noot.

Drop it into a React project and give your assistant a face that listens, thinks, talks and reacts.

36 expressions · 10 body shapes · any colour · lip-sync · spins and confetti · PNG, SVG, GIF and MP4 export

[**Live demo**](https://pingu-avatar.vercel.app) · [Avatar docs](avatar/README.md)

</div>

---

## Use it in your project

### 1. Add it

Copy the [`avatar/`](avatar/) folder into your project, for example to `src/components/avatar/`.
There is no package to install and no dependency besides React (18 or 19, with TypeScript), and
the code is yours to change. It works as is in the Next.js App Router, Vite and the like.

Import `avatar/pingu-avatar.css` once if you want the default colour to follow your theme: a
black Pingu on light pages, a white one on dark pages.

### 2. Show it

```tsx
import { PinguAvatar } from "./avatar";

<PinguAvatar size={120} state="happy" />
<PinguAvatar size={80} shape="egg" color="#3b8be8" state="curious" />
```

Ten shapes (`mochi`, `egg`, `squircle`, `hex`, `heart`, `cloud`…) and any hex colour; changing
either morphs smoothly.

### 3. Connect it to your assistant

Map what your assistant is doing to a state:

| Your assistant | `state` |
|---|---|
| waiting | `idle` |
| the user is typing | `listening` |
| the model is working | `thinking` (or `searching`, `working`) |
| the answer is streaming in | `talking` |
| done, or something went wrong | `happy`, `proud`, `confused`, `sad`… |

```tsx
import { PinguAvatar, type PinguState } from "./avatar";

type Status = "idle" | "typing" | "thinking" | "streaming";
const FACE: Record<Status, PinguState> = {
  idle: "idle",
  typing: "listening",
  thinking: "thinking",
  streaming: "talking",
};

<PinguAvatar agentId="assistant" size={48} state={FACE[status]} />
```

### 4. Lip-sync and reactions

Give the avatar an `agentId` and send it events from anywhere, without passing refs around. For
lip-sync, send one syllable per character as your typewriter prints the answer:

```ts
import { emitPingu, syllableFor } from "./avatar";

const open = syllableFor(ch); // null for characters that don't move the beak
if (open !== null) emitPingu("assistant", { type: "syllable", open });

emitPingu("assistant", { type: "keystroke" }); // a small nod while the user types
emitPingu("assistant", { type: "action", name: "spinBounce" }); // or burst, nod, shake, sigh…
```

### 5. Go further

[`avatar/README.md`](avatar/README.md) has every prop (pose, auto-doze, still frames, unread
badge…), all 36 states, theming with CSS variables, and the optional PNG, SVG, GIF and MP4 exports.
Avatars off screen pause, and `prefers-reduced-motion` gets a still frame.

## The studio

Try the avatar in the [live demo](https://pingu-avatar.vercel.app), in English, Italian, Spanish
or Chinese, light or dark. Everything runs in the browser.

<table>
  <tr>
    <td width="50%"><a href="https://pingu-avatar.vercel.app"><img src="docs/studio.png" alt="The Customise tab" /></a><br /><b>Customise</b>: shape, expression, colour and theme; export as PNG, SVG or GIF.</td>
    <td width="50%"><a href="https://pingu-avatar.vercel.app/?tab=motion"><img src="docs/animation.png" alt="The Animation tab" /></a><br /><b>Animation</b>: line up animations on a timeline and export the montage as MP4 or GIF.</td>
  </tr>
  <tr>
    <td width="50%"><a href="https://pingu-avatar.vercel.app/?tab=settings"><img src="docs/settings.png" alt="The Settings tab" /></a><br /><b>Settings</b>: language, sounds, a locked pose, cursor following, transparent exports.</td>
    <td width="50%"><a href="https://pingu-avatar.vercel.app/espressioni"><img src="docs/expressions.png" alt="The expression sheet" /></a><br /><b>Expressions</b>: the 16 poses of the original reference sheet, side by side.</td>
  </tr>
</table>

## Credits

Made by Gabriel Spicuglia. If you use the avatar, a ⭐ on this repo is appreciated. Notes for
contributors (and coding agents) are in [`CLAUDE.md`](CLAUDE.md).

A non-commercial exploration project. The avatar's design and animations are based on xAI's
Grok Bot (x.ai/bot), and all rights to the original design belong to their owners. "Pingu" is a
trademark of its respective owners. This project is not affiliated with, or endorsed by, xAI or
the owners of Pingu.

## Licence

[MIT](LICENSE)
