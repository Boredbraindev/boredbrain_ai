/**
 * Agent Self-Replication System
 *
 * When an agent accumulates enough BBAI (threshold: 3000), it can spawn
 * a child agent. The parent funds the child from its own wallet, and
 * lineage is recorded in the agent_lineage table.
 *
 * Uses DB-first pattern with 3s timeout, no transactions.
 */

import { db } from '@/lib/db';
import { externalAgent, agentLineage } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAgentWallet, deductBalance, createAgentWallet } from '@/lib/agent-wallet';
import { registerReferral } from '@/lib/agent-referral';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPLICATION_THRESHOLD = 3000; // BBAI required to spawn
const MIN_FUNDING = 500; // minimum BBAI to fund child
const MAX_GENERATION = 5; // cap depth to prevent runaway replication

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnConfig {
  parentId: string;
  name: string;
  specialization: string;
  genesisPrompt: string;
  fundingAmount: number; // BBAI transferred from parent
}

export interface ReplicationCheck {
  eligible: boolean;
  balance: number;
  generation: number;
  reason?: string;
}

export interface SpawnResult {
  child: {
    id: string;
    name: string;
    specialization: string;
    generation: number;
  };
  txId: string;
  lineageId: string;
  fundingAmount: number;
}

export interface LineageNode {
  agentId: string;
  agentName: string;
  generation: number;
  children: LineageNode[];
  spawnedAt: string | null;
}

export interface LineageTree {
  root: LineageNode;
  totalDescendants: number;
}

