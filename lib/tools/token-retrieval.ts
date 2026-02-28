import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

type SupportedChain = 'eth-mainnet' | 'polygon-mainnet' | 'arbitrum-mainnet' | 'optimism-mainnet' | 'base-mainnet' | 'bnb-mainnet';

// Chain mapping for different networks
const chainToHost: Record<SupportedChain, string> = {
  'eth-mainnet': 'eth-mainnet',
  'polygon-mainnet': 'polygon-mainnet',
  'arbitrum-mainnet': 'arb-mainnet',
  'optimism-mainnet': 'opt-mainnet',
  'base-mainnet': 'base-mainnet',
  'bnb-mainnet': 'bnb-mainnet',
};

const chainToNetwork: Record<SupportedChain, string> = {
  'eth-mainnet': 'ETH_MAINNET',
  'polygon-mainnet': 'MATIC_MAINNET',
  'arbitrum-mainnet': 'ARB_MAINNET',
  'optimism-mainnet': 'OPT_MAINNET',
  'base-mainnet': 'BASE_MAINNET',
  'bnb-mainnet': 'BNB_MAINNET',
};

// Popular token contracts for easy reference
const KNOWN_TOKENS: Record<string, string> = {
  // Major tokens mapping (lowercased keywords → contract address)
  'usdc': '0xa0b86a33e6c1f0ff8f38acdc8b17b1f4f5e9b4a5',
  'usdt': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'dai': '0x6b175474e89094c44da98b954eedeac495271d0f',
  'weth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  'uni': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  'link': '0x514910771af9ca656af840dff83e8264ecf986ca',
  'ape': '0x4d224452801aced8b2f0aebe155379bb5d594381',
  'shib': '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
  'matic': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  'wbtc': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  // BSC tokens
  'bnb': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  'wbnb': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  'busd': '0xe9e7cea3dedca5984780bafc599bd69add087d56',
  'cake': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', // PancakeSwap
};

const coingeckoPlatformMap: Record<SupportedChain, string[]> = {
  'eth-mainnet': ['ethereum'],
  'polygon-mainnet': ['polygon-pos'],
  'arbitrum-mainnet': ['arbitrum-one'],
  'optimism-mainnet': ['optimistic-ethereum'],
  'base-mainnet': ['base'],
  'bnb-mainnet': ['binance-smart-chain'],
};

async function lookupContractFromCoinGecko(symbol: string, chain: SupportedChain): Promise<string | null> {
  if (!serverEnv.COINGECKO_API_KEY) {
    return null;
  }

  const query = symbol.toLowerCase().trim();
  if (!query) {
    return null;
  }

  try {
    const searchRes = await fetch(
      `https://pro-api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          accept: 'application/json',
          'x-cg-pro-api-key': serverEnv.COINGECKO_API_KEY,
        },
      },
    );

    if (!searchRes.ok) {
      return null;
    }

    const searchJson = await searchRes.json();
    const coins: Array<{ id: string; symbol: string }> = searchJson?.coins ?? [];
    if (!coins.length) {
      return null;
    }

    const exactMatch = coins.find((coin) => coin.symbol.toLowerCase() === query);
    const coinId = (exactMatch ?? coins[0])?.id;
    if (!coinId) {
      return null;
    }

    const detailRes = await fetch(
      `https://pro-api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      {
        headers: {
          accept: 'application/json',
          'x-cg-pro-api-key': serverEnv.COINGECKO_API_KEY,
        },
      },
    );

    if (!detailRes.ok) {
      return null;
    }

    const detailJson = await detailRes.json();
    const platforms = detailJson?.platforms ?? {};
    const preferredPlatforms = coingeckoPlatformMap[chain] ?? [];

    for (const platform of preferredPlatforms) {
      const addr = platforms[platform];
      if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
        return addr;
      }
    }

    // Fallback to Ethereum address if specific chain unavailable
    const ethAddress = platforms['ethereum'];
    if (ethAddress && /^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
      return ethAddress;
    }

    return null;
  } catch (error) {
    console.error('CoinGecko lookup failed:', error);
    return null;
  }
}

type TokenAnalysis = {
  score: number; // 0-100 based on various factors
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  category: 'blue-chip' | 'defi' | 'meme' | 'infrastructure' | 'gaming' | 'unknown';
  highlights: string[];
  riskLevel: 'low' | 'medium' | 'high';
};

