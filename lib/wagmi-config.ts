import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
  binanceWallet,
  coinbaseWallet,
  okxWallet,
  phantomWallet,
  bitgetWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base, bsc, arbitrum, apeChain } from 'viem/chains';

const projectId = (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID').trim();

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        binanceWallet,
        okxWallet,
        bitgetWallet,
      ],
    },
    {
      groupName: 'More',
      wallets: [
        rabbyWallet,
        coinbaseWallet,
        phantomWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'BoredBrain AI',
    appDescription: 'AI Agent Economy Platform',
    appUrl: 'https://boredbrain.app',
    appIcon: 'https://boredbrain.app/footer-logo.png',
    projectId,
  },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [bsc, base, arbitrum, apeChain],
  transports: {
    [bsc.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [apeChain.id]: http(),
  },
});
