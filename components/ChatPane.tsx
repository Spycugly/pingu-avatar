"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, CaretLeft, Microphone, Plus, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { getAgent, SUGGESTIONS, THINKING_BEATS, type Agent } from "@/lib/agents";
import { emitPingu, PinguAvatar, syllableFor, type EngineState } from "@/avatar";
import { noot } from "@/lib/noot";
import { play } from "@/lib/sound";
import { dayTime } from "@/lib/time";
import { useI18n, type Key } from "@/lib/i18n";
import { messageText, type Message, type Status } from "@/hooks/useChat";
import AgentAvatar from "./AgentAvatar";
import Tooltip from "./Tooltip";

type Props = {
  agentId: string;
  messages: Message[];
  status: Status;
  /** Short reaction the header avatar acts out (celebrate, laugh…). */
  flourish?: EngineState;
  sound: boolean;
  className?: string;
  onToggleSound: () => void;
  onListening: (listening: boolean) => void;
  onReact: (state: EngineState, ms?: number) => void;
  onSend: (text: string) => void;
  onTyped: (msgId: string) => void;
  onBack: () => void;
};

const SEPARATOR_GAP = 30 * 60_000;
/** How long Pingu stays on screen after speaking, pulling the face that fits his line. */
const LINGER_MS = 1800;

