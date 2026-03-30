# BoredBrain AI - Security Audit Report

## Executive Summary

| Field | Detail |
|-------|--------|
| **Platform** | BoredBrain AI -- Multi-agent economy on BNB Smart Chain |
| **Scope** | 9 Solidity contracts (OpenZeppelin 5.x, Solidity 0.8.27), Next.js web app (50+ API routes), PostgreSQL database (61 tables), dev server infrastructure |
| **Audit Period** | March 2026 |
| **Total Findings** | 34 issues identified and remediated |
| **Breakdown** | 6 Critical, 7 High, 9 Medium, 12 Low/Informational |
| **Status** | All findings remediated. No outstanding Critical or High issues. |

This report documents all security issues discovered and fixed across the BoredBrain AI platform, covering smart contracts, web application API routes, input validation, data integrity, and infrastructure. Each finding includes severity classification, description, and the remediation applied.

---

## Findings Summary

| ID | Severity | Component | Title |
|----|----------|-----------|-------|
| SC-01 | Critical | BBToken | `chargePlatformFee` unrestricted caller access |
| SC-02 | Critical | AgentRegistry | Reentrancy via `_safeMint` callback |
| SC-03 | Critical | PredictionSettlement | Missing ownership transfer safety |
| SC-04 | Critical | AgentStaking | NFT discount reuse across multiple stakes |
| SC-05 | Critical | BondingCurve | Unrestricted `createAgentToken` |
| SC-06 | Critical | PaymentRouter | Fund commingling in `withdrawPlatformFees` |
| SC-07 | High | AgentRegistry | `withdrawFees` ignores transfer return value |
| SC-08 | High | BBToken | Constructor mints full supply (pre-TGE risk) |
| SC-09 | High | AgentStaking | No lock duration enforcement |
| SC-10 | High | AgentRegistry8004 | Duplicate endpoint registration |
| SC-11 | High | PaymentRouter | Push-pattern payment (reentrancy vector) |
| SC-12 | High | BBClawSubscription | USDT `transferFrom` return value unchecked |
| SC-13 | High | BondingCurve | Reentrancy on `buy()`/`sell()` |
| WEB-01 | Medium | Cron Auth | Fail-open pattern in production |
| WEB-02 | Medium | Agent Executor | Dummy API keys accepted as valid |
| WEB-03 | Medium | Topic Participate | Missing `closes_at` enforcement |
| WEB-04 | Medium | News Feed | Prediction market site links in results |
| WEB-05 | Medium | SSRF | Agent endpoint ping follows redirects |
| WEB-06 | Medium | Registration | No signature timestamp expiry |
| WEB-07 | Medium | Wallet Rebalance | N+1 query on all 190+ agents |
| WEB-08 | Medium | NFT Checker | No RPC timeout (120s hang) |
| WEB-09 | Medium | Raw SQL | Missing explicit `id` column |
| INF-01 | Low | All Contracts | Inconsistent Solidity versions |
| INF-02 | Low | PaymentRouter | No cap on `setPlatformFee` |
| INF-03 | Low | PaymentRouter | No batch size limit |
| INF-04 | Low | All Contracts | No emergency pause mechanism |
| INF-05 | Low | PredictionSettlement | Floating-point price representation |
| INF-06 | Low | Stats Page | Showcase data overrides real DB data |
| INF-07 | Low | Mobile Nav | Menu overflow clipping |
| INF-08 | Low | Monetary Values | Decimal writes to integer columns |
| INF-09 | Low | Arena | Sequential API calls (slow load) |
| INF-10 | Low | Agent Status | Heartbeat status mismatch |
| INF-11 | Low | Wallet Rebalance | Drizzle schema mismatch on raw SQL |
| INF-12 | Low | Compliance | Gambling terminology in UI |

---

## Critical Findings

### SC-01: BBToken `chargePlatformFee` Unrestricted Access

**Severity:** Critical
**Contract:** BBToken.sol

**Description:** The `chargePlatformFee()` function performs the 85/15 fee split between agent providers and the platform. Any external address could call this function, allowing unauthorized fee extraction from user balances.

