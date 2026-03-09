import { NextRequest, NextResponse } from 'next/server';
import {
  getSmartWallet,
  createSmartWallet,
  buildUserOperation,
  estimateGas,
  signUserOperation,
  executeUserOperation,
} from '@/lib/account-abstraction';

/**
 * GET /api/wallets/smart/[agentId] - Get smart wallet details.
 * Auto-creates the wallet if it does not exist yet.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let wallet = await getSmartWallet(agentId);
  if (!wallet) {
    // Auto-create with default values
    wallet = await createSmartWallet(
      agentId,
      '0x' + '0'.repeat(40), // placeholder owner
      'base',
    );
  }

  return NextResponse.json({
    wallet,
    meta: {
      nonce: wallet.nonce,
      isDeployed: wallet.isDeployed,
      spendingLimits: wallet.spendingLimits,
      guardianCount: wallet.guardians.length,
    },
  });
}

/**
 * POST /api/wallets/smart/[agentId] - Execute a user operation (mock).
 *
 * Body:
 *   {
 *     to: string,        // target contract address
 *     value: number,      // USDT amount
 *     data?: string,      // calldata (hex)
 *   }
 *
 * Returns the mock transaction result.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let body: { to: string; value: number; data?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.to || typeof body.value !== 'number') {
    return NextResponse.json(
      { error: 'to (address) and value (number) are required' },
      { status: 400 },
    );
  }

  let wallet = await getSmartWallet(agentId);
  if (!wallet) {
    wallet = await createSmartWallet(agentId, '0x' + '0'.repeat(40), 'base');
  }

  // Check spending limits
  if (body.value > wallet.spendingLimits.perTransaction) {
    return NextResponse.json(
      {
        error: `Amount ${body.value} exceeds per-transaction limit of ${wallet.spendingLimits.perTransaction}`,
      },
      { status: 400 },
    );
  }

  // Build, estimate, sign, and execute the UserOperation
  const userOp = buildUserOperation(wallet, body.to, body.value, body.data || '0x');
  const gas = estimateGas(userOp);
  userOp.callGasLimit = gas.callGas;
  userOp.verificationGasLimit = gas.verificationGas;
  userOp.preVerificationGas = gas.preVerificationGas;

  const signature = signUserOperation(userOp, 'mock-private-key');
  userOp.signature = signature;

  const result = await executeUserOperation(wallet, userOp);

  return NextResponse.json({
    txHash: result.txHash,
    gasUsed: result.gasUsed,
    status: result.status,
    blockNumber: result.blockNumber,
    nonce: wallet.nonce,
  });
}
