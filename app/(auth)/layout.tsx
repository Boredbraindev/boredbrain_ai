'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md px-4 md:px-8">
        {/* Terminal-style container */}
        <div className="relative rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm shadow-2xl">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-red-500/80" />
              <div className="size-3 rounded-full bg-yellow-500/80" />
              <div className="size-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex-1 text-center text-xs text-muted-foreground font-mono">
              boredbrain.app
            </div>
          </div>

          {/* Terminal content */}
          <div className="p-8">
            {/* Title */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <Link href="/" className="group">
                <span className="text-3xl font-sans font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
                  Bored Brain AI
                </span>
              </Link>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="text-green-500">●</span>
                <span>Your NFT AI co-pilot: playful instincts, calculated moves</span>
              </div>
            </div>

            {/* Auth Content */}
            <div className="mb-6">
              {children}
            </div>

            {/* Telegram CTA - Terminal style */}
            <div className="mt-6 p-4 border border-border/30 rounded-md bg-muted/20">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="text-blue-500">$</span>
                  <span>telegram --open</span>
                </div>
                <Button
                  asChild
                  className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90 text-white font-mono text-sm"
                >
                  <a
                    href="https://t.me/boredbrain_bot?start=webapp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Open in Telegram
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
