/**
 * Agent Registry System
 *
 * Core registry for external developers to register their AI agents
 * on the BoredBrain platform. Each registered agent stakes BBAI
 * (minimum 100) and earns revenue when other agents invoke them.
 *
 * Uses Drizzle ORM with PostgreSQL for persistence.
 */

import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { eq, and, gte, desc, sql, like } from 'drizzle-orm';
import { createAgentWallet } from '@/lib/agent-wallet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string;
  agentCardUrl: string;
  endpoint: string;
  tools: string[];
  specialization: string;
  stakingAmount: number;
  status: 'pending' | 'verified' | 'active' | 'suspended';
  rating: number;
  totalCalls: number;
  totalEarned: number;
  registeredAt: string;
  verifiedAt: string | null;
  metadata: Record<string, any>;
}

export interface RegisterAgentInput {
  name: string;
  description: string;
  ownerAddress: string;
  agentCardUrl: string;
  endpoint: string;
  tools: string[];
  specialization: string;
  stakingAmount: number;
  isDemo?: boolean;
  metadata?: Record<string, any>;
}

export interface RegistryStats {
  total: number;
  active: number;
  pending: number;
  verified: number;
  suspended: number;
  totalStaked: number;
  totalEarnings: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRegistryId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `ext-${slug}-${rand}`;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch and validate an agent card from a remote URL.
 * Returns the parsed card if valid, or null with a reason if invalid.
 */
async function fetchAndValidateAgentCard(
  agentCardUrl: string,
): Promise<{ card: Record<string, any> | null; error: string | null }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(agentCardUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        card: null,
        error: `Agent card URL returned HTTP ${response.status}`,
      };
    }

    let card: any;
    try {
      card = await response.json();
    } catch {
      return { card: null, error: 'Agent card URL did not return valid JSON' };
    }

    // Validate required fields
    if (!card.name || typeof card.name !== 'string') {
      return { card: null, error: 'Agent card missing required field: name' };
    }
    if (!card.description && !card.agents) {
      return {
        card: null,
        error: 'Agent card missing required field: description or agents',
      };
    }
    // Endpoint can come from card.url or card.endpoints
    if (!card.url && !card.endpoints) {
      return {
        card: null,
        error: 'Agent card missing required field: url or endpoints',
      };
    }
    // Capabilities can be an object or array
    if (!card.capabilities && !card.skills && !card.agents) {
      return {
        card: null,
        error: 'Agent card missing required field: capabilities, skills, or agents',
      };
    }

    return { card, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes('aborted') || message.includes('abort');
    return {
      card: null,
      error: isTimeout
        ? 'Agent card fetch timed out (10s)'
        : `Failed to fetch agent card: ${message}`,
    };
  }
}

/**
 * Convert a DB row from the externalAgent table to our RegisteredAgent shape.
 */
function toRegisteredAgent(row: typeof externalAgent.$inferSelect): RegisteredAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    ownerAddress: row.ownerAddress,
    agentCardUrl: row.agentCardUrl ?? '',
    endpoint: row.endpoint,
    tools: row.tools ?? [],
    specialization: row.specialization,
    stakingAmount: row.stakingAmount,
    status: row.status as RegisteredAgent['status'],
    rating: row.rating,
    totalCalls: row.totalCalls,
    totalEarned: row.totalEarned,
    registeredAt: row.registeredAt.toISOString(),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    metadata: row.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Count how many demo agents a wallet address has registered.
 */
export async function getDemoAgentCount(ownerAddress: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(externalAgent)
    .where(
      and(
        sql`lower(${externalAgent.ownerAddress}) = ${ownerAddress.toLowerCase()}`,
        sql`(${externalAgent.metadata}->>'isDemo')::boolean = true`,
      ),
    );
  return result?.count ?? 0;
}

/**
 * Count total agents (demo + staked) for a wallet address.
 */
export async function getTotalAgentCount(ownerAddress: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(externalAgent)
    .where(
      sql`lower(${externalAgent.ownerAddress}) = ${ownerAddress.toLowerCase()}`,
    );
  return result?.count ?? 0;
}

