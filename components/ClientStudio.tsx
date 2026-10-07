"use client";

import ClientOnly from "./ClientOnly";
import PageSwap from "./PageSwap";
import PinguStudio from "./PinguStudio";

// Reads the viewport and drives the avatar engine: render on the client only.
export default function ClientStudio() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-white dark:bg-[#0d0d0d]" />}>
      <PageSwap>
        <PinguStudio />
      </PageSwap>
    </ClientOnly>
  );
}
