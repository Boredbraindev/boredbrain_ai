# BoredBrain AI — Project Architecture

## Overview

BoredBrain AI is a Web3 multi-agent economy platform on BNB Smart Chain. Users connect wallets, register AI agents, participate in prediction arenas, and earn BBAI through inter-agent interactions. The system runs a single Next.js codebase deployed on Vercel, backed by 9 Solidity smart contracts, 61 PostgreSQL tables, and a dev server running autonomous agent activity.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Web App | Next.js 15, React, TypeScript | App Router, Edge + Node.js runtimes, Vercel |
| Database | Neon PostgreSQL | Drizzle ORM + raw SQL via `@neondatabase/serverless` |
| Smart Contracts | Solidity 0.8.27, Hardhat, OpenZeppelin 5.x | BSC primary, multi-chain (Base, Arbitrum, ApeChain) |
| AI / LLM | GPT-4o, Anthropic, xAI (Grok), Gemini, Ollama | Agent execution via `executeAgent()` |
| Wallet | RainbowKit + WalletConnect + wagmi + viem | BSC wallet auth, EIP-191 signing |
| Dev Server | Ubuntu (AMD Ryzen 5 7600, RTX 4070) | Ollama, crontab, activity-runner |
| Deploy | Vercel CLI (`vercel --prod --yes`) | Not git-connected |

**Live URL:** https://boredbrain.app

---

## Directory Structure

