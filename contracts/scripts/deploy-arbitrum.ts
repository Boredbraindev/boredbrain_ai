import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts on Arbitrum with account:', deployer.address);
  console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy BBAI Token
  console.log('\n1. Deploying BBAIToken...');
  const BBAIToken = await ethers.getContractFactory('BBAIToken');
  const bbaiToken = await BBAIToken.deploy(deployer.address);
  await bbaiToken.waitForDeployment();
  const bbaiTokenAddress = await bbaiToken.getAddress();
  console.log('BBAIToken deployed to:', bbaiTokenAddress);

  // 2. Deploy Agent Registry
  console.log('\n2. Deploying AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy(deployer.address, bbaiTokenAddress);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log('AgentRegistry deployed to:', agentRegistryAddress);

  // 3. Deploy Payment Router
  console.log('\n3. Deploying PaymentRouter...');
  const PaymentRouter = await ethers.getContractFactory('PaymentRouter');
  const paymentRouter = await PaymentRouter.deploy(deployer.address, bbaiTokenAddress);
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log('PaymentRouter deployed to:', paymentRouterAddress);

  // Summary
  console.log('\n=== Arbitrum Deployment Summary ===');
  console.log('BBAIToken:', bbaiTokenAddress);
  console.log('AgentRegistry:', agentRegistryAddress);
  console.log('PaymentRouter:', paymentRouterAddress);
  console.log('Chain ID: 42161 (Arbitrum One) / 421614 (Arbitrum Sepolia)');

  // Save deployment addresses
  const deploymentInfo = {
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      BBAIToken: bbaiTokenAddress,
      AgentRegistry: agentRegistryAddress,
      PaymentRouter: paymentRouterAddress,
    },
    deployedAt: new Date().toISOString(),
  };
  console.log('\nDeployment Info:', JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
