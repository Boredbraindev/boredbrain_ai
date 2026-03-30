'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, MenuIcon, UserIcon } from 'lucide-react';

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
  status?: 'live' | 'beta' | 'coming_soon';
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
            'text-[11px] lg:text-xs xl:text-[13px] font-mono-wide tracking-widest gap-0.5 px-2.5 lg:px-3 xl:px-4',
            isGroupActive
              ? 'text-amber-400 font-semibold'
              : 'text-white/60 hover:text-amber-400',
          )}
        >
          {label}
          <ChevronDownIcon className="size-3 lg:size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="min-w-[140px] lg:min-w-[160px] bg-[#0a0a0a] border-white/[0.06]"
      >
        {items.map((item) => {
          // Exact match only for dropdown items — prevents /agents matching /agents/register
          const isActive = pathname === item.href;
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn(
                  'text-[11px] lg:text-xs font-mono-wide tracking-widest cursor-pointer flex items-center gap-1.5',
                  isActive
                    ? 'text-amber-400 font-semibold'
                    : item.status === 'coming_soon'
                      ? 'text-white/25'
                      : 'text-white/60 hover:text-amber-400',
                )}
              >
                {item.label}
                {item.status === 'beta' && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold leading-none">B</span>
                )}
                {item.status === 'coming_soon' && (
                  <span className="text-[8px] text-white/20">🔒</span>
                )}
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
    label: 'Arena',
    items: [
      { href: '/arena', label: 'Live' },
      { href: '/leaderboard', label: 'Rankings' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/agents', label: 'Browse' },
      { href: '/agents/register', label: 'Register' },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/openclaw', label: 'BBClaw' },
      { href: '/docs', label: 'Docs' },
      { href: '/subscribe', label: 'Pro' },
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

  // Hide navbar on standalone pages (joinlist landing, etc.)
  if (pathname === '/joinlist') return null;

  return (
    <>
      <nav
        className={cn(
          'fixed left-0 right-0 z-30 top-0 flex justify-between items-center transition-all duration-300',
          'px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-3 xl:px-8 min-h-[56px] lg:min-h-[60px] xl:min-h-[64px]',
          scrolled
            ? 'bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/[0.04] shadow-[0_1px_10px_rgba(0,0,0,0.2)]'
            : 'bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-transparent',
        )}
        role="navigation"
      >
        {/* Left - Logo & Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-[80px] lg:min-w-[160px] xl:min-w-[200px]">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <MenuIcon className="size-5" />
          </Button>

          <Link href="/" className="flex items-center gap-2 lg:gap-2.5 group">
            <Image
              src="/footer.png"
              alt="Bored Brain AI"
              width={28}
              height={28}
              className="opacity-90 group-hover:opacity-100 transition-opacity rounded-md sm:w-[28px] sm:h-[28px] lg:w-[34px] lg:h-[34px] xl:w-[38px] xl:h-[38px]"
            />
            <span className="hidden lg:inline text-sm xl:text-base font-logo text-amber-500 group-hover:text-amber-400 transition-colors tracking-wide">
              BoredBrain
            </span>
          </Link>
        </div>

        {/* Center - Desktop Navigation */}
        <div className="hidden sm:flex items-center justify-center flex-1 gap-0.5 lg:gap-1 xl:gap-1.5">
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
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 min-w-[80px] lg:min-w-[160px] xl:min-w-[200px] justify-end">
          <Link href="/arena">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-full transition-all pointer-events-auto px-3.5 sm:px-4 lg:px-5 h-9 lg:h-10 xl:h-11 font-semibold active:scale-[0.97]"
            >
              <span className="font-bold text-xs sm:text-sm lg:text-sm xl:text-base text-amber-400 flex items-center gap-1 lg:gap-1.5">
                <span className="text-base sm:text-lg lg:text-xl leading-none">⚔</span>
                <span className="tracking-wide hidden sm:inline">ARENA</span>
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
            className="absolute top-[56px] left-0 right-0 max-h-[calc(100dvh-56px)] overflow-y-auto bg-[#0a0a0a]/98 backdrop-blur-sm border-b border-white/[0.04] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="text-[10px] font-mono-wide tracking-widest text-white/30 uppercase mb-1.5 px-2">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    // Exact match only for mobile menu items
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'text-sm px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5',
                          isActive
                            ? 'text-amber-400 font-semibold bg-amber-500/10'
                            : item.status === 'coming_soon'
                              ? 'text-white/25'
                              : 'text-white/60 hover:text-amber-400 hover:bg-white/[0.04]',
                        )}
                      >
                        {item.label}
                        {item.status === 'beta' && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold leading-none">BETA</span>
                        )}
                        {item.status === 'coming_soon' && (
                          <span className="text-[8px] text-white/20">🔒</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-white/[0.04] flex flex-col gap-2">
              <Link
                href="/profile"
                className={cn(
                  'text-sm px-2 py-1.5 rounded-md transition-colors flex items-center gap-2',
                  pathname === '/profile'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-white/60 hover:text-amber-400 hover:bg-white/[0.04]',
                )}
              >
                <UserIcon className="size-4" />
                Profile
              </Link>
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-[56px] lg:h-[60px] xl:h-[64px]" />
    </>
  );
}