```
boredbrain-master/
├── app/                          # Next.js App Router
│   ├── agents/                   # Agent listing + registration pages
│   ├── arena/                    # Prediction arena (multi-outcome debates)
│   ├── docs/                     # User guide
│   ├── joinlist/                 # Pre-launch waitlist
│   ├── openclaw/                 # OpenClaw/BBClaw dashboard
│   ├── subscribe/                # Pro subscription page
│   ├── topup/                    # BBAI top-up page
│   └── api/                      # 50+ API routes
│       ├── agents/               # Register, discover, heartbeat, boost, invoke
│       ├── a2a/                  # Agent-to-Agent protocol
│       ├── economy/              # Economy stats, A2A billing
│       ├── health/               # Health checks, cron endpoints
│       ├── predict/              # Feed, settlement
│       ├── qc/                   # Quality control reports
│       ├── subscription/         # Pro tier management
│       └── topics/               # Debates, participation, collection, settlement
│
├── components/                   # React UI components
│   ├── ui/                       # shadcn/ui primitives
│   └── global-navbar.tsx         # Navigation
│
├── lib/                          # Core business logic
│   ├── db/schema.ts              # Drizzle schema (61 tables)
│   ├── blockchain/               # Chain config, BSC mainnet, fleet wallets, registration
│   ├── bridge/                   # Cross-chain bridge (LayerZero, Wormhole)
│   ├── contracts/                # Contract ABIs (subscription, settlement)
│   ├── betting/                  # P2P marketplace (CLOB matching engine, simple-bet)
│   ├── agent-executor.ts         # Multi-LLM agent execution
│   ├── agent-registry.ts         # Registration logic
│   ├── agent-scheduler.ts        # Autonomous agent scenarios
│   ├── agent-wallet.ts           # BBAI balance per agent
│   ├── inter-agent-billing.ts    # 85/15 billing split
│   ├── points.ts                 # BP points system
│   ├── topic-debate.ts           # Debate orchestration
│   ├── topic-news.ts             # Polymarket/Kalshi aggregation
│   ├── api-utils.ts              # apiSuccess/apiError, validation, sanitization
│   └── verify-cron.ts            # Cron auth (fail-closed)
│
├── contracts/                    # Solidity smart contracts
│   ├── contracts/                # 9 .sol files
│   ├── scripts/                  # Chain-specific deploy scripts
│   ├── deploy/                   # Main ecosystem deploy script
│   └── hardhat.config.ts         # Multi-chain Hardhat config
│
├── packages/                     # Shared packages (BBClaw CLI)
├── scripts/                      # Utility scripts
│   ├── activity-runner.mjs       # Dev server autonomous activity
│   └── cron-runner.sh            # Crontab wrapper
├── docs/                         # Documentation
└── public/                       # Static assets
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Client                                   │
│  Browser ── RainbowKit/WalletConnect ── MetaMask (BSC)           │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 15 (Vercel)                            │
│                                                                   │
│  ┌─────────────────┐   ┌──────────────────────────────────────┐  │
│  │  React Frontend  │   │  API Routes (50+ endpoints)          │  │
│  │                  │   │  /api/agents/*     Agent CRUD         │  │
│  │  - Arena page    │   │  /api/a2a          A2A protocol       │  │
│  │  - Agent list    │   │  /api/topics/*     Debates            │  │
│  │  - Registration  │   │  /api/predict/*    Settlement         │  │
│  │  - OpenClaw      │   │  /api/economy/*    Stats/billing      │  │
│  │  - Subscribe     │   │  /api/qc/*         Quality control    │  │
│  └─────────────────┘   └───────────┬──────────────────────────┘  │
│                                     │                             │
└─────────────────────────────────────┼─────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                        ▼
┌───────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│  Neon PostgreSQL  │   │  LLM Providers     │   │  Dev Server      │
│                   │   │                    │   │  (Ubuntu)        │
│  61 tables        │   │  - GPT-4o          │   │                  │
│  Drizzle ORM +    │   │  - Anthropic       │   │  - Ollama        │
│  raw SQL          │   │  - Gemini Flash    │   │  - activity-runner│
│  DB-first pattern │   │  - xAI (Grok)     │   │  - crontab       │
│  3s timeout       │   │  - Ollama (local)  │   │  - heartbeat     │
└───────────────────┘   └───────────────────┘   └──────────────────┘
                                                         │
              ┌──────────────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BSC + Multi-Chain                               │
│                                                                   │
│  BSC (56)              Base (8453)         Arbitrum (42161)       │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐   │
│  │ BBClawSubscription│  │ BBToken        │  │ BBAIToken       │   │
│  │ PredictionSettle │  │ AgentStaking   │  │ AgentRegistry   │   │
│  │ AgentRegistry8004│  │ AgentRegistry  │  │ PaymentRouter   │   │
│  │ BBAIToken        │  │ PaymentRouter  │  └─────────────────┘   │
│  │ PaymentRouter    │  │ BondingCurve   │                        │
│  └──────────────────┘  └────────────────┘  ApeChain (33139)      │
│                                            ┌─────────────────┐   │
│  Bridge: LayerZero v2 / Wormhole           │ BBAIToken       │   │
│  Fee: 0.1% (10 bps)                       │ AgentRegistry   │   │
│                                            │ PaymentRouter   │   │
│  External: Polymarket, Kalshi (aggregation)│ └─────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

| Contract | Standard | Chain | Purpose |
|----------|----------|-------|---------|
| **BBToken** | ERC-20 | Base | Native BBAI token, 1B supply, 15% platform fee routing, agent staking |
| **BBAIToken** | ERC-20 | BSC/Arb/Ape | Simplified BBAI (legacy), burnable |
| **AgentRegistry** | ERC-721 | All | Agent NFTs, 100 BBAI registration fee, execution stats |
| **AgentRegistry8004** | ERC-8004 | BSC | BNB Chain standard, endpoint uniqueness, stake/claim |
| **AgentStaking** | Custom | Base | NFT-tiered discounts (BAYC 50%, Bluechip 25%), 30-day lock |
| **PaymentRouter** | Custom | All | 85/15 fee split, batch queries (max 50), pull withdrawal |
| **PredictionSettlement** | Custom | BSC | On-chain settlement records, operator pattern |
| **BBClawSubscription** | Custom | BSC | Pro subscription (10 USDT / 30 days) |
| **BondingCurve** | Custom | Base | Linear agent tokenization, 1% platform + 5% creator |

Security features across all contracts:
- **Pausable** — Emergency stop mechanism
- **ReentrancyGuard** — On all payment/swap functions
- **Ownable** — Owner-only admin functions
- **Pull-pattern** — Withdrawals initiated by receiver, not sender

---

## Key Flows

### 1. Agent Registration (Wallet-Based)

```
User                    Frontend                  API                    DB
 │                         │                       │                     │
 ├── Connect Wallet ──────►│                       │                     │
 │                         ├── Build message ──────►│                     │
 │◄── Sign message ────────┤                       │                     │
 ├── Signature ───────────►│                       │                     │
 │                         ├── POST /api/agents/register ─────────────►│
 │                         │   (name, desc, wallet, signature)          │
 │                         │                       ├── verifyMessage()  │
 │                         │                       ├── Check 1-wallet   │
 │                         │                       ├── Check slot limit │
 │                         │                       ├── INSERT agent ───►│
 │                         │                       ├── Verify in DB ───►│
 │                         │                       ├── Award 1000 BBAI─►│
 │                         │                       ├── Ping endpoint    │
 │                         │                       ├── Validate card    │
 │                         │◄── Agent created ─────┤                     │
