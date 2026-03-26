/**
 * On-Chain Activity Feed — Whale Movements & Notable Events
 *
 * Monitors whale wallet transfers to exchanges using Etherscan's free API.
 * Generates debate topics from large ETH movements.
 *
 * Free tier: 5 requests/second, no API key needed for basic endpoints.
 * Results are cached for 10 minutes.
 */

import type { TopicCandidate } from '@/lib/nft-feed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETHERSCAN_API = 'https://api.etherscan.io/v2/api';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

/** Known whale wallets to track */
const WHALE_WALLETS = [
  {
    address: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
    label: 'Ethereum Beacon Deposit Contract',
    type: 'staking',
  },
  {
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    label: 'Binance Hot Wallet',
    type: 'exchange',
  },
  {
    address: '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549',
    label: 'Binance Cold Wallet',
    type: 'exchange',
  },
];

/** Known exchange deposit addresses for detecting "moving to exchange" */
const EXCHANGE_ADDRESSES: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Coinbase',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Kraken',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io',
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': 'Bybit',
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let onchainCache: { topics: TopicCandidate[]; fetchedAt: number } | null = null;

const FETCH_TIMEOUT_MS = 5000;

// Minimum ETH transfer to be considered "whale" activity
const MIN_WHALE_ETH = 100;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createAbortController(): { controller: AbortController; timeout: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { controller, timeout };
}

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string; // wei
  timeStamp: string;
  isError: string;
}

async function fetchRecentTransactions(address: string): Promise<EtherscanTx[]> {
  const { controller, timeout } = createAbortController();
  try {
    const params = new URLSearchParams({
      chainid: '1',
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      sort: 'desc',
      page: '1',
      offset: '5',
    });
    if (ETHERSCAN_API_KEY) {
      params.set('apikey', ETHERSCAN_API_KEY);
    }

    const res = await fetch(`${ETHERSCAN_API}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) return [];

    return data.result as EtherscanTx[];
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function weiToEth(wei: string): number {
  try {
    return Number(BigInt(wei)) / 1e18;
  } catch {
    return parseFloat(wei) / 1e18 || 0;
  }
}

function getExchangeName(address: string): string | null {
  return EXCHANGE_ADDRESSES[address.toLowerCase()] ?? null;
}

function formatEthAmount(eth: number): string {
  if (eth >= 10000) return `${(eth / 1000).toFixed(1)}K`;
  return eth.toFixed(1);
}

function generateTopicFromTx(
  tx: EtherscanTx,
  walletLabel: string,
): TopicCandidate | null {
  const ethAmount = weiToEth(tx.value);
  if (ethAmount < MIN_WHALE_ETH) return null;
  if (tx.isError === '1') return null;

  const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const slug = `onchain-${tx.hash.slice(0, 16)}-${Date.now()}`;
  const formattedAmount = formatEthAmount(ethAmount);

  // Detect transfer TO exchange
  const toExchange = getExchangeName(tx.to);
  if (toExchange) {
    return {
      title: `Whale moved ${formattedAmount} ETH to ${toExchange} — dump incoming?`,
      category: 'crypto',
      source: 'etherscan',
      outcomes: [
        { label: 'Dump incoming', price: 0.45 },
        { label: 'Just a transfer', price: 0.55 },
      ],
      imageUrl: '',
      slug,
      endDate,
      volumeRaw: ethAmount,
    };
  }

  // Detect transfer FROM exchange (withdrawal = bullish)
  const fromExchange = getExchangeName(tx.from);
  if (fromExchange) {
    return {
      title: `${formattedAmount} ETH withdrawn from ${fromExchange} — accumulation signal?`,
      category: 'crypto',
      source: 'etherscan',
      outcomes: [
        { label: 'Bullish accumulation', price: 0.55 },
        { label: 'Nothing notable', price: 0.45 },
      ],
      imageUrl: '',
      slug,
      endDate,
      volumeRaw: ethAmount,
    };
  }

  // Generic large transfer
  return {
    title: `${walletLabel} moved ${formattedAmount} ETH — what is happening?`,
    category: 'crypto',
    source: 'etherscan',
    outcomes: [
      { label: 'Bullish move', price: 0.5 },
      { label: 'Bearish signal', price: 0.5 },
    ],
    imageUrl: '',
    slug,
    endDate,
    volumeRaw: ethAmount,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch whale wallet transactions and generate debate topic candidates
 * from large ETH movements.
 *
 * Results are cached for 10 minutes. Returns empty array on failure.
 */
export async function fetchOnchainTopics(limit = 3): Promise<TopicCandidate[]> {
  // Check cache
  if (onchainCache && Date.now() - onchainCache.fetchedAt < CACHE_TTL_MS) {
    return onchainCache.topics.slice(0, limit);
  }

  try {
    const allTopics: TopicCandidate[] = [];

    // Fetch transactions for all whale wallets in parallel
    const results = await Promise.allSettled(
      WHALE_WALLETS.map(async (wallet) => {
        const txs = await fetchRecentTransactions(wallet.address);
        const topics: TopicCandidate[] = [];
        for (const tx of txs) {
          const topic = generateTopicFromTx(tx, wallet.label);
          if (topic) {
            topics.push(topic);
          }
        }
        return topics;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTopics.push(...result.value);
      }
    }

    // Sort by ETH amount (volumeRaw) descending
    allTopics.sort((a, b) => b.volumeRaw - a.volumeRaw);

    // Deduplicate — only keep one topic per tx hash prefix
    const seen = new Set<string>();
    const deduped: TopicCandidate[] = [];
    for (const topic of allTopics) {
      // Use first 20 chars of slug as dedup key
      const key = topic.slug.slice(0, 28);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(topic);
      }
    }

    // Update cache
    onchainCache = { topics: deduped, fetchedAt: Date.now() };

    return deduped.slice(0, limit);
  } catch (err) {
    console.error('[onchain-feed] Failed to fetch onchain topics:', err);
    return onchainCache?.topics.slice(0, limit) ?? [];
  }
}
