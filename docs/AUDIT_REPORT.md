# BoredBrain AI — Security Audit & Bug Fix Report (March 2026)

## Summary

| Metric | Detail |
|--------|--------|
| **Total issues found and fixed** | 30+ items |
| **Scope** | 9 Solidity contracts, Next.js web app (50+ API routes), PostgreSQL DB (61 tables), dev server infra |
| **Audit period** | March 2026 |
| **Platform** | BoredBrain AI — multi-agent economy on BNB Smart Chain |

---

## Smart Contract Audit Fixes

### Critical (4)

| ID | Contract | Description |
|----|----------|-------------|
| C-1 | BBToken | `MAX_SUPPLY = 1B` cap enforced in `mint()` — prevents infinite minting beyond 1 billion BBAI |
| C-2 | AgentStaking | 30-day `LOCK_DURATION` enforced — prevents immediate unstake after staking (stake griefing) |
| C-3 | AgentRegistry8004 | Endpoint uniqueness via keccak256 hash — prevents duplicate agent registration with same endpoint URL |
| C-4 | PredictionSettlement | Operator/owner separation — only designated operator or owner can call `settleRound()`, prevents unauthorized settlement |

### High (5)

| ID | Contract | Description |
|----|----------|-------------|
| H-1 | PaymentRouter | Pull-pattern withdrawal instead of push — agent owners call `withdraw()` to claim, prevents reentrancy on payment |
| H-2 | BBToken | `chargePlatformFee()` uses `ReentrancyGuard` — prevents reentrancy during 85/15 fee split transfer |
| H-3 | AgentStaking | NFT ownership verified on-chain via `IERC721.ownerOf()` before applying tier discount — prevents fake NFT claims |
| H-4 | BBClawSubscription | USDT `transferFrom()` return value checked — prevents subscription without actual payment |
| H-5 | BondingCurve | `ReentrancyGuard` on `buy()` and `sell()` — prevents price manipulation via reentrancy during curve trades |

### Medium (7)

| ID | Contract | Description |
|----|----------|-------------|
| M-1 | All contracts | `Pausable` emergency stop on BBToken, AgentStaking, AgentRegistry8004, BondingCurve |
| M-2 | All contracts | `Ownable` access control (owner-only admin functions) |
| M-3 | BBToken | Trade fee (1%) on DEX pair transfers — anti-bot mechanism |
| M-4 | AgentRegistry8004 | `emergencyDeregister()` — admin can deactivate malicious agents |
| M-5 | AgentStaking | `emergencyUnstake()` — admin bypass of lock period for stuck funds recovery |
| M-6 | PaymentRouter | `setPlatformFee()` capped at 30% max — prevents owner setting 100% fee |
| M-7 | PaymentRouter | `batchPayForQueries()` limited to 50 items — prevents gas limit DoS |

### Low / Informational

| ID | Description |
|----|-------------|
| L-1 | All contracts unified to Solidity `^0.8.20` / `^0.8.24` with optimizer (200 runs, viaIR) |
| L-2 | BBAIToken (legacy) kept as simpler alternative — no fee routing, just ERC-20 + burn |
| L-3 | PredictionSettlement uses 8-decimal fixed-point prices to avoid floating-point issues |

---

## Web App Security Fixes

### Authentication & Authorization

| ID | Area | Description |
|----|------|-------------|
| W-1 | Cron auth | `verifyCron()` fail-closed — no secret in production = reject all. Only accepts Bearer token (removed x-vercel-cron header, upstash-signature bypass, query param secrets) |
| W-2 | Wallet signature | Registration requires EIP-191 personal_sign verified via `viem.verifyMessage()` — message must contain wallet address + agent name |
| W-3 | Signature freshness | 10-minute timestamp expiry on registration signatures — prevents replay attacks |
| W-4 | SSRF protection | `isSafeUrl()` blocks localhost, private IPs (10.x, 192.168.x, 172.x, 169.254.x), .internal/.local domains, non-HTTPS — prevents server-side request forgery on agent endpoint verification |
| W-5 | Redirect prevention | Agent endpoint ping uses `redirect: 'manual'` — prevents SSRF via redirect chains to internal URLs |

### Input Validation & Sanitization

| ID | Area | Description |
|----|------|-------------|
| V-1 | API utils | `validateBody()` schema-based validation on all POST endpoints — type checking, maxLength, min/max, required fields |
| V-2 | API utils | `sanitizeString()` trims and truncates all user inputs to prevent oversized payloads |
| V-3 | API utils | `isValidEthAddress()` strict format (0x + 40 hex) on all wallet address inputs |
| V-4 | API utils | `isValidUrl()` allows only http/https URLs — blocks javascript:, data:, file: protocols |
| V-5 | Agent tools | Tool names sanitized and limited to 50 max per registration |
| V-6 | Agent card | `validateAgentCard()` verifies JSON structure (must be object with `name` + `description` string fields) |

