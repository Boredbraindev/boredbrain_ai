export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// ── Point values for each action ─────────────────────────────────────────────

const POINT_VALUES: Record<string, number> = {
  forecast_entry: 10,
  arena_watch: 5,
  arena_stake_win: 50,
  agent_invoke: 20,
  agent_register: 100,
  daily_login: 10,
  streak_3: 30,
  streak_7: 100,
  streak_14: 200,
  streak_30: 500,
  streak_60: 1500,
  provider_called: 15,
  owner_bonus: 5,
  invoke_unique_agent: 5,
  invoke_loyalty_5x: 15,
  first_invocation: 50,
  maker_quality_bonus: 25,
  uptime_reward: 0,
  loser_points: 5,
  loser_comeback: 50,
  debate_vote: 10,
  first_blood: 25,
  contrarian_win: 30,
  proximity_bonus: 0,
  resurrection: 75,
  season_loyalty: 500,
  loyalty_bonus: 15,
  agent_stake: 0,
  bp_topup: 0,
  pro_daily_drip: 10,
  debate_stake: 0,
  agent_invoke_premium: 0,
  agent_boost: 0,
};

// ── Level thresholds ─────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, minBp: 0, title: 'Newbie' },
  { level: 5, minBp: 500, title: 'Trader' },
  { level: 10, minBp: 2000, title: 'Analyst' },
  { level: 20, minBp: 10000, title: 'Strategist' },
  { level: 30, minBp: 50000, title: 'Whale' },
  { level: 50, minBp: 200000, title: 'OG' },
];

function getLevelInfo(bp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1] ?? LEVELS[0];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bp >= LEVELS[i].minBp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? LEVELS[i];
      break;
    }
  }

  const progressRange = next.minBp - current.minBp;
  const progress =
    progressRange > 0
      ? Math.min(100, Math.floor(((bp - current.minBp) / progressRange) * 100))
      : 100;

  return {
    level: current.level,
    title: current.title,
    nextLevel: next.level,
    nextLevelBp: next.minBp,
    progress,
  };
}

// ── GET /api/points?wallet=0x... ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'wallet query parameter is required' }, { status: 400 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      const defaultLevel = getLevelInfo(0);
      return NextResponse.json({
        success: true,
        data: {
          points: { totalBp: 0, level: 1, title: 'Newbie', streakDays: 0, rank: 0, ...defaultLevel },
          history: [],
        },
      });
    }

    const sql = neon(dbUrl);

    // Fetch user points
    let totalBp = 0;
    let level = 1;
    let streakDays = 0;
    let rank = 0;

    try {
      const pointsRows = await sql`
        SELECT total_bp, level, streak_days
        FROM user_points
        WHERE wallet_address = ${wallet}
        LIMIT 1
      `;

      if (pointsRows.length > 0) {
        totalBp = pointsRows[0].total_bp ?? 0;
        level = pointsRows[0].level ?? 1;
        streakDays = pointsRows[0].streak_days ?? 0;

        // Calculate rank
        const rankRows = await sql`
          SELECT count(*) as count
          FROM user_points
          WHERE total_bp > ${totalBp}
        `;
        rank = (Number(rankRows[0]?.count) ?? 0) + 1;
      }
    } catch (err) {
      console.error('[points] user query error:', err);
    }

    const levelInfo = getLevelInfo(totalBp);

    // Fetch history
    let history: Array<{ amount: number; reason: string; createdAt: string | null }> = [];
    try {
      const historyRows = await sql`
        SELECT amount, reason, created_at
        FROM point_transaction
        WHERE wallet_address = ${wallet}
        ORDER BY created_at DESC
        LIMIT 20
      `;
      history = historyRows.map((r) => ({
        amount: r.amount ?? 0,
        reason: r.reason ?? '',
        createdAt: r.created_at ? String(r.created_at) : null,
      }));
    } catch (err) {
      console.error('[points] history query error:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        points: {
          totalBp,
          level: levelInfo.level,
          title: levelInfo.title,
          streakDays,
          rank,
          nextLevel: levelInfo.nextLevel,
          nextLevelBp: levelInfo.nextLevelBp,
          progress: levelInfo.progress,
        },
        history,
      },
    });
  } catch (err) {
    console.error('[points] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch points' }, { status: 500 });
  }
}

// ── POST /api/points ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const walletAddress = body.walletAddress as string | undefined;
    const reason = body.reason as string | undefined;
    const referenceId = body.referenceId as string | undefined;

    if (!walletAddress) {
      return NextResponse.json({ success: false, error: 'walletAddress is required' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ success: false, error: 'reason is required' }, { status: 400 });
    }

    if (!(reason in POINT_VALUES)) {
      return NextResponse.json(
        { success: false, error: `Invalid reason. Supported: ${Object.keys(POINT_VALUES).join(', ')}` },
        { status: 400 },
      );
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ success: true, data: { awarded: 0, newTotal: 0, levelUp: false } });
    }

    const sql = neon(dbUrl);
    const bp = POINT_VALUES[reason] ?? 0;
    if (bp === 0) {
      return NextResponse.json({ success: true, data: { awarded: 0, newTotal: 0, levelUp: false } });
    }

    let newTotal = 0;
    let levelUp = false;

    try {
      // Insert transaction
      await sql`
        INSERT INTO point_transaction (wallet_address, amount, reason, reference_id)
        VALUES (${walletAddress}, ${bp}, ${reason}, ${referenceId ?? null})
      `;

      // Check existing user points
      const existing = await sql`
        SELECT total_bp, level
        FROM user_points
        WHERE wallet_address = ${walletAddress}
        LIMIT 1
      `;

      let oldLevel = 1;

      if (existing.length === 0) {
        newTotal = bp;
        const levelInfo = getLevelInfo(newTotal);
        await sql`
          INSERT INTO user_points (wallet_address, total_bp, level)
          VALUES (${walletAddress}, ${newTotal}, ${levelInfo.level})
          ON CONFLICT (wallet_address) DO UPDATE
          SET total_bp = user_points.total_bp + ${bp},
              level = ${levelInfo.level}
        `;
      } else {
        oldLevel = existing[0].level ?? 1;
        newTotal = (existing[0].total_bp ?? 0) + bp;
        const levelInfo = getLevelInfo(newTotal);
        await sql`
          UPDATE user_points
          SET total_bp = ${newTotal}, level = ${levelInfo.level}
          WHERE wallet_address = ${walletAddress}
        `;
      }

      const newLevel = getLevelInfo(newTotal).level;
      levelUp = newLevel > oldLevel;
    } catch (err) {
      console.error('[points] award error:', err);
      return NextResponse.json({ success: true, data: { awarded: 0, newTotal: 0, levelUp: false } });
    }

    return NextResponse.json({
      success: true,
      data: {
        awarded: bp,
        newTotal,
        levelUp,
      },
    });
  } catch (err) {
    console.error('[points] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to award points' }, { status: 500 });
  }
}
