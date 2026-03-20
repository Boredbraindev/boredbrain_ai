import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'BNB\n');

  if (balance === 0n) throw new Error('0 BNB — cannot deploy');

  const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';

  // ── 1. BBToken (BBAI) — mint 0, TGE 때 mint() 호출 ────────────────
  console.log('1/7  BBToken (BBAI) — supply: 0 (TGE mint later)...');
  const BBToken = await ethers.getContractFactory('BBToken');
  const bbToken = await BBToken.deploy(deployer.address, deployer.address);
  await bbToken.waitForDeployment();
  const bbTokenAddr = await bbToken.getAddress();
  const supply = await bbToken.totalSupply();
  console.log('     ✓', bbTokenAddr, '| supply:', ethers.formatEther(supply));

  // ── 2. AgentRegistry (ERC-721) ────────────────────────────────────────
  console.log('2/7  AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy(deployer.address, bbTokenAddr);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log('     ✓', agentRegistryAddr);

  // ── 3. AgentRegistry8004 (ERC-8004) ───────────────────────────────────
  console.log('3/7  AgentRegistry8004...');
  const AgentRegistry8004 = await ethers.getContractFactory('AgentRegistry8004');
  const agentRegistry8004 = await AgentRegistry8004.deploy(
    bbTokenAddr,
    ethers.ZeroAddress,
    deployer.address
  );
  await agentRegistry8004.waitForDeployment();
  const agentRegistry8004Addr = await agentRegistry8004.getAddress();
  console.log('     ✓', agentRegistry8004Addr);

  // ── 4. AgentStaking ───────────────────────────────────────────────────
  console.log('4/7  AgentStaking...');
  const AgentStaking = await ethers.getContractFactory('AgentStaking');
  const agentStaking = await AgentStaking.deploy(bbTokenAddr, deployer.address);
  await agentStaking.waitForDeployment();
  const agentStakingAddr = await agentStaking.getAddress();
  console.log('     ✓', agentStakingAddr);

  // ── 5. PaymentRouter ──────────────────────────────────────────────────
  console.log('5/7  PaymentRouter...');
  const PaymentRouter = await ethers.getContractFactory('PaymentRouter');
  const paymentRouter = await PaymentRouter.deploy(deployer.address, bbTokenAddr);
  await paymentRouter.waitForDeployment();
  const paymentRouterAddr = await paymentRouter.getAddress();
  console.log('     ✓', paymentRouterAddr);

  // ── 6. BondingCurve ───────────────────────────────────────────────────
  console.log('6/7  BondingCurve...');
  const BondingCurve = await ethers.getContractFactory('BondingCurve');
  const bondingCurve = await BondingCurve.deploy(bbTokenAddr, deployer.address, deployer.address);
  await bondingCurve.waitForDeployment();
  const bondingCurveAddr = await bondingCurve.getAddress();
  console.log('     ✓', bondingCurveAddr);

  // ── 7. BBClawSubscription ─────────────────────────────────────────────
  console.log('7/7  BBClawSubscription...');
  const BBClawSubscription = await ethers.getContractFactory('BBClawSubscription');
  const bbClawSub = await BBClawSubscription.deploy(BSC_USDT);
  await bbClawSub.waitForDeployment();
  const bbClawSubAddr = await bbClawSub.getAddress();
  console.log('     ✓', bbClawSubAddr);

  // ── Post-deploy permissions ───────────────────────────────────────────
  console.log('\n── Permissions ──');

  console.log('  PaymentRouter → BBToken authorized...');
  const tx1 = await bbToken.setAuthorizedCaller(paymentRouterAddr, true);
  await tx1.wait();
  console.log('  ✓');

  console.log('  AgentRegistry8004 → AgentStaking linked...');
  const tx2 = await agentRegistry8004.setStakingContract(agentStakingAddr);
  await tx2.wait();
  console.log('  ✓');

  // ── Summary ───────────────────────────────────────────────────────────
  const remaining = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - remaining;

  // PredictionSettlement already deployed (kept from v1)
  const predictionSettlementAddr = '0x0ae8A0cE8A34155508F4C47b41B20A668A0a5600';

  const contracts = {
    BBToken: bbTokenAddr,
    AgentRegistry: agentRegistryAddr,
    AgentRegistry8004: agentRegistry8004Addr,
    AgentStaking: agentStakingAddr,
    PaymentRouter: paymentRouterAddr,
    BondingCurve: bondingCurveAddr,
    BBClawSubscription: bbClawSubAddr,
    PredictionSettlement: predictionSettlementAddr + ' (v1 — kept)',
  };

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      BSC MAINNET v2 — MINT 0 (TGE READY)                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  for (const [name, addr] of Object.entries(contracts)) {
    console.log(`║  ${name.padEnd(22)} ${addr}  ║`);
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Deployer:    ${deployer.address}             ║`);
  console.log(`║  BBToken supply: 0 (call mint() at TGE)                     ║`);
  console.log(`║  Gas used:    ${ethers.formatEther(gasUsed).substring(0, 20).padEnd(44)} ║`);
  console.log(`║  Remaining:   ${ethers.formatEther(remaining).substring(0, 20).padEnd(44)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  console.log('\n⚠️  v1 dead contracts (ignore):');
  console.log('    BBToken v1:    0xD150a4Fc5C8066665cf5F9d84C568A689A2e29bE (1B minted — DO NOT USE)');
  console.log('    BBAIToken v1:  0x7b12cde10B7E8b5577C2ef8FC411547afdf31F2c (1B minted — DO NOT USE)');

  const deploymentInfo = {
    version: 'v2',
    network: 'bsc-mainnet',
    chainId: '56',
    deployer: deployer.address,
    treasury: deployer.address,
    tokenSupply: '0 (mint at TGE)',
    contracts,
    deadContracts: {
      'BBToken_v1_DO_NOT_USE': '0xD150a4Fc5C8066665cf5F9d84C568A689A2e29bE',
      'BBAIToken_v1_DO_NOT_USE': '0x7b12cde10B7E8b5577C2ef8FC411547afdf31F2c',
    },
    gasUsedBNB: ethers.formatEther(gasUsed),
    deployedAt: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