function analyzeToken(
  symbol: string,
  name: string,
  contractAddress: string,
  totalSupply?: string,
  decimals?: number
): TokenAnalysis {
  let score = 0;
  const highlights: string[] = [];
  let category: TokenAnalysis['category'] = 'unknown';
  let riskLevel: TokenAnalysis['riskLevel'] = 'medium';

  const symbolLower = symbol.toLowerCase();
  const nameLower = name.toLowerCase();

  // Blue-chip tokens (high score)
  if (['eth', 'weth', 'btc', 'wbtc'].includes(symbolLower)) {
    score += 40;
    category = 'blue-chip';
    riskLevel = 'low';
    highlights.push('Blue-chip asset');
  }

  // Major stablecoins
  if (['usdc', 'usdt', 'dai', 'frax'].includes(symbolLower)) {
    score += 35;
    category = 'blue-chip';
    riskLevel = 'low';
    highlights.push('Stablecoin');
  }

  // Major DeFi tokens
  if (['uni', 'aave', 'comp', 'mkr', 'snx', 'crv', 'bal', 'cake'].includes(symbolLower)) {
    score += 30;
    category = 'defi';
    riskLevel = 'low';
    highlights.push('Major DeFi protocol');
  }

  // Infrastructure tokens
  if (['link', 'dot', 'atom', 'avax', 'sol', 'matic', 'bnb', 'wbnb'].includes(symbolLower)) {
    score += 28;
    category = 'infrastructure';
    riskLevel = 'low';
    highlights.push('Infrastructure token');
  }

  // Popular meme tokens
  if (['shib', 'doge', 'pepe', 'floki'].includes(symbolLower)) {
    score += 15;
    category = 'meme';
    riskLevel = 'high';
    highlights.push('Meme token');
  }

  // APE ecosystem
  if (['ape', 'apecoin'].includes(symbolLower) || nameLower.includes('ape')) {
    score += 25;
    category = 'gaming';
    riskLevel = 'medium';
    highlights.push('APE ecosystem');
  }

  // BSC ecosystem tokens
  if (['busd', 'cake'].includes(symbolLower) || nameLower.includes('binance')) {
    score += 22;
    category = 'defi';
    riskLevel = 'low';
    highlights.push('BSC ecosystem');
  }

  // Gaming tokens
  if (nameLower.includes('gaming') || nameLower.includes('game') || ['axs', 'slp', 'sand', 'mana'].includes(symbolLower)) {
    score += 20;
    category = 'gaming';
    riskLevel = 'medium';
    highlights.push('Gaming token');
  }

  // Check total supply for scarcity
  if (totalSupply) {
    const supply = parseInt(totalSupply, 16) / Math.pow(10, decimals || 18);
    if (supply < 1000000) {
      score += 15;
      highlights.push('Low total supply');
    } else if (supply > 1000000000000) {
      score -= 10;
      highlights.push('High inflation supply');
    }
  }

  // Contract address age heuristic (older contracts generally more established)
  const addressNum = parseInt(contractAddress.slice(2, 10), 16);
  if (addressNum < 0x10000000) {
    score += 10;
    highlights.push('Early contract');
  }

  // Cap score
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  const tier: TokenAnalysis['tier'] = 
    score >= 80 ? 'legendary' : 
    score >= 60 ? 'epic' : 
    score >= 40 ? 'rare' : 
    score >= 20 ? 'uncommon' : 'common';

  return { score, tier, category, highlights, riskLevel };
}

function generateTokenRoast(
  name: string,
  symbol: string,
  analysis: TokenAnalysis
): string {
  const tier = analysis.tier.toUpperCase();
  const cat = analysis.category;

  const opens = [
    `${symbol} swings into the canopy with`,
    `This ${symbol} token shimmers through the vines with`,
    `${name} prowls the blockchain jungle with`,
  ];
  const open = opens[Math.floor(Math.random() * opens.length)];

  // Symbol-specific roasts first
  if (['bnb', 'wbnb'].includes(symbol.toLowerCase())) {
    return `${open} yellow energy and exchange empire swagger. ${tier} BNB powerhouse—either you ride the golden vine or watch from the ground floor.`;
  }
  
  if (['cake'].includes(symbol.toLowerCase())) {
    return `${open} pancake-flipping finesse. ${tier} BSC sweetness—stack the syrup or get served cold breakfast.`;
  }

  // Category-specific roasts
  if (cat === 'blue-chip') {
    return `${open} diamond hands and steel nerves. ${tier} pedigree—the kind of banana that never spoils. Stack or step aside.`;
  }
  
  if (cat === 'defi') {
    const bscHint = analysis.highlights.some(h => h.includes('BSC')) ? 'BSC-flavored ' : '';
    return `${open} ${bscHint}yield-hunting swagger. ${tier} protocol power—either you farm the upside or get farmed by the downside.`;
  }
  
  if (cat === 'meme') {
    return `${open} manic energy and community chaos. ${tier} meme magic—rockets fast, crashes faster. Diamond hands or paper cuts.`;
  }
  
  if (cat === 'gaming') {
    return `${open} play-to-earn appetite. ${tier} gaming fuel—level up your bag or get respawned at zero.`;
  }
  
  if (cat === 'infrastructure') {
    return `${open} builder energy. ${tier} backbone strength—either you ride the foundation or build on someone else's.`;
  }

  // Generic roasts based on score
  if (analysis.score >= 80) {
    return `${open} apex predator vibes. ${tier} territory—miss this vine and you're eating leaves.`;
  }
  
  if (analysis.score >= 60) {
    return `${open} solid swing mechanics. ${tier} momentum—commit or watch from the ground.`;
  }
  
  if (analysis.score >= 40) {
    return `${open} mid-canopy mischief. ${tier} bite—decent snack, questionable meal.`;
  }
  
  return `${open} ground-level sniffing. ${tier} energy—fun for practice, risky for dinner.`;
}

