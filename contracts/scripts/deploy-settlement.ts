/**
 * Deploy PredictionSettlement to BSC Testnet
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-settlement.ts --network bscTestnet
 *
 * After deployment, set env vars in Vercel:
 *   SETTLEMENT_CONTRACT_BSC_TESTNET=<deployed address>
 *   SETTLEMENT_OPERATOR_KEY=<operator private key>
 */

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('=== PredictionSettlement Deployment ===');
  console.log('Network:', network.name, `(chainId: ${network.chainId})`);
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'BNB');

  if (balance === 0n) {
    throw new Error('Deployer has no BNB for gas. Fund via https://www.bnbchain.org/en/testnet-faucet');
  }

  // Deploy PredictionSettlement with deployer as operator
  console.log('\nDeploying PredictionSettlement...');
  const PredictionSettlement = await ethers.getContractFactory('PredictionSettlement');
  const settlement = await PredictionSettlement.deploy(deployer.address);
  await settlement.waitForDeployment();
  const address = await settlement.getAddress();

  console.log('\n=== Deployment Complete ===');
  console.log('PredictionSettlement:', address);
  console.log('Owner:', deployer.address);
  console.log('Operator:', deployer.address);
  console.log(`\nBscScan: https://testnet.bscscan.com/address/${address}`);

  console.log('\n=== Set these in Vercel ===');
  console.log(`SETTLEMENT_CONTRACT_BSC_TESTNET=${address}`);
  console.log(`SETTLEMENT_OPERATOR_KEY=<your operator private key>`);

  // Verify the contract state
  const owner = await settlement.owner();
  const operator = await settlement.operator();
  const totalRounds = await settlement.totalRounds();
  console.log('\n=== Contract State ===');
  console.log('owner():', owner);
  console.log('operator():', operator);
  console.log('totalRounds():', totalRounds.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
