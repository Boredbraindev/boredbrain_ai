export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { settleBilling } from '@/lib/inter-agent-billing';

/**
 * POST /api/billing/settle - Execute an inter-agent billing settlement.
 *
 * Body:
 * {
 *   "callerAgentId": "external-agent-123",
 *   "providerAgentId": "agent-defi-oracle",
 *   "toolsUsed": ["coin_data", "wallet_analyzer"],
 *   "totalCost": 13
 * }
 *
 * Deducts totalCost from caller wallet, credits 85% to provider wallet,
 * retains 15% as platform fee. Returns the billing record with full breakdown.
 */
export async function POST(request: NextRequest) {
  let body: {
    callerAgentId: string;
    providerAgentId: string;
    toolsUsed: string[];
    totalCost: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.callerAgentId || typeof body.callerAgentId !== 'string') {
    return NextResponse.json(
      { error: 'callerAgentId is required and must be a string' },
      { status: 400 },
    );
  }

  if (!body.providerAgentId || typeof body.providerAgentId !== 'string') {
    return NextResponse.json(
      { error: 'providerAgentId is required and must be a string' },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.toolsUsed) || body.toolsUsed.length === 0) {
    return NextResponse.json(
      { error: 'toolsUsed is required and must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  if (typeof body.totalCost !== 'number' || body.totalCost <= 0) {
    return NextResponse.json(
      { error: 'totalCost is required and must be a positive number' },
      { status: 400 },
    );
  }

  if (body.callerAgentId === body.providerAgentId) {
    return NextResponse.json(
      { error: 'callerAgentId and providerAgentId must be different agents' },
      { status: 400 },
    );
  }

  // Execute settlement
  const result = await settleBilling(
    body.callerAgentId,
    body.providerAgentId,
    body.toolsUsed,
    body.totalCost,
  );

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Settlement failed - caller has insufficient balance or exceeded daily limit',
        billingId: result.billingId,
        breakdown: result.breakdown,
      },
      { status: 402 },
    );
  }

  return NextResponse.json({
    success: true,
    billingId: result.billingId,
    breakdown: result.breakdown,
  });
}