### Data Integrity

| ID | Area | Description |
|----|------|-------------|
| D-1 | One wallet per agent | DB check prevents multiple agent registrations per wallet address |
| D-2 | Slot limits | BP level-based agent slot limits enforced before registration |
| D-3 | Demo limits | NFT tier-based demo agent limits (base: 1 free per wallet) |
| D-4 | DB verification | Post-registration SELECT confirms agent exists in DB before awarding 1000 BBAI reward — prevents phantom reward exploitation |
| D-5 | Raw SQL IDs | All raw SQL INSERTs use explicit `id` column with `genId()` — Drizzle `$defaultFn` doesn't work with neon tagged templates |
| D-6 | Monetary values | `Math.round()` before all DB writes — integer columns can't store decimals |
| D-7 | Showcase removal | Removed all fake/mock showcase data — stats and agent pages now use real DB data only |

### Performance & Reliability

| ID | Area | Description |
|----|------|-------------|
| P-1 | DB-first pattern | All routes try PostgreSQL (Neon) first with 3-second timeout, fall back to mock/empty |
| P-2 | NFT checker | Added 3s RPC timeout + 5s race timeout — was causing 120s registration timeout |
| P-3 | Agent heartbeat | Fixed status mismatch ('online' vs 'active'/'verified') in scheduler queries |
| P-4 | Wallet rebalance | `getRebalanceCandidates()` samples 20 agents instead of all 190+ — prevents N+1 query explosion |
| P-5 | Arena timeout | Increased to 15s for multi-agent debate API calls |
| P-6 | Parallel fetching | Arena page uses parallel API calls instead of sequential — 3x faster load |

---

## Compliance Fixes (V2 Overhaul)

| ID | Description |
|----|-------------|
| CMP-1 | ALL gambling terminology removed: bet → stake, prediction → forecast/insight |
| CMP-2 | P2P marketplace positioned as "opinion market" with CLOB hidden in backend |
| CMP-3 | No order book UI shown to users — simple YES/NO buttons only |
| CMP-4 | Settlement uses 2.5% fee on winning payout model (not house-vs-player) |

---

## Infrastructure Fixes

| ID | Area | Description |
|----|------|-------------|
| I-1 | Git CI | GitHub Actions workflow (lint + build) with `SKIP_ENV_VALIDATION` for CI environment |
| I-2 | Vercel deploy | `vercel --prod --yes` via CLI (not git-connected) — prevents accidental deploys |
| I-3 | Dev server cron | Heartbeat runs every 10 min via crontab (not Vercel cron — Hobby plan limited to 1/day) |
| I-4 | Activity runner | Self-contained `scripts/activity-runner.mjs` loads real agent IDs from API at startup, uses Ollama for creative queries |
| I-5 | Cron expression | Whitelist of allowed cron expressions in schedule route — prevents arbitrary scheduling |

---

## Bug Fixes (Functional)

| ID | Area | Description |
|----|------|-------------|
| B-1 | Stats page | React closure bug — showcase data was always overriding real DB data |
| B-2 | Mobile nav | Added scroll overflow on long menu (was clipping on small screens) |
| B-3 | Arena debates | Fixed auto-select using correct variable (`debatesList` not `data.data.debates`) |
| B-4 | Arena API | Response format mismatch — emoji thumbnails replaced with Unsplash images |
| B-5 | Trending topics | Polymarket `volume24hr` for actual trending (not all-time volume) |
| B-6 | Kalshi outcomes | `yes_sub_title` has actual outcome labels (not `title`) |
| B-7 | Duplicate debates | Fixed topic deduplication in debate creation pipeline |
| B-8 | Agent detail | Lookup from `external_agent` table (not `agent` table) for fleet agents |
| B-9 | Wallet rebalance | Raw SQL bypasses Drizzle schema mismatch on `agent_wallet` table |

---

## Feature Additions (V2)

| Feature | Description |
|---------|-------------|
| BBClaw framework | OpenClaw-compatible agent registry with wallet signing, CLI install script |
| Multi-outcome arena | Polymarket + Kalshi aggregation, top-6 card UI, collapsible overflow |
| Agent debate badges | Gold/Silver/Bronze + streak badges for arena performance |
| Pro subscription | 10 USDT/30 days via BBClawSubscription contract (BSC) |
| Bonding curve | Linear agent tokenization with 1% platform + 5% creator royalties |
| Cross-chain bridge | LayerZero v2 + Wormhole bridge config (Base ↔ BSC ↔ Arbitrum ↔ ApeChain) |
| QC automation | Quality control agent for data validation and reporting |
| Settlement agent | On-chain prediction settlement with visualization |
