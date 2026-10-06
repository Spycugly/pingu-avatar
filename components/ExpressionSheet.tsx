"use client";

import { useRef, useState } from "react";
import {
  PINGU_WHITE,
  PinguAvatar,
  SHAPE_NAMES,
  STATE_NAMES,
  syllableFor,
  type EngineState,
  type Frozen,
  type PinguHandle,
  type ShapeName,
} from "@/avatar";

/** The 16 poses of the reference sheet, row by row. */
const SHEET: { label: string; f: Frozen }[] = [
  { label: "fronte", f: {} },
  { label: "parla", f: { beak: "talk", open: 0.75, turn: 18, fx: "sound" } },
  { label: "felice", f: { eyes: "happy" } },
  { label: "occhiolino", f: { eyes: "wink", turn: 10, fx: "bang" } },
  { label: "oh!", f: { beak: "o" } },
  { label: "profilo", f: { turn: 72 } },
  { label: "curioso 3/4", f: { turn: -38, tilt: 14 } },
  { label: "arrabbiato", f: { eyes: "angry", turn: 14 } },
  { label: "contento", f: { eyes: "content" } },
  { label: "felice 3/4", f: { eyes: "happy", turn: 30, fx: "bang" } },
  { label: "profilo", f: { turn: 70, tilt: -4 } },
  { label: "confuso", f: { eyes: "confused", turn: 30, fx: "question" } },
  { label: "profilo basso", f: { turn: 74, tilt: -10 } },
  { label: "noot!", f: { turn: 70, tilt: 8, beak: "shout", open: 1, fx: "sound" } },
  { label: "3/4 su", f: { turn: -42, tilt: 12 } },
  { label: "risata", f: { eyes: "laugh", beak: "laugh", open: 0.8, fx: "sound" } },
];

const COLORS = [PINGU_WHITE, "#ef9231", "#3b7ff2", "#936ef5", "#68bead", "#EB4699"];
const ACTIONS = ["spin", "spinBounce", "spinDizzy", "spinWild", "bounce", "burst"] as const;

export default function ExpressionSheet() {
  return (
    <main className="min-h-dvh bg-black px-6 py-12 text-gb-text">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-16">
        <section>
          <h1 className="mb-1 text-[20px] font-medium">Espressioni di Pingu</h1>
          <p className="mb-8 text-[13px] text-gb-text-2">Le 16 pose del foglio di riferimento, come fotogrammi fissi.</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {SHEET.map((cell, i) => (
              <figure key={i} className="flex flex-col items-center gap-2">
                <PinguAvatar size={200} fit="roomy" frozen={cell.f} />
                <figcaption className="text-[12px] text-gb-text-2">
                  {i + 1}. {cell.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <Playground />
      </div>
    </main>
  );
}

function Playground() {
  const [state, setState] = useState<EngineState>("idle");
  const [shape, setShape] = useState<ShapeName>("mochi");
  const [color, setColor] = useState(PINGU_WHITE);
  const [pinPose, setPinPose] = useState(false);
  const [pose, setPose] = useState({ turn: 0, tilt: 0, roll: 0 });
  const [line, setLine] = useState("Noot noot. Sono Pingu, rispondo con una battuta sola.");
  const pingu = useRef<PinguHandle>(null);
  const speaking = useRef(0);

  const speak = () => {
    window.clearInterval(speaking.current);
    setState("talking");
    let i = 0;
    speaking.current = window.setInterval(() => {
      const open = syllableFor(line[i] ?? ".");
      if (open !== null) pingu.current?.syllable(open);
      if (++i > line.length) {
        window.clearInterval(speaking.current);
        window.setTimeout(() => setState("happy"), 250);
      }
    }, 55);
  };

  return (
    <section className="grid gap-8 md:grid-cols-[1fr_360px]">
      <div className="grid min-h-[420px] place-items-center rounded-[24px] bg-gb-main">
        <PinguAvatar
          ref={pingu}
          size={300}
          state={state}
          shape={shape}
          color={color}
          pose={pinPose ? pose : undefined}
          onClick={() => pingu.current?.spinBounce()}
        />
      </div>
      <div className="flex flex-col gap-6 text-[13px]">
        <Group title="Stati">
          {STATE_NAMES.map((s) => (
            <Chip key={s} active={s === state} onClick={() => setState(s)}>
              {s}
            </Chip>
          ))}
        </Group>
        <Group title="Azioni">
          {ACTIONS.map((a) => (
            <Chip key={a} onClick={() => pingu.current?.[a]()}>
              {a}
            </Chip>
          ))}
        </Group>
        <Group title="Forma">
          {SHAPE_NAMES.map((s) => (
            <Chip key={s} active={s === shape} onClick={() => setShape(s)}>
              {s}
            </Chip>
          ))}
        </Group>
        <Group title="Colore">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`size-7 rounded-full ring-offset-2 ring-offset-black ${c === color ? "ring-2 ring-white" : ""}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </Group>
        <Group title="Posa">
          <label className="flex w-full items-center gap-2 text-gb-text-2">
            <input type="checkbox" checked={pinPose} onChange={(e) => setPinPose(e.target.checked)} />
            Blocca la posa
          </label>
          {(["turn", "tilt", "roll"] as const).map((k) => (
            <label key={k} className="flex w-full items-center gap-3 text-gb-text-2">
              <span className="w-8">{k}</span>
              <input
                type="range"
                min={k === "turn" ? -100 : -40}
                max={k === "turn" ? 100 : 40}
                value={pose[k]}
                onChange={(e) => {
                  setPinPose(true);
                  setPose((p) => ({ ...p, [k]: Number(e.target.value) }));
                }}
                className="flex-1"
              />
              <span className="w-8 text-right tabular-nums">{pose[k]}</span>
            </label>
          ))}
        </Group>
        <Group title="Labiale">
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="w-full rounded-[10px] bg-gb-search px-3 py-2 text-gb-text focus:outline-none"
          />
          <Chip onClick={speak}>Parla</Chip>
        </Group>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[12px] uppercase tracking-wide text-gb-text-3">{title}</h2>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 transition ${active ? "bg-gb-emphasis text-gb-user-ink" : "bg-gb-fill text-gb-text-2 hover:text-gb-text"}`}
    >
      {children}
    </button>
  );
}
