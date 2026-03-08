'use client';

import React, { type ReactNode, useRef } from 'react';

let WagmiProvider: any;
let RainbowKitProvider: any;
let darkTheme: any;
let wagmiConfig: any;
let WEB3_READY = false;

try {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (projectId && projectId !== 'YOUR_WALLETCONNECT_PROJECT_ID') {
    WagmiProvider = require('wagmi').WagmiProvider;
    const rk = require('@rainbow-me/rainbowkit');
    RainbowKitProvider = rk.RainbowKitProvider;
    darkTheme = rk.darkTheme;
    require('@rainbow-me/rainbowkit/styles.css');
    wagmiConfig = require('@/lib/wagmi-config').wagmiConfig;
    WEB3_READY = !!(WagmiProvider && RainbowKitProvider && wagmiConfig);
  }
} catch (e) {
  console.warn('[Web3Provider] Failed to initialize:', e);
  WEB3_READY = false;
}

export function Web3Provider({ children }: { children: ReactNode }) {
  if (!WEB3_READY) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
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
    </WagmiProvider>
  );
}
