import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import {
  user,
  session,
  verification,
  account,
  chat,
  message,
  extremeSearchUsage,
  messageUsage,
  customInstructions,
  stream,
  lookout,
  subscription,
} from '@/lib/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import { config } from 'dotenv';
import { serverEnv } from '@/env/server';

config({
  path: '.env.local',
});

// ---------------------------------------------------------------------------
// Polar integration (conditional -- only activates when credentials are set)
// ---------------------------------------------------------------------------
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;
const POLAR_ENABLED = Boolean(POLAR_ACCESS_TOKEN);

function buildPolarPlugin() {
  if (!POLAR_ENABLED) return null;

  // Dynamic import at module scope is fine here because the condition above
  // is evaluated once on cold-start.
  const { polar, checkout, portal, webhooks } = require('@polar-sh/better-auth') as typeof import('@polar-sh/better-auth');
  const { Polar } = require('@polar-sh/sdk') as typeof import('@polar-sh/sdk');

  const polarClient = new Polar({
    accessToken: POLAR_ACCESS_TOKEN!,
    // Use sandbox server when explicitly set, otherwise production
    ...(process.env.POLAR_SANDBOX === 'true' ? { server: 'sandbox' as const } : {}),
  });

  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  const polarPlugins = [
    checkout({
      successUrl: process.env.POLAR_SUCCESS_URL || '/settings?checkout=success',
      authenticatedUsersOnly: true,
      products: process.env.POLAR_PRO_PRODUCT_ID
        ? [{ productId: process.env.POLAR_PRO_PRODUCT_ID, slug: 'pro' }]
        : undefined,
    }),
    portal({
      returnUrl: process.env.POLAR_PORTAL_RETURN_URL || '/settings',
    }),
    // Only add webhooks plugin when the secret is configured
    ...(webhookSecret
      ? [
          webhooks({
            secret: webhookSecret,
            onSubscriptionCreated: async (payload) => {
              console.log('[Polar] Subscription created:', payload.data.id);
            },
            onSubscriptionActive: async (payload) => {
              console.log('[Polar] Subscription active:', payload.data.id);
            },
            onSubscriptionCanceled: async (payload) => {
              console.log('[Polar] Subscription canceled:', payload.data.id);
            },
            onSubscriptionRevoked: async (payload) => {
              console.log('[Polar] Subscription revoked:', payload.data.id);
            },
          }),
        ]
      : []),
  ] as const;

  return polar({
    client: polarClient,
    createCustomerOnSignUp: true,
    use: polarPlugins as any,
  });
}

const polarPlugin = buildPolarPlugin();

// ---------------------------------------------------------------------------
// Better Auth instance
// ---------------------------------------------------------------------------
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  rateLimit: {
    max: 50,
    window: 60,
  },
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60,
  },
  advanced: {
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: undefined,
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      verification,
      account,
      chat,
      message,
      extremeSearchUsage,
      messageUsage,
      customInstructions,
      stream,
      lookout,
      subscription,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    // Only enable OAuth providers when both client ID and secret are set
    ...(serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: serverEnv.GITHUB_CLIENT_ID,
            clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: serverEnv.GOOGLE_CLIENT_ID,
            clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(serverEnv.TWITTER_CLIENT_ID && serverEnv.TWITTER_CLIENT_SECRET
      ? {
          twitter: {
            clientId: serverEnv.TWITTER_CLIENT_ID,
            clientSecret: serverEnv.TWITTER_CLIENT_SECRET,
          },
        }
      : {}),
  },
  pluginRoutes: {
    autoNamespace: true,
  },
  plugins: [
    nextCookies(),
    // Conditionally include the Polar plugin (cast needed due to version mismatch)
    ...(polarPlugin ? [polarPlugin as any] : []),
  ],
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3009',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3009',
    'https://boredbrain.ai',
    'https://www.boredbrain.ai',
    'https://boredbrain.app',
    'https://www.boredbrain.app',
    'https://boredbrain.app',
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ...(process.env.NODE_ENV !== 'production'
      ? (process.env.NGROK_HOST || process.env.NGROK_HOSTS || '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : []),
  ],
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3009',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3009',
    'https://boredbrain.ai',
    'https://www.boredbrain.ai',
    'https://boredbrain.app',
    'https://www.boredbrain.app',
    'https://boredbrain.app',
    ...(process.env.NODE_ENV !== 'production'
      ? (process.env.NGROK_HOST || process.env.NGROK_HOSTS || '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : []),
  ],
});

// Re-export for use in other modules
export const POLAR_INTEGRATION_ENABLED = POLAR_ENABLED;
