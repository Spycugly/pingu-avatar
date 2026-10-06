"use client";

import { ViewTransition } from "react";
import ClientOnly from "./ClientOnly";
import ChatApp from "./ChatApp";

// Chat state lives in localStorage and timestamps are local: render on the client only.
export default function ClientApp() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-white dark:bg-[#0d0d0d]" />}>
      {/* Route changes cross-fade the page (see .page-swap in globals.css). */}
      <ViewTransition enter="page-swap" exit="page-swap" default="none">
        <ChatApp />
      </ViewTransition>
    </ClientOnly>
  );
}