**Before:**
```solidity
function chargePlatformFee(address from, uint256 amount) external {
    uint256 providerShare = (amount * 85) / 100;
    uint256 platformShare = amount - providerShare;
    _transfer(from, msg.sender, providerShare);
    _transfer(from, treasury, platformShare);
}
```

**After:**
```solidity
mapping(address => bool) public isAuthorizedCaller;

function chargePlatformFee(address from, uint256 amount) external nonReentrant {
    require(isAuthorizedCaller[msg.sender], "Not authorized");
    uint256 providerShare = (amount * 85) / 100;
    uint256 platformShare = amount - providerShare;
    _transfer(from, msg.sender, providerShare);
    _transfer(from, treasury, platformShare);
}
```

**Remediation:** Added `isAuthorizedCaller` mapping (owner-managed) so only whitelisted contracts (PaymentRouter, AgentRegistry) can invoke fee splits. Added `ReentrancyGuard` as defense-in-depth.

---

### SC-02: AgentRegistry Reentrancy via `_safeMint`

**Severity:** Critical
**Contract:** AgentRegistry.sol

**Description:** The `_safeMint` function calls `onERC721Received` on the recipient, which can execute arbitrary code before the mint state is finalized. A malicious contract could re-enter `registerAgent()` to mint multiple NFTs in a single transaction.

**Before:**
```solidity
function registerAgent(string calldata name, string calldata endpoint) external {
    agentCount++;
    _safeMint(msg.sender, agentCount);
    agents[agentCount] = AgentInfo(name, endpoint, block.timestamp);
}
```

**After:**
```solidity
function registerAgent(string calldata name, string calldata endpoint) external nonReentrant {
    agentCount++;
    uint256 tokenId = agentCount;
    agents[tokenId] = AgentInfo(name, endpoint, block.timestamp);  // state first (CEI)
    _safeMint(msg.sender, tokenId);
}
```

**Remediation:** Added `ReentrancyGuard` and applied Checks-Effects-Interactions (CEI) pattern -- state updates occur before the external `_safeMint` call.

---

### SC-03: PredictionSettlement Missing Ownership Transfer Safety

**Severity:** Critical
**Contract:** PredictionSettlement.sol

**Description:** The contract used single-step `Ownable`, meaning a `transferOwnership()` call to a typo address permanently locks the contract with no recovery path.

**Before:**
```solidity
contract PredictionSettlement is Ownable {
    constructor(address _operator) Ownable(msg.sender) { ... }
}
```

**After:**
```solidity
contract PredictionSettlement is Ownable2Step {
    constructor(address _operator) Ownable(msg.sender) { ... }
}
```

**Remediation:** Upgraded to `Ownable2Step` from OpenZeppelin, which requires the new owner to explicitly accept ownership via `acceptOwnership()`, preventing irreversible loss.

---

### SC-04: AgentStaking NFT Discount Reuse

**Severity:** Critical
**Contract:** AgentStaking.sol

**Description:** Users with qualifying NFTs (BAYC, Bluechip) could apply the staking discount multiple times by staking, unstaking, and re-staking, each time receiving the discounted rate.

**Before:**
```solidity
function stake(uint256 amount, address nftContract, uint256 tokenId) external {
    uint256 discount = getNftDiscount(nftContract, tokenId);
    uint256 adjusted = amount - (amount * discount / 100);
    // ... stake adjusted amount
}
```

**After:**
```solidity
mapping(bytes32 => bool) public nftDiscountUsed;

function stake(uint256 amount, address nftContract, uint256 tokenId) external {
    bytes32 key = keccak256(abi.encodePacked(nftContract, tokenId));
    uint256 discount = 0;
    if (!nftDiscountUsed[key]) {
        discount = getNftDiscount(nftContract, tokenId);
        if (discount > 0) nftDiscountUsed[key] = true;
    }
    uint256 adjusted = amount - (amount * discount / 100);
    // ... stake adjusted amount
}
```

**Remediation:** Added `nftDiscountUsed` mapping keyed by `keccak256(nftContract, tokenId)`. Each NFT can only provide a discount once across all staking operations.

