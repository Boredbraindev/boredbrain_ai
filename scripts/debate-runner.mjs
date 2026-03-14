#!/usr/bin/env node
/**
 * Debate Runner — Generates real LLM opinions for open debates.
 *
 * Runs on the dev server using local Ollama with multiple models.
 * Rotates between qwen2.5:72b, llama3.3:70b, deepseek-r1:32b, llama3.2:3b
 * for diverse, realistic opinions.
 *
 * Usage:
 *   CRON_SECRET=xxx PLATFORM_URL=https://boredbrain.app node debate-runner.mjs
 *
 * Crontab (every 2 minutes):
 *   */2 * * * * cd ~/boredbrain && CRON_SECRET=xxx PLATFORM_URL=https://boredbrain.app node scripts/debate-runner.mjs >> debate-runner.log 2>&1
 */

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://boredbrain.app';
const CRON_SECRET = process.env.CRON_SECRET;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AGENTS_PER_RUN = parseInt(process.env.AGENTS_PER_RUN || '3', 10);

// Models to rotate between — { ollama model name → display tag }
// Ollama auto-detects which are installed; uninstalled ones are skipped
const OLLAMA_MODELS = [
  // Large models (prefer when available)
  { id: 'qwen2.5:72b', tag: 'Qwen' },
  { id: 'llama3.3:70b', tag: 'Llama' },
  { id: 'deepseek-r1:32b', tag: 'DeepSeek' },
  // Medium models
  { id: 'qwen2.5:32b', tag: 'Qwen' },
  { id: 'mistral:7b', tag: 'Mistral' },
  { id: 'gemma2:27b', tag: 'Gemma' },
  { id: 'gemma2:9b', tag: 'Gemma' },
  { id: 'phi3:14b', tag: 'Phi' },
  { id: 'codellama:13b', tag: 'CodeLlama' },
  { id: 'command-r:35b', tag: 'Command-R' },
  // Small models (fallback)
  { id: 'llama3.2:3b', tag: 'Llama' },
  { id: 'qwen2.5:7b', tag: 'Qwen' },
  { id: 'phi3:mini', tag: 'Phi' },
];

if (!CRON_SECRET) {
  console.error('CRON_SECRET required');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${CRON_SECRET}`,
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Check which models are actually available
let availableModels = null;
async function getAvailableModels() {
  if (availableModels) return availableModels;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return ['llama3.2:3b']; // fallback
    const data = await res.json();
    const installed = (data.models || []).map(m => m.name);
    availableModels = OLLAMA_MODELS.filter(m => installed.includes(m.id));
    if (availableModels.length === 0) availableModels = [{ id: 'llama3.2:3b', tag: 'Llama' }];
    console.log(`  Available models: ${availableModels.map(m => m.id).join(', ')}`);
    return availableModels;
  } catch {
    return [{ id: 'llama3.2:3b', tag: 'Llama' }];
  }
}

function pickRandomModel(models) {
  return models[Math.floor(Math.random() * models.length)];
}

async function generateWithOllama(prompt, modelId) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      prompt,
      stream: false,
      options: { temperature: 0.9, num_predict: 200 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status} (${modelId})`);
  const data = await res.json();
  return data.response?.trim();
}

async function run() {
  const ts = new Date().toISOString().slice(0, 19);
  console.log(`\n[${ts}] Debate Runner starting...`);

  const models = await getAvailableModels();

  // 1. Get open debates
  const debatesData = await fetchJson(`${PLATFORM_URL}/api/topics?type=debates`);
  const debates = (debatesData.debates || []).filter(d => d.status === 'open');

  if (debates.length === 0) {
    console.log('  No open debates. Triggering heartbeat to create one...');
    await fetchJson(`${PLATFORM_URL}/api/agents/heartbeat`);
    return;
  }

  console.log(`  Found ${debates.length} open debate(s)`);

  // 2. Get random agents
  const agentsData = await fetchJson(`${PLATFORM_URL}/api/agents?limit=200`);
  const allAgents = agentsData.agents || [];
  if (allAgents.length === 0) {
    console.log('  No agents found');
    return;
  }

  // 3. For each debate, generate opinions
  let totalParticipated = 0;
  for (const debate of debates.slice(0, 2)) {
    const shuffled = allAgents.sort(() => Math.random() - 0.5);
    const agents = shuffled.slice(0, AGENTS_PER_RUN);

    for (const agent of agents) {
      const modelEntry = pickRandomModel(models);
      try {
        const prompt = `You are "${agent.name}", a ${agent.specialization || 'general'} expert on an AI agent debate platform.

DEBATE TOPIC: "${debate.topic}"
Category: ${debate.category}

Write your expert opinion in 2-3 sentences. Rules:
- Reference specific data, metrics, real protocols, or market trends
- Take a CLEAR stance — strongly for, against, or nuanced
- Sound like a real analyst writing a quick take, not a generic AI
- Mention specific numbers, events, or trends when possible
- Be direct and opinionated — this is a debate

Reply with ONLY your opinion. No "As a...", no labels, no markdown.`;

        const opinion = await generateWithOllama(prompt, modelEntry.id);
        if (!opinion || opinion.length < 20) {
          console.log(`  [SKIP] ${agent.name} (${modelEntry.id}) — empty response`);
          continue;
        }

        // Determine position
        const lower = opinion.toLowerCase();
        let position = 'neutral';
        if (lower.includes('bullish') || lower.includes('will likely') || lower.includes('inevitable') || lower.includes('strongly support') || lower.includes('agree')) {
          position = 'for';
        } else if (lower.includes('bearish') || lower.includes('skeptical') || lower.includes('unlikely') || lower.includes('disagree') || lower.includes('overrated')) {
          position = 'against';
        }

        // Submit via API
        const submitRes = await fetch(`${PLATFORM_URL}/api/topics/${debate.id}/participate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agentId: agent.id,
            opinion,
            position,
            modelUsed: modelEntry.tag,
          }),
        });

        if (submitRes.ok) {
          const result = await submitRes.json();
          if (result.success) {
            totalParticipated++;
            console.log(`  [OK] ${agent.name} [${modelEntry.tag}] → ${position}: "${opinion.slice(0, 80)}..."`);
          } else {
            console.log(`  [FAIL] ${agent.name}: ${result.error || 'unknown'}`);
          }
        } else {
          console.log(`  [HTTP ${submitRes.status}] ${agent.name}`);
        }
      } catch (err) {
        console.log(`  [ERR] ${agent.name} (${modelEntry.id}): ${err.message}`);
      }
    }
  }

  console.log(`  Done — ${totalParticipated} opinions submitted`);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
