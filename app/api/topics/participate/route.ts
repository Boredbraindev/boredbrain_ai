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

const DEFAULT_DEBATE_COST = 2;

function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
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
  generate: (system: string, user: string) => Promise<string | null>;
};

function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey !== 'dummy') {
    providers.push({
      tag: 'DeepSeek',
      modelApi: 'deepseek-chat',
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 200,
            temperature: 1.0,
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
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 200,
            temperature: 1.0,
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
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 200,
            temperature: 1.0,
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
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'qwen/qwen3-32b',
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: usr + '\n\n/no_think' },
            ],
            max_tokens: 200,
            temperature: 0.8,
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
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
            max_tokens: 200,
            temperature: 1.0,
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
      generate: async (sys, usr) => {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${sys}\n\n${usr}` }] }],
              generationConfig: { maxOutputTokens: 200, temperature: 1.0 },
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

    // 1. Pick a random open debate
    const debates = await sql`
      SELECT id, topic, category, market_id
      FROM topic_debate
      WHERE status = 'open'
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
      await sql`
        INSERT INTO agent_wallet (agent_id, balance, daily_limit, total_earned, total_spent)
        VALUES (${agent.id}, 200, 200, 0, 0)
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
    const persona = agent.description
      ? `${agent.description}. Your specialty: ${agent.specialization}.`
      : `You specialize in ${agent.specialization}.`;

    const stanceHint = Math.random() > 0.5
      ? 'Take a STRONG position — argue firmly for one side.'
      : 'Be contrarian — challenge the popular view with evidence.';

    const sysPrompt = `You are "${agent.name}". ${persona}

RULES:
- NEVER start with "As a..." or "I think..." or any filler. Jump straight into your argument.
- NEVER output <think> tags or internal reasoning. Only output your final opinion.
- Be UNIQUE — your perspective must come from YOUR specific expertise (${agent.specialization}).
- ${stanceHint}`;

    const userPrompt = `DEBATE: "${debate.topic}" [${debate.category}]

IMPORTANT: Start your response with exactly [FOR] or [AGAINST] to declare your position, then write 2-3 sentences. Cite a specific number, protocol, event, or trend that only a ${agent.specialization} expert would know. Your opinion must be clearly different from a generic AI response.`;

    let opinionText: string | null = null;
    let provider = shuffled[0];

    for (const p of shuffled) {
      provider = p;
      try {
        opinionText = await p.generate(sysPrompt, userPrompt);
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

    // 4. Determine position — first check [FOR]/[AGAINST] tag, then keyword fallback
    let position: 'for' | 'against' | 'neutral' = 'neutral';
    const tagMatch = opinionText.match(/^\s*\[(FOR|AGAINST)\]/i);
    if (tagMatch) {
      position = tagMatch[1].toLowerCase() as 'for' | 'against';
      opinionText = opinionText.replace(/^\s*\[(FOR|AGAINST)\]\s*/i, '').trim();
    } else {
      const lower = opinionText.toLowerCase();
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
      // If still neutral (no keywords matched), assign randomly — pure neutral is rare in real debates
      else position = Math.random() > 0.5 ? 'for' : 'against';
    }

    const trimmed = opinionText.slice(0, 2000);

    // 5. Save opinion with model_used
    const opinionId = generateId();
    await sql`
      INSERT INTO debate_opinion (id, debate_id, agent_id, opinion, position, model_used, score, created_at)
      VALUES (${opinionId}, ${debate.id}, ${agent.id}, ${trimmed}, ${position}, ${provider.tag}, 0, NOW())
    `;

    // 6. Increment participant count + add to prize pool
    await sql`
      UPDATE topic_debate
      SET total_participants = COALESCE(total_participants, 0) + 1,
          total_pool = COALESCE(total_pool, 0) + ${cost}
      WHERE id = ${debate.id}
    `;

    // 6b. Create betting position if debate has a linked market and agent took a side
    if (debate.market_id && (position === 'for' || position === 'against')) {
      try {
        const outcome = position === 'for' ? 'For' : 'Against';
        await sql`
          INSERT INTO betting_position (market_id, user_address, outcome, shares, avg_price, realized_pnl)
          VALUES (${debate.market_id}, ${agent.id}, ${outcome}, ${cost}, 50, 0)
        `;
      } catch {
        // Non-critical — opinion is still recorded
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
        INSERT INTO point_transaction (id, wallet_address, action, amount, reference_id, created_at)
        VALUES (${generateId()}, ${walletAddr}, 'debate_vote', 10, ${debate.id}, NOW())
        ON CONFLICT DO NOTHING
      `;
      await sql`
        UPDATE user_points
        SET total_points = total_points + 10
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
      model: provider.tag,
      opinionPreview: trimmed.slice(0, 100) + '...',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Failed: ${msg}` }, { status: 500 });
  }
}
