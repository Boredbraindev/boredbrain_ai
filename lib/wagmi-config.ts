import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, bsc, arbitrum, apeChain } from 'viem/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'BoredBrain AI',
  appDescription: 'AI Agent Economy Platform',
  appUrl: 'https://boredbrain.app',
  appIcon: 'https://boredbrain.app/footer-logo.png',
  // Replace with your WalletConnect Cloud projectId
  // Get one at https://cloud.walletconnect.com
  projectId: (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID').trim(),
  chains: [base, bsc, arbitrum, apeChain],
});
