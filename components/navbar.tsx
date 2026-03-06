'use client';

/* eslint-disable @next/next/no-img-element */
import React, { memo, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { UserProfile, NavigationMenu } from '@/components/user-profile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ShareButton } from '@/components/share';
import { WalletConnectButton } from '@/components/wallet-connect-button';

import { ComprehensiveUserData } from '@/lib/user-data-server';

type VisibilityType = 'public' | 'private';

interface NavbarProps {
  chatId: string | null;
  selectedVisibilityType: VisibilityType;
  onVisibilityChange: (visibility: VisibilityType) => void | Promise<void>;
  user: ComprehensiveUserData | null;
  isOwner?: boolean;
  subscriptionData?: any;
  isProUser?: boolean;
  isProStatusLoading?: boolean;
  isCustomInstructionsEnabled?: boolean;
  setIsCustomInstructionsEnabled?: (value: boolean | ((val: boolean) => boolean)) => void;
  settingsOpen?: boolean;
  setSettingsOpen?: (open: boolean) => void;
  settingsInitialTab?: 'account' | 'usage';
}

const Navbar = memo(
  ({
    chatId,
    selectedVisibilityType,
    onVisibilityChange,
    user,
    isOwner = true,
    subscriptionData,
    isProUser,
    isProStatusLoading,
    isCustomInstructionsEnabled,
    setIsCustomInstructionsEnabled,
    settingsOpen,
    setSettingsOpen,
    settingsInitialTab,
  }: NavbarProps) => {
    // Use passed Pro status directly
    const shouldShowNavbarShare = false; // Temporarily hide share button without affecting other share entry points

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 10);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
      <>
        <nav
          className={cn(
            'fixed left-0 right-0 z-30 top-0 flex justify-between items-center transition-all duration-300',
            'px-3 py-2 sm:px-4 sm:py-3 min-h-[56px]',
            scrolled
              ? 'bg-background/70 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_20px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.04)]'
              : 'bg-background/40 backdrop-blur-md border-b border-transparent',
          )}
          role="navigation"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-[80px]">
            {/* History Menu Button - ChatGPT/Claude style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg"
                  onClick={() => {
                    // This will be wired to open history drawer
                    const event = new CustomEvent('toggle-history-drawer');
                    window.dispatchEvent(event);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Chat History
              </TooltipContent>
            </Tooltip>

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/footer-logo.png"
                alt="Bored Brain AI"
                width={28}
                height={28}
                className="opacity-80 hover:opacity-100 transition-opacity invert dark:invert-0"
              />
            </Link>
          </div>

          {/* Center - Platform Navigation */}
          <div className="flex items-center justify-center flex-1 gap-1">
            <Link href="/arena">
              <Button variant="ghost" size="sm" className="text-[11px] font-mono-wide tracking-widest text-muted-foreground/70 hover:text-amber-brand">Arena</Button>
            </Link>
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="text-[11px] font-mono-wide tracking-widest text-muted-foreground/70 hover:text-amber-brand">Agents</Button>
            </Link>
            <Link href="/prompts">
              <Button variant="ghost" size="sm" className="text-[11px] font-mono-wide tracking-widest text-muted-foreground/70 hover:text-amber-brand">Prompts</Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-[11px] font-mono-wide tracking-widest text-muted-foreground/70 hover:text-amber-brand">Market</Button>
            </Link>
            <Link href="/dashboard/revenue">
              <Button variant="ghost" size="sm" className="text-[11px] font-mono-wide tracking-widest text-muted-foreground/70 hover:text-amber-brand">Revenue</Button>
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 min-w-[80px] justify-end">
            {/* Share functionality using unified component */}
            {shouldShowNavbarShare && chatId && (
              <>
                {user && isOwner ? (
                  /* Authenticated chat owners get share functionality */
                  <ShareButton
                    chatId={chatId}
                    selectedVisibilityType={selectedVisibilityType}
                    onVisibilityChange={async (visibility) => {
                      await Promise.resolve(onVisibilityChange(visibility));
                    }}
                    isOwner={isOwner}
                    user={user}
                    variant="navbar"
                    className="mr-1"
                    disabled={false}
                  />
                ) : (
                  /* Non-owners (authenticated or not) just see indicator */
                  selectedVisibilityType === 'public' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="pointer-events-auto bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 opacity-80 cursor-not-allowed"
                          disabled
                        >
                          <GlobeHemisphereWestIcon size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Shared</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>
                        {user ? "This is someone else's shared page" : 'This is a shared page'}
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
              </>
            )}

            {/* New Chat Button */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/new">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="holographic-button rounded-full border border-border/40 dark:border-white/10 transition-all pointer-events-auto px-3.5 sm:px-4 h-9 font-semibold active:scale-[0.97]"
                >
                  <span className="font-bold text-xs sm:text-sm text-white dark:text-white flex items-center gap-1">
                    <span className="text-base sm:text-lg leading-none">+</span>
                    <span className="tracking-wide hidden sm:inline">NEW CHAT</span>
                    <span className="tracking-wide sm:hidden">NEW</span>
                  </span>
                </Button>
              </Link>

              <Link href="/dashboard" className="hidden sm:inline-block">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="relative overflow-hidden rounded-lg px-3 sm:px-4 h-10 font-semibold pointer-events-auto shadow-lg ring-1 ring-amber-500/30 ring-offset-1 ring-offset-background transition-all signal-card border-amber-brand hover:border-amber-brand-light active:scale-95"
                >
                  <span className="font-bold text-xs sm:text-sm text-amber-brand drop-shadow flex items-center gap-1.5">
                    <span className="tracking-widest font-mono-wide">DASHBOARD</span>
                  </span>
                </Button>
              </Link>
            </div>

            {/* Wallet Connect */}
            <div className="hidden sm:block">
              <WalletConnectButton />
            </div>

            {/* Navigation Menu - settings icon for general navigation */}
            <NavigationMenu />
            {/* User Profile - focused on authentication and account management */}
            <UserProfile
              user={user}
              subscriptionData={subscriptionData}
              isProUser={isProUser}
              isProStatusLoading={isProStatusLoading}
              isCustomInstructionsEnabled={isCustomInstructionsEnabled}
              setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              settingsInitialTab={settingsInitialTab}
            />
          </div>
        </nav>
      </>
    );
  },
);

Navbar.displayName = 'Navbar';

export { Navbar };
