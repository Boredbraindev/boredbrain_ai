'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const previousAddressRef = useRef<string | undefined>(undefined);

  const linkWallet = useCallback(async (walletAddress: string) => {
    try {
      const response = await fetch('/api/auth/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to link wallet:', errorData);
      }
    } catch (error) {
      console.error('Error linking wallet:', error);
    }
  }, []);

  useEffect(() => {
    if (isConnected && address && address !== previousAddressRef.current) {
      previousAddressRef.current = address;
      linkWallet(address);
    }
  }, [isConnected, address, linkWallet]);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="relative overflow-hidden rounded-lg px-3 h-9 font-semibold text-xs tracking-wider transition-all duration-200 border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 active:scale-95"
                  >
                    CONNECT
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="relative overflow-hidden rounded-lg px-3 h-9 font-semibold text-xs tracking-wider transition-all duration-200 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 active:scale-95"
                  >
                    WRONG NETWORK
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-2 h-9 text-xs transition-all duration-200 border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20 active:scale-95"
                  >
                    {chain.hasIcon && (
                      <div
                        className="size-4 rounded-full overflow-hidden"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="size-4"
                          />
                        )}
                      </div>
                    )}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-xs font-medium transition-all duration-200 border border-amber-500/20 bg-amber-500/5 text-amber-400/90 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300 active:scale-95"
                  >
                    {account.displayName}
                    {account.displayBalance && (
                      <span className="text-muted-foreground ml-0.5">
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
