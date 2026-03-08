'use client';

import React, { type ReactNode } from 'react';

let WagmiProvider: any;
let QueryClientProvider: any;
let QueryClient: any;
let RainbowKitProvider: any;
let darkTheme: any;
let wagmiConfig: any;

const HAS_WALLETCONNECT =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID &&
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID !== 'YOUR_WALLETCONNECT_PROJECT_ID';

if (HAS_WALLETCONNECT) {
  try {
    // Dynamic imports only when WalletConnect is configured
    WagmiProvider = require('wagmi').WagmiProvider;
    const tq = require('@tanstack/react-query');
    QueryClientProvider = tq.QueryClientProvider;
    QueryClient = tq.QueryClient;
    const rk = require('@rainbow-me/rainbowkit');
    RainbowKitProvider = rk.RainbowKitProvider;
    darkTheme = rk.darkTheme;
    require('@rainbow-me/rainbowkit/styles.css');
    wagmiConfig = require('@/lib/wagmi-config').wagmiConfig;
  } catch {
    // Web3 deps not available
  }
}

export function Web3Provider({ children }: { children: ReactNode }) {
  if (!HAS_WALLETCONNECT || !WagmiProvider || !wagmiConfig) {
    return <>{children}</>;
  }

  const web3QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 2,
      },
    },
  });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={web3QueryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#F59E0B',
            accentColorForeground: '#000000',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          locale="en-US"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