async function resolveContractAddress(
  tokenSymbol: string | null | undefined,
  contractAddress: string | null | undefined,
  chain: SupportedChain,
): Promise<string> {
  if (contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return contractAddress;
  }

  const key = (tokenSymbol || '').toLowerCase().trim();
  if (key && KNOWN_TOKENS[key]) {
    return KNOWN_TOKENS[key];
  }

  if (key) {
    const resolved = await lookupContractFromCoinGecko(key, chain);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('Unable to resolve contract address. Provide a valid contractAddress or known token symbol.');
}

export const tokenRetrievalTool = tool({
  description: 'Fetch token metadata, balances, and analysis via Alchemy Token API.',
  inputSchema: z.object({
    contractAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('ERC-20 token contract address.'),
    tokenSymbol: z
      .string()
      .optional()
      .describe('Token symbol (e.g., "USDC", "UNI", "APE").'),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('Wallet address to check token balance for.'),
    chain: z
      .enum(['eth-mainnet', 'polygon-mainnet', 'arbitrum-mainnet', 'optimism-mainnet', 'base-mainnet', 'bnb-mainnet'])
      .optional()
      .default('eth-mainnet')
      .describe('Blockchain network (default: eth-mainnet).'),
  }),
  execute: async ({ 
    contractAddress, 
    tokenSymbol, 
    walletAddress, 
    chain = 'eth-mainnet' 
  }: {
    contractAddress?: string | null;
    tokenSymbol?: string | null;
    walletAddress?: string | null;
    chain?: SupportedChain;
  }) => {
    try {
      if (!serverEnv.ALCHEMY_API_KEY) {
        return { success: false, error: 'ALCHEMY_API_KEY not configured' };
      }

      const resolved = await resolveContractAddress(tokenSymbol, contractAddress, chain);
      const host = chainToHost[chain] ?? 'eth-mainnet';

      // Get token metadata
      const metadataUrl = `https://${host}.g.alchemy.com/v2/${serverEnv.ALCHEMY_API_KEY}`;
      
      const metadataPayload = {
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [resolved],
        id: 1
      };

      const metadataRes = await fetch(metadataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataPayload)
      });

      if (!metadataRes.ok) {
        return { success: false, error: `Alchemy metadata error ${metadataRes.status}` };
      }

      const metadataData = await metadataRes.json();
      const metadata = metadataData.result;

      if (!metadata) {
        return { success: false, error: 'Token metadata not found' };
      }

      // Get token balance if wallet address provided
      let balance = null;
      if (walletAddress) {
        const balancePayload = {
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [walletAddress, [resolved]],
          id: 2
        };

        const balanceRes = await fetch(metadataUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(balancePayload)
        });

        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          const tokenBalances = balanceData.result?.tokenBalances;
          if (tokenBalances && tokenBalances.length > 0) {
            const rawBalance = tokenBalances[0].tokenBalance;
            if (rawBalance && rawBalance !== '0x0') {
              const decimals = metadata.decimals || 18;
              const balanceNum = parseInt(rawBalance, 16) / Math.pow(10, decimals);
              balance = {
                raw: rawBalance,
                formatted: balanceNum.toLocaleString(),
                decimals: decimals
              };
            }
          }
        }
      }

      // Generate analysis and roast
      const analysis = analyzeToken(
        metadata.symbol || 'UNKNOWN',
        metadata.name || 'Unknown Token',
        resolved,
        undefined, // totalSupply not available in basic metadata
        metadata.decimals
      );

      const roast = generateTokenRoast(
        metadata.name || 'Unknown Token',
        metadata.symbol || 'UNKNOWN',
        analysis
      );

      // External links based on chain
      const explorerUrl = chain === 'bnb-mainnet' 
        ? `https://bscscan.com/token/${resolved}`
        : `https://etherscan.io/token/${resolved}`;
      
      const dexUrl = chain === 'bnb-mainnet'
        ? `https://pancakeswap.finance/swap?outputCurrency=${resolved}`
        : `https://app.uniswap.org/#/tokens/ethereum/${resolved}`;
        
      const coingeckoUrl = `https://www.coingecko.com/en/coins/${metadata.symbol?.toLowerCase()}`;

      return {
        success: true,
        chain,
        token: {
          contractAddress: resolved,
          name: metadata.name || 'Unknown Token',
          symbol: metadata.symbol || 'UNKNOWN',
          decimals: metadata.decimals || 18,
          logo: metadata.logo || null,
          explorerUrl,
          dexUrl,
          coingeckoUrl,
        },
        balance: balance || undefined,
        wallet: walletAddress || undefined,
        analysis: {
          score: analysis.score,
          tier: analysis.tier,
          category: analysis.category,
          riskLevel: analysis.riskLevel,
          highlights: analysis.highlights,
          roast: roast,
        },
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unexpected error' };
    }
  },
});
