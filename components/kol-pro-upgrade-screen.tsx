'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Crown02Icon, DatabaseIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { XLogoIcon, CodeIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
interface KOLProUpgradeScreenProps {}

export function KOLProUpgradeScreen({}: KOLProUpgradeScreenProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 text-3xl sm:text-5xl font-be-vietnam-pro pt-12 sm:pt-14">
        <span className="text-foreground">Bored Brain</span>
        <div className="flex items-center relative">
          <XLogoIcon className="size-8 sm:size-12 text-foreground -mr-1 sm:-mr-2" />
          <h1 className="text-foreground">KOL</h1>
          {/* Beta badge as superscript */}
          <div className="absolute -top-2 -right-6 sm:-top-3 sm:-right-8">
            <div className="bg-primary text-primary-foreground px-1 py-0.5 rounded-sm text-xs font-semibold text-[8px] sm:text-xs">
              BETA
            </div>
          </div>
        </div>
      </div>

      {/* Feature notice */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md w-full text-center shadow-none">
          <CardHeader className="pb-4">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
              <HugeiconsIcon
                icon={Crown02Icon}
                size={32}
                color="currentColor"
                strokeWidth={1.5}
                className="text-primary-foreground"
              />
            </div>
            <CardTitle className="text-xl">Feature Unavailable</CardTitle>
            <CardDescription>
              KOL (Key Opinion Leader) tracker is currently unavailable while the Telegram mini app remains in open
              access. We&apos;re reworking premium features so everyone can continue exploring for free.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-primary"
                />
                <span>Track influential X accounts and KOLs</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CodeIcon className="h-4 w-4 text-primary" />
                <span>Natural language queries for insights</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={DatabaseIcon}
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-primary"
                />
                <span>Advanced filtering by engagement metrics</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => router.push('/new')}>
              Back to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
