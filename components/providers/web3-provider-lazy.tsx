'use client';

import dynamic from 'next/dynamic';
import React, { Component, type ReactNode } from 'react';

const Web3Provider = dynamic(
  () => import('./web3-provider').then((m) => m.Web3Provider),
  { ssr: false },
);

class Web3ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('[Web3ErrorBoundary] Web3 provider crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

export function Web3ProviderLazy({ children }: { children: ReactNode }) {
  return (
    <Web3ErrorBoundary>
      <Web3Provider>{children}</Web3Provider>
    </Web3ErrorBoundary>
  );
}
