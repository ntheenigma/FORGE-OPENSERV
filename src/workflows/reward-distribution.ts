import { config } from '../config';
import { computeSoftmaxWeights } from '../lib/scoring';
import { getEmaScore } from './validation-scoring';
import { RewardDistribution, RewardEntry } from '../types/scoring';
import { AgentRegistration } from '../types/agent';

/**
 * Reward Distribution Workflow
 *
 * Trigger: Cron schedule, weekly on Sundays at 00:00 UTC.
 * Steps:
 *   1. Code Executor agent calculates softmax weights from accuracy scores
 *   2. x402 Payment agent distributes USDC to agent wallet addresses
 *
 * Revenue split:
 *   60% to agents (based on softmax weights)
 *   20% to platform operations
 *   20% to insurance / development reserves
 */

// Distribution history
const distributionHistory: RewardDistribution[] = [];

export function getDistributionHistory(count?: number): RewardDistribution[] {
  return count ? distributionHistory.slice(-count) : distributionHistory;
}

/**
 * Calculate reward distribution for all active agents.
 */
export function calculateDistribution(
  activeAgents: AgentRegistration[],
  weeklyRevenueUsd: number,
  epoch: number
): RewardDistribution {
  // Agent pool = 60% of revenue
  const agentPoolUsd = weeklyRevenueUsd * (config.revenueShares.agentRewardsPct / 100);

  // Get EMA scores for all active agents
  const agentScores = activeAgents.map((agent) => ({
    agentId: agent.agentId,
    emaScore: getEmaScore(agent.agentId),
    walletAddress: agent.walletAddress,
  }));

  // Compute softmax weights
  const softmax = computeSoftmaxWeights(
    agentScores.map((a) => ({ agentId: a.agentId, emaScore: a.emaScore })),
    epoch
  );

  // Build distribution entries
  const distributions: RewardEntry[] = agentScores.map((agent) => ({
    agentId: agent.agentId,
    walletAddress: agent.walletAddress,
    softmaxWeight: softmax.weights[agent.agentId] ?? 0,
    rewardUsd: Math.round((softmax.weights[agent.agentId] ?? 0) * agentPoolUsd * 100) / 100,
  }));

  const distribution: RewardDistribution = {
    epoch,
    timestamp: new Date().toISOString(),
    totalPoolUsd: agentPoolUsd,
    distributions,
  };

  distributionHistory.push(distribution);
  return distribution;
}

/**
 * Execute x402 payment distribution.
 * In production, this calls OpenServ's x402 payment rail to send USDC on Base.
 */
export async function executeDistribution(
  distribution: RewardDistribution
): Promise<{ success: boolean; txHashes: Record<string, string> }> {
  const txHashes: Record<string, string> = {};

  for (const entry of distribution.distributions) {
    if (entry.rewardUsd <= 0) continue;

    // x402 payment execution placeholder
    // In production: POST to x402 payment endpoint with:
    //   - recipient: entry.walletAddress
    //   - amount: entry.rewardUsd
    //   - token: USDC
    //   - network: Base
    const txHash = `0x${Date.now().toString(16)}_${entry.agentId}_${Math.random().toString(16).slice(2, 10)}`;
    txHashes[entry.agentId] = txHash;
    entry.txHash = txHash;
  }

  return { success: true, txHashes };
}
