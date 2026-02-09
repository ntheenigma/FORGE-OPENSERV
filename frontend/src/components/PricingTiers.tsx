"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useWriteContract } from "wagmi";
import { parseEther, parseUnits, encodeFunctionData } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  PREMIUM_TIERS,
  ACCEPTED_TOKENS,
  FORGE_TREASURY,
  USDC_BASE,
} from "@/lib/constants";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function TokenSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {ACCEPTED_TOKENS.map((token) => (
        <button
          key={token.symbol}
          onClick={() => onSelect(token.symbol)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            selected === token.symbol
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
              : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
          }`}
        >
          {token.symbol}
        </button>
      ))}
    </div>
  );
}

function TierCard({
  tier,
  selectedToken,
  onSubscribe,
  loading,
}: {
  tier: (typeof PREMIUM_TIERS)[number];
  selectedToken: string;
  onSubscribe: (tierId: string) => void;
  loading: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        tier.highlight
          ? "border-amber-500/30 bg-gradient-to-b from-amber-500/[0.06] to-transparent"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
          Most Popular
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{tier.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">
            ${tier.priceUsd}
          </span>
          <span className="text-sm text-zinc-500">/{tier.period}</span>
        </div>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <svg
              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                tier.highlight ? "text-amber-400" : "text-zinc-500"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-zinc-300">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSubscribe(tier.id)}
        disabled={loading}
        className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
          tier.highlight
            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400"
            : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
        } disabled:opacity-50`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
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
            Confirming...
          </span>
        ) : (
          `Pay with ${selectedToken}`
        )}
      </button>
    </div>
  );
}

export function PricingTiers() {
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  async function handleSubscribe(tierId: string) {
    if (!isConnected) return;

    const tier = PREMIUM_TIERS.find((t) => t.id === tierId);
    if (!tier) return;

    setLoadingTier(tierId);
    setTxHash(null);

    try {
      const token = ACCEPTED_TOKENS.find((t) => t.symbol === selectedToken);
      if (!token) return;

      let hash: string;

      if (!token.address) {
        // Native ETH — use a rough estimate (tier price / ETH price placeholder)
        // In production, fetch from oracle
        const ethAmount = (tier.priceUsd / 3000).toFixed(6);
        hash = await sendTransactionAsync({
          to: FORGE_TREASURY,
          value: parseEther(ethAmount),
        });
      } else {
        // ERC-20 transfer
        const amount = parseUnits(
          tier.priceUsd.toString(),
          token.decimals
        );
        hash = await writeContractAsync({
          address: token.address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [FORGE_TREASURY, amount],
        });
      }

      setTxHash(hash);
    } catch (err) {
      console.error("Payment failed:", err);
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div>
      {/* Token Selector */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Pay with on Base
        </span>
        <TokenSelector selected={selectedToken} onSelect={setSelectedToken} />
      </div>

      {/* Tier Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {PREMIUM_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            selectedToken={selectedToken}
            onSubscribe={handleSubscribe}
            loading={loadingTier === tier.id}
          />
        ))}
      </div>

      {/* Connect prompt */}
      {!isConnected && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-zinc-400">
            Connect your wallet to subscribe with crypto on Base
          </p>
          <ConnectButton />
        </div>
      )}

      {/* Tx confirmation */}
      {txHash && (
        <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
          <p className="text-sm font-medium text-green-400">
            Payment submitted!
          </p>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-green-400/70 underline hover:text-green-300"
          >
            View on BaseScan
          </a>
        </div>
      )}
    </div>
  );
}
