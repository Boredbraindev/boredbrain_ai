# BoredBrain AI — BSC / Multi-Chain Deployment Guide

## Overview

Nine Solidity 0.8.27 contracts (OpenZeppelin 5.x) targeting BNB Smart Chain (primary) and Base/Arbitrum/ApeChain:

| Contract | Type | Key Features |
|----------|------|-------------|
| **BBToken** | ERC-20 | 1B supply, 15% platform fee routing, agent staking (100 BBAI / 30 days), Pausable |
| **BBAIToken** | ERC-20 | Simplified 1B supply, burnable (legacy/alternative) |
| **AgentRegistry** | ERC-721 | Agent NFTs, 100 BBAI registration fee, execution stats tracking |
| **AgentRegistry8004** | ERC-8004 | BNB Chain standard, endpoint uniqueness, stake/claim lifecycle |
| **AgentStaking** | Custom | NFT-tiered discounts (BAYC 50%, Bluechip 25%), 30-day lock |
| **PaymentRouter** | Custom | 85/15 split, batch queries (max 50), pull-pattern withdrawal |
| **PredictionSettlement** | Custom | On-chain round records, operator pattern, 8-decimal prices |
| **BBClawSubscription** | Custom | 10 USDT/30 days Pro subscription |
| **BondingCurve** | Custom | Linear curve agent tokenization, 1% platform + 5% creator fees |

---

## Prerequisites

- **Node.js** v18+
- **Hardhat** with `@nomicfoundation/hardhat-toolbox` (`npm install` in `contracts/`)
- **Deployer wallet** funded with BNB for gas
- **Block explorer API keys** for contract verification

## Platform Wallet

The platform wallet is already configured:

```
BBAI_PLATFORM_WALLET=0xCbD1e5cB4509cdCD28059eb3b2C71008C10E94A1
```

This address receives platform fees (15% of agent calls) and acts as the treasury.

---

## Environment Setup

Create `contracts/.env`:

```env
DEPLOYER_PRIVATE_KEY=0x...your_private_key...

# Block Explorer API Keys
BSCSCAN_API_KEY=your_bscscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
APESCAN_API_KEY=your_apescan_api_key

# Optional overrides (defaults to public RPCs)
BSC_RPC_URL=https://bsc-dataseed.binance.org
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
APECHAIN_RPC_URL=https://rpc.apechain.com

# Optional — NFT tier configuration
BAYC_ADDRESS=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D
MAYC_ADDRESS=0x60E4d786628Fea6478F785A6d7e704777c86a7c6
TREASURY_ADDRESS=0xCbD1e5cB4509cdCD28059eb3b2C71008C10E94A1
```

> **Never commit `.env` to version control.**

---

## Deployment Order

Contracts have dependencies and must be deployed in sequence:

```
1. BBToken (or BBAIToken)     ← no dependencies
2. AgentStaking               ← requires BBToken address
3. AgentRegistry (or 8004)    ← requires BBToken address
4. PaymentRouter              ← requires BBToken address
5. PredictionSettlement       ← standalone (operator pattern)
6. BBClawSubscription         ← requires USDT address
7. BondingCurve               ← requires BBToken + treasury address
```

---

## Deploy to BSC (Primary)

### Step 1: Testnet First

```bash
cd contracts
npm install

# BSC Testnet (chain ID 97)
npx hardhat run scripts/deploy-bsc.ts --network bscTestnet
```

