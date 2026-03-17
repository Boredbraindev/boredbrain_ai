'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

type NftTier = 'ape' | 'bluechip' | 'boredbrain' | 'none';

const TIER_EMOJI: Record<NftTier, string> = {
  ape: '🦍',
  bluechip: '💎',
  boredbrain: '🧠',
  none: '',
};

const TIER_STYLE: Record<NftTier, string> = {
  ape: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  bluechip: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  boredbrain: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
  none: 'border-amber-500/20 bg-amber-500/5 text-amber-400/90',
};

const USER_MENU_ITEMS = [
  { href: '/profile', label: 'My Profile', icon: '👤' },
];

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const previousAddressRef = useRef<string | undefined>(undefined);
  const [nftTier, setNftTier] = useState<NftTier>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bp, setBp] = useState<number | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

      // Check NFT holdings for badge
      fetch(`/api/wallets/nft-check?address=${address}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.tier && data.tier !== 'none') {
            setNftTier(data.tier);
          }
        })
        .catch(() => {});

      // Fetch user BP
      fetch(`/api/points?wallet=${address}`)
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.totalBp === 'number') {
            setBp(data.totalBp);
            setLevel(data.title ?? null);
          }
        })
        .catch(() => {});

      // Daily login check
      fetch('/api/points/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      }).catch(() => {});
    }
  }, [isConnected, address, linkWallet]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen]);

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
                    className="relative overflow-hidden rounded-lg px-4 h-9 font-semibold text-xs tracking-wider transition-all duration-200 border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 active:scale-95"
                  >
                    CONNECT WALLET
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
                <div className="relative" ref={menuRef}>
                  <div className="flex items-center gap-1.5">
                    {/* Chain icon */}
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

                    {/* User button — opens dropdown */}
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      type="button"
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-xs font-medium transition-all duration-200 border hover:opacity-80 active:scale-95 ${TIER_STYLE[nftTier]}`}
                    >
                      {nftTier !== 'none' && (
                        <span className="text-sm -mr-0.5">{TIER_EMOJI[nftTier]}</span>
                      )}
                      {account.displayName}
                      {bp !== null && (
                        <span className="text-amber-400/60 ml-0.5 font-mono text-[10px]">
                          {bp.toLocaleString()} BP
                        </span>
                      )}
                      <svg className={`size-3 opacity-50 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/[0.08] bg-background/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-white/70 font-medium block">{account.displayName}</span>
                            {level && (
                              <span className="text-[10px] text-amber-400/60 font-mono">{level}</span>
                            )}
                          </div>
                          {bp !== null && (
                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-amber-400 block">{bp.toLocaleString()}</span>
                              <span className="text-[9px] text-white/30 uppercase tracking-wider">BP</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Menu items */}
                      <div className="py-1">
                        {USER_MENU_ITEMS.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
                          >
                            <span className="text-sm w-5 text-center">{item.icon}</span>
                            {item.label}
                          </Link>
                        ))}
                      </div>

                      {/* Wallet actions */}
                      <div className="border-t border-white/[0.06] py-1">
                        <button
                          onClick={() => { openAccountModal(); setMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-white/[0.04] transition-colors w-full text-left"
                        >
                          <span className="text-sm w-5 text-center">🔌</span>
                          Disconnect Wallet
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
