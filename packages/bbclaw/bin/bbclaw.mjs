#!/usr/bin/env node

/**
 * BBClaw CLI — BoredBrain Agent Framework
 *
 * Register, manage, and invoke AI agents on the BoredBrain network.
 *
 * Usage:
 *   bbclaw register   Register a new agent (wallet signature required)
 *   bbclaw status     Check agent status and BBAI balance
 *   bbclaw invoke     Invoke an agent on the network
 *   bbclaw discover   List available agents
 *   bbclaw version    Show version
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VERSION = '0.1.0';
const API_BASE = process.env.BBCLAW_API || 'https://boredbrain.app/api';
const CONFIG_DIR = join(homedir(), '.bbclaw');
const CONFIG_PATH = join(CONFIG_DIR, 'agent.json');

function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort')) throw new Error('Request timed out');
    throw err;
  }
}

function printBanner() {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║  BBClaw — BoredBrain Agent Framework ║');
  console.log('  ║  Web 4.0 Agentic Intelligence        ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdRegister(args) {
  printBanner();

  let name = getArg(args, '--name') || (await prompt('Agent name: '));
  let wallet = getArg(args, '--wallet') || (await prompt('Wallet address (0x...): '));
  let key = getArg(args, '--key') || (await prompt('Private key (for signing, never sent to server): '));
  let spec = getArg(args, '--specialization') || getArg(args, '--spec') || (await prompt('Specialization (trading/defi/research/security/general): '));
  let desc = getArg(args, '--description') || getArg(args, '--desc') || (await prompt('Description: '));
  let endpoint = getArg(args, '--endpoint') || '';
  let agentCardUrl = getArg(args, '--agent-card') || '';

  if (!name || !wallet) {
    console.error('ERROR: Name and wallet address are required.');
    process.exit(1);
  }

  if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('ERROR: Invalid wallet address. Must be 0x + 40 hex characters.');
    process.exit(1);
  }

  // Sign registration message
  const timestamp = Date.now();
  const message = [
    'BoredBrain Agent Registration',
    '',
    `Wallet: ${wallet.toLowerCase()}`,
    `Agent: ${name}`,
    `Timestamp: ${Math.floor(timestamp / 1000)}`,
    `Chain: BNB Smart Chain (56)`,
    '',
    'By signing this message, you confirm registration of the above agent.',
    'This does not trigger a blockchain transaction or cost any gas.',
  ].join('\n');

  let signature;

  if (key) {
    try {
      const { privateKeyToAccount } = await import('viem/accounts');
      const formattedKey = key.startsWith('0x') ? key : `0x${key}`;
      const account = privateKeyToAccount(formattedKey);

      // Verify the key matches the wallet
      if (account.address.toLowerCase() !== wallet.toLowerCase()) {
        console.error(`ERROR: Private key does not match wallet address.`);
        console.error(`  Key address: ${account.address}`);
        console.error(`  Provided:    ${wallet}`);
        process.exit(1);
      }

      signature = await account.signMessage({ message });
      console.log('>> Wallet signature created successfully');
    } catch (err) {
      if (err.message?.includes('does not match')) throw err;
      console.error(`ERROR: Failed to sign message: ${err.message}`);
      console.error('Make sure viem is installed: npm install -g @boredbrain/bbclaw');
      process.exit(1);
    }
  } else {
    console.log('>> No private key provided.');
    console.log(`>> Complete registration at: https://boredbrain.app/agents/register`);
    saveConfig({ name, wallet, specialization: spec || 'general', api: API_BASE });
    console.log(`Config saved to ${CONFIG_PATH}`);
    return;
  }

  console.log(`\n>> Registering agent "${name}" on BoredBrain network...`);

  try {
    const { ok, data } = await apiFetch('/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: desc || `${name} — registered via BBClaw CLI`,
        ownerAddress: wallet,
        specialization: spec || 'general',
        tools: [],
        isDemo: args.includes('--demo'),
        stakingAmount: 0,
        signature,
        message,
        timestamp,
        endpoint: endpoint || undefined,
        agentCardUrl: agentCardUrl || undefined,
      }),
    });

    if (ok && data.data?.agent) {
      const agent = data.data.agent;
      const config = {
        agentId: agent.id,
        name,
        wallet,
        specialization: spec || 'general',
        description: desc || '',
        status: agent.status,
        api: API_BASE,
        registeredAt: agent.registeredAt,
      };
      saveConfig(config);

      console.log('');
      console.log('  ✅ Agent registered successfully!');
      console.log('');
      console.log(`  Agent ID:  ${agent.id}`);
      console.log(`  Name:      ${name}`);
      console.log(`  Status:    ${agent.status}`);
      console.log(`  Wallet:    ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
      if (data.data.rewardAwarded) {
        console.log(`  Reward:    +${data.data.rewardAmount || 1000} BBAI`);
      }
      if (data.data.verification?.verified) {
        console.log(`  Verified:  ✓`);
      }
      console.log('');
      console.log(`  Config saved to ${CONFIG_PATH}`);
      console.log(`  View agent: https://boredbrain.app/agents/${agent.id}`);
      console.log('');
    } else {
      console.error(`\nERROR: ${data.error || data.message || 'Registration failed'}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\nERROR: Could not reach API — ${err.message}`);
    saveConfig({ name, wallet, specialization: spec || 'general', api: API_BASE });
    console.log(`Config saved locally to ${CONFIG_PATH}`);
    console.log(`Complete at: https://boredbrain.app/agents/register`);
    process.exit(1);
  }
}

async function cmdStatus(args) {
  const config = loadConfig();
  if (!config) {
    console.log('No agent configured. Run: bbclaw register');
    return;
  }

  console.log('');
  console.log(`  Agent:    ${config.name || 'Unknown'}`);
  console.log(`  Wallet:   ${config.wallet || 'Not set'}`);
  console.log(`  Spec:     ${config.specialization || 'general'}`);
  if (config.agentId) {
    console.log(`  ID:       ${config.agentId}`);
    console.log(`  Status:   ${config.status || 'unknown'}`);
  }
  console.log('');

  // Fetch live status
  if (config.agentId) {
    try {
      const { ok, data } = await apiFetch(`/agents/${config.agentId}`, { timeout: 5000 });
      if (ok && data.data) {
        const agent = data.data;
        console.log('  --- Live Status ---');
        console.log(`  Status:      ${agent.status}`);
        console.log(`  Total Calls: ${agent.totalCalls || 0}`);
        console.log(`  Earned:      ${agent.totalEarned || 0} BBAI`);
        console.log(`  ELO Rating:  ${agent.eloRating || 1200}`);
        console.log('');
      }
    } catch {
      console.log('  Could not fetch live status.');
      console.log('');
    }
  }

  // Fetch wallet points
  if (config.wallet) {
    try {
      const { ok, data } = await apiFetch(`/points?wallet=${config.wallet}`, { timeout: 5000 });
      if (ok) {
        console.log('  --- Wallet ---');
        console.log(`  BBAI (BP):   ${data.totalBp || data.data?.totalBp || 0}`);
        console.log(`  Level:       ${data.title || data.data?.title || 'Newbie'}`);
        console.log('');
      }
    } catch {}
  }
}

async function cmdInvoke(args) {
  const config = loadConfig();
  const agentId = getArg(args, '--agent') || (await prompt('Agent ID to invoke: '));
  const query = getArg(args, '--query') || args.filter((a) => !a.startsWith('--')).join(' ') || (await prompt('Query: '));

  if (!agentId || !query) {
    console.error('Usage: bbclaw invoke --agent <id> --query "your question"');
    process.exit(1);
  }

  console.log(`\n>> Invoking agent ${agentId}...`);

  try {
    const payload = { query };
    if (config?.wallet) payload.callerAddress = config.wallet;

    const { ok, data } = await apiFetch(`/agents/${agentId}/invoke`, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: 30000,
    });

    const result = data.data?.result || data;
    if (ok && (result.response || result.content)) {
      console.log('');
      console.log(`  ── Response from ${result.agentName || agentId} ──`);
      console.log('');
      console.log(result.response || result.content || 'No response');
      console.log('');
      console.log(`  Model:  ${result.llmModel || result.model || '?'}`);
      console.log(`  Tokens: ${result.tokensUsed || '?'}`);
      if (result.cost) console.log(`  Cost:   ${result.cost} ${result.costUnit || 'BBAI'}`);
      console.log('');
    } else {
      console.error(`\nERROR: ${data.error || data.message || 'Invoke failed'}`);
    }
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
  }
}

async function cmdDiscover(args) {
  const limit = getArg(args, '--limit') || '20';
  const spec = getArg(args, '--spec') || getArg(args, '--specialization') || '';

  console.log('\n>> Discovering agents on BoredBrain network...\n');

  try {
    let path = `/agents/discover?limit=${limit}`;
    if (spec) path += `&specialization=${spec}`;

    const { ok, data } = await apiFetch(path, { timeout: 10000 });

    if (ok && (data.agents || data.data?.agents)) {
      const agents = data.agents || data.data.agents;
      if (agents.length === 0) {
        console.log('  No agents found.');
        return;
      }

      console.log(`  Found ${agents.length} agent(s):\n`);
      for (const a of agents) {
        const status = a.status === 'verified' ? '✓' : a.status === 'active' ? '●' : '○';
        console.log(`  ${status} ${a.name}`);
        console.log(`    ID:   ${a.id}`);
        console.log(`    Spec: ${a.specialization || 'general'}  |  Calls: ${a.totalCalls || 0}  |  ELO: ${a.eloRating || 1200}`);
        if (a.description) console.log(`    ${a.description.slice(0, 80)}${a.description.length > 80 ? '...' : ''}`);
        console.log('');
      }
    } else {
      console.error(`ERROR: ${data.error || 'Discovery failed'}`);
    }
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
  }
}

function cmdVersion() {
  console.log(`BBClaw v${VERSION} — BoredBrain Agent Framework`);
  console.log('https://boredbrain.app');
}

function cmdHelp() {
  printBanner();
  console.log('  Usage:');
  console.log('    bbclaw register                          Register a new agent');
  console.log('    bbclaw status                            Check agent status & balance');
  console.log('    bbclaw invoke --agent <id> --query <q>   Invoke an agent');
  console.log('    bbclaw discover [--spec <type>]          List available agents');
  console.log('    bbclaw version                           Show version');
  console.log('    bbclaw help                              Show this help');
  console.log('');
  console.log('  Register options:');
  console.log('    --name <name>           Agent name');
  console.log('    --wallet <0x...>        Wallet address');
  console.log('    --key <0x...>           Private key (for signing, never sent to server)');
  console.log('    --spec <type>           Specialization (trading/defi/research/...)');
  console.log('    --desc <text>           Description');
  console.log('    --endpoint <url>        Agent endpoint URL');
  console.log('    --agent-card <url>      Agent card JSON URL');
  console.log('    --demo                  Register as demo agent (free, 50 calls/day)');
  console.log('');
  console.log('  Environment:');
  console.log('    BBCLAW_API              Override API base URL');
  console.log('');
  console.log('  Config:  ~/.bbclaw/agent.json');
  console.log('  Docs:    https://boredbrain.app/docs');
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);

const commands = {
  register: cmdRegister,
  status: cmdStatus,
  invoke: cmdInvoke,
  discover: cmdDiscover,
  version: cmdVersion,
  '--version': cmdVersion,
  '-v': cmdVersion,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
};

if (!cmd || !(cmd in commands)) {
  if (cmd) console.error(`Unknown command: ${cmd}\n`);
  cmdHelp();
  process.exit(cmd ? 1 : 0);
} else {
  const result = commands[cmd](args);
  if (result && typeof result.catch === 'function') {
    result.catch((err) => {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    });
  }
}
