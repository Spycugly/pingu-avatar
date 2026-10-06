import { PinguAvatar, type PinguState } from "@/avatar";
import { getAgent, type Agent } from "@/lib/agents";

type Props = {
  agent: Agent;
  size: number;
  state?: PinguState;
  /** Like Grok, only the avatars that matter right now run the engine; the rest are stills. */
  animated?: boolean;
  badge?: boolean;
  autoDoze?: boolean;
  /** Eyes follow the pointer (on by default). */
  mouseInteractive?: boolean;
  /** Group chats: colour of the outline that separates the huddled members (the surface behind them). */
  ring?: string;
  onClick?: () => void;
  title?: string;
};

/** Single penguin, or a little huddle of three for group chats. */
export default function AgentAvatar({
  agent,
  size,
  state,
  animated = false,
  badge,
  autoDoze,
  mouseInteractive = true,
  ring = "var(--gb-sidebar)",
  onClick,
  title,
}: Props) {
  if (!agent.members) {
    return (
      <PinguAvatar
        size={size}
        color={agent.color}
        shape={agent.shape}
        state={state}
        agentId={agent.id}
        animated={animated}
        badge={badge}
        autoDoze={autoDoze}
        mouseInteractive={mouseInteractive}
        onClick={onClick}
        title={title}
      />
    );
  }
  const [a, b, c] = agent.members.slice(0, 3).map(getAgent);
  // Members a touch smaller and pushed to the corners, each outlined in the surface colour so the
  // overlaps read as separate penguins.
  const mini = Math.round(size * 0.58);
  const out = Math.max(1, Math.round(size * 0.06));
  const member = (m: Agent) => (
    <PinguAvatar size={mini} color={m.color} shape={m.shape} state={state} agentId={agent.id} animated={animated} mouseInteractive={mouseInteractive} ring={ring} />
  );
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden onClick={onClick}>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -out }}>{member(a)}</div>
      <div className="absolute" style={{ bottom: -out, left: -out }}>{member(b)}</div>
      <div className="absolute" style={{ bottom: -out, right: -out }}>{member(c)}</div>
      {badge && (
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-gb-sidebar bg-[#ff453a]" />
      )}
    </div>
  );
}
