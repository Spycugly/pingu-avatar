"use client";

import { ViewTransition } from "react";
import { usePhone } from "./NavRail";

/** Route changes cross-fade the page (see .page-swap in globals.css); on phones they are instant,
    like switching tabs on iOS. */
export default function PageSwap({ children }: { children: React.ReactNode }) {
  const swap = usePhone() ? "none" : "page-swap";
  return (
    <ViewTransition enter={swap} exit={swap} default="none">
      {children}
    </ViewTransition>
  );
}
