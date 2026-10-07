"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export type MontageFormat = "mp4" | "gif";
export type MontageBackground = "white" | "transparent";

/** "Export the montage": video or GIF, white or transparent (MP4 always needs a background). */
export default function MontageDialog({
  busy,
  progress,
  onCancel,
  onDownload,
}: {
  busy: boolean;
  progress: string | null;
  onCancel: () => void;
  onDownload: (format: MontageFormat, background: MontageBackground) => void;
}) {
  const { t } = useI18n();
  const [format, setFormat] = useState<MontageFormat>("gif");
  const [background, setBackground] = useState<MontageBackground>("white");
  const bg = format === "mp4" ? "white" : background;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="montage-title"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-[460px] rounded-[22px] bg-st-raised p-7 text-st-ink shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="montage-title" className="text-[20px] font-semibold">
          {t("montage.dialogTitle")}
        </h2>
        <p className="mt-1.5 text-[14px] leading-5 text-st-muted">{t("montage.dialogText")}</p>

        <fieldset className="mt-5 flex flex-col gap-2" disabled={busy}>
          <Option checked={format === "mp4"} onChange={() => setFormat("mp4")} name="format" title={t("montage.mp4")} text={t("montage.mp4Text")} />
          <Option checked={format === "gif"} onChange={() => setFormat("gif")} name="format" title={t("montage.gif")} text={t("montage.gifText")} />
        </fieldset>

        <fieldset className="mt-4 flex flex-col gap-1" disabled={busy}>
          <Option checked={bg === "white"} onChange={() => setBackground("white")} name="bg" title={t("montage.white")} plain />
          <Option
            checked={bg === "transparent"}
            onChange={() => setBackground("transparent")}
            name="bg"
            title={t("montage.transparentBg")}
            plain
            disabled={format === "mp4"}
          />
        </fieldset>

        <div className="mt-6 flex items-center justify-end gap-3">
          {progress && <span className="mr-auto text-[13px] tabular-nums text-st-muted">{progress}</span>}
          {/* Stays enabled while exporting: then it cancels the export. */}
          <button onClick={onCancel} className="h-11 rounded-xl px-4 text-[15px] text-st-muted transition hover:text-st-ink">
            {busy ? t("export.cancel") : t("montage.cancel")}
          </button>
          <button
            onClick={() => onDownload(format, bg)}
            disabled={busy}
            className="h-11 rounded-xl bg-st-accent px-5 text-[15px] text-st-accent-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {t("montage.download")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({
  checked,
  onChange,
  name,
  title,
  text,
  plain,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  title: string;
  text?: string;
  plain?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3.5 rounded-2xl px-3 ${plain ? "py-2" : "py-3"} ${
        !plain && checked ? "bg-st-hover" : ""
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-st-ink" : "border-st-line-strong"} peer-focus-visible:ring-2 peer-focus-visible:ring-st-line-strong`}
      >
        {checked && <span className="size-2.5 rounded-full bg-st-ink" />}
      </span>
      <span>
        <span className="block text-[16px] text-st-ink">{title}</span>
        {text && <span className="block text-[14px] text-st-muted">{text}</span>}
      </span>
    </label>
  );
}