Get test BNB from the [BNB Chain Faucet](https://www.bnbchain.org/en/testnet-faucet).

### Step 2: BSC Mainnet

```bash
# BSC Mainnet (chain ID 56)
npx hardhat run scripts/deploy-bsc.ts --network bsc
```

The deploy script (`scripts/deploy-bsc.ts`) deploys in order:
1. **BBAIToken** → mints 1B to deployer
2. **AgentRegistry** → with BBToken address
3. **PaymentRouter** → with BBToken address

### Step 3: Settlement Contract (BSC)

```bash
npx hardhat run scripts/deploy-settlement.ts --network bscTestnet
```

This deploys **PredictionSettlement** with deployer as operator.

### Step 4: Full Ecosystem (Base)

For the complete ecosystem with staking + NFT tiers:

```bash
# Base Sepolia (testnet)
npx hardhat run deploy/deploy.ts --network baseSepolia

# Base Mainnet
npx hardhat run deploy/deploy.ts --network base
```

The main deploy script (`deploy/deploy.ts`) does:
1. Deploys BBToken, AgentStaking, AgentRegistry, PaymentRouter
2. Sets fee exemptions for contracts
3. Configures BAYC/MAYC NFT tier discounts (if addresses provided)
4. Outputs verification commands

---

## Deploy to Other Chains

```bash
# Arbitrum
npx hardhat run scripts/deploy-arbitrum.ts --network arbitrum

# ApeChain
npx hardhat run scripts/deploy-apechain.ts --network apechain
```

Each chain gets: BBAIToken + AgentRegistry + PaymentRouter.

---

## Post-Deployment Configuration

### 1. Vercel Environment Variables

After deploying, add contract addresses to Vercel:

```env
# Token
BBAI_TOKEN_ADDRESS=0x...              # BBToken on Base
BBAI_TOKEN_BSC=0x...                  # BBAIToken on BSC

# Platform
BBAI_PLATFORM_WALLET=0xCbD1e5cB4509cdCD28059eb3b2C71008C10E94A1

# Settlement
SETTLEMENT_CONTRACT_BSC=0x...         # PredictionSettlement on BSC mainnet
SETTLEMENT_CONTRACT_BSC_TESTNET=0x... # PredictionSettlement on BSC testnet
SETTLEMENT_OPERATOR_KEY=0x...         # Operator private key for cron settlement

# Subscription
SUBSCRIPTION_CONTRACT_BSC=0x...       # BBClawSubscription on BSC

# Bridge (if multi-chain)
BBAI_TOKEN_ARBITRUM=0x...
BBAI_TOKEN_APECHAIN=0x...
LAYERZERO_ENDPOINT_BASE=0x1a44076050125825900e736c501f859c50fE728c
```

### 2. Fleet Wallets

Fleet agents (190+) use HD-derived addresses from the master mnemonic:

```env
FLEET_MASTER_MNEMONIC=<your-12-word-mnemonic-here>
```

Derivation path: `m/44'/60'/0'/0/{index}` (BIP-44 standard).

### 3. Switch Off Simulation Mode

The platform exits simulation mode when all three conditions are met:
- `BBAI_TOKEN_ADDRESS` is set (non-empty)
- `SETTLEMENT_CONTRACT_BSC` is set (non-empty)
- `BBAI_PLATFORM_WALLET` is not the zero address

Check with `isSimulationMode()` from `lib/blockchain/config.ts`.

---

## Contract Verification

Automatic verification runs during deployment. If it fails, verify manually:

```bash
cd contracts

# Example: verify BBToken on BSC
npx hardhat verify --network bsc <BBTOKEN_ADDRESS> <DEPLOYER_ADDRESS> <TREASURY_ADDRESS>

# Example: verify AgentRegistry on BSC
npx hardhat verify --network bsc <REGISTRY_ADDRESS> <DEPLOYER_ADDRESS> <BBTOKEN_ADDRESS>
```

Check verified contracts at `https://bscscan.com/address/<ADDRESS>#code`.

---

## Cost Estimate

| Chain | Item | Estimated Cost |
|-------|------|---------------|
| BSC | Deploy 3 contracts (Token + Registry + Router) | ~0.005-0.01 BNB |
| BSC | Deploy PredictionSettlement | ~0.002 BNB |
| BSC | Deploy BBClawSubscription | ~0.001 BNB |
| BSC | Permission wiring + verification | ~0.001 BNB |
| **BSC Total** | | **~0.01-0.015 BNB (~$8-12)** |
| Base | Deploy full ecosystem (4 contracts) | ~0.0005-0.001 ETH |
| Arbitrum | Deploy 3 contracts | ~0.0003-0.0005 ETH |

---

## Supported Networks

| Network | Chain ID | Hardhat Name | RPC |
|---------|----------|-------------|-----|
| BSC Mainnet | 56 | `bsc` | `https://bsc-dataseed.binance.org` |
| BSC Testnet | 97 | `bscTestnet` | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| Base Mainnet | 8453 | `base` | `https://mainnet.base.org` |
| Base Sepolia | 84532 | `baseSepolia` | `https://sepolia.base.org` |
| Arbitrum One | 42161 | `arbitrum` | `https://arb1.arbitrum.io/rpc` |
| Arbitrum Sepolia | 421614 | `arbitrumSepolia` | `https://sepolia-rollup.arbitrum.io/rpc` |
| ApeChain | 33139 | `apechain` | `https://rpc.apechain.com` |
| ApeChain Curtis | 33111 | `apechainTestnet` | `https://rpc.curtis.apechain.com` |

---

## Bridge Configuration

Cross-chain BBAI bridging is supported via LayerZero v2 and Wormhole:

| Route | Provider | Status |
|-------|----------|--------|
| Base ↔ BSC | LayerZero v2 | Ready (pending token deployment) |
| Base ↔ Arbitrum | LayerZero v2 | Ready |
| Base ↔ ApeChain | LayerZero v2 | Ready |
| BSC ↔ Arbitrum | Wormhole | Ready |

Platform bridge fee: 0.1% (10 basis points).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `insufficient funds` | Fund deployer with at least 0.015 BNB (BSC) or 0.001 ETH (Base) |
| `nonce too low` | Wait for pending txs to confirm, or reset nonce in wallet |
| BscScan verification fails | Retry `npx hardhat verify` manually; check BSCSCAN_API_KEY |
| `execution reverted` on subscribe | Confirm USDT address: `0x55d398326f99059fF775485246999027B3197955` (BSC) |
| Settlement not recording | Check operator key matches deployed contract's operator |
| Simulation mode still active | Verify all 3 env vars set: TOKEN, SETTLEMENT, PLATFORM_WALLET |
| Fleet wallets not derived | Check FLEET_MASTER_MNEMONIC is set correctly |
| Bridge route not found | Ensure token addresses set on both source and destination chains |
