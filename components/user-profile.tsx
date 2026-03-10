'use client';

import React, { useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { SignOutIcon, SignInIcon, InfoIcon, ShieldIcon, GearIcon, XLogoIcon } from '@phosphor-icons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { BinocularsIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from './theme-switcher';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { SettingsDialog } from './settings-dialog';
import { useSession, signOut } from '@/lib/auth-client';
import { SIGN_OUT_ENABLED } from '@/lib/constants';

// Empty NavigationMenu for backward compatibility
const NavigationMenu = memo(() => null);
NavigationMenu.displayName = 'NavigationMenu';

// User Profile Component - contains all navigation and account management
const UserProfile = memo(
  ({
    className,
    user,
    subscriptionData,
    isProUser,
    isProStatusLoading,
    isCustomInstructionsEnabled,
    setIsCustomInstructionsEnabled,
    settingsOpen,
    setSettingsOpen,
    settingsInitialTab,
  }: {
    className?: string;
    user?: any;
    subscriptionData?: any;
    isProUser?: boolean;
    isProStatusLoading?: boolean;
    isCustomInstructionsEnabled?: boolean;
    setIsCustomInstructionsEnabled?: (value: boolean | ((val: boolean) => boolean)) => void;
    settingsOpen?: boolean;
    setSettingsOpen?: (open: boolean) => void;
    settingsInitialTab?: 'account' | 'usage';
  }) => {
    const [signingOut, setSigningOut] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const { data: session, isPending } = useSession();
    const router = useRouter();

    // Use passed user prop if available, otherwise fall back to session
    const currentUser = user || session?.user;
    const isAuthenticated = Boolean(currentUser);

    if (isPending && !user) {
      return (
        <div className="h-8 w-8 flex items-center justify-center">
          <div className="size-4 rounded-full bg-muted/50 animate-pulse"></div>
        </div>
      );
    }

    return (
      <>
        {isAuthenticated ? (
          // Authenticated user - show avatar dropdown with all options
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('!p-0 !m-0 hover:opacity-80', signingOut && 'animate-pulse', className)}
                  >
                    <Avatar className="size-7 rounded-full border border-neutral-200 dark:border-neutral-700">
                      <AvatarImage
                        src={currentUser?.image || ''}
                        alt={currentUser?.name || ''}
                        className="rounded-full"
                      />
                      <AvatarFallback className="rounded-full text-xs">
                        {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Menu
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-[260px] z-[110] mr-2">
              {/* User Info Header */}
              <div className="p-3 pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 rounded-full border border-neutral-200 dark:border-neutral-700">
                    <AvatarImage
                      src={currentUser?.image || ''}
                      alt={currentUser?.name || ''}
                      className="rounded-full"
                    />
                    <AvatarFallback className="rounded-full">
                      {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <p className="font-medium text-sm truncate">{currentUser?.name || 'User'}</p>
                    {currentUser?.username && <p className="text-xs text-muted-foreground">@{currentUser.username}</p>}
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />

              {/* Settings */}
              <DropdownMenuItem className="cursor-pointer" onClick={() => setSettingsOpen?.(true)}>
                <GearIcon className="size-4 mr-2" weight="regular" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Features */}
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/signals" className="flex items-center">
                  <HugeiconsIcon icon={BinocularsIcon} className="size-4 mr-2 text-primary" />
                  <span>Signals</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/kol" className="flex items-center">
                  <XLogoIcon className="size-4 mr-2 text-primary" weight="fill" />
                  <span>Tracker</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* External Links */}
              <DropdownMenuItem className="cursor-pointer" asChild>
                <a href="https://boredbrain.app" target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <InfoIcon className="size-4 mr-2" weight="regular" />
                  <span>About</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" asChild>
                <a
                  href="https://x.com/boredbrain_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <XLogoIcon className="size-4 mr-2" weight="fill" />
                  <span>Follow on X</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Theme Switcher */}
              <div className="p-2">
                <div className="flex justify-center">
                  <ThemeSwitcher hideText />
                </div>
              </div>
              <DropdownMenuSeparator />

              {/* Sign Out */}
              {SIGN_OUT_ENABLED && (
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (signingOut) return;

                    setSigningOut(true);
                    const toastId = toast.loading('Signing out...');
                    try {
                      await signOut();
                      toast.dismiss(toastId);
                      localStorage.clear();
                      toast.success('Signed out successfully');
                      router.push('/sign-in');
                    } catch (error) {
                      console.error('Failed to sign out', error);
                      toast.dismiss(toastId);
                      setSigningOut(false);
                      toast.error('Failed to sign out');
                      router.refresh();
                    }
                  }}
                >
                  <SignOutIcon className="size-4 mr-2" weight="regular" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Unauthenticated user - show sign in button
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn('px-3 py-1.5 text-sm signal-card border-amber-brand hover:border-amber-brand-light text-amber-brand hover:text-amber-brand-light', signingIn && 'animate-pulse', className)}
                onClick={() => {
                  setSigningIn(true);
                  router.push('/sign-in');
                }}
              >
                <SignInIcon className="size-4 mr-1.5" />
                Sign In
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Sign in to save your progress
            </TooltipContent>
          </Tooltip>
        )}

        {/* Settings Dialog */}
        {settingsOpen !== undefined && setSettingsOpen && (
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            user={user}
            subscriptionData={subscriptionData}
            isProUser={isProUser}
            isProStatusLoading={isProStatusLoading}
            isCustomInstructionsEnabled={isCustomInstructionsEnabled}
            setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
            initialTab={settingsInitialTab}
          />
        )}
      </>
    );
  },
);

UserProfile.displayName = 'UserProfile';

export { UserProfile, NavigationMenu };
