#!/usr/bin/env node
/**
 * Seed Topics — Insert 30+ diverse topic_debate records into Neon PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/seed-topics.mjs
 *
 * Or with .env.local:
 *   node -e "require('dotenv').config({path:'.env.local'})" && node scripts/seed-topics.mjs
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
if (!process.env.DATABASE_URL) {
  try {
    let envPath = resolve(ROOT, '.env.local');
    try { readFileSync(envPath); } catch { envPath = resolve(ROOT, '.env.production.local'); }
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch (e) { console.error('Could not load env:', e.message); }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Topic definitions — 35 diverse, engaging topics
// ---------------------------------------------------------------------------

const TOPICS = [
  // crypto_price
  { topic: 'Will Bitcoin hit $200K before 2027?', category: 'crypto' },
  { topic: 'Is Solana a better L1 than Ethereum for DeFi?', category: 'crypto' },
  { topic: 'Will ETH flip BTC in market cap within 5 years?', category: 'crypto' },
  { topic: 'Is the crypto market entering a new supercycle?', category: 'crypto' },
  { topic: 'Will stablecoins replace traditional bank transfers by 2030?', category: 'crypto' },

  // defi
  { topic: 'Are liquid restaking protocols a systemic risk to Ethereum?', category: 'defi' },
  { topic: 'Will DEXs permanently overtake CEXs in trading volume?', category: 'defi' },
  { topic: 'Is yield farming sustainable or just a Ponzi with extra steps?', category: 'defi' },
  { topic: 'Should DeFi protocols implement KYC for regulatory compliance?', category: 'defi' },
  { topic: 'Will real-world asset tokenization be the killer DeFi use case?', category: 'defi' },

  // governance
  { topic: 'Should DAOs have legal entity status?', category: 'governance' },
  { topic: 'Is on-chain governance better than representative democracy?', category: 'governance' },
  { topic: 'Should token voting weight be quadratic instead of linear?', category: 'governance' },
  { topic: 'Do DAO treasuries need professional fund managers?', category: 'governance' },

  // nft
  { topic: 'Are NFTs dead or just evolving into utility tokens?', category: 'culture' },
  { topic: 'Will AI-generated art make human NFT artists obsolete?', category: 'culture' },
  { topic: 'Should NFT royalties be enforced on-chain?', category: 'culture' },

  // gaming
  { topic: 'Will blockchain gaming achieve mainstream adoption by 2027?', category: 'culture' },
  { topic: 'Is play-to-earn a broken economic model?', category: 'culture' },
  { topic: 'Can fully on-chain games compete with traditional AAA titles?', category: 'culture' },

  // ai
  { topic: 'Will AI replace 50% of coding jobs by 2028?', category: 'ai' },
  { topic: 'Should AI agents be allowed to hold and trade crypto autonomously?', category: 'ai' },
  { topic: 'Is AGI achievable within the next decade?', category: 'ai' },
  { topic: 'Will AI-generated content destroy trust in online media?', category: 'ai' },
  { topic: 'Should AI models be open-sourced by law?', category: 'ai' },
  { topic: 'Can AI agents outperform human traders consistently?', category: 'ai' },

  // social
  { topic: 'Is decentralized social media viable without token incentives?', category: 'culture' },
  { topic: 'Will SocialFi replace traditional influencer marketing?', category: 'culture' },
  { topic: 'Should social media platforms share ad revenue with creators on-chain?', category: 'culture' },

  // general / macro
  { topic: 'Is remote work better for innovation than office culture?', category: 'general' },
  { topic: 'Will central bank digital currencies (CBDCs) help or harm financial freedom?', category: 'general' },
  { topic: 'Should nation-states adopt Bitcoin as legal tender?', category: 'general' },
  { topic: 'Is the metaverse dead or just ahead of its time?', category: 'general' },
  { topic: 'Will quantum computing break all current blockchain security?', category: 'general' },
  { topic: 'Should tech companies be broken up for antitrust reasons?', category: 'general' },
  { topic: 'Is proof-of-stake fundamentally more secure than proof-of-work?', category: 'crypto' },
];

// ---------------------------------------------------------------------------
// Status distribution: 60% open, 30% completed, 10% settled (use 'completed' for settled too)
// ---------------------------------------------------------------------------

function pickStatus() {
  const r = Math.random();
  if (r < 0.60) return 'open';
  if (r < 0.90) return 'completed';
  return 'completed'; // "settled" maps to completed in schema
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${TOPICS.length} topics into topic_debate...`);

  let inserted = 0;
  let skipped = 0;

  for (const { topic, category } of TOPICS) {
    // Check if topic already exists to avoid duplicates
    const existing = await sql`
      SELECT id FROM topic_debate WHERE topic = ${topic} LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`  SKIP (exists): ${topic.slice(0, 50)}...`);
      skipped++;
      continue;
    }

    const id = generateId();
    const status = pickStatus();
    const daysOffset = randomInt(0, 21);
    const createdAt = daysAgo(daysOffset);
    const closesAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const totalParticipants = randomInt(2, 8);
    const totalPool = randomInt(50, 500);
    const topScore = status === 'completed' ? randomInt(60, 95) : 0;
    const topAgentId = status === 'completed' ? `agent-${generateId().slice(0, 8)}` : null;

    await sql`
      INSERT INTO topic_debate (id, topic, category, status, created_at, closes_at, total_participants, total_pool, top_score, top_agent_id)
      VALUES (${id}, ${topic}, ${category}, ${status}, ${createdAt.toISOString()}, ${closesAt.toISOString()}, ${totalParticipants}, ${totalPool}, ${topScore}, ${topAgentId})
    `;

    const statusIcon = status === 'open' ? '🟢' : '✅';
    console.log(`  ${statusIcon} ${status.padEnd(10)} [${category.padEnd(10)}] ${topic.slice(0, 60)}`);
    inserted++;
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}, Total topics: ${TOPICS.length}`);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
