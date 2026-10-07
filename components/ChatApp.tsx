"use client";

import Image from "next/image";
import { addTransitionType, startTransition, useEffect, useRef, useState, ViewTransition } from "react";
import { GithubLogo, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { AGENTS, getAgent } from "@/lib/agents";
import { shortTime } from "@/lib/time";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { messageText, useChat, type Message, type Status } from "@/hooks/useChat";
import { emitPingu, type EngineState, type PinguEvent } from "@/avatar";
import AgentAvatar from "./AgentAvatar";
import NavRail, { useTheme } from "./NavRail";
import { useI18n } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/links";
import { play } from "@/lib/sound";
import ChatPane from "./ChatPane";
import Tooltip from "./Tooltip";

/* Dimensions mirror the Grokbot demo on x.ai/bot: a 976×660 shell, 280px sidebar. */
export default function ChatApp() {
  const { t, lang } = useI18n();
  const chat = useChat();
  const [theme] = useTheme();
  const [activeId, setActiveId] = useState("pingu");
  const [query, setQuery] = useState("");
  /** Phones show one screen at a time, starting from the list (where the tab bar is), like a messaging app. */
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  /** The person is typing to the open agent: its avatars listen and nod along. */
  const [listening, setListening] = useState(false);
  /** The pointer is over the chat list: every avatar in it stops fidgeting and watches it. */
  const [overList, setOverList] = useState(false);

  /** On phones the list and the chat are two screens: moving between them slides (see .chat-push in globals.css). */
  const slide = (type: "chat-push" | "chat-pop", update: () => void) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return update();
    startTransition(() => {
      addTransitionType(type);
      update();
    });
  };

  // Phones: inside a conversation, dragging it to the right goes back to the list underneath.
  const paneRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const [peek, setPeek] = useState(false);
  useSwipeBack({
    pane: paneRef,
    under: listRef,
    active: mobileView === "chat",
    paneKey: activeId,
    onPeek: setPeek,
    onBack: () => setMobileView("list"),
  });

  // The body shows around the page when it bounces past its ends: give it the page's colour.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    document.body.style.backgroundColor = getComputedStyle(main).backgroundColor;
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, [mobileView, theme]);

  const open = (id: string) =>
    slide("chat-push", () => {
      setActiveId(id);
      setListening(false);
      chat.setActive(id);
      setMobileView("chat");
    });

  const agents = AGENTS.filter((a) => a.copy[lang].name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main
      ref={mainRef}
      data-theme={theme}
      // Phones: the page takes the colour of the screen on show (the list's, or the conversation's), so the
      // edges and the overscroll bounce blend in.
      className={`chat relative flex min-h-dvh flex-col items-center justify-center text-gb-text md:gap-6 md:bg-gb-page md:p-6 ${
        mobileView === "chat" ? "bg-gb-main" : "bg-gb-sidebar"
      }`}
    >
      {/* The studio's rail, identical: the theme (picked in the studio) is shared with it
          and drives the chat's own light/dark tokens. A tab bar at the bottom on phones (hidden inside a
          conversation, where the composer owns that edge), on top on tablets, floating on the left on wide screens. */}
      <div className="studio max-md:contents min-[1180px]:absolute min-[1180px]:left-5 min-[1180px]:top-1/2 min-[1180px]:-translate-y-1/2" data-theme={theme}>
        <NavRail
          active="chat"
          hideOnMobile={mobileView === "chat"}
          className="min-[1180px]:flex-col"
          tooltipClassName="left-1/2 top-[calc(100%+8px)] -translate-x-1/2 min-[1180px]:left-[calc(100%+12px)] min-[1180px]:top-1/2 min-[1180px]:translate-x-0 min-[1180px]:-translate-y-1/2"
        />
      </div>
      {/* Only the phone list/chat slides animate here: on a page change the shell must not fade in its
          own layer (an opaque rectangle above or below the translucent tab bar). */}
      <ViewTransition default="none" update={{ "chat-push": "chat-push", "chat-pop": "chat-pop", default: "none" }}>
        <div className="relative flex h-dvh w-full overflow-hidden bg-gb-main md:h-[660px] md:max-h-[calc(100dvh-176px)] md:w-[976px] md:rounded-[24px] md:ring-1 md:ring-gb-ring min-[1180px]:max-h-[calc(100dvh-92px)]">
          {/* Sidebar */}
          <aside
            ref={listRef}
            // While a swipe back runs, the list lies under the conversation (see useSwipeBack).
            className={`${mobileView === "list" || peek ? "flex" : "hidden"} ${peek ? "absolute inset-0" : ""} w-full flex-col bg-gb-sidebar pt-[env(safe-area-inset-top)] pb-[calc(max(12px,env(safe-area-inset-bottom))+70px)] md:flex md:pt-0 md:pb-0 md:w-[280px] md:shrink-0 md:border-r md:border-gb-divider`}
          >
            <div className="flex h-[44px] shrink-0 items-center justify-between pl-4 pr-[10px]">
              <div className="flex w-[52px] gap-2" aria-hidden>
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="group relative">
                <button
                  onClick={() => chat.reset(activeId)}
                  className="grid size-9 place-items-center rounded-[6px] text-gb-side-2 md:size-6 transition hover:bg-gb-hover hover:text-gb-side-1"
                  aria-label={t("chat.newChat")}
                >
                  <Plus size={16} />
                </button>
                {/* Below the button and right-aligned, so it stays inside the sidebar. */}
                <Tooltip label={t("chat.newChat")} tone="chat" className="right-0 top-[calc(100%+6px)]" />
              </div>
            </div>

            <div className="pl-4 pr-[10px]">
              <label className="flex h-10 items-center gap-2 rounded-[10px] md:h-8 border-[0.5px] border-gb-search-border bg-gb-search px-[10px] text-gb-side-3">
                <MagnifyingGlass size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("chat.search")}
                  className="w-full bg-transparent text-[16px] leading-[18px] text-gb-side-1 md:text-[13px] placeholder:text-gb-side-3 focus:outline-none"
                />
              </label>
            </div>

            <nav
              onPointerEnter={() => setOverList(true)}
              onPointerLeave={() => setOverList(false)}
              className="no-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2 pl-4 pr-[10px]"
            >
              {agents.map((agent) => (
                <SidebarItem
                  key={agent.id}
                  agentId={agent.id}
                  active={agent.id === activeId}
                  watching={overList}
                  messages={chat.threads[agent.id]}
                  status={chat.status[agent.id] ?? "idle"}
                  listening={listening && agent.id === activeId}
                  flourish={chat.flourish[agent.id]?.state}
                  unread={!!chat.unread[agent.id]}
                  onClick={() => {
                    if (agent.id !== activeId) play("tap");
                    open(agent.id);
                  }}
                />
              ))}
              {agents.length === 0 && (
                <p className="px-2 py-6 text-center text-[13px] text-gb-side-2">{t("chat.noResults")}</p>
              )}
            </nav>

            <div className="flex h-[50px] shrink-0 items-center gap-2 px-[14px] pb-[14px] pt-2">
              <Image src="/gabriel.jpg" alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
              <span className="text-[13px] leading-[18px] text-gb-side-1">Gabriel</span>
            </div>
            {/* Phones: the page footer would sit under the tab bar, so its links close the list instead. */}
            <div className="flex flex-col items-center gap-1.5 px-5 pb-2 md:hidden">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 text-[14px] font-medium text-gb-text">
                <GithubLogo size={18} weight="fill" />
                {t("chat.github")}
              </a>
              <a href="https://x.ai/bot" target="_blank" rel="noreferrer" className="text-center text-[12px] leading-4 text-gb-side-2">
                {t("chat.credit")}
              </a>
            </div>
          </aside>

          {/* Chat */}
          <ChatPane
            key={activeId}
            ref={paneRef}
            className={`${mobileView === "chat" ? "flex" : "hidden"} ${peek ? "z-10" : ""} md:flex`}
            agentId={activeId}
            messages={chat.threads[activeId]}
            status={chat.status[activeId] ?? "idle"}
            flourish={chat.flourish[activeId]?.state}
            sound={chat.sound}
            onListening={setListening}
            onReact={(state, ms) => chat.react(activeId, state, ms)}
            onToggleSound={() => chat.setSound((s) => !s)}
            onSend={(text) => chat.send(activeId, text)}
            onTyped={(msgId) => chat.finishTyping(activeId, msgId)}
            onBack={() => slide("chat-pop", () => setMobileView("list"))}
          />
        </div>
      </ViewTransition>

      {/* Footer links: no underline, they fade on hover instead. */}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-5 items-center gap-2 text-[14px] font-medium text-gb-text transition-opacity duration-200 hover:opacity-60 max-md:hidden"
      >
        <GithubLogo size={18} weight="fill" />
        {t("chat.github")}
      </a>
      {/* Credit for the chat's layout, which follows Grok Bot (see Credits in the README). */}
      <a
        href="https://x.ai/bot"
        target="_blank"
        rel="noreferrer"
        className="-mt-1 px-5 text-center text-[12px] leading-4 text-gb-side-2 transition-colors duration-200 hover:text-gb-text max-md:hidden md:-mt-2"
      >
        {t("chat.credit")}
      </a>
    </main>
  );
}

