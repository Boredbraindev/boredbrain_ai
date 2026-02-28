'use client';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSession } from '@/lib/auth-client';

interface SignInPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInPromptDialog({ open, onOpenChange }: SignInPromptDialogProps) {
  const { data: session, isPending } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  
  const isAuthenticated = !!session?.user;

  const handleTelegramLogin = async () => {
    setIsLoading(true);
    // Redirect to Telegram authentication
    window.location.href = '/telegram';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Sign in to continue</h2>
            <p className="text-sm text-muted-foreground">
              Access your chat history and unlock more features
            </p>
          </div>

          <div className="space-y-2">
            <Button
              className="w-full h-12 text-sm font-medium"
              disabled={isPending || isAuthenticated || isLoading}
              onClick={handleTelegramLogin}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue with Telegram'}
            </Button>
          </div>

          <div className="pt-4 space-y-4">
            <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
              By continuing, you acknowledge our acceptable use guidelines.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
