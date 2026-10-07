"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS, getAgent } from "@/lib/agents";
import { getPinguReply, greetingLine, lineForItalian, lineText, RESET_LINE } from "@/lib/pingu-brain";
import type { Lang } from "@/lib/i18n";
import { noot } from "@/lib/noot";
import { setSoundOn, soundOn, useSoundOn } from "@/lib/sound";
import type { EngineState } from "@/avatar";

export type Status = "idle" | "thinking" | "talking";

export type Message = {
  id: string;
  role: "user" | "pingu" | "system";
  /** What was typed (user) or the Italian line, kept as a fallback for `line`. */
  text: string;
  /** Pingu/system copy is stored as a line id and rendered in the current language (see `messageText`). */
  line?: string;
  at: number;
  /** Which penguin spoke (differs from the thread in group chats). */
  from?: string;
  tokenGag?: boolean;
  /** Face Pingu pulls after typing this line. */
  mood?: EngineState;
  /** Emoji reaction Pingu left on a user message. */
  reaction?: string;
  /** True while the typewriter has not finished. */
  typing?: boolean;
};

type Threads = Record<string, Message[]>;

const STORAGE_KEY = "pingu-chat-v2";
const REACTIONS = ["🙄", "🐟", "👍", "😐", "🧊", "💀"];
/** Leaving a reaction makes the header avatar act it out (Grok celebrates for 2.4s). */
const REACTION_FLOURISH: Record<string, EngineState> = {
  "🙄": "bored",
  "🐟": "happy",
  "👍": "celebrate",
  "😐": "suspicious",
  "🧊": "proud",
  "💀": "laughing",
};
const FLOURISH_MS = 2400;

export type Flourish = { state: EngineState; id: number };

const uid = () => Math.random().toString(36).slice(2, 10);

/** A message's text in the interface language. */
export const messageText = (m: Message, lang: Lang) => (m.line && lineText(m.line, lang)) ?? m.text;

/** A Pingu or system message for a line id. */
const lineMessage = (role: Message["role"], line: string, at: number) => ({
  id: uid(),
  role,
  line,
  text: lineText(line, "it") ?? "",
  at,
});

function greetingThread(agentId: string, at = Date.now()): Message[] {
  const agent = getAgent(agentId);
  return [
    {
      ...lineMessage("pingu", greetingLine(agent.id), at),
      from: agent.members ? agent.members[0] : agent.id,
    },
  ];
}

function loadThreads(): Threads {
  let saved: Threads = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {}
  const threads: Threads = {};
  AGENTS.forEach((a, i) => {
    // Threads saved before line ids existed hold Italian text: map it back to its line so it translates.
    const msgs = saved[a.id]?.map((m) => ({
      ...m,
      line: m.line ?? (m.role === "user" ? undefined : lineForItalian(m.text)),
      typing: false,
    }));
    threads[a.id] = msgs?.length ? msgs : greetingThread(a.id, Date.now() - i * 47 * 60_000);
  });
  return threads;
}

export function useChat() {
  const [threads, setThreads] = useState<Threads>(loadThreads);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [flourish, setFlourish] = useState<Record<string, Flourish | undefined>>({});
  // The app-wide sound setting (lib/sound.ts): the noot noot and the interface sounds.
  const sound = useSoundOn();
  const setSound = useCallback((next: boolean | ((on: boolean) => boolean)) => {
    setSoundOn(typeof next === "function" ? next(soundOn()) : next);
  }, []);

  const threadsRef = useRef(threads);
  const activeRef = useRef<string>("pingu");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    threadsRef.current = threads;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {}
  }, [threads]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Play a short avatar flourish (celebrate, laugh…) for one agent. */
  const react = useCallback((agentId: string, state: EngineState, ms = FLOURISH_MS) => {
    const id = Math.random();
    setFlourish((f) => ({ ...f, [agentId]: { state, id } }));
    const timer = window.setTimeout(
      () => setFlourish((f) => (f[agentId]?.id === id ? { ...f, [agentId]: undefined } : f)),
      ms,
    );
    timers.current.push(timer);
  }, []);

  const setActive = useCallback((id: string) => {
    activeRef.current = id;
    setUnread((u) => ({ ...u, [id]: false }));
  }, []);

  const send = useCallback((agentId: string, raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userMsg: Message = { id: uid(), role: "user", text, at: Date.now() };
    const before = threadsRef.current[agentId] ?? [];
    setThreads((t) => ({ ...t, [agentId]: [...t[agentId], userMsg] }));
    setStatus((s) => ({ ...s, [agentId]: "thinking" }));

    // Long enough for the pending row to play warm-up, thinking dots and a beat or two (Grok-like pacing).
    const delay = 1700 + Math.random() * 1300 + Math.min(text.length * 12, 900);
    const timer = window.setTimeout(() => {
      const agent = getAgent(agentId);
      const speaker = agent.members
        ? agent.members[Math.floor(Math.random() * agent.members.length)]
        : agent.id;
      const lastMsg = before[before.length - 1];
      const hasUserTurn = before.some((m) => m.role === "user");
      const reply = getPinguReply(text, {
        agentId: speaker,
        answering: hasUserTurn && lastMsg?.role === "pingu",
        recent: before.flatMap((m) => (m.role === "pingu" && m.line ? [m.line] : [])).slice(-12),
      });
      // A rare treat, not a habit: about one message in ten, and never while one of the last few
      // user messages still carries a reaction.
      const reactedLately = before
        .filter((m) => m.role === "user")
        .slice(-4)
        .some((m) => m.reaction);
      const reaction =
        !reactedLately && Math.random() < 0.1 ? REACTIONS[Math.floor(Math.random() * REACTIONS.length)] : undefined;

      setThreads((t) => ({
        ...t,
        [agentId]: [
          ...t[agentId].map((m) => (m.id === userMsg.id ? { ...m, reaction } : m)),
          {
            ...lineMessage("pingu", reply.line, Date.now()),
            from: speaker,
            tokenGag: reply.tokenGag,
            mood: reply.mood,
            typing: true,
          },
        ],
      }));
      setStatus((s) => ({ ...s, [agentId]: "talking" }));
      if (activeRef.current !== agentId) setUnread((u) => ({ ...u, [agentId]: true }));
      if (soundOn()) noot();
      if (reaction) react(agentId, REACTION_FLOURISH[reaction] ?? "celebrate");
    }, delay);
    timers.current.push(timer);
  }, [react]);

  const finishTyping = useCallback((agentId: string, msgId: string) => {
    setThreads((t) => ({
      ...t,
      [agentId]: t[agentId].map((m) => (m.id === msgId ? { ...m, typing: false } : m)),
    }));
    setStatus((s) => ({ ...s, [agentId]: "idle" }));
  }, []);

  const reset = useCallback((agentId: string) => {
    setThreads((t) => ({
      ...t,
      [agentId]: [
        lineMessage("system", RESET_LINE, Date.now()),
        ...greetingThread(agentId),
      ],
    }));
    setStatus((s) => ({ ...s, [agentId]: "idle" }));
  }, []);

  return { threads, status, unread, flourish, sound, setSound, send, finishTyping, reset, setActive, react };
}
