// ---------------------------------------------------------------------------
// OpenClaw / ClawHub Integration for BoredBrain AI
// Packages BoredBrain tools as OpenClaw-compatible skills with iden3 DID
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenClawSkillSchema {
  type: string;
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

export interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: 'boredbrain';
  protocol: 'openclaw-v1';
  category: string;
  inputSchema: OpenClawSkillSchema;
  outputSchema: OpenClawSkillSchema;
}

export interface ZKProof {
  proofId: string;
  protocol: 'iden3';
  circuitId: string;
  proof: {
    piA: [string, string];
    piB: [[string, string], [string, string]];
    piC: [string, string];
  };
  publicSignals: string[];
  verifiedAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// 8 BoredBrain Skills
// ---------------------------------------------------------------------------

export const BOREDBRAIN_SKILLS: OpenClawSkill[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Real-time web search across multiple engines with structured results, snippets, and metadata extraction.',
    version: '1.2.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', description: 'Array of search result objects' },
        totalResults: { type: 'number', description: 'Total matches found' },
      },
      required: ['results'],
    },
  },
  {
    id: 'crypto_data',
    name: 'Crypto Data',
    description: 'Real-time cryptocurrency prices, OHLC charts, volume, and historical data for 10,000+ tokens.',
    version: '2.0.1',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        coin: { type: 'string', description: 'Coin ID or symbol (e.g. bitcoin, ETH)' },
        currency: { type: 'string', description: 'Quote currency (default USD)' },
      },
      required: ['coin'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Current price' },
        marketCap: { type: 'number', description: 'Market capitalisation' },
        change24h: { type: 'number', description: '24h price change percentage' },
      },
      required: ['price'],
    },
  },
  {
    id: 'wallet_analyzer',
    name: 'Wallet Analyzer',
    description: 'Deep on-chain wallet analysis including holdings, transaction history, PnL tracking, and whale behaviour detection.',
    version: '1.8.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'blockchain',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address (0x...) or ENS name' },
        chain: { type: 'string', description: 'Chain: ethereum, polygon, arbitrum' },
      },
      required: ['address'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number', description: 'Total wallet value in USD' },
        tokens: { type: 'array', description: 'Token holdings breakdown' },
        riskScore: { type: 'number', description: 'Risk score 0-100' },
      },
      required: ['balance', 'tokens'],
    },
  },
  {
    id: 'agent_arena',
    name: 'Agent Arena',
    description: 'Create and monitor AI agent competition matches. Pit agents against each other in research, analysis, and prediction tasks.',
    version: '2.1.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'agents',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic or challenge' },
        agents: { type: 'string', description: 'Comma-separated agent IDs' },
        matchType: { type: 'string', description: 'Type: research, analysis, prediction' },
      },
      required: ['topic', 'agents'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        matchId: { type: 'string', description: 'Unique match identifier' },
        status: { type: 'string', description: 'Match status' },
        results: { type: 'array', description: 'Agent results and scores' },
      },
      required: ['matchId', 'status'],
    },
  },
  {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    description: 'Multi-source sentiment analysis across X/Twitter, Reddit, and news. Tracks trending topics and community signals.',
    version: '1.5.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'social',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or token to analyse sentiment for' },
        sources: { type: 'string', description: 'Comma-separated: twitter, reddit, news' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Sentiment score -1 to 1' },
        breakdown: { type: 'object', description: 'Per-source sentiment breakdown' },
        trending: { type: 'boolean', description: 'Whether topic is trending' },
      },
      required: ['score'],
    },
  },
  {
    id: 'code_audit',
    name: 'Code Audit',
    description: 'Automated smart contract and codebase security auditing. Detects vulnerabilities, gas optimisation issues, and best-practice violations.',
    version: '1.0.3',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Source code or contract address to audit' },
        language: { type: 'string', description: 'Language: solidity, rust, typescript' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        vulnerabilities: { type: 'array', description: 'List of found vulnerabilities' },
        severity: { type: 'string', description: 'Overall severity: low, medium, high, critical' },
        gasOptimisations: { type: 'array', description: 'Gas optimisation suggestions' },
      },
      required: ['vulnerabilities', 'severity'],
    },
  },
  {
    id: 'nft_metadata',
    name: 'NFT Metadata',
    description: 'Fetch and analyse NFT collection metadata, floor prices, rarity scores, and ownership distribution across chains.',
    version: '1.3.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'blockchain',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection address or slug' },
        tokenId: { type: 'string', description: 'Specific token ID (optional)' },
        chain: { type: 'string', description: 'Chain: ethereum, polygon, solana' },
      },
      required: ['collection'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Collection or token name' },
        floorPrice: { type: 'number', description: 'Current floor price in ETH' },
        rarityScore: { type: 'number', description: 'Rarity ranking score' },
        traits: { type: 'array', description: 'Token trait list' },
      },
      required: ['name'],
    },
  },
  {
    id: 'defi_yield',
    name: 'DeFi Yield',
    description: 'Aggregate DeFi yield farming opportunities across protocols. Compares APY, TVL, risk metrics, and impermanent loss estimates.',
    version: '1.1.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'defi',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', description: 'Protocol name or "all" for aggregation' },
        chain: { type: 'string', description: 'Chain filter: ethereum, arbitrum, all' },
        minTvl: { type: 'number', description: 'Minimum TVL in USD' },
      },
      required: ['protocol'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        pools: { type: 'array', description: 'Matching yield pools' },
        bestApy: { type: 'number', description: 'Highest APY found' },
        totalTvl: { type: 'number', description: 'Total TVL across results' },
      },
      required: ['pools'],
    },
  },
];

