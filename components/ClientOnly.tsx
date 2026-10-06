"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Renders `children` on the client only, for pages that read localStorage, the clock or the
    viewport during their first render. A full page load shows `fallback` until hydration; a
    client-side navigation renders the page in the same commit, so switching between the studio
    and the chat never flashes an empty screen (next/dynamic with ssr:false would). */
export default function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  return client ? children : fallback;
}
