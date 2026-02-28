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
} from '@/lib/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import { config } from 'dotenv';
import { serverEnv } from '@/env/server';

config({
  path: '.env.local',
});

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
    },
  }),
  socialProviders: {
    github: {
      clientId: serverEnv.GITHUB_CLIENT_ID,
      clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    },
    twitter: {
      clientId: serverEnv.TWITTER_CLIENT_ID,
      clientSecret: serverEnv.TWITTER_CLIENT_SECRET,
    },
  },
  pluginRoutes: {
    autoNamespace: true,
  },
  plugins: [nextCookies()],
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3009',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3009',
    'https://boredbrain.ai',
    'https://www.boredbrain.ai',
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
    ...(process.env.NODE_ENV !== 'production'
      ? (process.env.NGROK_HOST || process.env.NGROK_HOSTS || '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : []),
  ],
});
