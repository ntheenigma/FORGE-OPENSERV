"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [time, setTime] = useState("");
  const [nextWindow, setNextWindow] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toUTCString().slice(17, 25));
      const mins = now.getUTCMinutes();
      const nextMins = Math.ceil((mins + 1) / 15) * 15 - mins;
      const secs = 60 - now.getUTCSeconds();
      setNextWindow(
        `${String(nextMins - 1).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
              <span className="text-sm font-black text-black">O</span>
            </div>
            <span className="text-lg font-black tracking-tight text-white">
              ORACLE
            </span>
          </Link>
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 sm:flex">
            <div className="h-1.5 w-1.5 animate-live rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">LIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="hidden sm:block">
            <span className="text-zinc-600">UTC</span>{" "}
            <span className="font-mono text-zinc-300">{time}</span>
          </div>
          <div>
            <span className="text-zinc-600">Next window</span>{" "}
            <span className="font-mono text-amber-400">{nextWindow}</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/agents"
              className="rounded-lg px-2.5 py-1.5 text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              Agents
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-lg px-2.5 py-1.5 text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              Leaderboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
