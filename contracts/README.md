# BoredBrain AI ($BBAI) Smart Contracts

ERC-20 token and staking contracts for the BoredBrain AI Agent Economy, deployed on Base chain.

## Contracts

### BBToken.sol (ERC-20)

The core `$BBAI` token with the following features:

- **Name**: BoredBrain AI
- **Symbol**: BBAI
- **Total Supply**: 1,000,000,000 (1 billion) with 18 decimals
- **Owner Mint/Burn**: Owner can mint (up to max supply) and burn tokens
- **15% Platform Fee**: `chargePlatformFee()` splits agent tool call payments -- 85% to agent owner, 15% to treasury
- **Staking Lock**: `stakeForAgent()` locks 100 BBAI for 30 days to register an agent
- **1% Trade Fee**: Configurable per-address fee on agent token trades (applied to DEX pairs via `setFeeApplicable`)
- **Pausable**: Owner can pause/unpause all transfers for emergencies

### AgentStaking.sol

Dedicated staking contract for agent registration with NFT-based discounts:

- **Base Stake**: 100 BBAI per agent registration
- **Lock Period**: 30 days before unstaking is allowed
- **Ape Tier (50% discount)**: BAYC/MAYC holders stake only 50 BBAI
- **Bluechip Tier (25% discount)**: Other bluechip NFT holders stake 75 BBAI
- **Emergency Unstake**: Owner can force-unstake in critical situations

### AgentRegistry.sol (ERC-721)

On-chain agent registry. Each registered agent is minted as an NFT with metadata (name, capabilities, price per query).

### PaymentRouter.sol

Routes `$BBAI` payments for agent API queries with 15% platform fee split. Supports batch payments and arena prize distribution.

## Prerequisites

```bash
node >= 18
pnpm (or npm)
```

## Setup

```bash
cd contracts
pnpm install
```

## Environment Variables

Create a `.env` file in the `contracts/` directory:

```env
# Required
DEPLOYER_PRIVATE_KEY=0x_your_deployer_private_key

# Optional - defaults to deployer address
TREASURY_ADDRESS=0x_your_treasury_address

# RPC URLs (defaults provided, but recommended to use your own)
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# For contract verification on BaseScan
BASESCAN_API_KEY=your_basescan_api_key

# NFT tier discount addresses (optional, can be set post-deployment)
BAYC_ADDRESS=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D
MAYC_ADDRESS=0x60E4d786628Fea6478F785A6d7e704777c86a7c6
```

## Compile

```bash
npx hardhat compile
```

## Deploy

### Base Sepolia (Testnet) -- deploy here first

```bash
npx hardhat run deploy/deploy.ts --network baseSepolia
```

### Base Mainnet

```bash
npx hardhat run deploy/deploy.ts --network base
```

### Local (Hardhat network)

```bash
npx hardhat run deploy/deploy.ts
```

## Verify on BaseScan

After deployment, the script prints verification commands. Run them to verify each contract:

```bash
npx hardhat verify --network baseSepolia <BBToken_ADDRESS> "<DEPLOYER>" "<TREASURY>"
npx hardhat verify --network baseSepolia <AgentStaking_ADDRESS> "<BBTOKEN_ADDRESS>" "<DEPLOYER>"
npx hardhat verify --network baseSepolia <AgentRegistry_ADDRESS> "<DEPLOYER>" "<BBTOKEN_ADDRESS>"
npx hardhat verify --network baseSepolia <PaymentRouter_ADDRESS> "<DEPLOYER>" "<BBTOKEN_ADDRESS>"
```

## Post-Deployment Checklist

1. **Verify all contracts** on BaseScan
2. **Set NFT tier discounts** (if not set via env vars):
   ```
   AgentStaking.setApeTier(BAYC_ADDRESS, true)
   AgentStaking.setApeTier(MAYC_ADDRESS, true)
   AgentStaking.setBluechipTier(AZUKI_ADDRESS, true)
   ```
3. **Set DEX pair as fee-applicable** (after creating LP):
   ```
   BBToken.setFeeApplicable(DEX_PAIR_ADDRESS, true)
   ```
4. **Transfer tokens** to distribution wallets per tokenomics:
   - 40% Ecosystem Rewards
   - 20% Team/Development (set up vesting)
   - 15% Liquidity
   - 15% Community
   - 10% Investors
5. **Add liquidity** on a Base DEX (Aerodrome, Uniswap, etc.)

## Contract Architecture

```
BBToken (ERC-20)
  |
  |-- chargePlatformFee() --> 15% to treasury, 85% to agent owner
  |-- stakeForAgent()     --> lock 100 BBAI for agent registration
  |-- transfer()          --> 1% fee on trades to/from fee-applicable addresses
  |
AgentStaking
  |-- stake()                   --> 100 BBAI (standard)
  |-- stakeWithNFTDiscount()    --> 50 BBAI (ape tier) / 75 BBAI (bluechip tier)
  |-- unstake()                 --> after 30-day lock
  |
AgentRegistry (ERC-721)
  |-- registerAgent()    --> mint agent NFT, pay 100 BBAI fee
  |-- recordExecution()  --> track agent usage
  |
PaymentRouter
  |-- payForQuery()          --> split payment (85/15)
  |-- batchPayForQueries()   --> batch payments
  |-- withdraw()             --> agent owners claim earnings
```

## Testing

```bash
npx hardhat test
```

## Security Notes

- All contracts use OpenZeppelin v5.1 audited implementations
- ReentrancyGuard on all external state-changing functions
- Pausable for emergency circuit breaker
- Owner-only admin functions
- Pull-pattern for withdrawals (PaymentRouter)
- 30-day timelock on staked funds
