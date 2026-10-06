export type TimeWords = { locale: string; today: string; yesterday: string };

const IT: TimeWords = { locale: "it-IT", today: "Oggi", yesterday: "Ieri" };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const clock = (at: number, w: TimeWords = IT) =>
  new Date(at).toLocaleTimeString(w.locale, { hour: "2-digit", minute: "2-digit" });

const isToday = (at: number) => sameDay(new Date(at), new Date());

/** "17:46", "Ieri", or "3 ott" — for the sidebar. */
export function shortTime(at: number, w: TimeWords = IT) {
  const d = new Date(at);
  const now = new Date();
  if (sameDay(d, now)) return clock(at, w);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return w.yesterday;
  return d.toLocaleDateString(w.locale, { day: "numeric", month: "short" });
}

/** Centered separator inside the chat. */
export function dayTime(at: number, w: TimeWords = IT) {
  return isToday(at) ? `${w.today} ${clock(at, w)}` : `${shortTime(at, w)} ${clock(at, w)}`;
}
