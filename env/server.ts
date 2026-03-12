// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const optionalString = z.string().trim().optional().default('');

export const serverEnv = createEnv({
  server: {
    // Core - required for app to function
    DATABASE_URL: z.string().trim().min(1).optional().default(''),
    BETTER_AUTH_SECRET: z.string().trim().optional().default(''),

    // AI Providers - optional, features degrade gracefully
    XAI_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    GROQ_API_KEY: optionalString,
    GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
    DAYTONA_API_KEY: optionalString,

    // Database replicas
    READ_DB_1: optionalString,
    READ_DB_2: optionalString,

    // OAuth providers
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    TWITTER_CLIENT_ID: optionalString,
    TWITTER_CLIENT_SECRET: optionalString,

    // Redis/Cache
    REDIS_URL: optionalString,
    UPSTASH_REDIS_REST_URL: optionalString,
    UPSTASH_REDIS_REST_TOKEN: optionalString,

    // Tool API keys
    ELEVENLABS_API_KEY: optionalString,
    TAVILY_API_KEY: optionalString,
    EXA_API_KEY: optionalString,
    VALYU_API_KEY: optionalString,
    TMDB_API_KEY: optionalString,
    YT_ENDPOINT: optionalString,
    FIRECRAWL_API_KEY: optionalString,
    PARALLEL_API_KEY: optionalString,
    OPENWEATHER_API_KEY: optionalString,
    GOOGLE_MAPS_API_KEY: optionalString,
    AMADEUS_API_KEY: optionalString,
    AMADEUS_API_SECRET: optionalString,
    ALCHEMY_API_KEY: optionalString,
    SMITHERY_API_KEY: optionalString,
    COINGECKO_API_KEY: optionalString,
    CLOUDFLARE_ACCOUNT_ID: optionalString,
    CLOUDFLARE_API_TOKEN: optionalString,
    SUPERMEMORY_API_KEY: optionalString,

    // Infrastructure
    CRON_SECRET: optionalString,
    BLOB_READ_WRITE_TOKEN: optionalString,
    QSTASH_TOKEN: optionalString,
    RESEND_API_KEY: optionalString,
    ALLOWED_ORIGINS: z.string().trim().optional().default('http://localhost:3009'),

    // Polar payment integration
    POLAR_ACCESS_TOKEN: optionalString,
    POLAR_WEBHOOK_SECRET: optionalString,
    POLAR_PRO_PRODUCT_ID: optionalString,
    POLAR_SUCCESS_URL: z.string().trim().optional().default('/settings?checkout=success'),
    POLAR_PORTAL_RETURN_URL: z.string().trim().optional().default('/settings'),
    POLAR_SANDBOX: z.string().trim().optional().default('false'),
  },
  experimental__runtimeEnv: process.env,
});
