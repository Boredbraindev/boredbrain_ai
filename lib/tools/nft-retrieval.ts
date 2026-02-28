import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

type SupportedChain = 'eth-mainnet' | 'polygon-mainnet' | 'arbitrum-mainnet' | 'optimism-mainnet' | 'base-mainnet';

// Host mapping for REST fallback
const chainToHost: Record<SupportedChain, string> = {
  'eth-mainnet': 'eth-mainnet',
  'polygon-mainnet': 'polygon-mainnet',
  'arbitrum-mainnet': 'arb-mainnet',
  'optimism-mainnet': 'opt-mainnet',
  'base-mainnet': 'base-mainnet',
};

const KNOWN_COLLECTIONS: Record<string, string> = {
  // Popular collections mapping (lowercased keywords → contract address)
  'bayc': '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
  'bored ape yacht club': '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
  'bored ape': '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
  'azuki': '0xed5af388653567af2f388e6224dc7c4b3241c544',
  'mayc': '0x60e4d786628fea6478f785a6d7e704777c86a7c6', // Mutant Ape Yacht Club
  'mutant ape yacht club': '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
  'pudgy': '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
  'pudgy penguin': '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
  'pudgy penguins': '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
  'pudgypenguins': '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
  'lil pudgy': '0x524cab2ec69124574082676e6f654a18df49a048',
  'lil pudgys': '0x524cab2ec69124574082676e6f654a18df49a048',
  'lil pudgies': '0x524cab2ec69124574082676e6f654a18df49a048',
  'cool cats': '0x1a92f7381b9f03921564a437210bb9396471050c',
  'coolcats': '0x1a92f7381b9f03921564a437210bb9396471050c',
  'doodles': '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e',
};

const BAYC_CONTRACT = KNOWN_COLLECTIONS['bayc'];