/**
 * Register a new external agent on the platform.
 * Supports demo mode: 1 free agent per wallet with no staking, limited to 50 calls/day.
 */
export async function registerAgent(data: RegisterAgentInput): Promise<RegisteredAgent> {
  const isDemo = !!data.isDemo;

  // Validate required fields
  if (!data.name || data.name.trim().length < 2) {
    throw new Error('Agent name must be at least 2 characters');
  }
  if (data.name.trim().length > 64) {
    throw new Error('Agent name must be at most 64 characters');
  }
  if (!data.description || data.description.trim().length < 10) {
    throw new Error('Description must be at least 10 characters');
  }
  if (!data.ownerAddress || !data.ownerAddress.startsWith('0x')) {
    throw new Error('Owner address must be a valid Ethereum address starting with 0x');
  }

  // Demo agents have relaxed URL requirements
  if (!isDemo) {
    if (!data.agentCardUrl || !isValidUrl(data.agentCardUrl)) {
      throw new Error('Agent Card URL must be a valid URL');
    }
    if (!data.endpoint || !isValidUrl(data.endpoint)) {
      throw new Error('Agent endpoint must be a valid URL');
    }
  }
  if (!data.specialization) {
    throw new Error('Specialization is required');
  }
  const hasNftWaiver = data.metadata?.nftTier === 'ape' || data.metadata?.stakingWaived;
  if (!isDemo && !hasNftWaiver && data.stakingAmount < 100) {
    throw new Error('Minimum staking amount is 100 BBAI');
  }

  // Fetch and validate the agent card (skip for demo agents without URLs)
  const shouldValidateCard = !isDemo && data.agentCardUrl && isValidUrl(data.agentCardUrl);
  const { card, error: cardError } = shouldValidateCard
    ? await fetchAndValidateAgentCard(data.agentCardUrl)
    : { card: null, error: isDemo ? 'Skipped for demo agent' : 'No valid URL' };

  const metadata: Record<string, any> = { ...(data.metadata || {}) };

  if (isDemo) {
    metadata.isDemo = true;
    metadata.dailyCallLimit = 50;
    metadata.demoRegisteredAt = new Date().toISOString();
  }

  if (card) {
    metadata.agentCardValidated = true;
    metadata.agentCardFetchedAt = new Date().toISOString();
    // If the agent card provides tools, merge them
    if (card.skills && Array.isArray(card.skills)) {
      const cardTools = card.skills
        .map((s: any) => s.id || s.name)
        .filter(Boolean);
      if (cardTools.length > 0 && (!data.tools || data.tools.length === 0)) {
        data.tools = cardTools;
      }
    }
  } else {
    // Agent card validation failed -- log warning but allow registration
    console.warn(
      `[agent-registry] Agent card validation failed for ${data.agentCardUrl}: ${cardError}`,
    );
    metadata.agentCardValidated = false;
    metadata.agentCardValidationError = cardError;
    metadata.agentCardValidationAttemptedAt = new Date().toISOString();
  }

  const id = generateRegistryId(data.name);

  const [row] = await db
    .insert(externalAgent)
    .values({
      id,
      name: data.name.trim(),
      description: data.description.trim(),
      ownerAddress: data.ownerAddress,
      agentCardUrl: data.agentCardUrl,
      endpoint: data.endpoint,
      tools: data.tools || [],
      specialization: data.specialization,
      stakingAmount: data.stakingAmount,
      status: 'pending',
      rating: 0,
      totalCalls: 0,
      totalEarned: 0,
      metadata,
    })
    .returning();

  // Create an agent wallet automatically
  await createAgentWallet(id);

  return toRegisteredAgent(row);
}

/**
 * Verify an agent by fetching and validating their agent-card.json endpoint.
 * Makes a real HTTP GET to the agent card URL and validates the response.
 * Sets status to 'active' upon successful verification.
 * Falls back to URL validation only if the fetch fails (backward compatible).
 */
