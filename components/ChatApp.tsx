"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { GithubLogo, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { AGENTS, getAgent } from "@/lib/agents";
import { shortTime } from "@/lib/time";
import { messageText, useChat, type Message, type Status } from "@/hooks/useChat";
import { emitPingu, type EngineState, type PinguEvent } from "@/avatar";
import AgentAvatar from "./AgentAvatar";
import NavRail, { useTheme } from "./NavRail";
import { useI18n } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/links";
import ChatPane from "./ChatPane";
import Tooltip from "./Tooltip";

/* Dimensions mirror the Grokbot demo on x.ai/bot: a 976×660 shell, 280px sidebar. */
export default function ChatApp() {
  const { t, lang } = useI18n();
  const chat = useChat();
  const [theme, setTheme] = useTheme();
  const [activeId, setActiveId] = useState("pingu");
  const [query, setQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("chat");
  /** The person is typing to the open agent: its avatars listen and nod along. */
  const [listening, setListening] = useState(false);
  /** The pointer is over the chat list: every avatar in it stops fidgeting and watches it. */
  const [overList, setOverList] = useState(false);

  const open = (id: string) => {
    setActiveId(id);
    setListening(false);
    chat.setActive(id);
    setMobileView("chat");
  };

  const agents = AGENTS.filter((a) => a.copy[lang].name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main
      data-theme={theme}
      className="chat relative flex min-h-dvh flex-col items-center justify-center gap-5 bg-gb-page py-5 text-gb-text md:gap-6 md:p-6"
    >
      {/* The studio's rail, identical (theme switch included): the theme is shared with the studio
          and drives the chat's own light/dark tokens. On top on small screens, floating on the left on wide ones. */}
      <div className="studio min-[1180px]:absolute min-[1180px]:left-5 min-[1180px]:top-1/2 min-[1180px]:-translate-y-1/2" data-theme={theme}>
        <NavRail
          active="chat"
          theme={theme}
          onTheme={setTheme}
          className="min-[1180px]:flex-col"
          dividerClassName="h-7 w-px min-[1180px]:h-px min-[1180px]:w-7"
          tooltipClassName="left-1/2 top-[calc(100%+8px)] -translate-x-1/2 min-[1180px]:left-[calc(100%+12px)] min-[1180px]:top-1/2 min-[1180px]:translate-x-0 min-[1180px]:-translate-y-1/2"
        />
      </div>
      <div className="flex h-[calc(100dvh-164px)] w-full overflow-hidden bg-gb-main md:h-[660px] md:max-h-[calc(100dvh-176px)] md:w-[976px] md:rounded-[24px] md:ring-1 md:ring-gb-ring min-[1180px]:max-h-[calc(100dvh-92px)]">
        {/* Sidebar */}
        <aside
          className={`${mobileView === "list" ? "flex" : "hidden"} w-full flex-col bg-gb-sidebar md:flex md:w-[280px] md:shrink-0 md:border-r md:border-gb-divider`}
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
                className="grid size-6 place-items-center rounded-[6px] text-gb-side-2 transition hover:bg-gb-hover hover:text-gb-side-1"
                aria-label={t("chat.newChat")}
              >
                <Plus size={16} />
              </button>
              {/* Below the button and right-aligned, so it stays inside the sidebar. */}
              <Tooltip label={t("chat.newChat")} tone="chat" className="right-0 top-[calc(100%+6px)]" />
            </div>
          </div>

          <div className="pl-4 pr-[10px]">
            <label className="flex h-8 items-center gap-2 rounded-[10px] border-[0.5px] border-gb-search-border bg-gb-search px-[10px] text-gb-side-3">
              <MagnifyingGlass size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("chat.search")}
                className="w-full bg-transparent text-[13px] leading-[18px] text-gb-side-1 placeholder:text-gb-side-3 focus:outline-none"
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
                onClick={() => open(agent.id)}
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
        </aside>

        {/* Chat */}
        <ChatPane
          key={activeId}
          className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex`}
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
          onBack={() => setMobileView("list")}
        />
      </div>

      {/* Same style as the GitHub link in the studio's Info section. */}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-5 items-center gap-2 text-[14px] font-medium text-gb-text underline-offset-4 hover:underline"
      >
        <GithubLogo size={18} weight="fill" />
        {t("chat.github")}
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
