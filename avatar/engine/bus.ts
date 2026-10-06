/** Tiny per-agent event bus: the chat talks to the avatars without prop drilling. */
export type PinguEvent =
  | { type: "syllable"; open: number }
  | { type: "keystroke" }
  | {
      type: "action";
      name: "spin" | "bounce" | "burst" | "spinDizzy" | "spinWild" | "spinBounce" | "nod" | "shake" | "sigh";
    };

type Listener = (e: PinguEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function onPingu(agentId: string, fn: Listener) {
  let set = listeners.get(agentId);
  if (!set) listeners.set(agentId, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function emitPingu(agentId: string, e: PinguEvent) {
  listeners.get(agentId)?.forEach((fn) => fn(e));
}

/** Mouth opening for one typed character: vowels open wide, punctuation shuts. */
export function syllableFor(ch: string): number | null {
  if (/[aeiouàèéìòùAEIOU]/.test(ch)) return 0.75 + Math.random() * 0.25;
  if (/[.,!?…;:]/.test(ch)) return 0;
  if (/\s/.test(ch)) return null;
  return 0.25 + Math.random() * 0.2;
}