function normalizeIpfs(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.replace('ipfs://', '')}`;
  }
  return url;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' as any });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type BaycAnalysis = {
  score: number; // 0-100
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  traitCount: number;
  highlights: string[];
};

function evaluateBaycTraits(attributes: Array<{ trait_type?: string; value?: string | number }>): BaycAnalysis | null {
  if (!Array.isArray(attributes) || attributes.length === 0) return null;

  const traitCount = attributes.length;
  let score = 0;
  const highlights: string[] = [];

  const val = (t: string) => String(t || '').toLowerCase();

  const add = (n: number, note?: string) => {
    score += n;
    if (note) highlights.push(note);
  };

  // Trait count heuristic (fewer traits can be rarer in BAYC)
  if (traitCount <= 5) add(25, 'Low trait count');
  else if (traitCount === 6) add(10, 'Tight trait set');
  else if (traitCount >= 8) add(5, 'High trait count');

  // Known spicy values
  const rareValueHit = (v?: string | number) => {
    const s = val(String(v ?? ''));
    if (s.includes('solid gold')) return 35;
    if (s.includes('trippy')) return 28;
    if (s.includes('laser')) return 22;
    if (s.includes('robot')) return 16;
    if (s.includes('crown')) return 14;
    if (s.includes('party') || s.includes('spinner') || s.includes('sushi')) return 10;
    return 0;
  };

  for (const a of attributes) {
    const inc = rareValueHit(a.value);
    if (inc > 0) add(inc, `${a.trait_type}: ${a.value}`);
  }

  // Cap score and map to tier
  if (score > 100) score = 100;
  const tier: BaycAnalysis['tier'] = score >= 80 ? 'legendary' : score >= 60 ? 'epic' : score >= 40 ? 'rare' : score >= 20 ? 'uncommon' : 'common';

  return { score, tier, traitCount, highlights };
}

function generateBaycRoast(
  tokenName: string,
  attributes: Array<{ trait_type?: string; value?: string | number }>,
  analysis: BaycAnalysis | null,
): string | null {
  if (!analysis) return null;
  const toLower = (v?: string | number) => String(v ?? '').toLowerCase();
  const vals = attributes.map((a) => toLower(a.value));

  const hits = new Set<string>();
  for (const v of vals) {
    if (v.includes('solid gold')) hits.add('solid_gold');
    if (v.includes('trippy')) hits.add('trippy');
    if (v.includes('laser')) hits.add('laser');
    if (v.includes('party')) hits.add('party');
    if (v.includes('robot')) hits.add('robot');
    if (v.includes('dmt')) hits.add('dmt');
    if (v.includes('crown')) hits.add('crown');
    if (v.includes('spinner')) hits.add('spinner');
  }

  const tier = analysis.tier.toUpperCase();
  const baseOpen = `${tokenName || 'This ape'} walks into the canopy like it owns the vines—`;

  // Spicy templates (short, witty, brutal but playful; no emojis)
  if (hits.has('solid_gold'))
    return `${baseOpen} pure bullion flex. ${tier} energy. Either you catch this banana now or it swings past and laughs.`;
  if (hits.has('trippy'))
    return `${baseOpen} colors louder than a memecoin pump. Psychedelia meets swagger. ${tier} tier—blink and it flips itself.`;
  if (hits.has('laser'))
    return `${baseOpen} laser-eye cosplay with try-hard menace. ${tier} spark, but make it ruthless. You holding, or just rubbernecking?`;
  if (hits.has('robot'))
    return `${baseOpen} steel nerves, banana battery. ${tier} circuitry says: flip fast or get flipped on.`;
  if (hits.has('party'))
    return `${baseOpen} late to the party, still stealing fruit. ${tier} mischief—swing or stand there and get out-danced.`;
  if (hits.has('crown'))
    return `${baseOpen} crown’s heavy, grip’s steady. ${tier} sovereignty—banana tax applies to clumsy hands.`;
  if (analysis.score >= 80)
    return `${baseOpen} rare air. ${tier} canopy top. Miss this vine and you’re eating bark.`;
  if (analysis.score >= 60)
    return `${baseOpen} sleek swing, sharp bite. ${tier} momentum—hesitation feeds the crocodiles.`;
  if (analysis.score >= 40)
    return `${baseOpen} decent bite, mid swing. ${tier}. Flip the branch or scout a taller tree.`;

  return `${baseOpen} mid-branch snack. ${tier}. Fun if you’re grazing—forgettable if you’re hunting.`;
}

// Generic evaluation/roast for non-BAYC collections
function evaluateGenericTraits(attributes: Array<{ trait_type?: string; value?: string | number }>): BaycAnalysis | null {
  if (!Array.isArray(attributes) || attributes.length === 0) return null;
  const traitCount = attributes.length;
  let score = 0;
  const highlights: string[] = [];

  const val = (t: string) => t.toLowerCase();
  const add = (n: number, note?: string) => {
    score += n;
    if (note) highlights.push(note);
  };

  // Trait count heuristic
  if (traitCount <= 4) add(22, 'Sparse, clean trait set');
  else if (traitCount <= 6) add(12, 'Balanced traits');
  else add(6, 'Loaded kit');

  const rareValueHit = (raw?: string | number) => {
    const s = val(String(raw ?? ''));
    if (s.includes('gold')) return ['gold', 30] as const;
    if (s.includes('trippy') || s.includes('psychedelic')) return ['trippy', 24] as const;
    if (s.includes('laser')) return ['laser', 18] as const;
    if (s.includes('robot') || s.includes('cyborg') || s.includes('mech')) return ['robot', 16] as const;
    if (s.includes('crown') || s.includes('halo')) return ['crown', 14] as const;
    if (s.includes('skeleton') || s.includes('skull')) return ['skeleton', 16] as const;
    if (s.includes('angel') || s.includes('devil') || s.includes('demon')) return ['mythic', 14] as const;
    if (s.includes('pixel')) return ['pixel', 12] as const;
    if (s.includes('diamond')) return ['diamond', 20] as const;
    return [null, 0] as const;
  };

  for (const a of attributes) {
    const [tag, inc] = rareValueHit(a.value);
    if (inc > 0) add(inc, `${a.trait_type}: ${a.value}`);
    // bonus for space/galaxy backgrounds
    if (String(a.trait_type || '').toLowerCase().includes('background')) {
      const bg = val(String(a.value ?? ''));
      if (bg.includes('space') || bg.includes('galaxy') || bg.includes('cosmic')) add(8, 'cosmic backdrop');
    }
  }

  if (score > 100) score = 100;
  const tier: BaycAnalysis['tier'] = score >= 80 ? 'legendary' : score >= 60 ? 'epic' : score >= 40 ? 'rare' : score >= 20 ? 'uncommon' : 'common';
  return { score, tier, traitCount, highlights };
}

function generateGenericRoast(
  tokenName: string,
  collectionName: string,
  attributes: Array<{ trait_type?: string; value?: string | number }>,
  analysis: BaycAnalysis | null,
): string | null {
  if (!analysis) return null;
  const toLower = (v?: string | number) => String(v ?? '').toLowerCase();
  const vals = attributes.map((a) => toLower(a.value));

  const hits = new Set<string>();
  for (const v of vals) {
    if (v.includes('gold')) hits.add('gold');
    if (v.includes('trippy') || v.includes('psychedelic')) hits.add('trippy');
    if (v.includes('laser')) hits.add('laser');
    if (v.includes('robot') || v.includes('cyborg') || v.includes('mech')) hits.add('robot');
    if (v.includes('crown') || v.includes('halo')) hits.add('crown');
    if (v.includes('skeleton') || v.includes('skull')) hits.add('skeleton');
    if (v.includes('angel') || v.includes('devil') || v.includes('demon')) hits.add('mythic');
    if (v.includes('pixel')) hits.add('pixel');
  }

  const tier = analysis.tier.toUpperCase();
  const open = `${tokenName || 'This token'} shimmies out of ${collectionName || 'the collection'} with `;

  if (hits.has('gold')) return `${open}heavy metal swagger. ${tier} aura. Blink slow and it’s gone.`;
  if (hits.has('trippy')) return `${open}a kaleidoscope hangover. ${tier} heat—either you vibe or you bail.`;
  if (hits.has('laser')) return `${open}beams on, mercy off. ${tier}. You trading, or tanning in the blast?`;
  if (hits.has('robot')) return `${open}servo swagger. ${tier}. Flip the switch or get flipped on.`;
  if (hits.has('crown')) return `${open}budget royalty, real bite. ${tier}. Tribute is paid in exits, not likes.`;
  if (hits.has('skeleton')) return `${open}bone-deep drip. ${tier}. Paper hands rattle first.`;
  if (hits.has('pixel')) return `${open}retro venom. ${tier}. Blocky, but it bites.`;

  if (analysis.score >= 80) return `${open}predator pace. ${tier}. Miss this and you’re lunch.`;
  if (analysis.score >= 60) return `${open}sharp swing, no apology. ${tier}. Commit or step off the vine.`;
  if (analysis.score >= 40) return `${open}mid-swing snack. ${tier}. Cute bite, short reach.`;
  return `${open}leafy filler. ${tier}. Fun for the scrapbook, not the hunt.`;
}

async function resolveContractAddress(collection?: string | null, contractAddress?: string | null): Promise<string> {
  if (contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return contractAddress;
  }

  const key = (collection || '').toLowerCase().trim();
  if (key && KNOWN_COLLECTIONS[key]) {
    return KNOWN_COLLECTIONS[key];
  }

  // Best-effort contract search via REST if SDK doesn't expose search API in this version
  if (key) {
    try {
      const endpoint = `https://eth-mainnet.g.alchemy.com/nft/v3/${serverEnv.ALCHEMY_API_KEY}/searchContractMetadata?query=${encodeURIComponent(
        key,
      )}`;
      const res = await fetch(endpoint, { next: { revalidate: 60 } });
      if (res.ok) {
        const data = await res.json();
        const addr = data?.contracts?.[0]?.address;
        if (typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
          return addr;
        }
      }
    } catch {
      // ignore and fall through
    }
  }

  throw new Error('Unable to resolve contract address. Provide a valid contractAddress or recognizable collection name.');
}

export const nftRetrievalTool = tool({
  description: 'Fetch NFT metadata and traits (collection + token) via Alchemy NFT API.',
  inputSchema: z.object({
    tokenId: z.union([z.string(), z.number()]).describe('The NFT tokenId (string or number).'),
    contractAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('ERC-721/1155 contract address.'),
    collection: z
      .string()
      .optional()
      .describe('Collection name or slug (e.g., "bayc", "Bored Ape Yacht Club").'),
    chain: z
      .enum(['eth-mainnet', 'polygon-mainnet', 'arbitrum-mainnet', 'optimism-mainnet', 'base-mainnet'])
      .optional()
      .default('eth-mainnet')
      .describe('Blockchain network (default: eth-mainnet).'),
  }),
  execute: async ({ tokenId, contractAddress, collection, chain = 'eth-mainnet' }: {
    tokenId: string | number;
    contractAddress?: string | null;
    collection?: string | null;
    chain?: SupportedChain;
  }) => {
    try {
      if (!serverEnv.ALCHEMY_API_KEY) {
        return { success: false, error: 'ALCHEMY_API_KEY not configured' };
      }

      const resolved = await resolveContractAddress(collection, contractAddress);

      const tokenIdStr = String(tokenId);

      // REST fallback path
      const host = chainToHost[chain] ?? 'eth-mainnet';
      const restUrl = `https://${host}.g.alchemy.com/nft/v3/${serverEnv.ALCHEMY_API_KEY}/getNFTMetadata?contractAddress=${encodeURIComponent(
        resolved,
      )}&tokenId=${encodeURIComponent(tokenIdStr)}`;
      const res = await fetch(restUrl);
      if (!res.ok) {
        return { success: false, error: `Alchemy REST error ${res.status}` };
      }
      const data = await res.json();

      let rawMeta = (data.raw && data.raw.metadata) || data.rawMetadata || data.metadata || {};
      const attributes = (rawMeta?.attributes || []) as Array<{ trait_type?: string; value?: string | number; display_type?: string }>;
      // BAYC-specific: if attributes are missing, try fetching tokenUri metadata directly
      if ((!attributes || attributes.length === 0) && resolved.toLowerCase() === BAYC_CONTRACT) {
        const candidate = normalizeIpfs(data?.tokenUri?.gateway || (data?.raw && data?.raw?.tokenUri) || (data?.tokenUri && data?.tokenUri?.raw));
        if (candidate) {
          const fetched = await fetchJson(candidate);
          if (fetched && typeof fetched === 'object') {
            rawMeta = fetched;
          }
        }
      }

      const imageUrl = normalizeIpfs(
        data?.image?.originalUrl || data?.image?.pngUrl || data?.image?.cachedUrl || rawMeta?.image || data?.tokenUri?.gateway,
      );

      const collectionName = data?.contract?.name || data?.collection?.name || collection || '';
      const symbol = data?.contract?.symbol || '';
      const openseaUrl = `https://opensea.io/assets/ethereum/${resolved}/${tokenIdStr}`;
      const externalUrl = rawMeta?.external_url || data?.collection?.externalUrl || undefined;

      // Analysis + roast (BAYC or generic)
      const isBayc = resolved.toLowerCase() === BAYC_CONTRACT;
      const baseAttrs = ((rawMeta?.attributes as any[]) || attributes || []) as Array<{ trait_type?: string; value?: string | number }>;
      const baycAnalysis = isBayc ? evaluateBaycTraits(baseAttrs) : null;
      const genericAnalysis = !isBayc ? evaluateGenericTraits(baseAttrs) : null;
      const baycRoast = isBayc ? generateBaycRoast(
        data?.name || rawMeta?.name || `${collectionName} #${tokenIdStr}`,
        baseAttrs,
        baycAnalysis,
      ) : null;
      const genericRoast = !isBayc ? generateGenericRoast(
        data?.name || rawMeta?.name || `${collectionName} #${tokenIdStr}`,
        collectionName,
        baseAttrs,
        genericAnalysis,
      ) : null;

      return {
        success: true,
        chain,
        collection: {
          name: collectionName,
          symbol,
          contractAddress: resolved,
        },
        token: {
          id: tokenIdStr,
          name: data?.name || rawMeta?.name || `${collectionName} #${tokenIdStr}`,
          imageUrl: imageUrl || null,
          externalUrl: externalUrl || null,
          openseaUrl,
        },
        traits: ((rawMeta?.attributes as any[]) || attributes || [])
          .filter((a) => a && (a.trait_type || a.value))
          .map((a) => ({ trait_type: a.trait_type ?? 'trait', value: a.value ?? '', display_type: a.display_type })),
        analysis: (baycAnalysis || genericAnalysis)
          ? {
              collection: isBayc ? 'bayc' : 'generic',
              score: (baycAnalysis || genericAnalysis)!.score,
              tier: (baycAnalysis || genericAnalysis)!.tier,
              highlights: (baycAnalysis || genericAnalysis)!.highlights,
              traitCount: (baycAnalysis || genericAnalysis)!.traitCount,
              roast: (baycRoast || genericRoast) || undefined,
            }
          : undefined,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unexpected error' };
    }
  },
});