type ActionName = Extract<PinguEvent, { type: "action" }>["name"];
/** Moves for the idle sidebar avatars: no spins and no confetti. Repeats weight the gentler ones. */
const MOVES: ActionName[] = ["bounce", "bounce", "nod", "nod", "shake", "sigh"];
/** Short-lived expressions; none of these states spins or throws confetti on its own. */
const MOODS: EngineState[] = ["happy", "curious", "surprised", "excited", "proud", "shy", "bored", "confused", "suspicious", "laughing"];
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** While a chat is not selected and idle, its avatar now and then does a move or pulls a face
    for a few seconds. Returns the face to show, or null for the usual idle one. */
function useFidget(agentId: string, enabled: boolean) {
  const [mood, setMood] = useState<EngineState | null>(null);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let back: ReturnType<typeof setTimeout>;
    const next = (min: number) => {
      timer = setTimeout(() => {
        if (Math.random() < 0.5) emitPingu(agentId, { type: "action", name: pick(MOVES) });
        else {
          setMood(pick(MOODS));
          back = setTimeout(() => setMood(null), rand(2200, 4000));
        }
        next(5000);
      }, rand(min, 14000));
    };
    // A random first delay keeps the column from moving in sync.
    next(1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(back);
      setMood(null);
    };
  }, [agentId, enabled]);
  return mood;
}

