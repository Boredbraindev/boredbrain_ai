'use client';

import React, { Component, ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import { UserProvider } from '@/contexts/user-context';
import { DataStreamProvider } from '@/components/data-stream-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 0.5,
      refetchOnWindowFocus: true,
      gcTime: 1000 * 60 * 0.5,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
  },
});

class SafeUserProvider extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('[SafeUserProvider] UserProvider crashed, rendering without user context:', error);
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>;
    }
    return <UserProvider>{this.props.children}</UserProvider>;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeUserProvider>
        <DataStreamProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
            forcedTheme="dark"
          >
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </DataStreamProvider>
      </SafeUserProvider>
    </QueryClientProvider>
  );
}
