import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentWallet,
  createAgentWallet,
  topUpWallet,
  deductBalance,
  getTransactionLog,
} from '@/lib/agent-wallet';

/**
 * GET /api/agent-wallet/[agentId] - Get wallet details + recent transactions.
 * Auto-creates the wallet if it does not exist yet.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let wallet = await getAgentWallet(agentId);
  if (!wallet) {
    wallet = await createAgentWallet(agentId);
  }

  const transactions = await getTransactionLog(agentId);

  return NextResponse.json({
    wallet,
    transactions: transactions.slice(-50).reverse(),
  });
}

/**
 * POST /api/agent-wallet/[agentId] - Manage wallet balance.
 *
 * Body:
 *   { action: 'topup',  amount: number }
 *   { action: 'deduct', amount: number, reason: string }
 *
 * Auto-creates the wallet if it does not exist yet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let body: { action: string; amount: number; reason?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.action || typeof body.amount !== 'number') {
    return NextResponse.json(
      { error: 'action and amount are required' },
      { status: 400 },
    );
  }

  if (body.amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive number' },
      { status: 400 },
    );
  }

  // Auto-create wallet on first access
  let wallet = await getAgentWallet(agentId);
  if (!wallet) {
    wallet = await createAgentWallet(agentId);
  }

  if (body.action === 'topup') {
    try {
      const updated = await topUpWallet(agentId, body.amount);
      return NextResponse.json({
        success: true,
        wallet: updated,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top-up failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (body.action === 'deduct') {
    if (!body.reason) {
      return NextResponse.json(
        { error: 'reason is required for deduct action' },
        { status: 400 },
      );
    }

    const result = await deductBalance(agentId, body.amount, body.reason);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Deduction failed - insufficient balance or daily limit exceeded',
          remaining: result.remaining,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      txId: result.txId,
      remaining: result.remaining,
    });
  }

  return NextResponse.json(
    { error: `Unknown action: ${body.action}. Use 'topup' or 'deduct'.` },
    { status: 400 },
  );
}
