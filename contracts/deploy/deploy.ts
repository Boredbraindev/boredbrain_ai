import { ethers } from 'hardhat';

/**
 * Deployment script for the BoredBrain AI ($BBAI) token ecosystem on Base chain.
 *
 * Deploys:
 * 1. BBToken    - ERC-20 token with platform fees, staking, trade fees, pausable
 * 2. AgentStaking - Staking contract for agent registration with NFT tier discounts
 * 3. AgentRegistry - On-chain agent registry (ERC-721)
 * 4. PaymentRouter - Payment routing for agent tool calls
 *
 * Environment variables required:
 * - DEPLOYER_PRIVATE_KEY: Private key of the deployer wallet
 * - TREASURY_ADDRESS: (optional) Treasury address for fee collection, defaults to deployer
 * - BAYC_ADDRESS: (optional) BAYC contract address for Ape Tier discount
 * - MAYC_ADDRESS: (optional) MAYC contract address for Ape Tier discount
 *
 * Usage:
 *   npx hardhat run deploy/deploy.ts --network baseSepolia
 *   npx hardhat run deploy/deploy.ts --network base
 */

interface DeploymentResult {
  chainId: string;
  network: string;
  deployer: string;
  treasury: string;
  contracts: {
    BBToken: string;
    AgentStaking: string;
    AgentRegistry: string;
    PaymentRouter: string;
  };
  deployedAt: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  console.log('='.repeat(60));
  console.log('BoredBrain AI ($BBAI) - Contract Deployment');
  console.log('='.repeat(60));
  console.log('Chain ID:', chainId);
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  console.log('');

  // Treasury defaults to deployer if not set
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  console.log('Treasury:', treasuryAddress);
  console.log('');

  // -------------------------------------------------------
  // 1. Deploy BBToken (ERC-20)
  // -------------------------------------------------------
  console.log('1/4 - Deploying BBToken...');
  const BBToken = await ethers.getContractFactory('BBToken');
  const bbToken = await BBToken.deploy(deployer.address, treasuryAddress);
  await bbToken.waitForDeployment();
  const bbTokenAddress = await bbToken.getAddress();
  console.log('     BBToken deployed to:', bbTokenAddress);
  console.log('     Total supply:', ethers.formatEther(await bbToken.totalSupply()), 'BBAI');
  console.log('');

  // -------------------------------------------------------
  // 2. Deploy AgentStaking
  // -------------------------------------------------------
  console.log('2/4 - Deploying AgentStaking...');
  const AgentStaking = await ethers.getContractFactory('AgentStaking');
  const agentStaking = await AgentStaking.deploy(bbTokenAddress, deployer.address);
  await agentStaking.waitForDeployment();
  const agentStakingAddress = await agentStaking.getAddress();
  console.log('     AgentStaking deployed to:', agentStakingAddress);
  console.log('     Base stake: 100 BBAI, Lock: 30 days');
  console.log('');

  // -------------------------------------------------------
  // 3. Deploy AgentRegistry (ERC-721)
  // -------------------------------------------------------
  console.log('3/4 - Deploying AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy(deployer.address, bbTokenAddress);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log('     AgentRegistry deployed to:', agentRegistryAddress);
  console.log('');

  // -------------------------------------------------------
  // 4. Deploy PaymentRouter
  // -------------------------------------------------------
  console.log('4/4 - Deploying PaymentRouter...');
  const PaymentRouter = await ethers.getContractFactory('PaymentRouter');
  const paymentRouter = await PaymentRouter.deploy(deployer.address, bbTokenAddress);
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log('     PaymentRouter deployed to:', paymentRouterAddress);
  console.log('');

  // -------------------------------------------------------
  // Post-deployment configuration
  // -------------------------------------------------------
  console.log('--- Post-deployment Configuration ---');

  // Make AgentStaking fee-exempt so staking transfers don't incur trade fees
  console.log('Setting AgentStaking as fee-exempt on BBToken...');
  await bbToken.setFeeExempt(agentStakingAddress, true);

  // Make AgentRegistry fee-exempt
  console.log('Setting AgentRegistry as fee-exempt on BBToken...');
  await bbToken.setFeeExempt(agentRegistryAddress, true);

  // Make PaymentRouter fee-exempt
  console.log('Setting PaymentRouter as fee-exempt on BBToken...');
  await bbToken.setFeeExempt(paymentRouterAddress, true);

  // Configure NFT tier discounts if addresses are provided
  const baycAddress = process.env.BAYC_ADDRESS;
  const maycAddress = process.env.MAYC_ADDRESS;

  if (baycAddress) {
    console.log('Setting BAYC as Ape Tier (50% discount)...');
    await agentStaking.setApeTier(baycAddress, true);
  }

  if (maycAddress) {
    console.log('Setting MAYC as Ape Tier (50% discount)...');
    await agentStaking.setApeTier(maycAddress, true);
  }

  console.log('');

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  const deploymentResult: DeploymentResult = {
    chainId,
    network: chainId === '8453' ? 'Base Mainnet' : chainId === '84532' ? 'Base Sepolia' : `Chain ${chainId}`,
    deployer: deployer.address,
    treasury: treasuryAddress,
    contracts: {
      BBToken: bbTokenAddress,
      AgentStaking: agentStakingAddress,
      AgentRegistry: agentRegistryAddress,
      PaymentRouter: paymentRouterAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log('='.repeat(60));
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(JSON.stringify(deploymentResult, null, 2));
  console.log('');

  // -------------------------------------------------------
  // Verification commands
  // -------------------------------------------------------
  const networkFlag = chainId === '8453' ? 'base' : chainId === '84532' ? 'baseSepolia' : 'hardhat';
  console.log('--- Verify Contracts on BaseScan ---');
  console.log(`npx hardhat verify --network ${networkFlag} ${bbTokenAddress} "${deployer.address}" "${treasuryAddress}"`);
  console.log(`npx hardhat verify --network ${networkFlag} ${agentStakingAddress} "${bbTokenAddress}" "${deployer.address}"`);
  console.log(`npx hardhat verify --network ${networkFlag} ${agentRegistryAddress} "${deployer.address}" "${bbTokenAddress}"`);
  console.log(`npx hardhat verify --network ${networkFlag} ${paymentRouterAddress} "${deployer.address}" "${bbTokenAddress}"`);
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
});