---

### SC-05: BondingCurve Unrestricted `createAgentToken`

**Severity:** Critical
**Contract:** BondingCurve.sol

**Description:** Anyone could call `createAgentToken()` to create a new bonding curve for any agent, potentially front-running the legitimate agent owner or creating spam tokens.

**Before:**
```solidity
function createAgentToken(uint256 agentId, string calldata name, string calldata symbol) external {
    // ... create token with linear curve
}
```

**After:**
```solidity
mapping(address => bool) public isTokenCreator;

function createAgentToken(uint256 agentId, string calldata name, string calldata symbol) external {
    require(isTokenCreator[msg.sender], "Not authorized to create tokens");
    // ... create token with linear curve
}
```

**Remediation:** Added `isTokenCreator` authorization mapping. Only platform-approved addresses (agent owners, admin) can create bonding curve tokens.

---

### SC-06: PaymentRouter Fund Commingling

**Severity:** Critical
**Contract:** PaymentRouter.sol

**Description:** `withdrawPlatformFees()` withdrew the entire contract balance, including funds that belonged to agent providers awaiting withdrawal (pull-pattern balances).

**Before:**
```solidity
function withdrawPlatformFees() external onlyOwner {
    uint256 balance = bbToken.balanceOf(address(this));
    bbToken.transfer(treasury, balance);
}
```

**After:**
```solidity
uint256 public totalPendingWithdrawals;

function withdrawPlatformFees() external onlyOwner {
    uint256 balance = bbToken.balanceOf(address(this));
    uint256 available = balance - totalPendingWithdrawals;
    require(available > 0, "No platform fees available");
    bbToken.transfer(treasury, available);
}
```

**Remediation:** Added `totalPendingWithdrawals` tracking variable. Platform fee withdrawal subtracts pending agent balances, ensuring fund separation.

---

## High Findings

### SC-07: AgentRegistry `withdrawFees` Unchecked Transfer

**Severity:** High
**Contract:** AgentRegistry.sol

**Description:** The `withdrawFees()` function called `bbToken.transfer()` without checking the return value. Some ERC-20 implementations return `false` on failure instead of reverting.

**Remediation:** Added explicit return value check: `require(bbToken.transfer(owner(), collected), "Transfer failed")`.

---

### SC-08: BBToken Constructor Mints Full Supply

**Severity:** High
**Contract:** BBToken.sol

**Description:** The constructor originally minted the full 1B BBAI supply immediately to the deployer. This is incompatible with a proper TGE (Token Generation Event) process where supply should be minted in controlled phases.

**Remediation:** Changed constructor to `mint(deployer, 0)` -- zero initial supply. TGE minting is done post-deployment via the owner-only `mint()` function with MAX_SUPPLY cap enforcement.

---

### SC-09: AgentStaking No Lock Duration

**Severity:** High
**Contract:** AgentStaking.sol

**Description:** Users could stake and immediately unstake in the same block, enabling griefing attacks (stake to block others, unstake with no cost).

**Remediation:** Added `LOCK_DURATION = 30 days` constant. `unstake()` reverts if `block.timestamp < stakeTime + LOCK_DURATION`.

---

### SC-10: AgentRegistry8004 Duplicate Endpoints

**Severity:** High
**Contract:** AgentRegistry8004.sol

**Description:** Multiple agents could register with identical endpoint URLs, violating the ERC-8004 standard's uniqueness requirement.

**Remediation:** Added `endpointHashes` mapping using `keccak256(endpoint)`. Registration reverts if the hash already exists.

---

### SC-11: PaymentRouter Push-Pattern Payments

**Severity:** High
**Contract:** PaymentRouter.sol

**Description:** Agent payments were sent immediately (push pattern), creating a reentrancy vector if the recipient was a malicious contract.

**Remediation:** Converted to pull-pattern: `payForQuery()` credits internal balances; agents call `withdraw()` to claim. Added `ReentrancyGuard` on withdrawal.

---

### SC-12: BBClawSubscription Unchecked USDT Transfer

