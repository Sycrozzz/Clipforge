import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipForge – AI clipping studio",
  description: "Turn long videos into engaging, subtitled short-form clips.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-black text-white shadow-lg shadow-violet-900/40">
                ✂
              </span>
              <span className="text-[15px] font-bold tracking-tight">ClipForge</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-zinc-300 hover:bg-white/5 hover:text-white">
                Projects
              </Link>
              <Link href="/settings" className="rounded-lg px-3 py-1.5 text-zinc-300 hover:bg-white/5 hover:text-white">
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
