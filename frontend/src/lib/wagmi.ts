"use client";

import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const config = getDefaultConfig({
  appName: "FORGE",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "PLACEHOLDER_PROJECT_ID",
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
