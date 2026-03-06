import { NextRequest, NextResponse } from 'next/server';
import { tradeAgentToken, getTokenTradeHistory } from '@/lib/agent-tokenization';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, traderId, type, amount } = body;

    if (!tokenId || !traderId || !type || !amount) {
      return NextResponse.json({ error: 'tokenId, traderId, type, and amount are required' }, { status: 400 });
    }

    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json({ error: 'type must be buy or sell' }, { status: 400 });
    }

    const trade = await tradeAgentToken({ tokenId, traderId, type, amount: Number(amount) });
    return NextResponse.json({ trade }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Trade failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get('tokenId');

  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId query param required' }, { status: 400 });
  }

  try {
    const trades = await getTokenTradeHistory(tokenId);
    return NextResponse.json({ trades });
  } catch (error: any) {
    return NextResponse.json({ trades: [], error: error.message }, { status: 200 });
  }
}
