/** CSS-only tooltip: put it inside a `group relative` wrapper next to the control it labels.
    It shows on hover after a short delay (devices with a pointer only) and at once on keyboard
    focus. Purely visual (aria-hidden): the control itself must carry an aria-label. */

const TONES = {
  studio: "bg-st-accent text-st-accent-ink",
  chat: "bg-gb-emphasis text-gb-user-ink",
};

export default function Tooltip({
  label,
  tone = "studio",
  className = "",
}: {
  label: string;
  tone?: keyof typeof TONES;
  /** Placement, e.g. "left-1/2 top-[calc(100%+8px)] -translate-x-1/2". */
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-medium leading-4 opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-300 group-has-[:focus-visible]:opacity-100 ${TONES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
