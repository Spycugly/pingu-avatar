"use client";

import ClientOnly from "./ClientOnly";
import PageSwap from "./PageSwap";
import ChatApp from "./ChatApp";

// Chat state lives in localStorage and timestamps are local: render on the client only.
export default function ClientApp() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-white dark:bg-[#0d0d0d]" />}>
      <PageSwap>
        <ChatApp />
      </PageSwap>
    </ClientOnly>
  );
}
