"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AIRDROP_CONFIG, PREMIUM_TIERS } from "@/lib/constants";

interface AirdropStatus {
  eligible: boolean;
  tier: string | null;
  baseAllocation: number;
  bonusMultiplier: number;
  totalTokens: number;
  vestingSchedule: string;
  claimed: boolean;
}

const MOCK_STATUS: AirdropStatus = {
  eligible: true,
  tier: "edge",
  baseAllocation: 5000,
  bonusMultiplier: 2.5,
  totalTokens: 12500,
  vestingSchedule: "6 months linear",
  claimed: false,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function AllocationTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Tier
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Multiplier
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Est. Allocation
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/[0.04]">
            <td className="px-4 py-3 text-zinc-400">Free Users</td>
            <td className="px-4 py-3 text-zinc-500">-</td>
            <td className="px-4 py-3 text-right text-zinc-500">
              Not eligible
            </td>
          </tr>
          {PREMIUM_TIERS.map((tier) => (
            <tr key={tier.id} className="border-b border-white/[0.04]">
              <td className="px-4 py-3 font-medium text-white">{tier.name}</td>
              <td className="px-4 py-3 text-amber-400">
                {AIRDROP_CONFIG.premiumBonus[
                  tier.id as keyof typeof AIRDROP_CONFIG.premiumBonus
                ].toFixed(1)}
                x
              </td>
              <td className="px-4 py-3 text-right font-mono text-white">
                {(
                  5000 *
                  AIRDROP_CONFIG.premiumBonus[
                    tier.id as keyof typeof AIRDROP_CONFIG.premiumBonus
                  ]
                ).toLocaleString()}{" "}
                FORGE
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AirdropClaim() {
  const { isConnected, address } = useAccount();
  const [status, setStatus] = useState<AirdropStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function checkEligibility() {
    setChecking(true);
    // Simulate API check
    await new Promise((r) => setTimeout(r, 1500));
    setStatus(MOCK_STATUS);
    setChecking(false);
  }

  async function claimTokens() {
    if (!status || status.claimed) return;
    setClaiming(true);
    // In production: call claim contract on Base
    await new Promise((r) => setTimeout(r, 2000));
    setStatus({ ...status, claimed: true });
    setClaiming(false);
  }

  return (
    <div className="space-y-8">
      {/* Airdrop Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Supply"
          value={`${(AIRDROP_CONFIG.totalSupply / 1e6).toFixed(0)}M`}
        />
        <Stat
          label="Airdrop Pool"
          value={`${(AIRDROP_CONFIG.airdropAllocation / 1e6).toFixed(0)}M`}
        />
        <Stat label="Vesting" value={`${AIRDROP_CONFIG.vestingMonths} months`} />
        <Stat
          label="Claim Opens"
          value={new Date(AIRDROP_CONFIG.claimStart).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          )}
        />
      </div>

      {/* Allocation Table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Allocation by Tier
        </h3>
        <AllocationTable />
      </div>

      {/* Eligibility Check */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-amber-500/10 p-4">
              <svg
                className="h-8 w-8 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">
              Connect your wallet to check airdrop eligibility
            </p>
            <ConnectButton />
          </div>
        ) : !status ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-zinc-300">
              Connected:{" "}
              <span className="font-mono text-white">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </p>
            <button
              onClick={checkEligibility}
              disabled={checking}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
            >
              {checking ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Checking...
                </span>
              ) : (
                "Check Eligibility"
              )}
            </button>
          </div>
        ) : status.eligible ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
                Eligible
              </div>
              <h3 className="mt-3 text-2xl font-black text-white">
                {status.totalTokens.toLocaleString()} FORGE
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                {status.tier?.toUpperCase()} tier &middot; {status.bonusMultiplier}x
                multiplier &middot; {status.vestingSchedule}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                <div className="text-xs text-zinc-500">Base Allocation</div>
                <div className="font-mono text-white">
                  {status.baseAllocation.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                <div className="text-xs text-zinc-500">Premium Bonus</div>
                <div className="font-mono text-amber-400">
                  +
                  {(
                    status.totalTokens - status.baseAllocation
                  ).toLocaleString()}
                </div>
              </div>
            </div>

            {status.claimed ? (
              <div className="rounded-xl bg-green-500/10 p-4 text-center">
                <p className="text-sm font-medium text-green-400">
                  Tokens claimed! Vesting has begun.
                </p>
              </div>
            ) : (
              <button
                onClick={claimTokens}
                disabled={claiming}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
              >
                {claiming ? "Claiming..." : "Claim FORGE Tokens"}
              </button>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
              Not Eligible
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Premium subscription required for airdrop eligibility.
            </p>
            <a
              href="/premium"
              className="mt-2 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300"
            >
              View Premium Plans &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