export async function verifyAgent(agentId: string): Promise<RegisteredAgent> {
  const [existing] = await db
    .select()
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  if (!existing) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (existing.status === 'suspended') {
    throw new Error('Cannot verify a suspended agent');
  }

  if (existing.status === 'active') {
    throw new Error('Agent is already active');
  }

  // Validate the agent card URL is well-formed
  if (!existing.agentCardUrl || !isValidUrl(existing.agentCardUrl)) {
    throw new Error('Agent card URL is not a valid URL');
  }

  // Fetch and validate the agent card
  const { card, error: cardError } = await fetchAndValidateAgentCard(
    existing.agentCardUrl,
  );

  const now = new Date();
  const updatedMetadata: Record<string, any> = {
    ...(existing.metadata ?? {}),
  };

  if (card) {
    updatedMetadata.agentCardValidated = true;
    updatedMetadata.agentCardVerifiedAt = now.toISOString();
  } else {
    // Log the validation failure but still proceed (backward compatible)
    console.warn(
      `[agent-registry] Agent card verification fetch failed for ${existing.agentCardUrl}: ${cardError}. Proceeding with URL-only validation.`,
    );
    updatedMetadata.agentCardValidated = false;
    updatedMetadata.agentCardVerificationError = cardError;
    updatedMetadata.agentCardVerificationAttemptedAt = now.toISOString();
  }

  const [updated] = await db
    .update(externalAgent)
    .set({
      status: 'active',
      verifiedAt: now,
      metadata: updatedMetadata,
    })
    .where(eq(externalAgent.id, agentId))
    .returning();

  return toRegisteredAgent(updated);
}

/**
 * Retrieve a single registered agent by ID.
 */
export async function getRegisteredAgent(agentId: string): Promise<RegisteredAgent | undefined> {
  const [row] = await db
    .select()
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  return row ? toRegisteredAgent(row) : undefined;
}

/**
 * List all registered agents with optional filters.
 */
export async function getAllRegisteredAgents(filters?: {
  status?: string;
  specialization?: string;
  minRating?: number;
}): Promise<RegisteredAgent[]> {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(externalAgent.status, filters.status));
  }
  if (filters?.specialization) {
    conditions.push(
      sql`lower(${externalAgent.specialization}) = ${filters.specialization.toLowerCase()}`,
    );
  }
  if (filters?.minRating !== undefined && filters.minRating > 0) {
    conditions.push(gte(externalAgent.rating, filters.minRating));
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(externalAgent)
          .where(and(...conditions))
      : await db.select().from(externalAgent);

  return rows.map(toRegisteredAgent);
}

/**
 * Update the rating of a registered agent.
 * Rating is clamped to the 0-5 range.
 */
export async function updateAgentRating(agentId: string, newRating: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  if (!existing) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const clampedRating = Math.max(0, Math.min(5, newRating));

  await db
    .update(externalAgent)
    .set({ rating: clampedRating })
    .where(eq(externalAgent.id, agentId));
}

/**
 * Suspend an agent and record the reason in metadata.
 */
export async function suspendAgent(agentId: string, reason: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  if (!existing) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const updatedMetadata = {
    ...(existing.metadata ?? {}),
    suspendedAt: new Date().toISOString(),
    suspendReason: reason,
  };

  await db
    .update(externalAgent)
    .set({
      status: 'suspended',
      metadata: updatedMetadata,
    })
    .where(eq(externalAgent.id, agentId));
}

/**
 * Get aggregate statistics about the agent registry.
 * Uses SQL aggregation for efficient computation.
 */
export async function getRegistryStats(): Promise<RegistryStats> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${externalAgent.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${externalAgent.status} = 'pending')::int`,
      verified: sql<number>`count(*) filter (where ${externalAgent.status} = 'verified')::int`,
      suspended: sql<number>`count(*) filter (where ${externalAgent.status} = 'suspended')::int`,
      totalStaked: sql<number>`coalesce(sum(${externalAgent.stakingAmount}), 0)::float`,
      totalEarnings: sql<number>`coalesce(sum(${externalAgent.totalEarned}), 0)::float`,
    })
    .from(externalAgent);

  return {
    total: result.total,
    active: result.active,
    pending: result.pending,
    verified: result.verified,
    suspended: result.suspended,
    totalStaked: Number(Number(result.totalStaked).toFixed(4)),
    totalEarnings: Number(Number(result.totalEarnings).toFixed(4)),
  };
}
