'use client';

import React from 'react';
import { UserProfile } from '@/components/user-profile';

interface NavbarProps {
  user: any;
  isProUser: boolean;
  isProStatusLoading: boolean;
  showProBadge?: boolean;
}

export function Navbar({ user, isProUser, isProStatusLoading }: NavbarProps) {
  return (
    <div className="fixed left-0 right-0 top-0 z-30 flex justify-end items-center p-3 bg-background/80 backdrop-blur-md border-b border-border/50">
      <UserProfile
        user={user || null}
        subscriptionData={
          user?.polarSubscription
            ? {
                hasSubscription: true,
                subscription: user.polarSubscription,
              }
            : { hasSubscription: false }
        }
        isProUser={isProUser}
        isProStatusLoading={isProStatusLoading}
      />
    </div>
  );
}
