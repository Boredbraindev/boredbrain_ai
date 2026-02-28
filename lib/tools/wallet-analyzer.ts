import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

type SupportedChain = 'eth-mainnet' | 'polygon-mainnet' | 'arbitrum-mainnet' | 'optimism-mainnet' | 'base-mainnet';
type ChainOption = SupportedChain | 'auto';

const chainToHost: Record<SupportedChain, string> = {
  'eth-mainnet': 'eth-mainnet',
  'polygon-mainnet': 'polygon-mainnet',
  'arbitrum-mainnet': 'arb-mainnet',
  'optimism-mainnet': 'opt-mainnet',
  'base-mainnet': 'base-mainnet',
};

const stableSymbols = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'BUSD']);

function hexToBigInt(hex?: string) {
  if (!hex || typeof hex !== 'string') return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function normalize(balanceHex: string, decimals: number): number {
  const raw = hexToBigInt(balanceHex);
  if (decimals <= 0) return Number(raw);
  const denom = BigInt(10) ** BigInt(decimals);
  const whole = Number(raw / denom);
  const frac = Number(raw % denom) / Number(denom);
  return whole + frac;
}

export const walletAnalyzerTool = tool({
  description: 'Analyze a wallet address to infer on-chain persona, risk and edge profile (Alchemy-only).',
  inputSchema: z.object({
    address: z.string().describe('Wallet address (0x...)'),
    chain: z
      .enum(['auto', 'eth-mainnet', 'polygon-mainnet', 'arbitrum-mainnet', 'optimism-mainnet', 'base-mainnet'])
      .optional()
      .default('auto'),
    maxTokens: z.number().optional().default(12),
  }),
  execute: async ({ address, chain = 'auto', maxTokens = 12 }: { address: string; chain?: ChainOption; maxTokens?: number }) => {
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return { success: false, error: 'Invalid address format' };
      }
      if (!serverEnv.ALCHEMY_API_KEY) {
        return { success: false, error: 'ALCHEMY_API_KEY not configured' };
      }
      // JSON-RPC helper
      const rpc = async (host: string, method: string, params: any[]) => {
        const r = await fetch(`https://${host}.g.alchemy.com/v2/${serverEnv.ALCHEMY_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        if (!r.ok) return null;
        const j = await r.json();
        return j?.result ?? null;
      };

      // 1) ERC-20 balances (auto-detect richest chain when chain === 'auto')
      const candidateHosts: string[] =
        chain === 'auto'
          ? ['eth-mainnet', 'base-mainnet', 'polygon-mainnet', 'arbitrum-mainnet', 'optimism-mainnet']
          : [chainToHost[chain as SupportedChain] ?? 'eth-mainnet'];

      let selectedHost = candidateHosts[0];
      let bestBalances: Array<{ contractAddress: string; tokenBalance: string }> = [];

      for (const host of candidateHosts) {
        // Prefer JSON-RPC alchemy_getTokenBalances for broad support
        let arr: Array<{ contractAddress: string; tokenBalance: string }> = [];
        const rpcRes = await rpc(host, 'alchemy_getTokenBalances', [address]);
        if (rpcRes && Array.isArray(rpcRes?.tokenBalances)) {
          arr = rpcRes.tokenBalances as any[];
        } else {
          // REST fallback (not always available depending on plan)
          try {
            const url = `https://${host}.g.alchemy.com/v2/${serverEnv.ALCHEMY_API_KEY}/getTokenBalances?address=${address}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
              const j = await res.json();
              arr = Array.isArray(j?.tokenBalances) ? j.tokenBalances : [];
            }
          } catch {
            // ignore
          }
        }
        if (arr.length > bestBalances.length) {
          bestBalances = arr;
          selectedHost = host;
        }
      }

      const tokenBalances: Array<{ contractAddress: string; tokenBalance: string }> = bestBalances;

      // 2) Token metadata for top N (by raw balance)
      const sorted = tokenBalances
        .slice()
        .sort((a, b) => (hexToBigInt(b.tokenBalance) > hexToBigInt(a.tokenBalance) ? 1 : -1))
        .slice(0, maxTokens);

      const metaCalls = await Promise.all(
        sorted.map(async (t) => {
          const m = await rpc(selectedHost, 'alchemy_getTokenMetadata', [t.contractAddress]);
          if (!m) return null;
          const symbol = m?.symbol || '';
          const decimals = typeof m?.decimals === 'number' ? m.decimals : 18;
          const amount = normalize(t.tokenBalance, decimals);
          return { symbol, contractAddress: t.contractAddress, decimals, amount };
        }),
      );

      const balances = metaCalls.filter(Boolean) as Array<{ symbol: string; contractAddress: string; decimals: number; amount: number }>;
      const sumAmount = balances.reduce((acc, b) => acc + (Number.isFinite(b.amount) ? b.amount : 0), 0) || 1; // avoid div by zero
      const top = balances[0];
      const topWeight = top ? top.amount / sumAmount : 0;
      const stablePct = balances
        .filter((b) => stableSymbols.has((b.symbol || '').toUpperCase()))
        .reduce((acc, b) => acc + (b.amount / sumAmount), 0);

      // 3) Recent transfers (optional gist)
      const transfersBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromAddress: address,
            category: ['erc20', 'erc721', 'erc1155', 'external'],
            withMetadata: false,
            maxCount: '0x32', // 50
            order: 'desc',
          },
        ],
      } as const;
      const txRes = await fetch(`https://${selectedHost}.g.alchemy.com/v2/${serverEnv.ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfersBody),
      });
      const txJson = txRes.ok ? await txRes.json() : null;
      const transfers = Array.isArray(txJson?.result?.transfers) ? txJson.result.transfers : [];

      // 4) NFT ownership snapshot (top collections)
      let ownedCount = 0;
      let topCollections: Array<{ name: string; address: string; count: number }> = [];
      try {
        const nftsUrl = `https://${selectedHost}.g.alchemy.com/nft/v3/${serverEnv.ALCHEMY_API_KEY}/getNFTsForOwner/?owner=${address}&withMetadata=false&pageSize=100`;
        const nRes = await fetch(nftsUrl, { cache: 'no-store' });
        if (nRes.ok) {
          const nJson = await nRes.json();
          const arr = Array.isArray(nJson?.ownedNfts) ? nJson.ownedNfts : Array.isArray(nJson?.nfts) ? nJson.nfts : [];
          ownedCount = Array.isArray(nJson?.ownedNfts) && typeof nJson?.totalCount === 'number' ? nJson.totalCount : arr.length;
          const map = new Map<string, { name: string; address: string; count: number }>();
          for (const it of arr) {
            const addr = it?.contract?.address || it?.contractAddress || '';
            if (!addr) continue;
            const name = it?.contract?.name || it?.name || 'Collection';
            const prev = map.get(addr);
            if (prev) prev.count += 1;
            else map.set(addr, { name, address: addr, count: 1 });
          }
          topCollections = Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
        }
      } catch {}

      // NFT persona heuristic
      let nftPersona: string | null = null;
      const txCount = transfers.length;
      if (ownedCount >= 25 && txCount < ownedCount * 0.3) nftPersona = 'Collector';
      else if (txCount > ownedCount * 0.8 && ownedCount > 0) nftPersona = 'Flipper';
      else if (ownedCount <= 5) nftPersona = 'Grazer';

      // Persona heuristics
      let persona = 'Explorer';
      if (topWeight > 0.65) persona = 'Conviction Holder';
      else if (balances.length >= 8) persona = 'Sampler';
      else if (stablePct > 0.6) persona = 'Capital Preserver';
      if (transfers.length >= 40 && persona !== 'Capital Preserver') persona = 'Active Swinger';

      let risk = 55;
      if (persona === 'Conviction Holder') risk = 62;
      if (persona === 'Sampler') risk = 65;
      if (persona === 'Capital Preserver') risk = 30;
      if (persona === 'Active Swinger') risk = 68;

      const edges: string[] = [];
      if (stablePct > 0.5) edges.push('Solid stable allocation discipline');
      if (topWeight > 0.6 && top?.symbol) edges.push(`High conviction in ${top.symbol}`);
      if (balances.some((b) => (b.symbol || '').toUpperCase() === 'BNB')) edges.push('BNB alignment adds chain liquidity tailwind');

      return {
        success: true,
        chain: selectedHost,
        address,
        tokens: balances
          .map((b) => ({ symbol: b.symbol, contractAddress: b.contractAddress, amount: Math.round(b.amount * 1000) / 1000 }))
          .slice(0, 8),
        persona: { label: persona, riskScore: Math.round(risk) },
        edges,
        activitySample: { transferCount: transfers.length },
        nfts: {
          ownedCount,
          topCollections,
          nftPersona: nftPersona || undefined,
        },
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unexpected error' };
    }
  },
});