// ---------------------------------------------------------------------------
// ClawHub Registry Class
// ---------------------------------------------------------------------------

export class ClawHubRegistry {
  private skills: OpenClawSkill[];
  private registeredAt: string;

  constructor() {
    this.skills = BOREDBRAIN_SKILLS;
    this.registeredAt = '2025-11-15T00:00:00Z';
  }

  /** Register all BoredBrain skills with the ClawHub registry. */
  registerSkills(): {
    success: boolean;
    registeredCount: number;
    packageName: string;
    registrationId: string;
  } {
    return {
      success: true,
      registeredCount: this.skills.length,
      packageName: '@boredbrain/mcp-skills',
      registrationId: `clawhub-reg-${Date.now().toString(36)}`,
    };
  }

  /** Return the full skill manifest for ClawHub discovery. */
  getSkillManifest(): {
    protocol: string;
    version: string;
    package: string;
    author: string;
    totalSkills: number;
    skills: OpenClawSkill[];
    registeredAt: string;
  } {
    return {
      protocol: 'openclaw-v1',
      version: '2.1.0',
      package: '@boredbrain/mcp-skills',
      author: 'boredbrain',
      totalSkills: this.skills.length,
      skills: this.skills,
      registeredAt: this.registeredAt,
    };
  }

  /** Verify an agent identity via iden3 DID (mock). */
  verifyIdentity(did: string): {
    valid: boolean;
    did: string;
    trustScore: number;
    claims: string[];
  } {
    const iden3Pattern = /^did:iden3:[a-z]+:[a-z]+:[a-zA-Z0-9]+$/;
    const valid = iden3Pattern.test(did);

    return {
      valid,
      did,
      trustScore: valid ? 95 : 0,
      claims: valid
        ? ['agent:operator', 'clawhub:registered', 'boredbrain:mcp-access', 'iden3:zk-verified']
        : [],
    };
  }
}

// ---------------------------------------------------------------------------
// iden3 DID Verification (Mock ZK Proofs)
// ---------------------------------------------------------------------------

/**
 * Generate a mock iden3 ZK proof for a given wallet address.
 * In production this would call the iden3 issuer node and circuit prover.
 */
export function generateProof(address: string): ZKProof {
  const hash = Array.from(address).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hex = (n: number) => `0x${(BigInt(n) * BigInt(2n ** 64n) + BigInt(hash)).toString(16).padStart(64, '0')}`;

  return {
    proofId: `proof-${Date.now().toString(36)}-${hash.toString(16)}`,
    protocol: 'iden3',
    circuitId: 'credentialAtomicQuerySigV2',
    proof: {
      piA: [hex(1), hex(2)],
      piB: [
        [hex(3), hex(4)],
        [hex(5), hex(6)],
      ],
      piC: [hex(7), hex(8)],
    },
    publicSignals: [
      hex(hash),
      `0x${address.replace('0x', '').padStart(64, '0')}`,
      `0x${Date.now().toString(16).padStart(64, '0')}`,
    ],
    verifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Verify a mock iden3 ZK proof.
 * In production this would check the proof against the on-chain state contract.
 */
export function verifyProof(proof: ZKProof): boolean {
  return (
    proof.protocol === 'iden3' &&
    proof.circuitId === 'credentialAtomicQuerySigV2' &&
    Array.isArray(proof.proof.piA) &&
    proof.proof.piA.length === 2 &&
    Array.isArray(proof.proof.piC) &&
    proof.proof.piC.length === 2 &&
    proof.publicSignals.length >= 2 &&
    new Date(proof.expiresAt).getTime() > Date.now()
  );
}

// ---------------------------------------------------------------------------
// Singleton via globalThis
// ---------------------------------------------------------------------------

const GLOBAL_KEY = '__clawhub_registry__' as const;

function getGlobalRegistry(): ClawHubRegistry {
  const g = globalThis as unknown as Record<string, ClawHubRegistry | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new ClawHubRegistry();
  }
  return g[GLOBAL_KEY]!;
}

export const clawHubRegistry = getGlobalRegistry();
