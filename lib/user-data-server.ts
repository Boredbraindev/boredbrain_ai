import 'server-only';

import { eq, desc, and, or } from 'drizzle-orm';
import { user, subscription } from './db/schema';
import { db } from './db';
import { getSession } from './auth-utils';
import { generateReferralCode } from './referral-utils';

type DbUser = typeof user.$inferSelect;

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
// When UNLOCK_PRO_FOR_ALL is "true" (the default until Polar is configured),
// every user is treated as a Pro subscriber. Once you set up your Polar account
// and have real subscriptions flowing, set this to "false" in the env.
//
// The order of precedence:
//   1. UNLOCK_PRO_FOR_ALL env var (explicit override)
//   2. NEXT_PUBLIC_UNLOCK_PRO_FOR_ALL (fallback / build-time)
//   3. Default: "false"  <-- pro requires real subscription via Polar
const PRO_UNLOCK_FLAG =
  (process.env.UNLOCK_PRO_FOR_ALL ?? process.env.NEXT_PUBLIC_UNLOCK_PRO_FOR_ALL ?? 'false') !== 'false';

const GUEST_ACCESS_FLAG =
  (process.env.ALLOW_GUEST_ACCESS ?? process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? 'true') !== 'false' ||
  PRO_UNLOCK_FLAG;
const GUEST_USER_ID = process.env.GUEST_USER_ID || 'guest-user';
const GUEST_USER_EMAIL = process.env.GUEST_USER_EMAIL || 'guest@boredbrain.local';
const GUEST_USER_NAME = process.env.GUEST_USER_NAME || 'Guest User';

// ---------------------------------------------------------------------------
// Polar subscription checking
// ---------------------------------------------------------------------------
type PolarSubscriptionInfo = {
  id: string;
  productId: string;
  status: string;
  amount: number;
  currency: string;
  recurringInterval: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

/**
 * Checks the subscription table for an active Polar subscription for the given user.
 * Active means: status is "active" or "trialing", and currentPeriodEnd is in the future.
 */
async function getPolarSubscription(userId: string): Promise<PolarSubscriptionInfo | null> {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          or(
            eq(subscription.status, 'active'),
            eq(subscription.status, 'trialing'),
            // Include canceled subs that haven't expired yet (cancel_at_period_end)
            eq(subscription.status, 'canceled'),
          ),
        ),
      )
      .orderBy(desc(subscription.currentPeriodEnd))
      .limit(1);

    const sub = rows[0];
    if (!sub) return null;

    // For canceled subs, only consider them active if the period hasn't ended
    if (sub.status === 'canceled' && sub.currentPeriodEnd < now) {
      return null;
    }

    return {
      id: sub.id,
      productId: sub.productId,
      status: sub.status,
      amount: sub.amount,
      currency: sub.currency,
      recurringInterval: sub.recurringInterval,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt,
    };
  } catch (error) {
    // If the subscription table doesn't exist yet or any DB error occurs,
    // fail gracefully and fall back to the PRO_UNLOCK_FLAG behavior.
    console.warn('[user-data-server] Failed to check Polar subscription:', error);
    return null;
  }
}

/**
 * Derives the pro status from subscription data.
 * Returns the resolved isProUser, proSource, and subscriptionStatus.
 */
function deriveProStatus(polarSub: PolarSubscriptionInfo | null): {
  isProUser: boolean;
  proSource: 'polar' | 'dodo' | 'none';
  subscriptionStatus: 'active' | 'canceled' | 'expired' | 'none';
  polarSubscription?: ComprehensiveUserData['polarSubscription'];
} {
  if (polarSub) {
    const isActive = polarSub.status === 'active' || polarSub.status === 'trialing';
    const isCanceledButValid = polarSub.status === 'canceled' && polarSub.currentPeriodEnd > new Date();

    return {
      isProUser: isActive || isCanceledButValid,
      proSource: 'polar',
      subscriptionStatus: isActive ? 'active' : isCanceledButValid ? 'canceled' : 'expired',
      polarSubscription: {
        id: polarSub.id,
        productId: polarSub.productId,
        status: polarSub.status,
        amount: polarSub.amount,
        currency: polarSub.currency,
        recurringInterval: polarSub.recurringInterval,
        currentPeriodStart: polarSub.currentPeriodStart,
        currentPeriodEnd: polarSub.currentPeriodEnd,
        cancelAtPeriodEnd: polarSub.cancelAtPeriodEnd,
        canceledAt: polarSub.canceledAt,
      },
    };
  }

  // No subscription found -- fall back to the feature flag
  if (PRO_UNLOCK_FLAG) {
    return {
      isProUser: true,
      proSource: 'none',
      subscriptionStatus: 'active',
    };
  }

  return {
    isProUser: false,
    proSource: 'none',
    subscriptionStatus: 'none',
  };
}

