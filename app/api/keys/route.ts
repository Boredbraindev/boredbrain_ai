export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { neon } from '@neondatabase/serverless';

// Inline generateApiKey (avoid importing lib/agent-api/auth which uses Drizzle)
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const random = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  return `bb_sk_${random}`;
}

// Inline generateId
function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * GET /api/keys - List API keys for the authenticated user
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  const keys = await sql`
    SELECT id, name, key as key_preview, permissions, rate_limit, total_queries, total_spent, credit_balance, status, created_at, last_used_at
    FROM api_key
    WHERE user_id = ${user.id}
  `;

  // Mask keys for security (show only first 12 chars)
  const maskedKeys = keys.map((k: any) => ({
    id: k.id,
    name: k.name,
    keyPreview: k.key_preview.slice(0, 12) + '...',
    permissions: k.permissions,
    rateLimit: k.rate_limit,
    totalQueries: k.total_queries,
    totalSpent: k.total_spent,
    creditBalance: k.credit_balance,
    status: k.status,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
  }));

  return NextResponse.json({ keys: maskedKeys });
}

/**
 * POST /api/keys - Create a new API key
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { name?: string; permissions?: string[]; walletAddress?: string; chainId?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sql = neon(process.env.DATABASE_URL!);
  const key = generateApiKey();
  const id = generateId();
  const name = body.name || 'Default API Key';
  const permissions = JSON.stringify(body.permissions || ['*']);
  const walletAddress = body.walletAddress || null;
  const chainId = body.chainId || null;

  const [newKey] = await sql`
    INSERT INTO api_key (id, user_id, key, name, permissions, wallet_address, chain_id, rate_limit, total_queries, total_spent, credit_balance, status, created_at)
    VALUES (${id}, ${user.id}, ${key}, ${name}, ${permissions}::jsonb, ${walletAddress}, ${chainId}, 100, 0, '0', '1000', 'active', now())
    RETURNING *
  `;

  return NextResponse.json({
    key, // Show full key only on creation
    id: newKey.id,
    name: newKey.name,
    creditBalance: newKey.credit_balance,
    message: 'Save this key securely. It will not be shown again.',
  }, { status: 201 });
}

/**
 * DELETE /api/keys - Revoke an API key
 */
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get('id');

  if (!keyId) {
    return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Verify ownership
  const existing = await sql`
    SELECT * FROM api_key WHERE id = ${keyId} LIMIT 1
  `;

  if (!existing.length || existing[0].user_id !== user.id) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  await sql`
    UPDATE api_key SET status = 'revoked' WHERE id = ${keyId}
  `;

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
