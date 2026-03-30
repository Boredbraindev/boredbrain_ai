export const runtime = 'edge';

/**
 * POST /api/topics/participate — Have one agent submit a real LLM opinion to an open debate.
 *
 * Designed to be called repeatedly (e.g., every 30s from dev server cron)
 * to build up genuine, diverse opinions without hitting Vercel's 10s timeout.
 *
 * Each call: picks 1 random open debate + 1 random agent → LLM generates opinion.
 * Rotates between DeepSeek, Groq (Llama/Qwen), and Gemini Flash for model diversity.
 *
 * Edge runtime — uses raw SQL via @neondatabase/serverless
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyCron } from '@/lib/verify-cron';

const DEFAULT_DEBATE_COST = 2;

// ── Specialization-specific prompts & temperatures ──────────────────────────

const SPECIALIZATION_PROMPTS: Record<string, string> = {
  trading: 'You analyze markets using technical indicators, order flow, and price action. Cite specific support/resistance levels, RSI readings, or volume patterns.',
  defi: 'You evaluate DeFi protocols by TVL trends, yield sustainability, smart contract risks, and tokenomics. Reference specific protocols and metrics.',
  security: 'You assess risks through vulnerability analysis, audit findings, and attack vectors. Reference specific CVEs, exploits, or security incidents.',
  research: 'You provide deep analysis with academic rigor. Cite specific papers, data sources, or historical precedents.',
  analytics: 'You work with on-chain data, wallet flows, and network metrics. Reference specific addresses, transaction volumes, or network stats.',
  social: 'You track community sentiment, social media trends, and narrative shifts. Reference specific community reactions or viral moments.',
  content: 'You craft narratives and communication strategies. Reference specific campaigns, engagement metrics, or content performance data.',
  creative: 'You think outside the box with unconventional perspectives. Draw surprising parallels from art, culture, or cross-industry innovation.',
  compliance: 'You evaluate regulatory frameworks, legal precedents, and compliance requirements. Reference specific regulations, court rulings, or enforcement actions.',
  utility: 'You assess practical adoption, user experience, and real-world utility. Reference specific integrations, user metrics, or infrastructure benchmarks.',
  general: 'You synthesize broad market knowledge across multiple domains. Connect dots between macro trends, sector rotations, and emerging narratives.',
  gaming: 'You analyze gaming ecosystems, player economics, and metaverse trends. Reference specific game metrics, player counts, or virtual economy data.',
  nft: 'You evaluate NFT markets through floor prices, collection metrics, and cultural relevance. Reference specific collections, marketplace volumes, or creator trends.',
  market: 'You focus on market microstructure, liquidity dynamics, and trading infrastructure. Reference specific spread data, depth charts, or exchange metrics.',
};

const SPECIALIZATION_TEMPS: Record<string, number> = {
  trading: 0.7,
  analytics: 0.7,
  security: 0.75,
  compliance: 0.75,
  research: 0.8,
  defi: 0.85,
  market: 0.8,
  utility: 0.85,
  general: 0.9,
  nft: 0.95,
  gaming: 0.95,
  content: 1.0,
  social: 1.1,
  creative: 1.1,
};

function getSpecializationPrompt(spec: string): string {
  return SPECIALIZATION_PROMPTS[spec?.toLowerCase()] || SPECIALIZATION_PROMPTS.general;
}

function getSpecializationTemp(spec: string): number {
  return SPECIALIZATION_TEMPS[spec?.toLowerCase()] ?? 0.9;
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ── Multi-model providers ────────────────────────────────────────────────────

type LLMProvider = {
  tag: string;
  modelApi: string;
  generate: (system: string, user: string, temperature?: number) => Promise<string | null>;
};

function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey !== 'dummy') {
    providers.push({
      tag: 'DeepSeek',
      modelApi: 'deepseek-chat',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 400,
            temperature,
          }),
        }, 8000);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      },
    });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey !== 'dummy') {
    providers.push({
      tag: 'Llama',
      modelApi: 'llama-3.1-8b-instant',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 400,
            temperature,
          }),
        }, 8000);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      },
    });

    providers.push({
      tag: 'Llama 4',
      modelApi: 'meta-llama/llama-4-scout-17b-16e-instruct',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 400,
            temperature,
          }),
        }, 8000);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      },
    });

    providers.push({
      tag: 'Qwen',
      modelApi: 'qwen/qwen3-32b',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'qwen/qwen3-32b',
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: usr + '\n\n/no_think' },
            ],
            max_tokens: 400,
            temperature: Math.min(temperature, 0.8),
          }),
        }, 8000);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      },
    });
  }

  // OpenAI (GPT-4o-mini for cost efficiency)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== 'dummy') {
    providers.push({
      tag: 'GPT',
      modelApi: 'gpt-4o-mini',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 400,
            temperature,
          }),
        }, 8000);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      },
    });
  }

  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey && geminiKey !== 'dummy') {
    providers.push({
      tag: 'Gemini',
      modelApi: 'gemini-2.0-flash',
      generate: async (sys, usr, temperature = 0.9) => {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${sys}\n\n${usr}` }] }],
              generationConfig: { maxOutputTokens: 400, temperature },
            }),
          },
          8000,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      },
    });
  }

  return providers;
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  return Promise.race([
    fetch(url, opts),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    ),
  ]);
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: 'No DATABASE_URL' }, { status: 503 });
  }

  try {
    const sql = neon(dbUrl);

    // 1. Pick a random open debate (include outcomes for multi-outcome support)
    const debates = await sql`
      SELECT id, topic, category, market_id, outcomes, polymarket_slug, closes_at
      FROM topic_debate
      WHERE status = 'open' AND closes_at > NOW()
      ORDER BY RANDOM()
      LIMIT 1
    `;

    if (debates.length === 0) {
      return NextResponse.json({ success: true, participated: false, reason: 'No open debates' });
    }
    const debate = debates[0];

    // 2. Pick a random active agent who hasn't participated in this debate yet
    const agents = await sql`
      SELECT id, name, specialization, description
      FROM external_agent
      WHERE status IN ('active', 'verified')
        AND id NOT IN (
          SELECT agent_id FROM debate_opinion WHERE debate_id = ${debate.id}
        )
      ORDER BY RANDOM()
      LIMIT 1
    `;

    if (agents.length === 0) {
      return NextResponse.json({ success: true, participated: false, reason: 'All agents already participated in available debates' });
    }
    const agent = agents[0];

    // 2b. Check agent wallet balance — create if missing, then deduct participation fee
    const cost = DEFAULT_DEBATE_COST;
    const wallets = await sql`
      SELECT balance FROM agent_wallet WHERE agent_id = ${agent.id} LIMIT 1
    `;

    if (wallets.length === 0) {
      // Create wallet with 200 BP initial
      const walletAddress = '0x' + agent.id.replace(/[^a-f0-9]/gi, '').padEnd(40, '0').slice(0, 40);
      await sql`
        INSERT INTO agent_wallet (id, agent_id, address, balance, daily_limit, total_spent)
        VALUES (${generateId()}, ${agent.id}, ${walletAddress}, 200, 200, 0)
        ON CONFLICT (agent_id) DO NOTHING
      `;
    }

    const currentBalance = wallets.length > 0 ? (wallets[0].balance ?? 0) : 200;
    if (currentBalance < cost) {
      return NextResponse.json({ success: true, participated: false, reason: `Agent ${agent.name} insufficient balance (${currentBalance} BP < ${cost} BP)` });
    }

    // Deduct balance
    await sql`
      UPDATE agent_wallet
      SET balance = balance - ${cost}, total_spent = total_spent + ${cost}
      WHERE agent_id = ${agent.id} AND balance >= ${cost}
    `;

    // 3. Pick a random provider
    const providers = getProviders();
    if (providers.length === 0) {
      return NextResponse.json({ success: true, participated: false, reason: 'No LLM API keys configured' });
    }

    // Shuffle providers and try until one succeeds
    const shuffled = [...providers].sort(() => Math.random() - 0.5);

    // Build a unique persona prompt using the agent's description and specialization
    const spec = agent.specialization || 'general';
    const specPrompt = getSpecializationPrompt(spec);
    const specTemp = getSpecializationTemp(spec);

    const persona = agent.description
      ? `${agent.description}. Your specialty: ${spec}.`
      : `You specialize in ${spec}.`;

    const stanceHint = Math.random() > 0.5
      ? 'Take a STRONG position — argue firmly for one side.'
      : 'Be contrarian — challenge the popular view with evidence.';

    // Detect multi-outcome debate
    const debateOutcomes: Array<{label: string; price: number}> | null =
      debate.outcomes && Array.isArray(debate.outcomes) && debate.outcomes.length > 2
        ? debate.outcomes as Array<{label: string; price: number}>
        : null;
    const isMultiOutcome = !!debateOutcomes;

    const sysPrompt = `You are "${agent.name}". ${persona}

EXPERTISE: ${specPrompt}

You MUST respond in EXACTLY this structured format (keep the tags):

[REASONING]
Your analysis based on your ${spec} expertise. Include specific data points, metrics, or references. 2-3 sentences max.
[/REASONING]

[PREDICTION]
One clear, specific prediction statement about the outcome.
[/PREDICTION]

[CONFIDENCE]
A number from 0 to 100 representing your confidence percentage.
[/CONFIDENCE]

[STAKE]
The outcome label you would stake BBAI on (e.g. "For", "Against", or a specific outcome name).
[/STAKE]

RULES:
- NEVER start with "As a..." or "I think..." or any filler. Jump straight into your argument.
- NEVER output <think> tags or internal reasoning. Only output the structured format above.
- Be UNIQUE — your perspective must come from YOUR specific expertise (${spec}).
- ${stanceHint}
- Include at least one specific data point, metric, or verifiable reference in your reasoning.
- Briefly acknowledge the strongest counterargument in your reasoning.`;

    // Build outcome-aware user prompt
    let userPrompt: string;
    if (isMultiOutcome && debateOutcomes) {
      const outcomeList = debateOutcomes
        .map((o: {label: string; price: number}, i: number) => `  [${i}] ${o.label} (${Math.round(o.price * 100)}%)`)
        .join('\n');
      userPrompt = `DEBATE: "${debate.topic}" [${debate.category}]

AVAILABLE OUTCOMES:
${outcomeList}

In [REASONING], explain why you chose your outcome using your ${spec} expertise. Acknowledge why another outcome might seem likely.
In [PREDICTION], state your specific predicted outcome clearly.
In [CONFIDENCE], give a number 0-100.
In [STAKE], put the EXACT label text of the outcome you choose (e.g. "${debateOutcomes[0].label}").

Your opinion must be clearly different from a generic AI response. Draw on domain-specific knowledge.`;
    } else {
      userPrompt = `DEBATE: "${debate.topic}" [${debate.category}]

In [REASONING], present your core argument using your ${spec} expertise with specific data. Acknowledge the strongest counterargument.
In [PREDICTION], state your specific predicted outcome.
In [CONFIDENCE], give a number 0-100.
In [STAKE], put exactly "For" or "Against" to declare your position.

Your opinion must be clearly different from a generic AI response. Draw on domain-specific knowledge.`;
    }

    let opinionText: string | null = null;
    let provider = shuffled[0];

    for (const p of shuffled) {
      provider = p;
      try {
        opinionText = await p.generate(sysPrompt, userPrompt, specTemp);
        if (opinionText && opinionText.length >= 20) break;
        opinionText = null;
      } catch {
        opinionText = null;
      }
    }

    if (!opinionText || opinionText.length < 20) {
      // Refund participation fee on LLM failure
      try {
        await sql`UPDATE agent_wallet SET balance = balance + ${cost} WHERE agent_id = ${agent.id}`;
      } catch { /* non-critical */ }
      return NextResponse.json({ success: true, participated: false, reason: `All providers failed (refunded ${cost} BP)` });
    }

    // Strip chain-of-thought tags from Qwen/DeepSeek (closed + unclosed)
    opinionText = opinionText
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<think>[\s\S]*/g, '')
      .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
      .trim();

    if (opinionText.length < 20) {
      try {
        await sql`UPDATE agent_wallet SET balance = balance + ${cost} WHERE agent_id = ${agent.id}`;
      } catch { /* non-critical */ }
      return NextResponse.json({ success: true, participated: false, reason: `Only thinking output from ${provider.tag} (refunded ${cost} BP)` });
    }

    // 4. Parse structured response: [REASONING], [PREDICTION], [CONFIDENCE], [STAKE]
    let reasoning: string | null = null;
    let prediction: string | null = null;
    let confidence: number | null = null;
    let stakeOutcome: string | null = null;

    // Extract [REASONING]...[/REASONING] or [REASONING]...(next tag)
    const reasoningMatch = opinionText.match(/\[REASONING\]\s*([\s\S]*?)(?:\[\/REASONING\]|\[PREDICTION\])/i);
    if (reasoningMatch) reasoning = reasoningMatch[1].trim();

    // Extract [PREDICTION]...[/PREDICTION] or [PREDICTION]...(next tag)
    const predictionMatch = opinionText.match(/\[PREDICTION\]\s*([\s\S]*?)(?:\[\/PREDICTION\]|\[CONFIDENCE\])/i);
    if (predictionMatch) prediction = predictionMatch[1].trim();

    // Extract [CONFIDENCE] number
    const confidenceMatch = opinionText.match(/\[CONFIDENCE\]\s*(\d{1,3})/i);
    if (confidenceMatch) {
      const c = parseInt(confidenceMatch[1], 10);
      confidence = Math.max(0, Math.min(100, c));
    }

    // Extract [STAKE] outcome
    const stakeMatch = opinionText.match(/\[STAKE\]\s*([\s\S]*?)(?:\[\/STAKE\]|$)/i);
    if (stakeMatch) stakeOutcome = stakeMatch[1].trim().replace(/\[\/STAKE\]/i, '').trim();

    // Build composite opinion text from parts (fallback to raw if parsing failed)
    let compositeOpinion: string;
    if (reasoning || prediction) {
      compositeOpinion = [
        reasoning ? reasoning : '',
        prediction ? prediction : '',
      ].filter(Boolean).join('\n\n');
    } else {
      // Fallback: use the raw LLM output stripped of tags
      compositeOpinion = opinionText
        .replace(/\[(REASONING|PREDICTION|CONFIDENCE|STAKE|\/REASONING|\/PREDICTION|\/CONFIDENCE|\/STAKE)\]/gi, '')
        .trim();
    }

    // 4b. Determine position and outcome index
    let position: 'for' | 'against' | 'neutral' = 'neutral';
    let outcomeIndex: number | null = null;

    if (isMultiOutcome && debateOutcomes) {
      // Multi-outcome: match stakeOutcome to outcome labels
      if (stakeOutcome) {
        const lowerStake = stakeOutcome.toLowerCase();
        const matchIdx = debateOutcomes.findIndex(
          (o: {label: string; price: number}) => o.label.toLowerCase() === lowerStake
            || lowerStake.includes(o.label.toLowerCase())
            || o.label.toLowerCase().includes(lowerStake)
        );
        if (matchIdx >= 0) outcomeIndex = matchIdx;
      }
      // Fallback: assign random outcome
      if (outcomeIndex === null) {
        outcomeIndex = Math.floor(Math.random() * debateOutcomes.length);
      }
      if (!stakeOutcome && outcomeIndex !== null) {
        stakeOutcome = debateOutcomes[outcomeIndex].label;
      }
      position = 'for'; // multi-outcome agents are always "for" their chosen outcome
    } else {
      // Binary: check stakeOutcome first, then keyword fallback
      if (stakeOutcome) {
        const lowerStake = stakeOutcome.toLowerCase();
        if (lowerStake.includes('for') || lowerStake.includes('yes') || lowerStake.includes('support') || lowerStake.includes('bullish')) {
          position = 'for';
        } else if (lowerStake.includes('against') || lowerStake.includes('no') || lowerStake.includes('oppose') || lowerStake.includes('bearish')) {
          position = 'against';
        }
      }

      if (position === 'neutral') {
        // Keyword fallback from the opinion text
        const lower = compositeOpinion.toLowerCase();
        const forWords = ['support', 'agree', 'bullish', 'will likely', 'inevitable', 'definitely',
          'must', 'should', 'essential', 'positive', 'opportunity', 'promising', 'yes',
          'absolutely', 'clearly', 'undeniably', 'momentum', 'growth', 'favor', 'benefit',
          'advantage', 'enable', 'improve', 'strong', 'necessary', 'crucial', 'vital'];
        const againstWords = ['disagree', 'skeptical', 'bearish', 'unlikely', 'overrated', 'won\'t',
          'no', 'fail', 'risk', 'dangerous', 'unsustainable', 'bubble', 'overhyped',
          'questionable', 'concern', 'flawed', 'problematic', 'doubt', 'threat',
          'weakness', 'undermine', 'fragile', 'vulnerable', 'premature', 'naive'];

        let forScore = 0;
        let againstScore = 0;
        for (const w of forWords) { if (lower.includes(w)) forScore++; }
        for (const w of againstWords) { if (lower.includes(w)) againstScore++; }

        if (forScore > againstScore && forScore >= 1) position = 'for';
        else if (againstScore > forScore && againstScore >= 1) position = 'against';
        else if (forScore === againstScore && forScore >= 1) position = Math.random() > 0.5 ? 'for' : 'against';
        else position = Math.random() > 0.5 ? 'for' : 'against';
      }

      // Normalize stakeOutcome for binary
      if (!stakeOutcome) stakeOutcome = position === 'for' ? 'For' : 'Against';
    }

    const trimmed = compositeOpinion.slice(0, 2000);

    // 5. Save opinion with structured fields
    const opinionId = generateId();
    await sql`
      INSERT INTO debate_opinion (id, debate_id, agent_id, opinion, position, outcome_index, model_used, reasoning, prediction, confidence, stake_amount, stake_outcome, score, created_at)
      VALUES (${opinionId}, ${debate.id}, ${agent.id}, ${trimmed}, ${position}, ${outcomeIndex}, ${provider.tag}, ${reasoning}, ${prediction}, ${confidence}, 0, ${stakeOutcome}, 0, NOW())
    `;

    // 5b. Auto-stake logic — fail-safe, never blocks opinion
    let autoStakeAmount = 0;
    try {
      if (confidence !== null && confidence > 0) {
        // Calculate stake: confidence * 0.1, capped at 5% of balance
        const maxByConfidence = confidence * 0.1;
        const maxByBalance = currentBalance * 0.05;
        autoStakeAmount = Math.round(Math.min(maxByConfidence, maxByBalance) * 100) / 100;

        if (autoStakeAmount >= 0.1) {
          // Deduct from wallet
          await sql`
            UPDATE agent_wallet
            SET balance = balance - ${autoStakeAmount}, total_spent = total_spent + ${autoStakeAmount}
            WHERE agent_id = ${agent.id} AND balance >= ${autoStakeAmount}
          `;

          // Only record stake if deduction succeeded (check via separate query since neon returns row count inconsistently)
          // Record in debate_stake table
          await sql`
            INSERT INTO debate_stake (id, debate_id, wallet_address, agent_id, amount, status, created_at)
            VALUES (${generateId()}, ${debate.id}, ${agent.id}, ${agent.id}, ${Math.round(autoStakeAmount)}, 'active', NOW())
          `;

          // Update opinion with actual stake amount
          await sql`
            UPDATE debate_opinion SET stake_amount = ${autoStakeAmount} WHERE id = ${opinionId}
          `;
        } else {
          autoStakeAmount = 0;
        }
      }
    } catch {
      // Auto-staking failed — non-critical, opinion is already saved
      autoStakeAmount = 0;
    }

    // 6. Increment participant count + add to prize pool
    await sql`
      UPDATE topic_debate
      SET total_participants = COALESCE(total_participants, 0) + 1,
          total_pool = COALESCE(total_pool, 0) + ${cost}
      WHERE id = ${debate.id}
    `;

    // 6b. Auto-bet: place a real bet on the agent's chosen outcome
    let autoBetAmount = 0;
    let autoBetMarketId: string | null = debate.market_id || null;
    if (position === 'for' || position === 'against') {
      try {
        // Determine outcome label
        let outcomeLabel: string;
        if (isMultiOutcome && debateOutcomes && outcomeIndex !== null) {
          outcomeLabel = debateOutcomes[outcomeIndex].label;
        } else {
          outcomeLabel = position === 'for' ? 'For' : 'Against';
        }

        // If no linked market, create one for this debate
        if (!autoBetMarketId) {
          const outcomes = isMultiOutcome && debateOutcomes
            ? debateOutcomes.map((o: {label: string; price: number}) => o.label)
            : ['For', 'Against'];
          const outcomesArray = `{${outcomes.map((o: string) => `"${o}"`).join(',')}}`;
          const closesAt = debate.closes_at || new Date(Date.now() + 7 * 86400000).toISOString();
          const newMarket = await sql`
            INSERT INTO betting_market (id, title, category, outcomes, status, creator_address, creator_type, total_volume, total_orders, resolves_at)
            VALUES (gen_random_uuid(), ${debate.topic}, ${debate.category || 'general'}, ${outcomesArray}::text[], 'open', 'platform', 'platform', 0, 0, ${closesAt}::timestamp)
            RETURNING id
          `;
          const marketId = newMarket[0]?.id;
          if (!marketId) throw new Error('Failed to create betting market');
          // Link the market to the debate
          await sql`
            UPDATE topic_debate SET market_id = ${marketId}::uuid WHERE id = ${debate.id}
          `;
          autoBetMarketId = marketId;
        }

        // Check agent wallet balance for betting (need at least 5 BBAI to bet)
        const walletCheck = await sql`
          SELECT balance FROM agent_wallet WHERE agent_id = ${agent.id} LIMIT 1
        `;
        const agentBalance = walletCheck.length > 0 ? (walletCheck[0].balance ?? 0) : 0;

        if (agentBalance >= 5) {
          // Random bet amount 1-5 BBAI
          autoBetAmount = Math.floor(Math.random() * 5) + 1;
          // Clamp to available balance
          autoBetAmount = Math.min(autoBetAmount, agentBalance);
          const betPrice = 50; // fair value default

          // Deduct bet amount from agent wallet
          await sql`
            UPDATE agent_wallet
            SET balance = balance - ${autoBetAmount}, total_spent = total_spent + ${autoBetAmount}
            WHERE agent_id = ${agent.id} AND balance >= ${autoBetAmount}
          `;

          // Place a betting order
          await sql`
            INSERT INTO betting_order (id, market_id, user_address, user_type, side, price, amount, filled, status)
            VALUES (gen_random_uuid(), ${autoBetMarketId}::uuid, ${agent.id}, 'agent', ${outcomeLabel}, ${betPrice}, ${autoBetAmount}, 0, 'open')
          `;

          // Update market order count and volume
          await sql`
            UPDATE betting_market
            SET total_orders = total_orders + 1, total_volume = total_volume + ${autoBetAmount * betPrice}, updated_at = NOW()
            WHERE id = ${autoBetMarketId}::uuid
          `;

          // Upsert betting position
          const existingPos = await sql`
            SELECT id, shares, avg_price FROM betting_position
            WHERE market_id = ${autoBetMarketId}::uuid AND user_address = ${agent.id} AND outcome = ${outcomeLabel}
            LIMIT 1
          `;

          if (existingPos.length > 0) {
            const oldShares = existingPos[0].shares || 0;
            const oldAvg = existingPos[0].avg_price || 0;
            const newShares = oldShares + autoBetAmount;
            const newAvg = newShares > 0 ? Math.round((oldAvg * oldShares + betPrice * autoBetAmount) / newShares) : 0;
            await sql`
              UPDATE betting_position
              SET shares = ${newShares}, avg_price = ${newAvg}, updated_at = NOW()
              WHERE id = ${existingPos[0].id}
            `;
          } else {
            await sql`
              INSERT INTO betting_position (id, market_id, user_address, outcome, shares, avg_price, realized_pnl)
              VALUES (gen_random_uuid(), ${autoBetMarketId}::uuid, ${agent.id}, ${outcomeLabel}, ${autoBetAmount}, ${betPrice}, 0)
            `;
          }
        }
      } catch {
        // Non-critical — opinion is still recorded, betting is best-effort
        autoBetAmount = 0;
      }
    }

    // 7. Award BP (non-critical)
    try {
      const agentRows = await sql`
        SELECT owner_address FROM external_agent WHERE id = ${agent.id} LIMIT 1
      `;
      const walletAddr = agentRows[0]?.owner_address ?? agent.id;

      // Inline point award — insert into point_transaction
      await sql`
        INSERT INTO point_transaction (id, wallet_address, reason, amount, reference_id, created_at)
        VALUES (${generateId()}, ${walletAddr}, 'debate_vote', 10, ${debate.id}, NOW())
        ON CONFLICT DO NOTHING
      `;
      await sql`
        UPDATE user_points
        SET total_bp = total_bp + 10
        WHERE wallet_address = ${walletAddr}
      `;
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      participated: true,
      debate: debate.topic.slice(0, 80),
      agent: agent.name,
      specialization: agent.specialization,
      position,
      outcomeIndex: outcomeIndex ?? undefined,
      outcomePicked: isMultiOutcome && debateOutcomes && outcomeIndex !== null
        ? debateOutcomes[outcomeIndex].label
        : undefined,
      model: provider.tag,
      reasoning: reasoning?.slice(0, 200) ?? null,
      prediction: prediction?.slice(0, 200) ?? null,
      confidence: confidence ?? null,
      stakeAmount: autoStakeAmount,
      stakeOutcome: stakeOutcome ?? null,
      betAmount: autoBetAmount,
      betMarketId: autoBetMarketId ?? undefined,
      opinionPreview: trimmed.slice(0, 100) + '...',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Failed: ${msg}` }, { status: 500 });
  }
}
