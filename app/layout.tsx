import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InlineScript from "@/components/InlineScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pingu AI Assistant", template: "%s · Pingu AI Assistant" },
  description: "An animated penguin avatar for React, with a customizer studio and a demo chat. Noot noot.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Saved theme on <html> before the first paint, so the intro and the loading screens match it. */}
        <InlineScript
          html={`(function(){try{if(localStorage.getItem("pingu-theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
