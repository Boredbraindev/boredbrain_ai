export const maxDuration = 10;

/**
 * POST /api/topics/settle — Auto-settle completed debates.
 *
 * For debates linked to Polymarket: checks if the Polymarket event has resolved,
 * then distributes the prize pool to agents who picked the winning side.
 *
 * For debates without Polymarket link: uses LLM scoring (existing system).
 *
 * Called by heartbeat cron or manually.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';
import { verifyCron } from '@/lib/verify-cron';

const GAMMA_API = 'https://gamma-api.polymarket.com';

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * Check Polymarket event resolution status.
 * Returns the winning outcome string or null if not yet resolved.
 */
async function checkPolymarketResolution(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GAMMA_API}/events/${eventId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const event = await res.json();
    if (!event.closed && event.active !== false) return null;

    const markets = event.markets ?? [];
    if (markets.length === 0) return null;

    if (markets.length === 1) {
      const m = markets[0];
      if (m.resolved) {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
        if (Array.isArray(prices)) {
          const yesPrice = parseFloat(prices[0]);
          return yesPrice > 0.5 ? 'Yes' : 'No';
        }
      }
      return null;
    }

    for (const m of markets) {
      if (m.resolved) {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
        if (Array.isArray(prices) && parseFloat(prices[0]) > 0.9) {
          return m.groupItemTitle ?? m.question ?? 'Yes';
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Map Polymarket outcome to debate position.
 */
function outcomeToPosition(outcome: string): 'for' | 'against' | 'neutral' {
  const lower = outcome.toLowerCase();
  if (lower === 'yes' || lower === 'true') return 'for';
  if (lower === 'no' || lower === 'false') return 'against';
  return 'neutral';
}

// ── Inline helper: generate deterministic wallet address ──────────────────
function generateWalletAddress(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

// ── Inline: topUpWallet via raw SQL ─────────────────────────────────────────
async function topUpWalletEdge(sql: any, agentId: string, amount: number): Promise<void> {
  const wallets = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  if (wallets.length === 0) throw new Error(`Wallet not found for agent: ${agentId}`);
  if (amount <= 0) throw new Error('Top-up amount must be positive');

  const newBalance = wallets[0].balance + amount;
  await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${agentId}`;
  await sql`
    INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
    VALUES (${generateId()}, ${agentId}, ${amount}, 'credit', 'Wallet top-up', ${newBalance})
  `;
}

// ── Inline: getAgentWallet via raw SQL ──────────────────────────────────────
async function getAgentWalletEdge(sql: any, agentId: string) {
  const rows = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  return rows.length > 0 ? rows[0] : null;
}

// ── Inline: createAgentWallet via raw SQL ───────────────────────────────────
async function createAgentWalletEdge(
  sql: any,
  agentId: string,
  dailyLimit: number = 50,
  initialBalance: number = 50,
) {
  const existing = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  if (existing.length > 0) return existing[0];

  const address = generateWalletAddress(agentId);
  const rows = await sql`
    INSERT INTO agent_wallet (id, agent_id, address, balance, daily_limit, total_spent, is_active)
    VALUES (${generateId()}, ${agentId}, ${address}, ${initialBalance}, ${dailyLimit}, 0, true)
    RETURNING *
  `;
  await sql`
    INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
    VALUES (${generateId()}, ${agentId}, ${initialBalance}, 'credit', 'Initial wallet funding', ${initialBalance})
  `;
  return rows[0];
}

// ── Inline: awardPoints via raw SQL ─────────────────────────────────────────
function getLevelFromBp(bp: number): number {
  if (bp >= 200000) return 50;
  if (bp >= 50000) return 30;
  if (bp >= 10000) return 20;
  if (bp >= 2000) return 10;
  if (bp >= 500) return 5;
  return 1;
}

async function awardPointsEdge(
  sql: any,
  walletAddress: string,
  reason: string,
  referenceId?: string,
  customAmount?: number,
): Promise<void> {
  try {
    const bp = customAmount ?? 0;
    if (bp === 0) return;

    await sql`
      INSERT INTO point_transaction (wallet_address, amount, reason, reference_id)
      VALUES (${walletAddress}, ${bp}, ${reason}, ${referenceId ?? null})
    `;

    const existing = await sql`
      SELECT * FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;

    if (existing.length === 0) {
      const level = getLevelFromBp(bp);
      await sql`
        INSERT INTO user_points (wallet_address, total_bp, level)
        VALUES (${walletAddress}, ${bp}, ${level})
      `;
    } else {
      const newTotal = existing[0].total_bp + bp;
      const level = getLevelFromBp(newTotal);
      await sql`
        UPDATE user_points SET total_bp = ${newTotal}, level = ${level}
        WHERE wallet_address = ${walletAddress}
      `;
    }
  } catch (err) {
    console.error('[points] awardPoints error:', err);
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Find debates that have a Polymarket link but no resolved outcome yet
    // Excludes 'settled' (already done) and 'closed' (duplicates/manually closed)
    // Note: we don't filter by closes_at because Polymarket can resolve early
    const unsettledDebates = await sql`
      SELECT * FROM topic_debate
      WHERE polymarket_event_id IS NOT NULL
        AND resolved_outcome IS NULL
        AND status IN ('open', 'scoring', 'completed')
      LIMIT 10
    `;

    let settled = 0;
    const results: { debateId: string; topic: string; outcome: string; winnersCount: number; poolDistributed: number; stakesSettled?: number }[] = [];

    // Ensure settlement_log table exists
    await sql`
      CREATE TABLE IF NOT EXISTS settlement_log (
        id TEXT PRIMARY KEY,
        debate_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        winning_outcome TEXT,
        total_pool REAL DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        tx_hash TEXT,
        settled_by TEXT,
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    for (const debate of unsettledDebates) {
      if (!debate.polymarket_event_id) continue;

      const outcome = await checkPolymarketResolution(debate.polymarket_event_id);
      if (!outcome) continue;

      // Get all opinions for this debate
      const opinions = await sql`
        SELECT * FROM debate_opinion WHERE debate_id = ${debate.id}
      `;

      if (opinions.length === 0) continue;

      // Generate a settlement log ID
      const logId = `stl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Insert settlement log — status: scoring
      try {
        await sql`
          INSERT INTO settlement_log (id, debate_id, topic, status, participant_count, settled_by, created_at)
          VALUES (${logId}, ${debate.id}, ${(debate.topic ?? '').slice(0, 200)}, 'scoring', ${opinions.length}, 'settlement-agent', NOW())
        `;
      } catch {
        // Non-critical — settlement continues even if log fails
      }

      // Determine winning position
      const winningPosition = outcomeToPosition(outcome);

      // Find winners (agents who picked the right side)
      const winners = opinions.filter((o: any) => o.position === winningPosition);
      const losers = opinions.filter((o: any) => o.position !== winningPosition);

      // Calculate pool
      const pool = debate.total_pool ?? (opinions.length * 2);

      // Distribute pool to winners
      let distributed = 0;
      if (winners.length > 0) {
        const sharePerWinner = Math.floor(pool / winners.length);

        for (const winner of winners) {
          try {
            // Ensure wallet exists
            let wallet = await getAgentWalletEdge(sql, winner.agent_id);
            if (!wallet) {
              wallet = await createAgentWalletEdge(sql, winner.agent_id, 500, 0);
            }
            await topUpWalletEdge(sql, winner.agent_id, sharePerWinner);
            distributed += sharePerWinner;

            // Award bonus BP
            await awardPointsEdge(
              sql,
              winner.agent_id,
              'arena_stake_win',
              debate.id,
              sharePerWinner,
            );
          } catch {
            // Non-critical, continue with other winners
          }
        }
      }

      // ── Settle user stakes ──────────────────────────────────────────
      let stakesSettled = 0;
      try {
        const allStakes = await sql`
          SELECT * FROM debate_stake
          WHERE debate_id = ${debate.id} AND status = 'active'
        `;

        if (allStakes.length > 0) {
          const winnerAgentIds = new Set(winners.map((w: any) => w.agent_id));
          const totalStakePool = allStakes.reduce((sum: number, s: any) => sum + s.amount, 0);
          const winningStakes = allStakes.filter((s: any) => winnerAgentIds.has(s.agent_id));
          const losingStakes = allStakes.filter((s: any) => !winnerAgentIds.has(s.agent_id));

          const winningTotal = winningStakes.reduce((sum: number, s: any) => sum + s.amount, 0);

          // Distribute pool to winning stakers proportionally
          for (const stake of winningStakes) {
            const share = winningTotal > 0
              ? Math.floor((stake.amount / winningTotal) * totalStakePool)
              : stake.amount;
            try {
              await awardPointsEdge(sql, stake.wallet_address, 'arena_stake_win', debate.id, share);
              await sql`
                UPDATE debate_stake
                SET status = 'won', payout = ${share}, settled_at = NOW()
                WHERE id = ${stake.id}
              `;
              stakesSettled++;
            } catch {
              // Non-critical
            }
          }

          // Mark losing stakes
          for (const stake of losingStakes) {
            try {
              await sql`
                UPDATE debate_stake
                SET status = 'lost', payout = 0, settled_at = NOW()
                WHERE id = ${stake.id}
              `;
            } catch {
              // Non-critical
            }
          }
        }
      } catch {
        // Stake settlement non-critical
      }

      // Update debate record — use 'settled' status for Polymarket-resolved debates
      await sql`
        UPDATE topic_debate
        SET resolved_outcome = ${outcome}, status = 'settled'
        WHERE id = ${debate.id}
      `;

      // ── On-chain settlement: record to PredictionSettlement contract ──
      let txHash: string | null = null;
      const operatorKey = process.env.SETTLEMENT_OPERATOR_KEY || process.env.DEPLOYER_PRIVATE_KEY;
      const settlementContract = '0x0ae8A0cE8A34155508F4C47b41B20A668A0a5600';

      if (operatorKey && operatorKey !== '0x' + '0'.repeat(64)) {
        try {
          const { createWalletClient, createPublicClient, http, parseAbi } = await import('viem');
          const { privateKeyToAccount } = await import('viem/accounts');
          const { bsc } = await import('viem/chains');

          const account = privateKeyToAccount(operatorKey as `0x${string}`);
          const client = createWalletClient({ account, chain: bsc, transport: http('https://bsc-dataseed.binance.org') });
          const publicClient = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

          // Use debate creation timestamp hash as roundId
          const roundId = BigInt(Date.now());
          const asset = debate.category || 'general';
          const startPrice = BigInt(0); // prediction topics don't have price
          const endPrice = BigInt(0);
          const outcomeDir = outcome.toLowerCase() === 'yes' || outcome.toLowerCase() === 'true' ? 0 : 1;

          const hash = await client.writeContract({
            address: settlementContract as `0x${string}`,
            abi: parseAbi([
              'function settleRound(uint256,string,uint256,uint256,uint8,uint256,uint256,uint256) external',
            ]),
            functionName: 'settleRound',
            args: [
              roundId,
              asset,
              startPrice,
              endPrice,
              outcomeDir,
              BigInt(Math.round(pool * 0.6)), // upPool estimate
              BigInt(Math.round(pool * 0.4)), // downPool estimate
              BigInt(opinions.length),
            ],
          });

          await publicClient.waitForTransactionReceipt({ hash });
          txHash = hash;
        } catch (onchainErr) {
          // On-chain settlement is non-critical — log and continue
          console.error('[settle] On-chain error:', onchainErr instanceof Error ? onchainErr.message : onchainErr);
        }
      }

      // Update settlement log — status: settled
      try {
        await sql`
          UPDATE settlement_log
          SET status = 'settled',
              winning_outcome = ${outcome},
              total_pool = ${distributed},
              participant_count = ${opinions.length},
              tx_hash = ${txHash},
              settled_at = NOW()
          WHERE id = ${logId}
        `;
      } catch {
        // Non-critical
      }

      settled++;
      results.push({
        debateId: debate.id,
        topic: debate.topic.slice(0, 60),
        outcome,
        winnersCount: winners.length,
        poolDistributed: distributed,
        stakesSettled,
        txHash,
      } as any);
    }

    return apiSuccess({
      settled,
      checked: unsettledDebates.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Settlement failed: ${msg}`, 500);
  }
}
