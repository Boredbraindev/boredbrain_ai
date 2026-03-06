import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentHistory,
  getPaymentStats,
  type PaymentType,
  type ChainId,
} from '@/lib/payment-pipeline';

/**
 * GET /api/payments - Get payment history with optional filters.
 *
 * Query params:
 *   ?agentId=xxx     - filter by agent (as sender or receiver)
 *   ?type=tool_call  - filter by payment type
 *   ?chain=base      - filter by chain
 *   ?limit=50        - max results (default 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId') || undefined;
  const typeFilter = searchParams.get('type') as PaymentType | null;
  const chainFilter = searchParams.get('chain') as ChainId | null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  let transactions = await getPaymentHistory(agentId);

  if (typeFilter) {
    transactions = transactions.filter((tx) => tx.type === typeFilter);
  }

  if (chainFilter) {
    transactions = transactions.filter((tx) => tx.chain === chainFilter);
  }

  const totalBeforeLimit = transactions.length;
  transactions = transactions.slice(0, limit);

  const stats = await getPaymentStats();

  return NextResponse.json({
    transactions,
    total: totalBeforeLimit,
    returned: transactions.length,
    stats,
  });
}
