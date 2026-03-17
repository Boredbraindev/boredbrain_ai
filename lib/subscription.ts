import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// Subscription tier check utilities
// Uses raw neon() SQL for edge-runtime compatibility
// ---------------------------------------------------------------------------

/**
 * Get the subscription tier for a wallet address.
 * Returns 'pro' if an active (non-expired) Pro subscription exists, else 'basic'.
 */
export async function getSubscriptionTier(walletAddress: string): Promise<'basic' | 'pro'> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const walletLower = walletAddress.toLowerCase();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT tier, expires_at
        FROM user_subscription
        WHERE LOWER(wallet_address) = ${walletLower}
          AND tier = 'pro'
        LIMIT 1
      `,
      timeout,
    ]);

    if (!rows || rows.length === 0) return 'basic';

    const sub = rows[0];
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;

    // Active if no expiry (lifetime) or expiry is in the future
    if (!expiresAt || expiresAt > new Date()) {
      return 'pro';
    }

    return 'basic';
  } catch (err) {
    console.error('[getSubscriptionTier]', err);
    return 'basic'; // fail-open to basic tier
  }
}

/**
 * Check if a wallet can view agent opinions in debates.
 * Pro users OR users who have registered agents can view opinions.
 */
export async function canViewOpinions(walletAddress: string): Promise<boolean> {
  try {
    const tier = await getSubscriptionTier(walletAddress);
    if (tier === 'pro') return true;

    // Check if user has any registered agents
    const sql = neon(process.env.DATABASE_URL!);
    const walletLower = walletAddress.toLowerCase();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT id FROM external_agent
        WHERE LOWER(owner_address) = ${walletLower}
        LIMIT 1
      `,
      timeout,
    ]);

    return rows !== null && rows.length > 0;
  } catch (err) {
    console.error('[canViewOpinions]', err);
    return false;
  }
}

/**
 * Check if a wallet can stake BP on debates.
 * Only Pro users can stake.
 */
export async function canStake(walletAddress: string): Promise<boolean> {
  try {
    const tier = await getSubscriptionTier(walletAddress);
    return tier === 'pro';
  } catch (err) {
    console.error('[canStake]', err);
    return false;
  }
}

/**
 * Get the number of agent slots for a wallet.
 * Basic = 1 slot, Pro = 5 slots.
 */
export async function getAgentSlots(walletAddress: string): Promise<number> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const walletLower = walletAddress.toLowerCase();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT agent_slots, tier, expires_at
        FROM user_subscription
        WHERE LOWER(wallet_address) = ${walletLower}
          AND tier = 'pro'
        LIMIT 1
      `,
      timeout,
    ]);

    if (!rows || rows.length === 0) return 1;

    const sub = rows[0];
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;

    if (!expiresAt || expiresAt > new Date()) {
      return sub.agent_slots as number;
    }

    return 1; // expired
  } catch (err) {
    console.error('[getAgentSlots]', err);
    return 1;
  }
}
