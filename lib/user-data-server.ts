import 'server-only';

import { eq } from 'drizzle-orm';
import { user } from './db/schema';
import { db } from './db';
import { getSession } from './auth-utils';
import { generateReferralCode } from './referral-utils';

type DbUser = typeof user.$inferSelect;

const PRO_UNLOCK_FLAG =
  (process.env.UNLOCK_PRO_FOR_ALL ?? process.env.NEXT_PUBLIC_UNLOCK_PRO_FOR_ALL ?? 'true') !== 'false';
const GUEST_ACCESS_FLAG =
  (process.env.ALLOW_GUEST_ACCESS ?? process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? 'true') !== 'false' ||
  PRO_UNLOCK_FLAG;
const GUEST_USER_ID = process.env.GUEST_USER_ID || 'guest-user';
const GUEST_USER_EMAIL = process.env.GUEST_USER_EMAIL || 'guest@boredbrain.local';
const GUEST_USER_NAME = process.env.GUEST_USER_NAME || 'Guest User';

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
    isProUser: true,
    proSource: 'none',
    subscriptionStatus: 'active',
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
      if (PRO_UNLOCK_FLAG && !cached.isProUser) {
        const upgradedCache = {
          ...cached,
          isProUser: true,
          proSource: cached.proSource ?? 'none',
          subscriptionStatus: 'active' as const,
        };
        setCachedUserData(userId, upgradedCache);
        return upgradedCache;
      }
      return cached;
    }

    // Fetch user data
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .then((rows) => rows[0]);

    if (!userData) {
      return null;
    }

    // Ensure user has a referral code
    let referralCode = userData.referralCode;
    if (!referralCode) {
      referralCode = await ensureUserReferralCode(userData.id);
    }

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
      isProUser: true,
      proSource: 'none',
      subscriptionStatus: 'active',
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

    if (PRO_UNLOCK_FLAG && !comprehensiveData.isProUser) {
      comprehensiveData.isProUser = true;
      comprehensiveData.proSource = comprehensiveData.proSource || 'none';
      comprehensiveData.subscriptionStatus = 'active';
    }

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