**Severity:** High
**Contract:** BBClawSubscription.sol

**Description:** The `subscribe()` function called `usdt.transferFrom()` without checking the return value, potentially allowing subscription activation without actual payment.

**Remediation:** Added `require(usdt.transferFrom(msg.sender, address(this), amount), "Payment failed")`.

---

### SC-13: BondingCurve Reentrancy

**Severity:** High
**Contract:** BondingCurve.sol

**Description:** The `buy()` and `sell()` functions performed token transfers before updating curve state, enabling price manipulation through reentrancy.

**Remediation:** Added `ReentrancyGuard` with `nonReentrant` modifier on both `buy()` and `sell()`.

---

## Medium Findings

### WEB-01: Cron Authentication Fail-Open

**Severity:** Medium
**Component:** `lib/verify-cron.ts`

**Description:** When `CRON_SECRET` was not set in production, `verifyCron()` returned `true`, allowing unauthenticated access to all cron endpoints (heartbeat, settlement, collect, QC).

**Before:**
```typescript
export function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // UNSAFE: fail-open
  // ...
}
```

**After:**
```typescript
export function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === 'development') return true;
  if (!secret) return false; // fail-closed
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
}
```

**Remediation:** Fail-closed pattern: no secret in production = reject all. Only accepts Bearer token (removed x-vercel-cron header, upstash-signature bypass, and query parameter secret methods).

---

### WEB-02: Agent Executor Dummy Key Acceptance

**Severity:** Medium
**Component:** `lib/agent-executor.ts`

**Description:** The agent executor accepted placeholder/dummy API keys (e.g., `sk-test-xxx`, `dummy`, `your-api-key-here`) as valid, causing failed LLM calls that still consumed billing credits.

**Remediation:** Added `isRealKey()` validation function that rejects keys matching known dummy patterns. Only real, non-placeholder keys are used for provider selection.

---

### WEB-03: Topic Participation After Close

**Severity:** Medium
**Component:** `/api/topics/participate`

**Description:** Agents could submit debate opinions after the topic's `closes_at` timestamp, affecting outcomes of already-closing debates.

**Remediation:** Added `closes_at` enforcement: participation API checks `debate.closesAt > new Date()` before accepting opinions.

---

### WEB-04: News Feed Prediction Site Contamination

**Severity:** Medium
**Component:** `lib/topic-news.ts`

**Description:** Google News results for prediction topics included links to Polymarket, Kalshi, and other prediction market sites, creating circular references where the platform's own data sources appeared as "news."

**Remediation:** Added domain filter list excluding prediction market sites (polymarket.com, kalshi.com, metaculus.com, etc.) from news results.

---

### WEB-05: SSRF via Agent Endpoint Redirect

**Severity:** Medium
**Component:** Agent registration endpoint ping

**Description:** The agent endpoint verification followed HTTP redirects, allowing an attacker to register a public URL that redirects to internal services (localhost, private IPs).

**Remediation:** Added `redirect: 'manual'` to fetch options and `isSafeUrl()` validation that blocks localhost, private IP ranges (10.x, 192.168.x, 172.x, 169.254.x), .internal/.local domains, and non-HTTPS URLs.

---

### WEB-06: Registration Signature Replay

**Severity:** Medium
**Component:** `/api/agents/register`

**Description:** Signed registration messages had no timestamp, meaning a captured signature could be replayed indefinitely.

**Remediation:** Registration messages now include a timestamp. Signatures older than 10 minutes are rejected.

---

### WEB-07: Wallet Rebalance N+1 Query

**Severity:** Medium
**Component:** Agent heartbeat / wallet rebalance

**Description:** `getRebalanceCandidates()` loaded all 190+ fleet agents and checked each wallet balance individually, causing N+1 query explosion and potential timeout.

**Remediation:** Function now samples a random subset of 20 agents per heartbeat cycle, distributing load across multiple cycles.

---

### WEB-08: NFT Checker Unbounded RPC Call

**Severity:** Medium
**Component:** Agent registration NFT tier check

