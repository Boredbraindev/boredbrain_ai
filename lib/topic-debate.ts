/**
 * Topic Debate Engine — Multi-Agent Open Debates
 *
 * Instead of 1v1 arena matches, topics are posted and ANY agent can submit
 * an opinion/argument. Opinions are then scored on relevance, insight,
 * accuracy, and creativity.
 *
 * Debate phases: 'open' → 'scoring' → 'completed' → 'settled'
 * Additional status: 'closed' (manually closed or duplicate — never deleted)
 * Uses gemini-2.0-flash for scoring to minimize LLM costs.
 */

import { generateId } from 'ai';
import { db } from '@/lib/db';
import { topicDebate, debateOpinion, externalAgent, bettingMarket, bettingPosition, debateStake, agentBadge } from '@/lib/db/schema';
import { eq, sql, desc, and, lt, ne } from 'drizzle-orm';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { awardPoints } from '@/lib/points';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPEN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours — allows participation across heartbeat cycles

const DEBATE_CATEGORIES = [
  'crypto',
  'defi',
  'ai',
  'governance',
  'culture',
  'nft',
  'general',
] as const;

export type DebateCategory = (typeof DEBATE_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Topic Debate CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new topic debate that is open for 30 minutes.
 */
export async function createTopicDebate(
  topic: string,
  category: string = 'general',
  polymarketEventId?: string,
  imageUrl?: string,
  outcomes?: Array<{label: string; price: number}>,
  polymarketSlug?: string,
  /** Polymarket/Kalshi endDate — used as closesAt instead of default 24h when provided */
  closesAtOverride?: string | Date,
  /** Source market: 'polymarket' | 'kalshi' | 'internal' */
  source?: string,
): Promise<{ id: string; topic: string; category: string; closesAt: Date; marketId?: string }> {
  // Check for existing debate with same topic (case-insensitive, trimmed)
  try {
    const existing = await Promise.race([
      db
        .select({ id: topicDebate.id, topic: topicDebate.topic, category: topicDebate.category, closesAt: topicDebate.closesAt, marketId: topicDebate.marketId })
        .from(topicDebate)
        .where(sql`LOWER(TRIM(${topicDebate.topic})) = LOWER(TRIM(${topic})) AND ${topicDebate.status} = 'open'`)
        .limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        topic: existing[0].topic,
        category: existing[0].category,
        closesAt: existing[0].closesAt,
        marketId: existing[0].marketId ?? undefined,
      };
    }
  } catch (err) {
    console.error('[topic-debate] duplicate check error:', err);
    // Continue with creation — better to risk a duplicate than block all new debates
  }

  const id = generateId();
  const now = new Date();

  // Use Polymarket endDate as closesAt when provided and valid, otherwise default 24h
  let closesAt: Date;
  if (closesAtOverride) {
    const parsed = closesAtOverride instanceof Date ? closesAtOverride : new Date(closesAtOverride);
    if (!isNaN(parsed.getTime()) && parsed > now) {
      closesAt = parsed;
    } else {
      closesAt = new Date(now.getTime() + OPEN_DURATION_MS);
    }
  } else {
    closesAt = new Date(now.getTime() + OPEN_DURATION_MS);
  }

  let marketId: string | undefined;

  // 1. Create a linked betting market for this debate
  // Use multi-outcome labels if available, otherwise default to For/Against
  const marketOutcomes = outcomes && outcomes.length >= 2
    ? outcomes.map(o => o.label)
    : ['For', 'Against'];

  try {
    const [market] = await db
      .insert(bettingMarket)
      .values({
        title: `Debate: ${topic.slice(0, 200)}`,
        description: outcomes && outcomes.length >= 2
          ? `Multi-outcome market for topic debate with ${outcomes.length} choices.`
          : `Linked staking market for topic debate. Agents stake by taking a for/against position.`,
        category: 'ecosystem',
        outcomes: marketOutcomes,
        creatorAddress: 'platform-debate',
        creatorType: 'platform',
        resolvesAt: closesAt,
        tags: ['debate', category],
        metadata: { debateId: id },
      })
      .returning();

    marketId = market?.id;
  } catch (err) {
    console.error('[topic-debate] createTopicDebate betting market error:', err);
    // Non-critical — debate can still work without a linked market
  }

  // 2. Create the topic debate with the linked market ID
  try {
    await db.insert(topicDebate).values({
      id,
      topic,
      category,
      status: 'open',
      closesAt,
      totalParticipants: 0,
      polymarketEventId: polymarketEventId ?? null,
      totalPool: 0,
      marketId: marketId ?? null,
      imageUrl: imageUrl ?? null,
      outcomes: outcomes ?? null,
      polymarketSlug: polymarketSlug ?? null,
      source: source ?? 'polymarket',
    });
  } catch (err) {
    console.error('[topic-debate] createTopicDebate DB error:', err);
    // Fall through — return the created debate info even if DB write fails
  }

  return { id, topic, category, closesAt, marketId };
}

/**
 * Submit an agent's opinion to an open debate.
 * Each agent can only submit ONE opinion per debate.
 */
export async function submitAgentOpinion(
  debateId: string,
  agentId: string,
  opinion: string,
  position: 'for' | 'against' | 'neutral' = 'neutral',
  modelUsed?: string,
  outcomeIndex?: number,
): Promise<{ success: boolean; opinionId?: string; error?: string }> {
  try {
    // 1. Check debate exists and is open
    const debates = await Promise.race([
      db
        .select()
        .from(topicDebate)
        .where(eq(topicDebate.id, debateId))
        .limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    if (debates.length === 0) {
      return { success: false, error: 'Debate not found' };
    }

    const debate = debates[0];

    if (debate.status !== 'open') {
      return { success: false, error: 'Debate is no longer accepting opinions' };
    }

    // Check if past close time
    if (new Date() > new Date(debate.closesAt)) {
      return { success: false, error: 'Debate has closed' };
    }

    // 2. Check agent hasn't already submitted
    const existing = await db
      .select({ id: debateOpinion.id })
      .from(debateOpinion)
      .where(
        and(
          eq(debateOpinion.debateId, debateId),
          eq(debateOpinion.agentId, agentId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Agent has already submitted an opinion for this debate' };
    }

    // 3. Insert opinion
    const opinionId = generateId();
    await db.insert(debateOpinion).values({
      id: opinionId,
      debateId,
      agentId,
      opinion: opinion.slice(0, 2000), // cap at 2000 chars
      position,
      outcomeIndex: outcomeIndex ?? null,
      score: 0,
      modelUsed: modelUsed || null,
    });

    // 4. Increment participant count
    await db
      .update(topicDebate)
      .set({
        totalParticipants: sql`${topicDebate.totalParticipants} + 1`,
      })
      .where(eq(topicDebate.id, debateId));

    // 4b. Create a betting position if the debate has a linked market and agent took a side
    if (debate.marketId && (position === 'for' || position === 'against')) {
      try {
        const outcome = position === 'for' ? 'For' : 'Against';
        await db.insert(bettingPosition).values({
          marketId: debate.marketId,
          userAddress: agentId,
          outcome,
          shares: 2, // 2 BP participation fee = 2 shares
          avgPrice: 50, // 50/50 implied probability at entry
          realizedPnl: 0,
        });
      } catch (err) {
        console.error('[topic-debate] betting position creation error:', err);
        // Non-critical — opinion is still recorded
      }
    }

    // 5. Award BP points for participation (10 BP)
    // Use agent's owner address if it's a fleet agent, otherwise use agentId as wallet
    try {
      const agentRow = await db
        .select({ ownerAddress: externalAgent.ownerAddress })
        .from(externalAgent)
        .where(eq(externalAgent.id, agentId))
        .limit(1);

      const walletAddr = agentRow[0]?.ownerAddress ?? agentId;
      await awardPoints(walletAddr, 'debate_vote', debateId, 10);
    } catch {
      // Points award failed — non-critical
    }

    return { success: true, opinionId };
  } catch (err) {
    console.error('[topic-debate] submitAgentOpinion error:', err);
    return { success: false, error: 'Failed to submit opinion' };
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score all opinions in a debate using an LLM judge.
 * Transitions debate from 'open' → 'scoring' → 'completed'.
 */
export async function scoreOpinions(debateId: string): Promise<{
  success: boolean;
  scored: number;
  error?: string;
}> {
  try {
    // 1. Get debate
    const debates = await db
      .select()
      .from(topicDebate)
      .where(eq(topicDebate.id, debateId))
      .limit(1);

    if (debates.length === 0) {
      return { success: false, scored: 0, error: 'Debate not found' };
    }

    const debate = debates[0];

    if (debate.status === 'completed') {
      return { success: false, scored: 0, error: 'Debate already scored' };
    }

    // 2. Mark as scoring
    await db
      .update(topicDebate)
      .set({ status: 'scoring' })
      .where(eq(topicDebate.id, debateId));

    // 3. Get all opinions
    const opinions = await db
      .select()
      .from(debateOpinion)
      .where(eq(debateOpinion.debateId, debateId));

    if (opinions.length === 0) {
      await db
        .update(topicDebate)
        .set({ status: 'completed' })
        .where(eq(topicDebate.id, debateId));
      return { success: true, scored: 0 };
    }

    // 4. Build scoring prompt
    const opinionList = opinions
      .map(
        (o: typeof opinions[number], i: number) =>
          `[Opinion ${i + 1} | Agent: ${o.agentId} | Position: ${o.position}]\n${o.opinion}`,
      )
      .join('\n\n---\n\n');

    const scoringPrompt = `You are a neutral debate judge. Score each opinion on the following topic.

Topic: "${debate.topic}"
Category: ${debate.category}

There are ${opinions.length} opinions to score. For each opinion, provide scores from 0-25 in four categories:
- relevance: How relevant is the opinion to the topic?
- insight: Does it provide unique or deep insight?
- accuracy: Are the claims factually sound?
- creativity: Is the argument novel or well-crafted?

Total score is the sum of all four (0-100).

Opinions:
${opinionList}

Respond with a JSON array in this exact format (one entry per opinion, in order):
[{"relevance": N, "insight": N, "accuracy": N, "creativity": N}, ...]

Return ONLY the JSON array, nothing else.`;

    const judgeConfig: AgentConfig = {
      id: 'topic-debate-judge',
      name: 'Debate Judge',
      description: 'Neutral judge scoring topic debate opinions',
      preferredProvider: 'google',
      preferredModel: 'gemini-2.0-flash',
    };

    const result = await executeAgent(judgeConfig, scoringPrompt);

    // 5. Parse scores
    let scores: Array<{
      relevance: number;
      insight: number;
      accuracy: number;
      creativity: number;
    }> = [];

    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('[topic-debate] Failed to parse scoring JSON');
    }

    // 6. Update each opinion with scores
    let topScore = 0;
    let topAgentId = '';
    let scoredCount = 0;

    for (let i = 0; i < opinions.length; i++) {
      const breakdown = scores[i] ?? {
        relevance: 10 + Math.floor(Math.random() * 10),
        insight: 10 + Math.floor(Math.random() * 10),
        accuracy: 10 + Math.floor(Math.random() * 10),
        creativity: 10 + Math.floor(Math.random() * 10),
      };

      // Clamp values
      const clamped = {
        relevance: Math.min(25, Math.max(0, Math.round(breakdown.relevance))),
        insight: Math.min(25, Math.max(0, Math.round(breakdown.insight))),
        accuracy: Math.min(25, Math.max(0, Math.round(breakdown.accuracy))),
        creativity: Math.min(25, Math.max(0, Math.round(breakdown.creativity))),
      };

      const totalScore =
        clamped.relevance + clamped.insight + clamped.accuracy + clamped.creativity;

      await db
        .update(debateOpinion)
        .set({
          score: totalScore,
          scoreBreakdown: clamped,
        })
        .where(eq(debateOpinion.id, opinions[i].id));

      if (totalScore > topScore) {
        topScore = totalScore;
        topAgentId = opinions[i].agentId;
      }

      scoredCount++;
    }

    // 7. Award bonus BP to top 3
    const sortedOpinions = opinions
      .map((o: typeof opinions[number], i: number) => ({
        ...o,
        totalScore:
          scores[i]
            ? Math.min(25, scores[i].relevance) +
              Math.min(25, scores[i].insight) +
              Math.min(25, scores[i].accuracy) +
              Math.min(25, scores[i].creativity)
            : 0,
      }))
      .sort((a: { totalScore: number }, b: { totalScore: number }) => b.totalScore - a.totalScore);

    const bonusBp = [50, 30, 15]; // 1st, 2nd, 3rd place bonus
    const badgeTypes = ['debate_gold', 'debate_silver', 'debate_bronze'];
    for (let i = 0; i < Math.min(3, sortedOpinions.length); i++) {
      try {
        const agentRow = await db
          .select({ ownerAddress: externalAgent.ownerAddress })
          .from(externalAgent)
          .where(eq(externalAgent.id, sortedOpinions[i].agentId))
          .limit(1);
        const walletAddr = agentRow[0]?.ownerAddress ?? sortedOpinions[i].agentId;
        await awardPoints(walletAddr, 'debate_vote', debateId, bonusBp[i]);

        // Award debate badge (Gold/Silver/Bronze)
        await db.insert(agentBadge).values({
          agentId: sortedOpinions[i].agentId,
          badgeType: badgeTypes[i],
          debateId,
          debateTopic: debate.topic.slice(0, 200),
        });
      } catch {
        // Non-critical
      }
    }

    // Award streak badges (3 wins, 5 wins)
    try {
      if (topAgentId) {
        const goldCount = await db
          .select({ id: agentBadge.id })
          .from(agentBadge)
          .where(and(
            eq(agentBadge.agentId, topAgentId),
            eq(agentBadge.badgeType, 'debate_gold'),
          ));

        if (goldCount.length === 3) {
          await db.insert(agentBadge).values({
            agentId: topAgentId,
            badgeType: 'streak_3',
            debateId,
            debateTopic: '3-win streak achieved',
          });
        } else if (goldCount.length === 5) {
          await db.insert(agentBadge).values({
            agentId: topAgentId,
            badgeType: 'debate_champion',
            debateId,
            debateTopic: '5-win champion',
          });
        }
      }
    } catch {
      // Non-critical
    }

    // 8. Settle user stakes — winners bet on top-scoring agent
    try {
      const allStakes = await db
        .select()
        .from(debateStake)
        .where(and(
          eq(debateStake.debateId, debateId),
          eq(debateStake.status, 'active'),
        ));

      if (allStakes.length > 0 && topAgentId) {
        const totalPool = allStakes.reduce((sum, s) => sum + s.amount, 0);
        const winStakes = allStakes.filter(s => s.agentId === topAgentId);
        const loseStakes = allStakes.filter(s => s.agentId !== topAgentId);
        const winTotal = winStakes.reduce((sum, s) => sum + s.amount, 0);

        for (const stake of winStakes) {
          const payout = winTotal > 0 ? Math.floor((stake.amount / winTotal) * totalPool) : stake.amount;
          try {
            await awardPoints(stake.walletAddress, 'arena_stake_win', debateId, payout);
            await db.update(debateStake).set({ status: 'won', payout, settledAt: new Date() }).where(eq(debateStake.id, stake.id));
          } catch { /* non-critical */ }
        }
        for (const stake of loseStakes) {
          try {
            await db.update(debateStake).set({ status: 'lost', payout: 0, settledAt: new Date() }).where(eq(debateStake.id, stake.id));
          } catch { /* non-critical */ }
        }
      }
    } catch {
      // Stake settlement non-critical
    }

    // 9. Mark debate as completed
    await db
      .update(topicDebate)
      .set({
        status: 'completed',
        topScore,
        topAgentId: topAgentId || null,
      })
      .where(eq(topicDebate.id, debateId));

    return { success: true, scored: scoredCount };
  } catch (err) {
    console.error('[topic-debate] scoreOpinions error:', err);
    // Ensure we don't leave debate stuck in 'scoring'
    try {
      await db
        .update(topicDebate)
        .set({ status: 'open' })
        .where(
          and(
            eq(topicDebate.id, debateId),
            eq(topicDebate.status, 'scoring'),
          ),
        );
    } catch {
      // ignore
    }
    return { success: false, scored: 0, error: 'Scoring failed' };
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * Get debate results with ranked opinions.
 */
export async function getDebateResults(debateId: string): Promise<{
  debate: {
    id: string;
    topic: string;
    category: string;
    status: string;
    totalParticipants: number;
    createdAt: Date;
    closesAt: Date;
  } | null;
  opinions: Array<{
    id: string;
    agentId: string;
    agentName: string;
    agentSpecialization: string;
    opinion: string;
    score: number;
    scoreBreakdown: {
      relevance: number;
      insight: number;
      accuracy: number;
      creativity: number;
    } | null;
    position: string;
    modelUsed: string | null;
    createdAt: Date;
    rank: number;
  }>;
}> {
  try {
    // 1. Get debate
    const debates = await Promise.race([
      db
        .select()
        .from(topicDebate)
        .where(eq(topicDebate.id, debateId))
        .limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    if (debates.length === 0) {
      return { debate: null, opinions: [] };
    }

    const debate = debates[0];

    // 2. Get opinions ranked by score
    const opinions = await db
      .select({
        id: debateOpinion.id,
        agentId: debateOpinion.agentId,
        opinion: debateOpinion.opinion,
        score: debateOpinion.score,
        scoreBreakdown: debateOpinion.scoreBreakdown,
        position: debateOpinion.position,
        modelUsed: debateOpinion.modelUsed,
        createdAt: debateOpinion.createdAt,
      })
      .from(debateOpinion)
      .where(eq(debateOpinion.debateId, debateId))
      .orderBy(desc(debateOpinion.score));

    // 3. Enrich with agent names
    const enriched = await Promise.all(
      opinions.map(async (o: typeof opinions[number], index: number) => {
        let agentName = 'Unknown Agent';
        let agentSpecialization = 'general';

        try {
          const agentRow = await db
            .select({
              name: externalAgent.name,
              specialization: externalAgent.specialization,
            })
            .from(externalAgent)
            .where(eq(externalAgent.id, o.agentId))
            .limit(1);

          if (agentRow.length > 0) {
            agentName = agentRow[0].name;
            agentSpecialization = agentRow[0].specialization;
          }
        } catch {
          // Fallback to unknown
        }

        return {
          id: o.id,
          agentId: o.agentId,
          agentName,
          agentSpecialization,
          opinion: o.opinion,
          score: o.score ?? 0,
          scoreBreakdown: o.scoreBreakdown ?? null,
          position: o.position,
          modelUsed: o.modelUsed ?? null,
          createdAt: o.createdAt,
          rank: index + 1,
        };
      }),
    );

    return {
      debate: {
        id: debate.id,
        topic: debate.topic,
        category: debate.category,
        status: debate.status,
        totalParticipants: debate.totalParticipants,
        createdAt: debate.createdAt,
        closesAt: debate.closesAt,
      },
      opinions: enriched,
    };
  } catch (err) {
    console.error('[topic-debate] getDebateResults error:', err);
    return { debate: null, opinions: [] };
  }
}

// ---------------------------------------------------------------------------
// List debates
// ---------------------------------------------------------------------------

/**
 * List debates with optional status filter.
 */
export async function listTopicDebates(
  options: {
    status?: string;
    category?: string;
    limit?: number;
  } = {},
): Promise<
  Array<{
    id: string;
    topic: string;
    category: string;
    status: string;
    totalParticipants: number;
    createdAt: Date;
    closesAt: Date;
    topScore: number | null;
    topAgentId: string | null;
  }>
> {
  try {
    const limit = Math.min(options.limit ?? 20, 50);

    let query = db
      .select()
      .from(topicDebate)
      .orderBy(desc(topicDebate.createdAt))
      .limit(limit);

    // Apply filters via chaining (drizzle doesn't support dynamic where well,
    // so we use conditional where)
    const conditions = [];
    if (options.status) {
      conditions.push(eq(topicDebate.status, options.status));
    }
    if (options.category) {
      conditions.push(eq(topicDebate.category, options.category));
    }

    let rows;
    if (conditions.length === 1) {
      rows = await db
        .select()
        .from(topicDebate)
        .where(conditions[0])
        .orderBy(desc(topicDebate.createdAt))
        .limit(limit);
    } else if (conditions.length === 2) {
      rows = await db
        .select()
        .from(topicDebate)
        .where(and(conditions[0], conditions[1]))
        .orderBy(desc(topicDebate.createdAt))
        .limit(limit);
    } else {
      rows = await db
        .select()
        .from(topicDebate)
        .orderBy(desc(topicDebate.createdAt))
        .limit(limit);
    }

    return rows;
  } catch (err) {
    console.error('[topic-debate] listTopicDebates error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auto-close expired debates
// ---------------------------------------------------------------------------

/**
 * Find open debates past their close time and score them.
 * Called from the heartbeat cron.
 */
export async function closeExpiredDebates(): Promise<{
  closed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let closed = 0;

  try {
    const now = new Date();
    const expired = await db
      .select({ id: topicDebate.id })
      .from(topicDebate)
      .where(
        and(
          eq(topicDebate.status, 'open'),
          lt(topicDebate.closesAt, now),
        ),
      )
      .limit(5); // process max 5 per cycle

    for (const debate of expired) {
      try {
        const result = await scoreOpinions(debate.id);
        if (result.success) {
          closed++;
        } else if (result.error) {
          errors.push(`Score ${debate.id}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Close ${debate.id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`closeExpiredDebates: ${msg}`);
  }

  return { closed, errors };
}

// ---------------------------------------------------------------------------
// Auto-participation — pick random agents and have them opine
// ---------------------------------------------------------------------------

/**
 * Have random fleet agents participate in open topic debates.
 * Called from the heartbeat cron.
 */
export async function autoParticipateInDebates(
  agentCount: number = 7,
): Promise<{ participated: number; errors: string[] }> {
  const errors: string[] = [];
  let participated = 0;

  try {
    // 1. Get open debates
    const openDebates = await db
      .select()
      .from(topicDebate)
      .where(eq(topicDebate.status, 'open'))
      .orderBy(sql`RANDOM()`)
      .limit(1); // participate in 1 debate per cycle to fit Vercel 10s timeout

    if (openDebates.length === 0) {
      return { participated: 0, errors: [] };
    }

    // 2. Pick random active agents
    const agents = await Promise.race([
      db
        .select({
          id: externalAgent.id,
          name: externalAgent.name,
          specialization: externalAgent.specialization,
          description: externalAgent.description,
        })
        .from(externalAgent)
        .where(sql`${externalAgent.status} IN ('active', 'verified')`)
        .orderBy(sql`RANDOM()`)
        .limit(agentCount * 2), // fetch extra for variety
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    if (agents.length === 0) {
      return { participated: 0, errors: ['No active agents found'] };
    }

    // 3. For each debate, have agents submit opinions
    for (const debate of openDebates) {
      // Check if debate is still within time
      if (new Date() > new Date(debate.closesAt)) {
        continue;
      }

      // Pick a subset of agents for this debate
      const shuffled = [...agents].sort(() => Math.random() - 0.5);
      const selectedAgents = shuffled.slice(
        0,
        Math.min(agentCount, shuffled.length),
      );

      for (const agent of selectedAgents) {
        try {
          // Check if agent already participated
          const existing = await db
            .select({ id: debateOpinion.id })
            .from(debateOpinion)
            .where(
              and(
                eq(debateOpinion.debateId, debate.id),
                eq(debateOpinion.agentId, agent.id),
              ),
            )
            .limit(1);

          if (existing.length > 0) continue;

          // Generate opinion — try LLM first, fall back to template
          let opinionText: string | null = null;
          let position: 'for' | 'against' | 'neutral' = 'neutral';
          let outcomeIndex: number | undefined;

          // Check if this is a multi-outcome debate
          const isMultiOutcome = debate.outcomes && Array.isArray(debate.outcomes) && debate.outcomes.length >= 2;
          const debateOutcomes = debate.outcomes as Array<{label: string; price: number}> | null;

          try {
            // Use OpenAI only — Gemini hits 429, xAI hits 400
            const pick = { provider: 'openai' as const, model: 'gpt-4o-mini' };
            const agentConfig: AgentConfig = {
              id: agent.id,
              name: agent.name,
              description: agent.description ?? `${agent.specialization} specialist`,
              preferredProvider: pick.provider,
              preferredModel: pick.model,
            };

            const stanceHint = Math.random() > 0.5
              ? 'Argue FIRMLY for one side.'
              : 'Be contrarian — challenge the popular view.';

            // Build outcome-aware prompt
            let outcomePrompt = '';
            if (isMultiOutcome && debateOutcomes) {
              const outcomeList = debateOutcomes
                .map((o, i) => `  [${i}] ${o.label} (${Math.round(o.price * 100)}%)`)
                .join('\n');
              outcomePrompt = `\n\nAVAILABLE OUTCOMES:\n${outcomeList}\n\nYou MUST start your response with [PICK:N] where N is the outcome number you choose (e.g. [PICK:0], [PICK:2]).`;
            } else {
              outcomePrompt = '';
            }

            const result = await Promise.race([
              executeAgent(
                agentConfig,
                `You are "${agent.name}". ${agent.description ?? agent.specialization + ' specialist'}.

DEBATE: "${debate.topic}" [${debate.category}]${outcomePrompt}

Write 2-3 sentences. ${stanceHint} Rules:
- NEVER start with "As a..." or any filler. Jump straight into your argument.
- NEVER output <think> tags or internal reasoning.
- Cite a specific number, protocol, event, or trend only a ${agent.specialization} expert would reference.
- Your tone must match: ${agent.specialization} experts are opinionated and specific.

Reply with ONLY your opinion.`,
              ),
              new Promise<{ content: null }>((resolve) =>
                setTimeout(() => resolve({ content: null }), 8000),
              ),
            ]);

            if (result.content && !result.content.includes('LLM unavailable')) {
              // Strip chain-of-thought tags
              opinionText = result.content
                .replace(/<think>[\s\S]*?<\/think>/g, '')
                .replace(/<think>[\s\S]*/g, '')
                .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
                .trim()
                .slice(0, 2000);
              if (opinionText.length < 20) {
                opinionText = null;
              }
            }
          } catch {
            // LLM call failed — skip this agent
          }

          // No fallback — if LLM fails, skip this agent
          if (!opinionText) {
            continue;
          }

          // Extract outcome index for multi-outcome debates
          if (isMultiOutcome && debateOutcomes && opinionText) {
            const pickMatch = opinionText.match(/^\s*\[PICK:(\d+)\]/i);
            if (pickMatch) {
              const idx = parseInt(pickMatch[1], 10);
              if (idx >= 0 && idx < debateOutcomes.length) {
                outcomeIndex = idx;
                // Map to for/against/neutral based on index for backwards compat
                position = 'for'; // multi-outcome agents are always "for" their chosen outcome
              }
              opinionText = opinionText.replace(/^\s*\[PICK:\d+\]\s*/i, '').trim();
            } else {
              // No valid pick — assign random outcome
              outcomeIndex = Math.floor(Math.random() * debateOutcomes.length);
              position = 'for';
            }
          }

          // Determine position from LLM content (binary debates only)
          if (!isMultiOutcome && position === 'neutral' && opinionText) {
            const lower = opinionText.toLowerCase();
            if (lower.includes('support') || lower.includes('agree') || lower.includes('in favor') || lower.includes('positive')) {
              position = 'for';
            } else if (lower.includes('disagree') || lower.includes('against') || lower.includes('skeptical') || lower.includes('unlikely')) {
              position = 'against';
            }
          }

          const submitResult = await submitAgentOpinion(
            debate.id,
            agent.id,
            opinionText,
            position,
            undefined,
            outcomeIndex,
          );

          if (submitResult.success) {
            participated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Agent ${agent.name} on "${debate.topic}": ${msg}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`autoParticipateInDebates: ${msg}`);
  }

  return { participated, errors };
}
