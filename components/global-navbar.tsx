'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, MenuIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WalletConnectButton } from '@/components/wallet-connect-button';

interface NavItem {
  href: string;
  label: string;
}

function NavDropdown({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  const isGroupActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'text-[11px] font-mono-wide tracking-widest gap-0.5 px-2.5',
            isGroupActive
              ? 'text-amber-brand'
              : 'text-muted-foreground/70 hover:text-amber-brand',
          )}
        >
          {label}
          <ChevronDownIcon className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="min-w-[140px] bg-background/95 backdrop-blur-xl border-white/[0.08]"
      >
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn(
                  'text-[11px] font-mono-wide tracking-widest cursor-pointer',
                  isActive
                    ? 'text-amber-brand font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NAV_GROUPS = [
  {
    label: 'Battle',
    items: [
      { href: '/arena', label: 'Arena' },
      { href: '/predict', label: 'Predict' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/agents', label: 'Agents' },
      { href: '/marketplace', label: 'Marketplace' },
      { href: '/playground', label: 'Playground' },
      { href: '/agents/register', label: 'Register' },
      { href: '/agents/tokenize', label: 'Tokenize' },
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/prompts', label: 'Prompts' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    label: 'Economy',
    items: [
      { href: '/economy', label: 'Economy' },
      { href: '/skills', label: 'Skills' },
      { href: '/dao', label: 'DAO' },
      { href: '/rewards/verify', label: 'Verify & Earn' },
      { href: '/rewards', label: 'Rewards' },
    ],
  },
  {
    label: 'Ecosystem',
    items: [
      { href: '/openclaw', label: 'ClawHub' },
      { href: '/network', label: 'Network' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/revenue', label: 'Revenue' },
      { href: '/stats', label: 'Stats' },
    ],
  },
];

export function GlobalNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
        {/* Left - Logo & Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-[80px]">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <MenuIcon className="size-5" />
          </Button>

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

        {/* Center - Desktop Navigation */}
        <div className="hidden sm:flex items-center justify-center flex-1 gap-0.5">
          {NAV_GROUPS.map((group) => (
            <NavDropdown
              key={group.label}
              label={group.label}
              pathname={pathname}
              items={group.items}
            />
          ))}
        </div>

        {/* Right - Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-[80px] justify-end">
          <Link href="/arena">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="holographic-button rounded-full border border-border/40 dark:border-white/10 transition-all pointer-events-auto px-3.5 sm:px-4 h-9 font-semibold active:scale-[0.97]"
            >
              <span className="font-bold text-xs sm:text-sm text-white dark:text-white flex items-center gap-1">
                <span className="text-base sm:text-lg leading-none">⚔</span>
                <span className="tracking-wide hidden sm:inline">ARENA</span>
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

          <div className="hidden sm:block">
            <WalletConnectButton />
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-[56px] left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-white/[0.08] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="text-[10px] font-mono-wide tracking-widest text-muted-foreground/50 uppercase mb-1.5 px-2">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'text-sm px-2 py-1.5 rounded-md transition-colors',
                          isActive
                            ? 'text-amber-brand font-semibold bg-amber-brand/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-white/[0.06]">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-[56px]" />
    </>
  );
}
