import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'BNB\n');

  if (balance === 0n) throw new Error('0 BNB — cannot deploy');

  // BSC Mainnet USDT (BEP-20)
  const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';

  // ── 1. BBToken (BBAI) ─────────────────────────────────────────────────
  console.log('1/9  BBToken (BBAI)...');
  const BBToken = await ethers.getContractFactory('BBToken');
  const bbToken = await BBToken.deploy(deployer.address, deployer.address);
  await bbToken.waitForDeployment();
  const bbTokenAddr = await bbToken.getAddress();
  console.log('     ✓', bbTokenAddr);

  // ── 2. BBAIToken (simple version) ─────────────────────────────────────
  console.log('2/9  BBAIToken...');
  const BBAIToken = await ethers.getContractFactory('BBAIToken');
  const bbaiToken = await BBAIToken.deploy(deployer.address);
  await bbaiToken.waitForDeployment();
  const bbaiTokenAddr = await bbaiToken.getAddress();
  console.log('     ✓', bbaiTokenAddr);

  // ── 3. AgentRegistry (ERC-721) ────────────────────────────────────────
  console.log('3/9  AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy(deployer.address, bbTokenAddr);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log('     ✓', agentRegistryAddr);

  // ── 4. AgentRegistry8004 (ERC-8004) ───────────────────────────────────
  console.log('4/9  AgentRegistry8004...');
  const AgentRegistry8004 = await ethers.getContractFactory('AgentRegistry8004');
  const agentRegistry8004 = await AgentRegistry8004.deploy(
    bbTokenAddr,
    ethers.ZeroAddress, // no separate staking contract yet
    deployer.address
  );
  await agentRegistry8004.waitForDeployment();
  const agentRegistry8004Addr = await agentRegistry8004.getAddress();
  console.log('     ✓', agentRegistry8004Addr);

  // ── 5. AgentStaking ───────────────────────────────────────────────────
  console.log('5/9  AgentStaking...');
  const AgentStaking = await ethers.getContractFactory('AgentStaking');
  const agentStaking = await AgentStaking.deploy(bbTokenAddr, deployer.address);
  await agentStaking.waitForDeployment();
  const agentStakingAddr = await agentStaking.getAddress();
  console.log('     ✓', agentStakingAddr);

  // ── 6. PaymentRouter ──────────────────────────────────────────────────
  console.log('6/9  PaymentRouter...');
  const PaymentRouter = await ethers.getContractFactory('PaymentRouter');
  const paymentRouter = await PaymentRouter.deploy(deployer.address, bbTokenAddr);
  await paymentRouter.waitForDeployment();
  const paymentRouterAddr = await paymentRouter.getAddress();
  console.log('     ✓', paymentRouterAddr);

  // ── 7. BondingCurve ───────────────────────────────────────────────────
  console.log('7/9  BondingCurve...');
  const BondingCurve = await ethers.getContractFactory('BondingCurve');
  const bondingCurve = await BondingCurve.deploy(bbTokenAddr, deployer.address, deployer.address);
  await bondingCurve.waitForDeployment();
  const bondingCurveAddr = await bondingCurve.getAddress();
  console.log('     ✓', bondingCurveAddr);

  // ── 8. BBClawSubscription ─────────────────────────────────────────────
  console.log('8/9  BBClawSubscription...');
  const BBClawSubscription = await ethers.getContractFactory('BBClawSubscription');
  const bbClawSub = await BBClawSubscription.deploy(BSC_USDT);
  await bbClawSub.waitForDeployment();
  const bbClawSubAddr = await bbClawSub.getAddress();
  console.log('     ✓', bbClawSubAddr);

  // ── 9. PredictionSettlement ───────────────────────────────────────────
  console.log('9/9  PredictionSettlement...');
  const PredictionSettlement = await ethers.getContractFactory('PredictionSettlement');
  const predictionSettlement = await PredictionSettlement.deploy(deployer.address);
  await predictionSettlement.waitForDeployment();
  const predictionSettlementAddr = await predictionSettlement.getAddress();
  console.log('     ✓', predictionSettlementAddr);

  // ── Post-deploy: wire up permissions ──────────────────────────────────
  console.log('\n── Setting permissions ──');

  console.log('  Authorizing PaymentRouter on BBToken...');
  const tx1 = await bbToken.setAuthorizedCaller(paymentRouterAddr, true);
  await tx1.wait();
  console.log('  ✓ PaymentRouter authorized');

  console.log('  Authorizing BondingCurve token creator...');
  // BondingCurve: owner is already deployer, so createAgentToken works for owner
  // but also authorize AgentRegistry8004 if needed later

  // Link AgentRegistry8004 to AgentStaking
  console.log('  Linking AgentRegistry8004 → AgentStaking...');
  const tx2 = await agentRegistry8004.setStakingContract(agentStakingAddr);
  await tx2.wait();
  console.log('  ✓ Staking contract linked');

  // ── Summary ───────────────────────────────────────────────────────────
  const remainingBalance = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - remainingBalance;

  const contracts = {
    BBToken: bbTokenAddr,
    BBAIToken: bbaiTokenAddr,
    AgentRegistry: agentRegistryAddr,
    AgentRegistry8004: agentRegistry8004Addr,
    AgentStaking: agentStakingAddr,
    PaymentRouter: paymentRouterAddr,
    BondingCurve: bondingCurveAddr,
    BBClawSubscription: bbClawSubAddr,
    PredictionSettlement: predictionSettlementAddr,
  };

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         BSC MAINNET — ALL 9 CONTRACTS DEPLOYED          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  for (const [name, addr] of Object.entries(contracts)) {
    console.log(`║  ${name.padEnd(22)} ${addr}  ║`);
  }
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Deployer:  ${deployer.address}  ║`);
  console.log(`║  Gas used:  ${ethers.formatEther(gasUsed).padEnd(42)} ║`);
  console.log(`║  Remaining: ${ethers.formatEther(remainingBalance).padEnd(42)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // JSON output for saving
  const deploymentInfo = {
    network: 'bsc-mainnet',
    chainId: '56',
    deployer: deployer.address,
    treasury: deployer.address,
    contracts,
    gasUsedBNB: ethers.formatEther(gasUsed),
    deployedAt: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
