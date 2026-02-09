import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORGE | Bitcoin Prediction Engine",
  description: "Multi-agent ensemble generating 15-minute directional Bitcoin predictions.",
};

function Header() {
  const links = [
    { href: "/", label: "Predictions" },
    { href: "/premium", label: "Premium" },
    { href: "/airdrop", label: "Airdrop" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <span className="text-sm font-black text-black">F</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">FORGE</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Header />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