function SidebarItem({
  agentId,
  active,
  watching,
  messages,
  status,
  listening,
  flourish,
  unread,
  onClick,
}: {
  agentId: string;
  active: boolean;
  /** The pointer is somewhere over the list. */
  watching: boolean;
  messages: Message[];
  status: Status;
  listening: boolean;
  flourish?: EngineState;
  unread: boolean;
  onClick: () => void;
}) {
  const { t, locale, lang } = useI18n();
  const agent = getAgent(agentId);
  const mood = useFidget(agentId, !active && !watching && status === "idle" && !flourish);
  const last = [...messages].reverse().find((m) => m.role !== "system");
  const preview =
    status === "thinking"
      ? t("chat.thinking")
      : last?.typing
        ? t("chat.typing")
        : last
          ? `${last.role === "user" ? t("chat.youPrefix") : ""}${messageText(last, lang)}`
          : "";

  return (
    <button
      onClick={onClick}
      className={`flex h-[53px] w-full shrink-0 items-center gap-2 rounded-[10px] p-2 text-left transition ${
        active ? "bg-gb-selected" : "hover:bg-gb-hover"
      }`}
    >
      <AgentAvatar
        agent={agent}
        size={32}
        state={
          flourish ??
          (status === "thinking" ? "working" : status === "talking" ? "talking" : listening ? "listening" : (mood ?? "idle"))
        }
        animated
        autoDoze={active}
        // The open chat always watches the pointer; the others only while it is over the list.
        mouseInteractive={active || watching}
        badge={unread}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] leading-5 tracking-[-0.15px] text-gb-side-1">{agent.copy[lang].name}</span>
          {last && <span className="shrink-0 text-[12px] leading-4 text-gb-side-3">{shortTime(last.at, { locale, today: t("chat.today"), yesterday: t("chat.yesterday") })}</span>}
        </div>
        <p className={`truncate text-[12px] leading-4 ${status !== "idle" ? "shimmer-text" : "text-gb-side-2"}`}>
          {preview}
        </p>
      </div>
    </button>
  );
}
