'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AuthCardProps {
  title: string;
  description: string;
  mode?: 'sign-in' | 'sign-up';
}

/**
 * Authentication component for Telegram mini app
 */
export default function AuthCard({ title, description, mode = 'sign-in' }: AuthCardProps) {
  return (
    <div className="w-full max-w-[380px] mx-auto">
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-medium">{title}</h1>
          <p className="text-sm text-muted-foreground/80">{description}</p>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full h-12 text-sm font-medium"
            onClick={() => window.location.href = '/telegram'}
          >
            Continue with Telegram
          </Button>
        </div>

        <div className="pt-6 space-y-4">
          <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
            By continuing, you acknowledge our acceptable use guidelines.
          </p>

          <p className="text-sm text-center text-muted-foreground">
            {mode === 'sign-in' ? (
              <>
                New to Bored Brain?{' '}
                <Link href="/sign-up" className="text-foreground font-medium hover:underline underline-offset-4">
                  Create account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/sign-in" className="text-foreground font-medium hover:underline underline-offset-4">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
