'use client';

import Link from 'next/link';
import { Lock, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        {/* Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <Lock className="h-8 w-8 text-white/30" />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-4 w-4 text-amber-400/60" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white/90">{title}</h1>
          <p className="text-sm text-white/40">
            {description || 'This feature is under development and will be available soon.'}
          </p>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-amber-400 tracking-wide uppercase">Coming Soon</span>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <Link href="/arena">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Arena
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
