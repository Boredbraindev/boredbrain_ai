'use client';

import { createAuthClient } from 'better-auth/react';
// The Polar client plugin is conditionally included to avoid type issues
// when Polar server-side plugin is not active.
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  plugins: [],
});

// Export Better Auth hooks
export const { useSession, signIn, signOut, signUp } = authClient;