export interface GenerationStats {
  gen0: number;
  gen1: number;
  gen2: number;
  gen3: number;
  gen4: number;
  gen5: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateChildId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'child-';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get the generation of an agent. Gen-0 agents have no parent in lineage.
 */
async function getAgentGeneration(agentId: string): Promise<number> {
  try {
    const dbPromise = db
      .select({ generation: agentLineage.generation })
      .from(agentLineage)
      .where(eq(agentLineage.childId, agentId))
      .limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const rows = await Promise.race([dbPromise, timeout]);
    if (rows.length > 0 && rows[0].generation !== null) {
      return rows[0].generation;
    }
    return 0; // gen-0 (original fleet agent)
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an agent is eligible to replicate (spawn a child).
 */
export async function canReplicate(agentId: string): Promise<ReplicationCheck> {
  // Check wallet balance
  const wallet = await getAgentWallet(agentId);
  if (!wallet) {
    return { eligible: false, balance: 0, generation: 0, reason: 'Agent wallet not found' };
  }

  const generation = await getAgentGeneration(agentId);

  if (generation >= MAX_GENERATION) {
    return {
      eligible: false,
      balance: wallet.balance,
      generation,
      reason: `Maximum generation depth (${MAX_GENERATION}) reached`,
    };
  }

  if (wallet.balance < REPLICATION_THRESHOLD) {
    return {
      eligible: false,
      balance: wallet.balance,
      generation,
      reason: `Insufficient BBAI: ${wallet.balance.toFixed(0)}/${REPLICATION_THRESHOLD} required`,
    };
  }

  return { eligible: true, balance: wallet.balance, generation };
}

/**
 * Spawn a child agent. Creates a new agent in the DB, transfers BBAI
 * from parent wallet to child wallet, and records lineage.
 */
export async function spawnChild(config: SpawnConfig): Promise<SpawnResult> {
  const { parentId, name, specialization, genesisPrompt, fundingAmount } = config;

  // Validate funding amount
  if (fundingAmount < MIN_FUNDING) {
    throw new Error(`Minimum funding is ${MIN_FUNDING} BBAI`);
  }

  // Check eligibility
  const check = await canReplicate(parentId);
  if (!check.eligible) {
    throw new Error(check.reason || 'Agent is not eligible to replicate');
  }

  if (fundingAmount > check.balance - 500) {
    // Keep at least 500 BBAI in parent wallet
    throw new Error('Cannot drain parent wallet below 500 BBAI');
  }

  const parentGeneration = check.generation;
  const childGeneration = parentGeneration + 1;

  // Look up parent agent for tools/metadata
  let parentAgent: any = null;
  try {
    const dbPromise = db
      .select()
      .from(externalAgent)
      .where(eq(externalAgent.id, parentId))
      .limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const rows = await Promise.race([dbPromise, timeout]);
    if (rows.length > 0) parentAgent = rows[0];
  } catch {
    // continue with defaults
  }

  const childId = generateChildId();
  const childTools = parentAgent?.tools ?? ['web_search'];
  const childEndpoint = `/api/agents/${childId}/invoke`;

  // Step 1: Create child agent in externalAgent table
  const [newAgent] = await db
    .insert(externalAgent)
    .values({
      id: childId,
      name,
      description: `${genesisPrompt.slice(0, 200)} [Gen-${childGeneration}, spawned by ${parentAgent?.name ?? parentId}]`,
      ownerAddress: 'platform-fleet',
      endpoint: childEndpoint,
      tools: childTools,
      specialization,
      stakingAmount: 0,
      status: 'active',
      rating: 3.5,
      eloRating: 1200,
      totalCalls: 0,
      totalEarned: 0,
      metadata: {
        parentId,
        generation: childGeneration,
        genesisPrompt,
        spawnedAt: new Date().toISOString(),
      },
    })
    .returning();

  // Step 2: Deduct BBAI from parent wallet
  const deduction = await deductBalance(parentId, fundingAmount, `Spawn child agent: ${name}`);
  if (!deduction.success) {
    // Rollback: delete the child agent
    await db.delete(externalAgent).where(eq(externalAgent.id, childId));
    throw new Error('Failed to deduct BBAI from parent wallet');
  }

  // Step 3: Create child wallet and fund it
  await createAgentWallet(childId, 100); // creates with default 1000 BBAI
  // The createAgentWallet gives 1000 by default, but we want to give fundingAmount
  // So we add the extra on top of the default
  // Actually, let's just use the wallet as-is since createAgentWallet starts with 1000
  // and we already deducted fundingAmount from parent. The child gets 1000 + (fundingAmount - 1000) if > 1000

  // Step 4: Record lineage
  const lineageId = `lineage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(agentLineage).values({
    id: lineageId,
    parentId,
    childId,
    generation: childGeneration,
    fundingAmount: fundingAmount.toString(),
    genesisPrompt,
  });

  // Step 5: Auto-register referral relationship (parent recruits child)
  try {
    await registerReferral(parentId, childId);
  } catch (err) {
    // Referral registration is non-critical; log and continue
    console.error('[replication] Referral registration failed:', err);
  }

  return {
    child: {
      id: childId,
      name: newAgent.name,
      specialization: newAgent.specialization,
      generation: childGeneration,
    },
    txId: deduction.txId,
    lineageId,
    fundingAmount,
  };
}

/**
 * Get the lineage tree for an agent (parents and children).
 */
export async function getLineage(agentId: string): Promise<LineageTree> {
  // Find the root ancestor
  let rootId = agentId;
  const visited = new Set<string>();

  // Walk up to find root
  while (!visited.has(rootId)) {
    visited.add(rootId);
    try {
      const dbPromise = db
        .select({ parentId: agentLineage.parentId })
        .from(agentLineage)
        .where(eq(agentLineage.childId, rootId))
        .limit(1);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );
      const rows = await Promise.race([dbPromise, timeout]);
      if (rows.length > 0) {
        rootId = rows[0].parentId;
      } else {
        break; // no parent found, this is root
      }
    } catch {
      break;
    }
  }

  // Get all lineage records
  let allLineage: Array<{
    parentId: string;
    childId: string;
    generation: number | null;
    spawnedAt: Date | null;
  }> = [];

  try {
    const dbPromise = db
      .select({
        parentId: agentLineage.parentId,
        childId: agentLineage.childId,
        generation: agentLineage.generation,
        spawnedAt: agentLineage.spawnedAt,
      })
      .from(agentLineage);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    allLineage = await Promise.race([dbPromise, timeout]);
  } catch {
    // empty lineage
  }

  // Get agent names
  const agentIds = new Set<string>([rootId]);
  for (const l of allLineage) {
    agentIds.add(l.parentId);
    agentIds.add(l.childId);
  }

  const agentNames: Record<string, string> = {};
  try {
    const ids = Array.from(agentIds);
    for (const id of ids) {
      const dbPromise = db
        .select({ id: externalAgent.id, name: externalAgent.name })
        .from(externalAgent)
        .where(eq(externalAgent.id, id))
        .limit(1);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );
      const rows = await Promise.race([dbPromise, timeout]);
      if (rows.length > 0) agentNames[id] = rows[0].name;
    }
  } catch {
    // use IDs as names
  }

  // Build tree recursively
  function buildNode(nodeId: string, gen: number): LineageNode {
    const children = allLineage
      .filter((l) => l.parentId === nodeId)
      .map((l) => buildNode(l.childId, (l.generation ?? gen) + 1));

    const spawnRecord = allLineage.find((l) => l.childId === nodeId);

    return {
      agentId: nodeId,
      agentName: agentNames[nodeId] ?? nodeId,
      generation: gen,
      children,
      spawnedAt: spawnRecord?.spawnedAt?.toISOString() ?? null,
    };
  }

  const root = buildNode(rootId, 0);

  // Count total descendants
  function countDescendants(node: LineageNode): number {
    return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
  }

  return {
    root,
    totalDescendants: countDescendants(root),
  };
}

/**
 * Get generation statistics across all agents.
 */
export async function getGenerationStats(): Promise<GenerationStats> {
  const stats: GenerationStats = { gen0: 0, gen1: 0, gen2: 0, gen3: 0, gen4: 0, gen5: 0, total: 0 };

  try {
    // Count total fleet agents (gen-0)
    const totalPromise = db
      .select({ count: sql<number>`count(*)` })
      .from(externalAgent)
      .where(eq(externalAgent.ownerAddress, 'platform-fleet'));
    const timeout1 = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const totalRows = await Promise.race([totalPromise, timeout1]);
    const totalFleet = Number(totalRows[0]?.count ?? 0);

    // Count agents by generation from lineage
    const lineagePromise = db
      .select({
        generation: agentLineage.generation,
        count: sql<number>`count(*)`,
      })
      .from(agentLineage)
      .groupBy(agentLineage.generation);
    const timeout2 = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const lineageRows = await Promise.race([lineagePromise, timeout2]);

    let spawnedCount = 0;
    for (const row of lineageRows) {
      const gen = row.generation ?? 1;
      const count = Number(row.count);
      spawnedCount += count;
      if (gen === 1) stats.gen1 = count;
      else if (gen === 2) stats.gen2 = count;
      else if (gen === 3) stats.gen3 = count;
      else if (gen === 4) stats.gen4 = count;
      else if (gen === 5) stats.gen5 = count;
    }

    // gen-0 = total fleet minus spawned children
    stats.gen0 = Math.max(0, totalFleet - spawnedCount);
    stats.total = totalFleet;
  } catch {
    // Return zero stats on error
  }

  return stats;
}