// ---------------------------------------------------------------------------
// Guest user helpers
// ---------------------------------------------------------------------------
async function ensureGuestUserRecord(): Promise<DbUser> {
  const existingById = await db.select().from(user).where(eq(user.id, GUEST_USER_ID)).limit(1);

  if (existingById[0]) {
    return existingById[0];
  }

  const existingByEmail = await db.select().from(user).where(eq(user.email, GUEST_USER_EMAIL)).limit(1);

  if (existingByEmail[0]) {
    return existingByEmail[0];
  }

  const now = new Date();
  const result = await db
    .insert(user)
    .values({
      id: GUEST_USER_ID,
      name: GUEST_USER_NAME,
      email: GUEST_USER_EMAIL,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const created = result[0];

  return (
    created || {
      id: GUEST_USER_ID,
      name: GUEST_USER_NAME,
      email: GUEST_USER_EMAIL,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    }
  );
}

function buildGuestComprehensiveData(record: DbUser): ComprehensiveUserData {
  const baseData: ComprehensiveUserData = {
    id: record.id,
    email: record.email,
    emailVerified: record.emailVerified ?? false,
    name: record.name || GUEST_USER_NAME,
    image: record.image,
    username: record.username || null,
    walletAddress: record.walletAddress || null,
    referralCode: record.referralCode || null,
    referredBy: record.referredBy || null,
    createdAt: record.createdAt || new Date(),
    updatedAt: record.updatedAt || new Date(),
    isProUser: PRO_UNLOCK_FLAG,
    proSource: 'none',
    subscriptionStatus: PRO_UNLOCK_FLAG ? 'active' : 'none',
    paymentHistory: [],
  };

  baseData.dodoPayments = {
    hasPayments: false,
    expiresAt: null,
    mostRecentPayment: undefined,
    daysUntilExpiration: undefined,
    isExpired: false,
    isExpiringSoon: false,
  };

  return baseData;
}

// Single comprehensive user data type
export type ComprehensiveUserData = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  username: string | null;
  walletAddress: string | null;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  isProUser: boolean;
  proSource: 'polar' | 'dodo' | 'none';
  subscriptionStatus: 'active' | 'canceled' | 'expired' | 'none';
  polarSubscription?: {
    id: string;
    productId: string;
    status: string;
    amount: number;
    currency: string;
    recurringInterval: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  };
  dodoPayments?: {
    hasPayments: boolean;
    expiresAt: Date | null;
    mostRecentPayment?: Date;
    daysUntilExpiration?: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
  };
  // Payment history
  paymentHistory: any[];
};

const userDataCache = new Map<string, { data: ComprehensiveUserData; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedUserData(userId: string): ComprehensiveUserData | null {
  const cached = userDataCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    userDataCache.delete(userId);
  }
  return null;
}

function setCachedUserData(userId: string, data: ComprehensiveUserData): void {
  userDataCache.set(userId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearUserDataCache(userId: string): void {
  userDataCache.delete(userId);
}

export function clearAllUserDataCache(): void {
  userDataCache.clear();
}

export async function getComprehensiveUserData(): Promise<ComprehensiveUserData | null> {
  try {
    // Get session once
    const session = await getSession();

    if (!session?.user?.id) {
      if (GUEST_ACCESS_FLAG) {
        const cachedGuest = getCachedUserData(GUEST_USER_ID);
        if (cachedGuest) {
          return cachedGuest;
        }

        const guestRecord = await ensureGuestUserRecord();
        const guestData = buildGuestComprehensiveData(guestRecord);

        setCachedUserData(GUEST_USER_ID, guestData);
        return guestData;
      }

      return null;
    }

    const userId = session.user.id;

    // Check cache first
    const cached = getCachedUserData(userId);
    if (cached) {
      return cached;
    }

    // Fetch user data and subscription in parallel
    const [userData, polarSub] = await Promise.all([
      db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .then((rows) => rows[0]),
      getPolarSubscription(userId),
    ]);

    if (!userData) {
      return null;
    }

    // Ensure user has a referral code
    let referralCode = userData.referralCode;
    if (!referralCode) {
      referralCode = await ensureUserReferralCode(userData.id);
    }

    // Derive pro status from real subscription data (or fall back to flag)
    const proStatus = deriveProStatus(polarSub);

    const comprehensiveData: ComprehensiveUserData = {
      id: userData.id,
      email: userData.email,
      emailVerified: userData.emailVerified,
      name: userData.name || userData.email.split('@')[0],
      image: userData.image,
      username: userData.username || null,
      walletAddress: userData.walletAddress || null,
      referralCode: referralCode,
      referredBy: userData.referredBy || null,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      isProUser: proStatus.isProUser,
      proSource: proStatus.proSource,
      subscriptionStatus: proStatus.subscriptionStatus,
      polarSubscription: proStatus.polarSubscription,
      paymentHistory: [],
    };

    comprehensiveData.dodoPayments = {
      hasPayments: false,
      expiresAt: null,
      mostRecentPayment: undefined,
      daysUntilExpiration: undefined,
      isExpired: false,
      isExpiringSoon: false,
    };

    // Cache the result
    setCachedUserData(userId, comprehensiveData);

    return comprehensiveData;
  } catch (error) {
    console.error('Error getting comprehensive user data:', error);
    return null;
  }
}

// Helper functions for backward compatibility and specific use cases
export async function isUserPro(): Promise<boolean> {
  const userData = await getComprehensiveUserData();
  return userData?.isProUser || false;
}

export async function getUserSubscriptionStatus(): Promise<'active' | 'canceled' | 'expired' | 'none'> {
  const userData = await getComprehensiveUserData();
  return userData?.subscriptionStatus || 'none';
}

export async function getProSource(): Promise<'polar' | 'dodo' | 'none'> {
  const userData = await getComprehensiveUserData();
  return userData?.proSource || 'none';
}

// Ensure user has a referral code
export async function ensureUserReferralCode(userId: string): Promise<string | null> {
  try {
    // Check if user already has a referral code
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { referralCode: true },
    });

    if (existingUser?.referralCode) {
      return existingUser.referralCode;
    }

    // Generate new referral code
    const referralCode = generateReferralCode();

    // Update user with referral code
    await db
      .update(user)
      .set({
        referralCode,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return referralCode;
  } catch (error) {
    console.error('Failed to ensure user referral code:', error);
    return null;
  }
}
