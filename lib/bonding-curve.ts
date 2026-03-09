/**
 * Bonding Curve - Client-side calculations
 *
 * Mirrors the on-chain BondingCurve.sol logic exactly.
 * Linear bonding curve: price = basePrice + (supply * slope)
 *
 * All values use the same 18-decimal convention as the contract,
 * but this module works with human-readable numbers (e.g. supply = 1000
 * means 1000 tokens, not 1000e18 wei). The contract-level precision
 * is handled transparently.
 *
 * Fee structure:
 *   - 1% platform fee  (PLATFORM_FEE_BPS = 100)
 *   - 5% creator fee   (CREATOR_FEE_BPS = 500)
 */

// ========== Constants (mirrors BondingCurve.sol) ==========

export const PLATFORM_FEE_BPS = 100;   // 1%
export const CREATOR_FEE_BPS = 500;    // 5%
export const BPS_DENOMINATOR = 10000;

/** Default base price in USDT per token */
export const DEFAULT_BASE_PRICE = 0.001;

/** Default slope: price increase per token of circulating supply */
export const DEFAULT_SLOPE = 0.0000001;

/** Default max supply (1 billion tokens) */
export const DEFAULT_MAX_SUPPLY = 1_000_000_000;

// ========== Types ==========

export interface BondingCurveParams {
  basePrice: number;
  slope: number;
  maxSupply: number;
}

export interface TradeQuote {
  /** Raw cost/payout before fees (USDT) */
  rawAmount: number;
  /** 1% platform fee (USDT) */
  platformFee: number;
  /** 5% creator fee (USDT) */
  creatorFee: number;
  /** Total cost for buy, or net payout for sell (USDT) */
  total: number;
  /** Average price per token in this trade */
  averagePrice: number;
  /** Spot price after the trade executes */
  newPrice: number;
  /** New circulating supply after the trade */
  newSupply: number;
}

// ========== Core Functions ==========

/**
 * Get the current spot price for a given circulating supply.
 * Mirrors: price = basePrice + (supply * slope)
 */
export function getCurrentPrice(
  supply: number,
  params: BondingCurveParams = defaultParams()
): number {
  return params.basePrice + supply * params.slope;
}

/**
 * Calculate the total market cap at a given supply.
 * marketCap = currentPrice * circulatingSupply
 */
export function getMarketCap(
  supply: number,
  params: BondingCurveParams = defaultParams()
): number {
  return getCurrentPrice(supply, params) * supply;
}

/**
 * Calculate the raw cost (before fees) to buy `amount` tokens
 * starting from `currentSupply`.
 *
 * Uses the integral of the linear curve from S to S+A:
 *   cost = A * basePrice + slope * A * (2S + A) / 2
 */
export function calculateRawBuyCost(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams = defaultParams()
): number {
  const baseCost = amount * params.basePrice;
  const slopeCost = (params.slope * amount * (2 * currentSupply + amount)) / 2;
  return baseCost + slopeCost;
}

/**
 * Calculate the raw payout (before fees) for selling `amount` tokens
 * starting from `currentSupply`.
 *
 * Uses the integral from (S-A) to S:
 *   payout = A * basePrice + slope * A * (2S - A) / 2
 */
export function calculateRawSellPayout(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams = defaultParams()
): number {
  if (amount > currentSupply) {
    throw new Error('Sell amount exceeds current supply');
  }
  const basePayout = amount * params.basePrice;
  const slopePayout = (params.slope * amount * (2 * currentSupply - amount)) / 2;
  return basePayout + slopePayout;
}

/**
 * Get a full buy quote including all fees.
 * The buyer pays: rawCost + platformFee + creatorFee
 */
export function calculateBuyPrice(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams = defaultParams()
): TradeQuote {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (params.maxSupply > 0 && currentSupply + amount > params.maxSupply) {
    throw new Error('Purchase would exceed max supply');
  }

  const rawCost = calculateRawBuyCost(currentSupply, amount, params);
  const platformFee = (rawCost * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const creatorFee = (rawCost * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
  const total = rawCost + platformFee + creatorFee;
  const newSupply = currentSupply + amount;

  return {
    rawAmount: rawCost,
    platformFee,
    creatorFee,
    total,
    averagePrice: total / amount,
    newPrice: getCurrentPrice(newSupply, params),
    newSupply,
  };
}

/**
 * Get a full sell quote including all fees.
 * The seller receives: rawPayout - platformFee - creatorFee
 */
export function calculateSellPrice(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams = defaultParams()
): TradeQuote {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (amount > currentSupply) throw new Error('Insufficient supply to sell');

  const rawPayout = calculateRawSellPayout(currentSupply, amount, params);
  const platformFee = (rawPayout * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const creatorFee = (rawPayout * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
  const total = rawPayout - platformFee - creatorFee;
  const newSupply = currentSupply - amount;

  return {
    rawAmount: rawPayout,
    platformFee,
    creatorFee,
    total,
    averagePrice: amount > 0 ? total / amount : 0,
    newPrice: getCurrentPrice(newSupply, params),
    newSupply,
  };
}

// ========== Utility Functions ==========

/**
 * Generate default bonding curve parameters
 */
export function defaultParams(): BondingCurveParams {
  return {
    basePrice: DEFAULT_BASE_PRICE,
    slope: DEFAULT_SLOPE,
    maxSupply: DEFAULT_MAX_SUPPLY,
  };
}

/**
 * Generate a token symbol from an agent name.
 * Takes the first letters of each word, uppercase, max 5 chars.
 * Falls back to first 4 chars + "T" if single word.
 */
export function generateTokenSymbol(agentName: string): string {
  const words = agentName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5);
  }
  // Single word: take first 4 chars + "T"
  const base = agentName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (base.slice(0, 4) + 'T').slice(0, 5);
}

/**
 * Estimate how many tokens can be bought with a given USDT budget.
 * Uses binary search over the buy cost function.
 */
export function estimateTokensForBudget(
  currentSupply: number,
  budget: number,
  params: BondingCurveParams = defaultParams()
): number {
  if (budget <= 0) return 0;

  let lo = 0;
  let hi = params.maxSupply > 0 ? params.maxSupply - currentSupply : budget / params.basePrice * 2;
  const epsilon = 0.001; // precision: 0.001 tokens

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateRawBuyCost(currentSupply, mid, params);
    const totalCost = cost * (1 + (PLATFORM_FEE_BPS + CREATOR_FEE_BPS) / BPS_DENOMINATOR);

    if (Math.abs(totalCost - budget) < epsilon * params.basePrice) {
      return mid;
    }
    if (totalCost < budget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Get a price chart: array of { supply, price } points for visualization.
 */
export function getPriceCurvePoints(
  params: BondingCurveParams = defaultParams(),
  numPoints: number = 50,
  maxPlotSupply?: number
): Array<{ supply: number; price: number; marketCap: number }> {
  const maxS = maxPlotSupply ?? (params.maxSupply > 0 ? params.maxSupply : 1_000_000);
  const step = maxS / numPoints;

  const points: Array<{ supply: number; price: number; marketCap: number }> = [];
  for (let i = 0; i <= numPoints; i++) {
    const supply = i * step;
    points.push({
      supply,
      price: getCurrentPrice(supply, params),
      marketCap: getMarketCap(supply, params),
    });
  }
  return points;
}
