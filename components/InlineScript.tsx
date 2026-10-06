"use client";

/** A script that runs while the HTML is parsed, before the first paint. On the client it renders as
    text/plain so React does not warn about script tags (see the Next guide "Preventing Flash"). */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