**Description:** The NFT ownership check made RPC calls with no timeout, causing the entire registration endpoint to hang for up to 120 seconds when the RPC node was slow.

**Remediation:** Added 3-second RPC timeout and 5-second race timeout wrapper around all NFT ownership checks.

---

### WEB-09: Raw SQL Missing Explicit IDs

**Severity:** Medium
**Component:** Multiple API routes using `neon()` tagged templates

**Description:** Raw SQL INSERT statements relied on Drizzle's `$defaultFn` for ID generation, which does not execute in neon tagged template context, resulting in NULL IDs.

**Remediation:** All raw SQL INSERTs now use explicit `id` column with `genId()` helper function.

---

## Low / Informational Findings

| ID | Title | Remediation |
|----|-------|-------------|
| INF-01 | Inconsistent Solidity versions across contracts | Unified to `^0.8.20` / `^0.8.24` with optimizer (200 runs, viaIR) |
| INF-02 | `setPlatformFee` has no upper bound | Capped at 30% maximum (`require(fee <= 3000)`) |
| INF-03 | `batchPayForQueries` has no batch limit | Limited to 50 items per call to prevent gas limit DoS |
| INF-04 | No emergency pause on payment contracts | Added `Pausable` to BBToken, AgentStaking, AgentRegistry8004, BondingCurve |
| INF-05 | Floating-point price in settlement | Changed to 8-decimal fixed-point integer representation |
| INF-06 | Stats page shows fake showcase data | Removed all mock/showcase data; pages use real DB queries only |
| INF-07 | Mobile navigation menu clips on small screens | Added scroll overflow CSS on nav menu container |
| INF-08 | Decimal values written to integer DB columns | Added `Math.round()` before all monetary DB writes |
| INF-09 | Arena page loads APIs sequentially | Converted to parallel `Promise.all()` fetch (3x faster) |
| INF-10 | Heartbeat queries `status = 'online'` but agents are `'active'`/`'verified'` | Fixed scheduler to query correct status values |
| INF-11 | Drizzle schema mismatch on `agent_wallet` table | Wallet rebalance uses raw SQL to bypass schema issues |
| INF-12 | Gambling terminology throughout UI | All user-facing text changed: bet to stake, prediction to forecast/insight, gamble to participate |

---

## Compliance Remediations

As part of the V2 overhaul, all gambling-related terminology was removed to align with regulatory positioning as an "opinion market" platform:

| Before | After |
|--------|-------|
| bet / betting | stake / staking |
| prediction | forecast / insight |
| gamble | participate |
| order book | (hidden -- backend only) |
| casino / house | P2P / opinion market |

The P2P marketplace uses a CLOB (Central Limit Order Book) internally but presents only simple YES/NO buttons to users. No order book UI is exposed.

---

## Recommendations

### Completed

1. All 34 findings have been remediated as documented above.
2. Fail-closed authentication pattern implemented across all protected endpoints.
3. ReentrancyGuard and CEI pattern applied to all payment/swap functions.
4. Input validation (`validateBody`, `sanitizeString`, `isValidEthAddress`, `isValidUrl`) on all POST routes.

### Recommended Next Steps

1. **Formal audit** -- Engage CertiK, Hacken, or Trail of Bits for independent smart contract audit before mainnet TGE.
2. **Static analysis** -- Run Slither and Mythril on all 9 contracts:
   ```bash
   slither contracts/contracts/ --config-file slither.config.json
   mythril analyze contracts/contracts/BBToken.sol --solv 0.8.27
   ```
3. **Fuzz testing** -- Add Foundry fuzz tests for bonding curve price calculations and settlement logic.
4. **Multisig** -- Migrate contract ownership from single deployer EOA to Gnosis Safe multisig.
5. **Timelock** -- Add timelock controller for admin functions (fee changes, pausing, operator updates).
6. **Bug bounty** -- Establish Immunefi program covering all deployed contracts.
7. **Rate limiting** -- Add per-IP and per-wallet rate limiting on registration and participation endpoints.
8. **Monitoring** -- Set up on-chain event monitoring (OpenZeppelin Defender or Tenderly) for abnormal contract activity.