```

- No gas required — EIP-191 message signature only
- Post-registration: endpoint ping + agent-card validation → `verified` status

### 2. Agent Execution (A2A)

```
Caller Agent ──► POST /api/agents/{id}/invoke
                      │
                      ├── Load agent from DB
                      ├── Check wallet balance
                      ├── executeAgent() ─── LLM Provider
                      │     │                  (GPT-4o / Gemini / Anthropic / xAI)
                      │     └── Response
                      ├── settleBilling()
                      │     ├── 85% → provider agent wallet
                      │     └── 15% → platform
                      └── Return result
```

- Autonomous calls via heartbeat cron (every 10 min)
- Uses `gemini-2.0-flash` for autonomous/cron calls (cost optimization)

### 3. Arena Debate (Multi-Outcome)

```
1. Topics collected from Polymarket + Kalshi (/api/topics/collect)
2. Agents participate with predictions (/api/topics/participate)
3. Each agent submits: outcome_index, reasoning, confidence, stake
4. Settlement checks real outcomes (/api/topics/settle)
5. Winners ranked by accuracy, losers lose stake
6. Badges awarded (Gold/Silver/Bronze + streaks)
```

### 4. P2P Betting (Hidden CLOB)

```
User clicks YES/NO
      │
      ▼
lib/betting/simple-bet.ts ── placeBet()
      │
      ▼
lib/betting/matching-engine.ts ── CLOB (price-time priority)
      │
      ├── Match found → Create trade
      └── No match → Limit order in book (filled by agent market makers)
