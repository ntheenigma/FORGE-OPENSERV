import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { checkArchitectureDiversity, identifyDeprecatedAgents } from '../lib/scoring';
import { getEmaScore } from '../workflows/validation-scoring';
import {
  AgentRegistration,
  AgentCapability,
  AgentStatus,
  LeaderboardEntry,
} from '../types/agent';

/**
 * Agent Registry
 *
 * Manages registration of external agents (Moltbot/OpenClaw/LangChain/custom).
 * Any MCP-compliant agent can register, stake $50 USDC, receive tasks, and earn.
 *
 * Registration flow:
 *   1. Agent developer builds agent using any framework
 *   2. Agent exposes capabilities via MCP
 *   3. Developer adds Forge capability declaration
 *   4. Stakes $50 USDC, enters shadow validation
 *   5. Passes shadow validation → active, receives hourly tasks
 *
 * Diversity enforcement: max 30% of agents may share identical architecture.
 * Bottom 10% deprecated automatically each epoch.
 */

const registry = new Map<string, AgentRegistration>();
const earningsTracker = new Map<string, number>();
const predictionCounts = new Map<string, number>();

export function getRegisteredAgents(): AgentRegistration[] {
  return Array.from(registry.values());
}

export function getActiveAgents(): AgentRegistration[] {
  return Array.from(registry.values()).filter((a) => a.status === 'active');
}

export function getAgent(agentId: string): AgentRegistration | undefined {
  return registry.get(agentId);
}

/**
 * Register a new external agent.
 */
export function registerAgent(params: {
  name: string;
  endpointUrl: string;
  capabilities: AgentCapability[];
  architecture: string;
  walletAddress: string;
}): { success: boolean; agentId?: string; error?: string } {
  // Check architecture diversity
  const existingArchitectures = getActiveAgents().map((a) => a.architecture);
  if (checkArchitectureDiversity(existingArchitectures, params.architecture)) {
    return {
      success: false,
      error: `Architecture "${params.architecture}" would exceed ${config.agentRegistry.maxSameArchitecturePct}% diversity cap.`,
    };
  }

  const agentId = `agent-${uuidv4().slice(0, 8)}`;

  const registration: AgentRegistration = {
    agentId,
    name: params.name,
    endpointUrl: params.endpointUrl,
    capabilities: params.capabilities,
    architecture: params.architecture,
    walletAddress: params.walletAddress,
    stakeAmountUsd: config.agentRegistry.stakeAmountUsd,
    stakedAt: new Date().toISOString(),
    status: 'pending_validation',
    shadowValidationPassed: false,
  };

  registry.set(agentId, registration);
  earningsTracker.set(agentId, 0);
  predictionCounts.set(agentId, 0);

  return { success: true, agentId };
}

/**
 * Promote agent from pending_validation to shadow_mode.
 */
export function startShadowValidation(agentId: string): boolean {
  const agent = registry.get(agentId);
  if (!agent || agent.status !== 'pending_validation') return false;
  agent.status = 'shadow_mode';
  return true;
}

/**
 * Promote agent from shadow_mode to active after passing validation.
 */
export function activateAgent(agentId: string): boolean {
  const agent = registry.get(agentId);
  if (!agent || agent.status !== 'shadow_mode') return false;
  agent.shadowValidationPassed = true;
  agent.status = 'active';
  return true;
}

/**
 * Deprecate an agent (bottom performers or manual).
 */
export function deprecateAgent(agentId: string): boolean {
  const agent = registry.get(agentId);
  if (!agent) return false;
  agent.status = 'deprecated';
  return true;
}

/**
 * Slash an agent's stake (invalid format, missed deadline).
 */
export function slashAgent(agentId: string): boolean {
  const agent = registry.get(agentId);
  if (!agent) return false;
  agent.status = 'slashed';
  return true;
}

/**
 * Run automatic deprecation of bottom N% performers.
 */
export function runAutoDeprecation(): string[] {
  const active = getActiveAgents();
  const scored = active.map((a) => ({
    agentId: a.agentId,
    emaScore: getEmaScore(a.agentId),
  }));

  const toDeprecate = identifyDeprecatedAgents(scored);
  for (const agentId of toDeprecate) {
    deprecateAgent(agentId);
  }

  return toDeprecate;
}

/**
 * Record agent earnings.
 */
export function recordEarnings(agentId: string, amountUsd: number): void {
  const current = earningsTracker.get(agentId) ?? 0;
  earningsTracker.set(agentId, current + amountUsd);
}

/**
 * Record a prediction submission.
 */
export function recordPrediction(agentId: string): void {
  const current = predictionCounts.get(agentId) ?? 0;
  predictionCounts.set(agentId, current + 1);
}

/**
 * Build public leaderboard.
 */
export function getLeaderboard(): LeaderboardEntry[] {
  const agents = getActiveAgents();

  const entries: LeaderboardEntry[] = agents.map((agent) => ({
    rank: 0,
    agentId: agent.agentId,
    name: agent.name,
    capability: agent.capabilities[0],
    rollingEma10d: getEmaScore(agent.agentId),
    totalEarningsUsd: earningsTracker.get(agent.agentId) ?? 0,
    predictionsCount: predictionCounts.get(agent.agentId) ?? 0,
    activeSince: agent.stakedAt,
  }));

  // Sort by EMA (lower = better)
  entries.sort((a, b) => a.rollingEma10d - b.rollingEma10d);
  entries.forEach((e, i) => (e.rank = i + 1));

  return entries;
}

/**
 * Get agents by capability for task routing.
 */
export function getAgentsByCapability(capability: AgentCapability): AgentRegistration[] {
  return getActiveAgents().filter((a) => a.capabilities.includes(capability));
}
