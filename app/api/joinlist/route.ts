export const runtime = 'edge';

import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError, parseJsonBody, sanitizeString } from '@/lib/api-utils';

export async function POST(request: Request) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return apiError('Service unavailable', 503);
  }

  const parsed = await parseJsonBody<{ email: string; walletAddress?: string }>(request);
  if ('error' in parsed) return parsed.error;

  const { data } = parsed;
  const email = sanitizeString(data.email, 320).toLowerCase();
  const walletAddress = data.walletAddress ? sanitizeString(data.walletAddress, 100) : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError('Valid email is required');
  }

  const sql = neon(dbUrl);

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        wallet_address text,
        created_at timestamp DEFAULT now()
      )
    `;

    // Check for duplicate
    const existing = await sql`SELECT id FROM waitlist WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return apiSuccess({ status: 'duplicate', message: 'You are already on the waitlist!' });
    }

    // Insert
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO waitlist (id, email, wallet_address)
      VALUES (${id}, ${email}, ${walletAddress})
    `;

    // Get count for response
    const countRows = await sql`SELECT COUNT(*)::int AS count FROM waitlist`;
    const totalSignups = countRows[0]?.count ?? 0;

    return apiSuccess({ status: 'success', message: 'Welcome to the waitlist!', totalSignups });
  } catch (err: any) {
    console.error('[joinlist] error:', err);
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return apiSuccess({ status: 'duplicate', message: 'You are already on the waitlist!' });
    }
    return apiError('Failed to join waitlist', 500);
  }
}
