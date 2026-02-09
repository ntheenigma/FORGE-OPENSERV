import Link from "next/link";

const ALLOC = [
  { label: "Airdrop", pct: 15, color: "bg-amber-500" },
  { label: "Ecosystem", pct: 30, color: "bg-blue-500" },
  { label: "Team", pct: 15, color: "bg-purple-500" },
  { label: "Treasury", pct: 20, color: "bg-emerald-500" },
  { label: "Liquidity", pct: 20, color: "bg-pink-500" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

export default function AirdropPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:py-20">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1">
          <span className="text-xs font-medium text-amber-400">Premium Exclusive</span>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">FORGE Token Airdrop</h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-zinc-400">
          15M tokens allocated to premium subscribers. Higher tiers = larger multipliers. Claim on Base.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Supply" value="100M" />
        <Stat label="Airdrop Pool" value="15M" />
        <Stat label="Vesting" value="6 months" />
        <Stat label="Claim Opens" value="Jul 2025" />
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Token Distribution</h2>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.04]">
          {ALLOC.map((s) => <div key={s.label} className={s.color} style={{ width: `${s.pct}%` }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {ALLOC.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-xs text-zinc-400">{s.label} ({s.pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tier</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Multiplier</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Est. Allocation</th>
          </tr></thead>
          <tbody>
            {[{t:"Signal",m:"1.0x",a:"5,000"},{t:"Edge",m:"2.5x",a:"12,500"},{t:"Vault",m:"10.0x",a:"50,000"}].map((r)=>(
              <tr key={r.t} className="border-b border-white/[0.04]">
                <td className="px-4 py-3 font-medium text-white">{r.t}</td>
                <td className="px-4 py-3 text-amber-400">{r.m}</td>
                <td className="px-4 py-3 text-right font-mono text-white">{r.a} FORGE</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6 text-center">
        <p className="text-sm text-zinc-400">Connect your Base wallet to check eligibility</p>
        <Link href="/premium" className="mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-black">Get Premium First</Link>
      </div>
    </div>
  );
}
