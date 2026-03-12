/**
 * AI Debate Engine
 *
 * Auto-generates multi-agent debates from trending discourse topics.
 * Agents are assigned positions and argue across multiple rounds,
 * producing a final consensus verdict.
 *
 * Uses gemini-2.0-flash for cost-efficient autonomous execution.
 */

import { generateId } from 'ai';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import type { TrendingTopic } from '@/lib/polymarket-feed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DebateAgent {
  id: string;
  name: string;
  avatar: string;
  specialization: string;
  position: string; // The outcome they defend
}

export interface DebateMessage {
  agentId: string;
  agentName: string;
  agentAvatar: string;
  position: string;
  content: string;
  timestamp: string;
  rebuttal: boolean;
}

export interface Verdict {
  position: string;
  confidence: number;
  agentVotes: number;
  reasoning: string;
}

export interface Debate {
  id: string;
  topic: TrendingTopic;
  agents: DebateAgent[];
  status: 'scheduled' | 'live' | 'completed';
  messages: DebateMessage[];
  round: number;
  maxRounds: number;
  startedAt?: string;
  completedAt?: string;
  verdict?: Verdict;
}

// ---------------------------------------------------------------------------
// In-memory debate store (DB-optional — works without persistence)
// ---------------------------------------------------------------------------

const activeDebates = new Map<string, Debate>();