export default function ChatPane({
  agentId,
  messages,
  status,
  flourish,
  sound,
  className = "",
  onToggleSound,
  onListening,
  onReact,
  onSend,
  onTyped,
  onBack,
}: Props) {
  const { t, locale, lang } = useI18n();
  const words = { locale, today: t("chat.today"), yesterday: t("chat.yesterday") };
  const agent = getAgent(agentId);
  const name = agent.copy[lang].name;
  const isGroup = !!agent.members;
  const busy = status !== "idle";
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Keep Pingu's presence row up briefly after talking so the happy face is seen.
  const [prevStatus, setPrevStatus] = useState(status);
  const [linger, setLinger] = useState(false);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setLinger(prevStatus === "talking" && status === "idle");
  }
  useEffect(() => {
    if (!linger) return;
    const t = window.setTimeout(() => setLinger(false), LINGER_MS);
    return () => clearTimeout(t);
  }, [linger]);

  // Stick to the bottom as messages arrive and the typewriter grows them.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const toBottom = () => scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    const ro = new ResizeObserver(toBottom);
    ro.observe(content);
    scroller.scrollTop = scroller.scrollHeight;
    return () => ro.disconnect();
  }, []);

  const lastPingu = [...messages].reverse().find((m) => m.role === "pingu");
  const speaker = lastPingu?.from && status !== "thinking" ? getAgent(lastPingu.from) : agent;
  const [typing, setTyping] = useState(false);

  const headerState: EngineState =
    flourish ?? (status === "thinking" ? "working" : status === "talking" ? "talking" : typing ? "listening" : "idle");

  // Poke the header avatar: it spins, throws confetti and (with sound on) honks.
  const poke = () => {
    emitPingu(agentId, { type: "action", name: "spinBounce" });
    emitPingu(agentId, { type: "action", name: "burst" });
    if (sound) noot();
  };

  return (
    <section className={`relative min-w-0 flex-1 flex-col bg-gb-main ${className}`}>
      {/* Header */}
      <header className="flex h-[calc(52px+env(safe-area-inset-top))] shrink-0 pt-[env(safe-area-inset-top)] items-center gap-1 border-b border-gb-divider px-4 md:h-[44px]">
        <button
          onClick={onBack}
          className="-ml-3 grid size-11 shrink-0 place-items-center rounded-md text-gb-text-2 hover:bg-gb-hover md:hidden"
          aria-label={t("chat.back")}
        >
          <CaretLeft size={18} />
        </button>
        <AgentAvatar
          agent={agent}
          size={20}
          state={headerState}
          animated
          ring="var(--gb-main)"
          onClick={poke}
          title={t("chat.poke", { name })}
        />
        <div className="ml-1 flex min-w-0 items-baseline gap-2">
          <h1 className="truncate text-[13px] leading-[18px] text-gb-text">{name}</h1>
          {busy && (
            <span className="shimmer-text truncate text-[12px] leading-4">
              {status === "thinking" ? t("chat.thinking") : t("chat.typing")}
            </span>
          )}
        </div>
        <div className="group relative ml-auto">
          <button
            // Turning sound on honks once: proof that it works, and the click unlocks the audio.
            onClick={() => {
              if (!sound) noot();
              onToggleSound();
            }}
            className={`-mr-2.5 grid size-11 place-items-center rounded-[6px] transition hover:bg-gb-hover md:mr-0 md:size-6 ${sound ? "text-gb-text" : "text-gb-text-2"}`}
            aria-label={sound ? t("chat.soundOff") : t("chat.soundOn")}
            aria-pressed={sound}
          >
            {sound ? (
              <SpeakerHigh size={15} weight="fill" />
            ) : (
              <span className="grid">
                <SpeakerSlash size={15} weight="fill" className="[grid-area:1/1]" />
                {/* Phosphor draws the slash in the same path as the speaker: a red copy clipped to a
                    band along the slash (48,40 → 208,216 in the 256 grid) colours the slash alone. */}
                <SpeakerSlash
                  size={15}
                  weight="fill"
                  className="text-gb-danger [clip-path:polygon(18.05%_9.92%,86.88%_85.63%,81.95%_90.08%,13.13%_14.38%)] [grid-area:1/1]"
                />
              </span>
            )}
          </button>
          {/* Below the button and right-aligned, so it stays inside the pane. */}
          <Tooltip
            label={sound ? t("chat.soundOnTitle") : t("chat.soundOffTitle")}
            tone="chat"
            className="right-0 top-[calc(100%+6px)]"
          />
        </div>
      </header>

      {/* Transcript */}
      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div ref={contentRef} className="flex flex-col px-5 pb-12 pt-2">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showTime = !prev || m.at - prev.at > SEPARATOR_GAP;
            const speaker = m.from ? getAgent(m.from) : agent;
            const voice = m.from ?? agentId;
            const newSpeaker =
              isGroup && m.role === "pingu" && (prev?.role !== "pingu" || prev.from !== m.from);
            const sameSender = !!prev && !showTime && !newSpeaker && prev.role === m.role && prev.from === m.from;
            const gap = showTime || newSpeaker ? "mt-2" : i === 0 ? "" : sameSender ? "mt-1.5" : "mt-[18px]";
            return (
              <div key={m.id} className="flex flex-col">
                {showTime && (
                  <p className={`py-1 text-center text-[12px] leading-4 text-gb-text-2 ${i === 0 ? "" : "mt-5"}`}>
                    {dayTime(m.at, words)}
                  </p>
                )}
                {newSpeaker && (
                  <p
                    className={`flex items-center justify-center gap-1 text-[13px] leading-4 text-gb-text-2 ${showTime ? "mt-2" : "mt-[18px]"}`}
                  >
                    {t("chat.messageFrom")}
                    <PinguAvatar size={15} color={speaker.color} shape={speaker.shape} animated={false} />
                    <span className="text-gb-text">{speaker.copy[lang].name}</span>
                  </p>
                )}

                {m.role === "system" && (
                  <p className={`text-center text-[13px] leading-4 text-gb-text-2 ${showTime ? "mt-3" : "mt-5"}`}>
                    {messageText(m, lang)}
                  </p>
                )}

                {m.role === "user" && (
                  <div className={`msg-pop relative ml-auto max-w-[85%] ${gap}`}>
                    <div className="whitespace-pre-wrap rounded-2xl bg-gb-user px-3 py-2 text-[14px] leading-5 text-gb-user-ink">
                      {m.text}
                    </div>
                    {m.reaction && (
                      <span
                        className="reaction-pop absolute -bottom-[14px] right-[10px] flex size-[22px] items-center justify-center rounded-full bg-gb-reaction ring-2 ring-gb-main"
                        title={t("chat.reaction", { name })}
                      >
                        {/* Emoji font metrics, not the text font's, so the glyph sits in the middle. */}
                        <span className="block text-[12px] leading-none [font-family:'Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji',sans-serif]">
                          {m.reaction}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {m.role === "pingu" && (
                  <div className={`msg-pop flex flex-col items-start ${gap}`}>
                    <div className="flex max-w-[85%] items-end gap-2.5">
                      {/* Pingu sits beside his line: talks while it types, pulls the face that fits it, then the
                          newest one stays alive (idle) while older lines keep their face as a still frame,
                          so the transcript reads as a row of expressions. */}
                      <PinguAvatar
                        size={40}
                        color={speaker.color}
                        shape={speaker.shape}
                        agentId={voice}
                        animated={!!m.typing || m === lastPingu}
                        state={
                          m.typing
                            ? "talking"
                            : m === lastPingu
                              ? linger
                                ? (m.mood ?? "happy")
                                : "idle"
                              : (m.mood ?? "idle")
                        }
                      />
                      <div className="min-w-0 whitespace-pre-wrap rounded-2xl bg-gb-bubble px-3 py-2 text-[14px] leading-5 text-gb-text">
                        <TypeText text={messageText(m, lang)} animate={!!m.typing} voice={voice} onDone={() => onTyped(m.id)} />
                      </div>
                    </div>
                    {m.tokenGag && !m.typing && (
                      <span className="msg-pop mt-2 pl-[62px] text-[13px] leading-4 text-gb-text-2">{t("chat.tokens")}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {status === "thinking" && (
            <PresenceRow
              status={busy ? status : "idle"}
              mood={lastPingu?.mood ?? "happy"}
              agentId={speaker.id}
              color={speaker.color}
              shape={speaker.shape}
            />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative shrink-0 px-5 pb-[max(12px,env(safe-area-inset-bottom))] md:pb-3">
        <div className="composer-fade pointer-events-none absolute inset-x-0 -top-12 h-12" />
        <Composer
          name={name}
          busy={busy}
          onSend={onSend}
          onTyping={(on) => {
            setTyping(on);
            onListening(on);
          }}
          onKey={() => emitPingu(agentId, { type: "keystroke" })}
          onDeaf={() => onReact("suspicious", 2600)}
        />
      </div>
    </section>
  );
}

function TypeText({
  text,
  animate,
  voice,
  onDone,
}: {
  text: string;
  animate: boolean;
  /** Agent whose beak moves with each character. */
  voice: string;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(() =>
    animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : text.length,
  );
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!animate) return;
    if (shown >= text.length) {
      // Let the beak close before Pingu goes idle.
      const t = window.setTimeout(() => doneRef.current(), 250);
      return () => clearTimeout(t);
    }
    const prevChar = text[shown - 1] ?? "";
    const delay = /[.,!?…]/.test(prevChar) ? 260 : 38 + Math.random() * 30;
    const open = syllableFor(text[shown] ?? "");
    if (open !== null) emitPingu(voice, { type: "syllable", open });
    const t = window.setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [animate, shown, text, voice]);

  const typing = animate && shown < text.length;
  return <span className={typing ? "caret" : undefined}>{text.slice(0, shown)}</span>;
}

/**
 * Grok-style pending row. Thinking runs in phases: a short warm-up, the thinking dots, then
 * "beats" (searching, writing, working…) with their own labels. When the reply lands Pingu is
 * surprised for a moment, talks with the typewriter, then lingers on the face that fits his line
 * (the message keeps that face as a still frame once a newer line arrives).
 */
type Phase = { state: EngineState; label?: Key };

const WARM: Phase = { state: "idle", label: "chat.warm" };
const phaseFor = (status: Status, mood: EngineState): Phase =>
  status === "thinking" ? WARM : status === "talking" ? { state: "surprised" } : { state: mood };

function PresenceRow({
  status,
  mood,
  agentId,
  color,
  shape,
}: {
  status: Status;
  mood: EngineState;
  agentId: string;
  color: string;
  shape: Agent["shape"];
}) {
  const { t } = useI18n();
  const [prev, setPrev] = useState(status);
  const [phase, setPhase] = useState<Phase>(() => phaseFor(status, mood));
  if (status !== prev) {
    setPrev(status);
    setPhase(phaseFor(status, mood));
  }

  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (status === "thinking") {
      const beats = [...THINKING_BEATS].sort(() => Math.random() - 0.5);
      let at = 450;
      later(at, () => setPhase({ state: "thinking", label: "chat.thinkingJoke" }));
      at += 900 + Math.random() * 300;
      beats.forEach((b) => {
        later(at, () => setPhase({ state: b.state, label: `beat.${b.state}` as Key }));
        at += b.min + Math.random() * (b.max - b.min);
      });
    } else if (status === "talking") {
      later(400, () => setPhase({ state: "talking" }));
    }
    return () => timers.forEach(clearTimeout);
  }, [status]);

  return (
    <div className="msg-pop mt-[18px] flex items-center gap-3" role="status">
      <PinguAvatar size={40} color={color} shape={shape} state={phase.state} agentId={agentId} />
      {phase.label && (
        <span key={phase.label} className="presence-label shimmer-text text-[14px] leading-5">
          {t(phase.label)}
        </span>
      )}
    </div>
  );
}

function Composer({
  name,
  busy,
  onSend,
  onTyping,
  onKey,
  onDeaf,
}: {
  name: string;
  busy: boolean;
  onSend: (text: string) => void;
  onTyping: (typing: boolean) => void;
  onKey: () => void;
  onDeaf: () => void;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [deaf, setDeaf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !text.trim()) return;
    play("send");
    onSend(text);
    setText("");
    onTyping(false);
  };

  const micJoke = () => {
    onDeaf();
    setDeaf(true);
    window.setTimeout(() => setDeaf(false), 2600);
  };

  return (
    <form
      onSubmit={submit}
      className="relative flex h-[52px] items-center gap-2 rounded-full md:h-[45px] border-[0.5px] border-gb-border bg-gb-composer p-2"
    >
      <button
        type="button"
        onClick={() => {
          setText(SUGGESTIONS[lang][Math.floor(Math.random() * SUGGESTIONS[lang].length)]);
          onTyping(true);
          inputRef.current?.focus();
        }}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-gb-fill md:size-7 text-gb-text-2 transition hover:text-gb-text"
        aria-label={t("chat.suggest")}
        title={t("chat.suggest")}
      >
        <Plus size={14} weight="bold" />
      </button>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onTyping(!!e.target.value.trim());
          onKey();
        }}
        placeholder={deaf ? t("chat.deaf", { name }) : t("chat.placeholder", { name })}
        className="min-w-0 flex-1 bg-transparent py-0.5 text-[16px] leading-5 md:text-[14px] text-gb-text placeholder:text-gb-text-3 focus:outline-none"
        aria-label={t("chat.placeholder", { name })}
      />
      {text.trim() ? (
        <button
          type="submit"
          disabled={busy}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-gb-emphasis text-gb-user-ink transition hover:bg-gb-emphasis-hover disabled:opacity-40 md:size-7"
          aria-label={t("chat.send")}
        >
          <ArrowUp size={14} weight="bold" />
        </button>
      ) : (
        <button
          type="button"
          onClick={micJoke}
          className={`grid size-9 shrink-0 place-items-center rounded-full bg-gb-emphasis md:size-7 text-gb-user-ink transition hover:bg-gb-emphasis-hover ${deaf ? "wiggle" : ""}`}
          aria-label={t("chat.mic")}
        >
          <Microphone size={14} weight="fill" />
        </button>
      )}
    </form>
  );
}
