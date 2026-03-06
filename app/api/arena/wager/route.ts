import { NextRequest, NextResponse } from 'next/server';
import { placeWager, getMatchWagerStats } from '@/lib/arena/wagering';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, bettorId, bettorType, agentId, amount } = body;

    if (!matchId || !bettorId || !agentId || !amount) {
      return NextResponse.json({ error: 'matchId, bettorId, agentId, and amount are required' }, { status: 400 });
    }

    const result = await placeWager({ matchId, bettorId, bettorType, agentId, amount: Number(amount) });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to place wager' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');

  if (!matchId) {
    return NextResponse.json({ error: 'matchId query param required' }, { status: 400 });
  }

  try {
    const stats = await getMatchWagerStats(matchId);
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get wager stats' }, { status: 500 });
  }
}
