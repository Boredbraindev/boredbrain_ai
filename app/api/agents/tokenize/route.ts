import { NextRequest, NextResponse } from 'next/server';
import { tokenizeAgent, getAgentTokens } from '@/lib/agent-tokenization';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, tokenSymbol, tokenName, chain } = body;

    if (!agentId || !tokenSymbol || !tokenName) {
      return NextResponse.json({ error: 'agentId, tokenSymbol, and tokenName are required' }, { status: 400 });
    }

    const token = await tokenizeAgent({ agentId, tokenSymbol, tokenName, chain });
    return NextResponse.json({ token }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Tokenization failed' }, { status: 400 });
  }
}

export async function GET() {
  try {
    const tokens = await getAgentTokens();
    return NextResponse.json({ tokens }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    return NextResponse.json({ tokens: [], error: error.message }, { status: 200 });
  }
}
