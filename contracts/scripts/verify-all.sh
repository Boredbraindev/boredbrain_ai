#!/bin/bash
# Verify all BSC mainnet contracts on BscScan
# Usage: BSCSCAN_API_KEY=xxx ./scripts/verify-all.sh

DEPLOYER="0xCbD1e5cB4509cdCD28059eb3b2C71008C10E94A1"
BBTOKEN="0x6a95F2C04c6C614fD84DBB127a1d0d15f439fA81"
BSC_USDT="0x55d398326f99059fF775485246999027B3197955"

echo "Verifying BBToken..."
npx hardhat verify --network bsc $BBTOKEN "$DEPLOYER" "$DEPLOYER"

echo "Verifying AgentRegistry..."
npx hardhat verify --network bsc 0x587D11190AD4920CEE02e81fb98d285d5F66238d "$DEPLOYER" "$BBTOKEN"

echo "Verifying AgentRegistry8004..."
npx hardhat verify --network bsc 0x618a8D664EFDa1d49997ceA6DC0EBAE845b1E231 "$BBTOKEN" "0x0000000000000000000000000000000000000000" "$DEPLOYER"

echo "Verifying AgentStaking..."
npx hardhat verify --network bsc 0xd157d4A0030a1Ea220EB85257740d345C21C62E7 "$BBTOKEN" "$DEPLOYER"

echo "Verifying PaymentRouter..."
npx hardhat verify --network bsc 0x799f8ceA23DfaAe796113Fa12D975EB11Ea3bEa0 "$DEPLOYER" "$BBTOKEN"

echo "Verifying BondingCurve..."
npx hardhat verify --network bsc 0x0273FDbe5fc34C874AC1EE938EDC55b5cC4e360d "$BBTOKEN" "$DEPLOYER" "$DEPLOYER"

echo "Verifying BBClawSubscription..."
npx hardhat verify --network bsc 0x8D7f7349e9e81c28fad6155d7F6969C382abc326 "$BSC_USDT"

echo "Verifying PredictionSettlement..."
npx hardhat verify --network bsc 0x0ae8A0cE8A34155508F4C47b41B20A668A0a5600 "$DEPLOYER"

echo "Done!"
