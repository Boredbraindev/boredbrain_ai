import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateApiKey } from '@/lib/agent-api/auth';
import { generateId } from 'ai';

/**
 * GET /api/keys - List API keys for the authenticated user
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const keys = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPreview: apiKey.key,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      totalQueries: apiKey.totalQueries,
      totalSpent: apiKey.totalSpent,
      creditBalance: apiKey.creditBalance,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.userId, user.id));

  // Mask keys for security (show only first 12 chars)
  const maskedKeys = keys.map((k) => ({
    ...k,
    keyPreview: k.keyPreview.slice(0, 12) + '...',
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

  const key = generateApiKey();

  const [newKey] = await db
    .insert(apiKey)
    .values({
      id: generateId(),
      userId: user.id,
      key,
      name: body.name || 'Default API Key',
      permissions: body.permissions || ['*'],
      walletAddress: body.walletAddress || null,
      chainId: body.chainId || null,
      rateLimit: 100,
      totalQueries: 0,
      totalSpent: '0',
      creditBalance: '1000', // 1000 BBAI free credits for new keys
      status: 'active',
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json({
    key, // Show full key only on creation
    id: newKey.id,
    name: newKey.name,
    creditBalance: newKey.creditBalance,
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

  // Verify ownership
  const [existing] = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.id, keyId))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  await db
    .update(apiKey)
    .set({ status: 'revoked' })
    .where(eq(apiKey.id, keyId));

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
