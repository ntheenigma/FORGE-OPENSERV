import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORGE | Bitcoin Prediction Engine",
  description:
    "Multi-agent ensemble generating 15-minute directional Bitcoin predictions. Powered by diversity, not redundancy.",
  openGraph: {
    title: "FORGE | Bitcoin Prediction Engine",
    description:
      "Multi-agent ensemble generating 15-minute directional Bitcoin predictions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>
          <Header />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
