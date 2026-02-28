'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
});

// Export Better Auth hooks
export const { useSession, signIn, signOut, signUp } = authClient;