/** Get all debates (most recent first) */
export function getAllDebates(): Debate[] {
  return Array.from(activeDebates.values()).sort(
    (a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
  );
}

/** Get a specific debate by ID */
export function getDebate(debateId: string): Debate | undefined {
  return activeDebates.get(debateId);
}

/** Check if a topic already has an active/recent debate */
export function hasActiveDebate(topicId: string): boolean {
  for (const debate of activeDebates.values()) {
    if (debate.topic.id === topicId && debate.status !== 'completed') {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Agent selection
// ---------------------------------------------------------------------------

const AGENT_AVATARS = [
  '/agents/analyst.png',
  '/agents/trader.png',
  '/agents/researcher.png',
  '/agents/strategist.png',
  '/agents/sentinel.png',
  '/agents/oracle.png',
];

function pickAvatar(index: number): string {
  return AGENT_AVATARS[index % AGENT_AVATARS.length];
}

/**
 * Pick N agents from the database with varied specializations.
 * Falls back to synthetic agents if DB is unavailable.
 */
async function pickDebateAgents(count: number): Promise<DebateAgent[]> {
  const agents: DebateAgent[] = [];

  try {
    // Fetch random fleet agents with different specializations
    const rows = await Promise.race([
      db
        .select({
          id: externalAgent.id,
          name: externalAgent.name,
          description: externalAgent.description,
          category: externalAgent.category,
        })
        .from(externalAgent)
        .where(eq(externalAgent.ownerAddress, 'platform-fleet'))
        .orderBy(sql`RANDOM()`)
        .limit(count * 3), // fetch extra to ensure variety
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    // Pick agents with different categories
    const usedCategories = new Set<string>();
    for (const row of rows) {
      if (agents.length >= count) break;
      const cat = row.category ?? 'general';
      if (usedCategories.has(cat) && agents.length < count - 1) continue;
      usedCategories.add(cat);
      agents.push({
        id: row.id,
        name: row.name,
        avatar: pickAvatar(agents.length),
        specialization: cat,
        position: '', // assigned later
      });
    }
  } catch (err) {
    console.warn('[debate-engine] DB unavailable, using synthetic agents:', err);
  }

  // Fill remaining slots with synthetic agents
  const synthetics = [
    { name: 'Atlas Analyst', specialization: 'research' },
    { name: 'Nova Strategist', specialization: 'trading' },
    { name: 'Cipher Guardian', specialization: 'security' },
    { name: 'Pulse Reporter', specialization: 'news' },
  ];

  while (agents.length < count) {
    const syn = synthetics[agents.length % synthetics.length];
    agents.push({
      id: `synth-${generateId()}`,
      name: syn.name,
      avatar: pickAvatar(agents.length),
      specialization: syn.specialization,
      position: '',
    });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Debate creation
// ---------------------------------------------------------------------------

/**
 * Create a new debate from a trending topic.
 * Assigns each agent a different outcome position to defend.
 */
export async function createDebateFromTopic(topic: TrendingTopic): Promise<Debate> {
  const agentCount = Math.min(topic.outcomes.length, 4);
  const agents = await pickDebateAgents(Math.max(agentCount, 2));

  // Assign positions — each agent defends a different outcome
  for (let i = 0; i < agents.length; i++) {
    agents[i].position = topic.outcomes[i % topic.outcomes.length];
  }

  const debate: Debate = {
    id: generateId(),
    topic,
    agents,
    status: 'scheduled',
    messages: [],
    round: 0,
    maxRounds: 3,
    startedAt: new Date().toISOString(),
  };

  activeDebates.set(debate.id, debate);

  // Prune old completed debates (keep max 50)
  if (activeDebates.size > 50) {
    const all = getAllDebates();
    const toRemove = all.filter((d) => d.status === 'completed').slice(30);
    for (const d of toRemove) {
      activeDebates.delete(d.id);
    }
  }

  return debate;
}

// ---------------------------------------------------------------------------
// Debate round execution
// ---------------------------------------------------------------------------

/**
 * Run one round of debate. Each agent produces an argument defending their position.
 * After round 1, agents also rebut previous arguments.
 */
export async function runDebateRound(debate: Debate): Promise<DebateMessage[]> {
  if (debate.status === 'completed') {
    return [];
  }

  debate.status = 'live';
  debate.round++;

  const newMessages: DebateMessage[] = [];
  const isRebuttal = debate.round > 1;

  // Build context from previous messages
  const previousArgs = debate.messages
    .slice(-debate.agents.length * 2) // last 2 rounds max
    .map((m) => `[${m.agentName} — supporting "${m.position}"]: ${m.content}`)
    .join('\n\n');

  for (const agent of debate.agents) {
    try {
      const systemContext = isRebuttal
        ? `This is round ${debate.round} of a multi-agent discourse. You are defending the position "${agent.position}" on the topic: "${debate.topic.title}". Current consensus levels: ${debate.topic.outcomes.map((o, i) => `${o}: ${debate.topic.percentages[i] ?? 0}%`).join(', ')}.\n\nPrevious arguments:\n${previousArgs}\n\nProvide a focused rebuttal to opposing arguments. Be specific with data and reasoning. 2-3 sentences maximum.`
        : `You are participating in a discourse on the topic: "${debate.topic.title}". You are defending the position "${agent.position}". Current consensus levels: ${debate.topic.outcomes.map((o, i) => `${o}: ${debate.topic.percentages[i] ?? 0}%`).join(', ')}.\n\nProvide your opening argument in 2-3 sentences. Be specific with data, evidence, and reasoning. Do not hedge — commit to your position.`;

      const agentConfig: AgentConfig = {
        id: agent.id,
        name: agent.name,
        description: `Expert ${agent.specialization} analyst participating in structured discourse`,
        preferredProvider: 'google',
        preferredModel: 'gemini-2.0-flash',
      };

      const result = await executeAgent(agentConfig, systemContext);

      const message: DebateMessage = {
        agentId: agent.id,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        position: agent.position,
        content: result.content.slice(0, 500), // cap length
        timestamp: new Date().toISOString(),
        rebuttal: isRebuttal,
      };

      newMessages.push(message);
      debate.messages.push(message);
    } catch (err) {
      console.error(`[debate-engine] Agent ${agent.name} failed:`, err);
      // Add a fallback message so the debate continues
      const fallback: DebateMessage = {
        agentId: agent.id,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        position: agent.position,
        content: `Based on current analysis, the "${agent.position}" position remains supported by market fundamentals and recent developments.`,
        timestamp: new Date().toISOString(),
        rebuttal: isRebuttal,
      };
      newMessages.push(fallback);
      debate.messages.push(fallback);
    }
  }

  // Check if debate should conclude
  if (debate.round >= debate.maxRounds) {
    const verdict = await generateVerdict(debate);
    debate.verdict = verdict;
    debate.status = 'completed';
    debate.completedAt = new Date().toISOString();
  }

  // Persist state
  activeDebates.set(debate.id, debate);

  return newMessages;
}

// ---------------------------------------------------------------------------
// Verdict generation
// ---------------------------------------------------------------------------

/**
 * Synthesize all arguments into a final consensus verdict.
 */
export async function generateVerdict(debate: Debate): Promise<Verdict> {
  const allArguments = debate.messages
    .map((m) => `[${m.agentName} — "${m.position}"]: ${m.content}`)
    .join('\n\n');

  const prompt = `You are a neutral judge synthesizing a multi-agent discourse.

Topic: "${debate.topic.title}"
Positions: ${debate.topic.outcomes.join(', ')}
Current consensus: ${debate.topic.outcomes.map((o, i) => `${o}: ${debate.topic.percentages[i] ?? 0}%`).join(', ')}

All arguments:
${allArguments}

Based on the strength of arguments presented, determine:
1. Which position has the strongest support? (respond with EXACTLY one of: ${debate.topic.outcomes.join(', ')})
2. Confidence level (0-100)
3. Brief reasoning (1-2 sentences)

Respond in this exact JSON format:
{"position": "...", "confidence": N, "reasoning": "..."}`;

  try {
    const judgeConfig: AgentConfig = {
      id: 'debate-judge',
      name: 'Consensus Judge',
      description: 'Neutral arbiter that synthesizes discourse into a verdict',
      preferredProvider: 'google',
      preferredModel: 'gemini-2.0-flash',
    };

    const result = await executeAgent(judgeConfig, prompt);

    // Parse JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*?"position"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        position: String(parsed.position ?? debate.topic.outcomes[0]),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence ?? 60))),
        agentVotes: debate.agents.filter(
          (a) => a.position === parsed.position,
        ).length,
        reasoning: String(parsed.reasoning ?? 'Based on the balance of arguments presented.'),
      };
    }
  } catch (err) {
    console.error('[debate-engine] Verdict generation failed:', err);
  }

  // Fallback verdict based on highest percentage
  const maxIdx = debate.topic.percentages.indexOf(
    Math.max(...debate.topic.percentages),
  );
  return {
    position: debate.topic.outcomes[maxIdx] ?? debate.topic.outcomes[0],
    confidence: debate.topic.percentages[maxIdx] ?? 50,
    agentVotes: 1,
    reasoning: 'Verdict based on prevailing consensus levels.',
  };
}
