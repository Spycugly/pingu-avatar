"use client";

import { ViewTransition } from "react";
import ClientOnly from "./ClientOnly";
import PinguStudio from "./PinguStudio";

// Reads the viewport and drives the avatar engine: render on the client only.
export default function ClientStudio() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-white dark:bg-[#0d0d0d]" />}>
      {/* Route changes cross-fade the page (see .page-swap in globals.css). */}
      <ViewTransition enter="page-swap" exit="page-swap" default="none">
        <PinguStudio />
      </ViewTransition>
    </ClientOnly>
  );
}
