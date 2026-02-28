import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x' + '0'.repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Base Mainnet
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      chainId: 8453,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    // Base Sepolia Testnet
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      chainId: 84532,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    // BSC Mainnet
    bsc: {
      url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      chainId: 56,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    // BSC Testnet
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || '',
      baseSepolia: process.env.BASESCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
    },
  },
};

export default config;
