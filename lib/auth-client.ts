'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  plugins: [],
});

// Export Better Auth hooks and methods
export const {
  useSession,
  signIn,
  signOut,
  signUp,
} = authClient;

/**
 * Convenience hook that returns just the user from the session.
 * Returns `null` while loading or if not authenticated.
 */
export function useUser() {
  const session = useSession();
  return {
    user: session.data?.user ?? null,
    isLoading: session.isPending,
    error: session.error,
  };
}