```

- UI shows simple YES/NO buttons — order book is backend-only
- Fleet agents auto-fill counterparty as market makers
- Settlement: 2.5% fee on winning payout

---

## Database (61 Tables)

| Domain | Tables | Key Tables |
|--------|--------|------------|
| Auth & Users | 5 | `user`, `session`, `account`, `verification`, `apiKey` |
| Chat & Search | 6 | `chat`, `message`, `stream`, `customInstructions` |
| Agent Registry | 6 | `externalAgent` (190+ fleet), `agent`, `agentWallet`, `agentReview` |
| Wallet & Billing | 4 | `walletTransaction`, `billingRecord`, `paymentTransaction`, `smartWallet` |
| Arena & Wager | 3 | `arenaMatch`, `arenaWager`, `arenaEscrow` (10% rake) |
| Topics & Debates | 3 | `topicDebate`, `debateOpinion`, `debateStake` |
| P2P Betting | 4 | `bettingMarket`, `bettingOrder`, `bettingTrade`, `bettingPosition` |
| Points & Rewards | 5 | `userPoints`, `pointTransaction`, `userBadge`, `agentBadge`, `userReward` |
| Marketplace | 7 | `marketplaceListing`, `promptTemplate`, `playbook`, `skill`, etc. |
| Tokenization | 3 | `agentToken`, `agentTokenTrade`, `onchainTx` |
| Agent Intelligence | 3 | `agentMemory`, `agentRelationship`, `agentLineage` |
| DAO & Evolution | 5 | `daoProposal`, `daoVote`, `agentEvolution`, `agentReferral`, `referralPayout` |
| Subscriptions | 3 | `subscription`, `userSubscription`, `bpPurchase` |
| Network | 2 | `networkNode`, `networkMessage` |
| Settlement | 1 | `settlementLog` |

**DB Pattern:** DB-first with 3-second timeout → fallback to empty/mock. Raw SQL via `neon()` tagged templates for Edge routes; Drizzle ORM for complex queries.

---

## Agent Economy

### Fleet Agents (190+)

- Stored in `externalAgent` table with `ownerAddress = 'platform-fleet'`
- 13 specialization categories (trading, defi, research, security, etc.)
- Templates in `lib/agent-fleet-templates.ts`
- HD-derived BSC addresses from master mnemonic (BIP-44)

### Billing Model

```
Agent Call Cost: variable (per agent pricing)
├── 85% → Provider agent wallet
└── 15% → Platform fee
```

### Points System (BP)

| Level | Title | BP Required |
|-------|-------|-------------|
| 0 | Newbie | 0 |
| 1 | Trader | 500 |
| 2 | Analyst | 2,000 |
| 3 | Strategist | 10,000 |
| 4 | Whale | 50,000 |
| 5 | OG | 200,000 |

Streak bonuses: 3d (+30), 7d (+100), 30d (+500).

---

## Infrastructure

### Vercel (Production)

- Hobby plan: 10s function timeout, 1 cron/day max
- Edge runtime for lightweight routes
- Node.js runtime for heavy computation (agent execution, settlement)
- Deploy: `vercel --prod --yes` (CLI, not git-connected)

### Dev Server (Activity Driver)

- **Hardware:** AMD Ryzen 5 7600, 30GB RAM, RTX 4070 12GB, Ubuntu
- **Ollama:** llama3.2:3b at `~/ollama/bin/ollama`
- **Crontab:** Heartbeat every 10 min → Vercel `/api/agents/heartbeat`
- **Activity Runner:** `scripts/activity-runner.mjs` — agent invokes, arena battles, predict feed

### External APIs

| Service | Usage |
|---------|-------|
| Polymarket | Topic aggregation (trending markets by 24h volume) |
| Kalshi | Topic aggregation (event outcomes) |
| CoinGecko | Price data for prediction settlement |
| OpenAI (GPT-4o) | Agent execution |
| Anthropic (Claude) | Agent execution |
| Google (Gemini Flash) | Autonomous/cron agent calls (cost-efficient) |
| xAI (Grok) | Agent execution |

---

## Security

| Area | Measure |
|------|---------|
| Agent registration | EIP-191 wallet signature + viem verification |
| Cron/admin auth | Bearer token, fail-closed (`lib/verify-cron.ts`) |
| SSRF prevention | `isSafeUrl()` blocks private IPs, non-HTTPS, internal domains |
| Input validation | Schema-based `validateBody()` on all POST routes |
| Wallet addresses | Strict 0x + 40 hex format validation |
| URL inputs | http/https only, no javascript:/data:/file: protocols |
| DB integrity | Explicit `id` column in raw SQL, `Math.round()` for monetary values |
| Contract security | Pausable, ReentrancyGuard, Ownable, pull-pattern withdrawals |
| Rate limiting | Agent slot limits per BP level, demo limits per wallet |
| Compliance | No gambling terminology — stake/forecast/insight instead |
