import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts on BSC with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'BNB');

  if (balance === 0n) {
    throw new Error('Deployer has 0 BNB — cannot deploy');
  }

  // ── 1. Deploy BBToken (BBAI) ──────────────────────────────────────────
  // Constructor: (address initialOwner, address _treasury)
  // Both set to deployer — treasury can be updated later via setTreasury()
  console.log('\n1. Deploying BBToken (BBAI)...');
  const BBToken = await ethers.getContractFactory('BBToken');
  const bbToken = await BBToken.deploy(deployer.address, deployer.address);
  await bbToken.waitForDeployment();
  const bbTokenAddress = await bbToken.getAddress();
  console.log('   BBToken deployed to:', bbTokenAddress);

  // ── 2. Deploy PaymentRouter ───────────────────────────────────────────
  // Constructor: (address initialOwner, address _bbaiToken)
  console.log('\n2. Deploying PaymentRouter...');
  const PaymentRouter = await ethers.getContractFactory('PaymentRouter');
  const paymentRouter = await PaymentRouter.deploy(deployer.address, bbTokenAddress);
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log('   PaymentRouter deployed to:', paymentRouterAddress);

  // ── 3. Deploy PredictionSettlement ────────────────────────────────────
  // Constructor: (address _operator)  — deployer acts as operator initially
  console.log('\n3. Deploying PredictionSettlement...');
  const PredictionSettlement = await ethers.getContractFactory('PredictionSettlement');
  const predictionSettlement = await PredictionSettlement.deploy(deployer.address);
  await predictionSettlement.waitForDeployment();
  const predictionSettlementAddress = await predictionSettlement.getAddress();
  console.log('   PredictionSettlement deployed to:', predictionSettlementAddress);

  // ── 4. Post-deploy: authorize PaymentRouter on BBToken ────────────────
  console.log('\n4. Authorizing PaymentRouter as caller on BBToken...');
  const tx = await bbToken.setAuthorizedCaller(paymentRouterAddress, true);
  await tx.wait();
  console.log('   PaymentRouter authorized ✓');

  // ── Summary ───────────────────────────────────────────────────────────
  const remainingBalance = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - remainingBalance;

  console.log('\n════════════════════════════════════════════');
  console.log('  BSC Mainnet Deployment Complete');
  console.log('════════════════════════════════════════════');
  console.log('BBToken (BBAI):', bbTokenAddress);
  console.log('PaymentRouter:', paymentRouterAddress);
  console.log('PredictionSettlement:', predictionSettlementAddress);
  console.log('────────────────────────────────────────────');
  console.log('Deployer / Owner:', deployer.address);
  console.log('Treasury:', deployer.address);
  console.log('Gas used:', ethers.formatEther(gasUsed), 'BNB');
  console.log('Remaining:', ethers.formatEther(remainingBalance), 'BNB');
  console.log('════════════════════════════════════════════');

  const deploymentInfo = {
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      BBToken: bbTokenAddress,
      PaymentRouter: paymentRouterAddress,
      PredictionSettlement: predictionSettlementAddress,
    },
    treasury: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  console.log('\nDeployment JSON:', JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
