/**
 * BP Top-Up via USDT Deposit
 *
 * Users send USDT (BEP-20) to the platform wallet on BSC,
 * then submit the tx hash to receive BP.
 *
 * Rate: $1 USDT = 100 BP (with bonus tiers for larger deposits)
 */

// ---------------------------------------------------------------------------
// Platform deposit address (BSC)
// ---------------------------------------------------------------------------

export const PLATFORM_DEPOSIT_ADDRESS =
  process.env.BBAI_PLATFORM_WALLET || '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// BP Rate tiers — larger deposits get bonus BP
// ---------------------------------------------------------------------------

export interface BpRate {
  minUsdt: number;
  maxUsdt: number | null;
  bpPerUsdt: number;      // BP per $1 USDT
  bonusPercent: number;
  tier: string;
}

export const BP_RATES: BpRate[] = [
  { minUsdt: 1,   maxUsdt: 4.99,   bpPerUsdt: 100, bonusPercent: 0,  tier: 'standard' },
  { minUsdt: 5,   maxUsdt: 9.99,   bpPerUsdt: 120, bonusPercent: 20, tier: 'bonus' },
  { minUsdt: 10,  maxUsdt: 49.99,  bpPerUsdt: 150, bonusPercent: 50, tier: 'whale' },
  { minUsdt: 50,  maxUsdt: null,   bpPerUsdt: 200, bonusPercent: 100, tier: 'mega' },
];

/**
 * Calculate BP from a USDT deposit amount.
 */
export function calculateBpFromUsdt(usdtAmount: number): {
  bp: number;
  bonusPercent: number;
  tier: string;
} {
  // Find matching tier (highest first)
  for (let i = BP_RATES.length - 1; i >= 0; i--) {
    const rate = BP_RATES[i];
    if (usdtAmount >= rate.minUsdt) {
      return {
        bp: Math.floor(usdtAmount * rate.bpPerUsdt),
        bonusPercent: rate.bonusPercent,
        tier: rate.tier,
      };
    }
  }

  // Default (should not reach here if minUsdt >= 1 check is done)
  return { bp: Math.floor(usdtAmount * 100), bonusPercent: 0, tier: 'standard' };
}

