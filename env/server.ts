// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const requiredString = z.string().trim().min(1);
const optionalStringWithDefault = (value: string) => z.string().trim().optional().default(value);

export const serverEnv = createEnv({
  server: {
    XAI_API_KEY: requiredString,
    OPENAI_API_KEY: requiredString,
    ANTHROPIC_API_KEY: requiredString,
    GROQ_API_KEY: requiredString,
    GOOGLE_GENERATIVE_AI_API_KEY: requiredString,
    DAYTONA_API_KEY: requiredString,
    DATABASE_URL: requiredString,
    READ_DB_1: optionalStringWithDefault(''),
    READ_DB_2: optionalStringWithDefault(''),
    BETTER_AUTH_SECRET: requiredString,
    GITHUB_CLIENT_ID: requiredString,
    GITHUB_CLIENT_SECRET: requiredString,
    GOOGLE_CLIENT_ID: requiredString,
    GOOGLE_CLIENT_SECRET: requiredString,
    TWITTER_CLIENT_ID: requiredString,
    TWITTER_CLIENT_SECRET: requiredString,
    REDIS_URL: requiredString,
    UPSTASH_REDIS_REST_URL: requiredString,
    UPSTASH_REDIS_REST_TOKEN: requiredString,
    ELEVENLABS_API_KEY: requiredString,
    TAVILY_API_KEY: requiredString,
    EXA_API_KEY: requiredString,
    VALYU_API_KEY: requiredString,
    TMDB_API_KEY: requiredString,
    YT_ENDPOINT: requiredString,
    FIRECRAWL_API_KEY: requiredString,
    PARALLEL_API_KEY: optionalStringWithDefault('dummy-parallel-api-key'),
    OPENWEATHER_API_KEY: requiredString,
    GOOGLE_MAPS_API_KEY: optionalStringWithDefault('dummy-google-maps-api-key'),
    AMADEUS_API_KEY: optionalStringWithDefault('dummy-amadeus-api-key'),
    AMADEUS_API_SECRET: optionalStringWithDefault('dummy-amadeus-api-secret'),
    CRON_SECRET: requiredString,
    BLOB_READ_WRITE_TOKEN: requiredString,
    SMITHERY_API_KEY: requiredString,
    COINGECKO_API_KEY: requiredString,
    // Make optional with empty default so the app doesn't crash if not set; the tool checks presence at runtime
    ALCHEMY_API_KEY: optionalStringWithDefault(''),
    QSTASH_TOKEN: requiredString,
    RESEND_API_KEY: requiredString,
    SUPERMEMORY_API_KEY: requiredString,
    ALLOWED_ORIGINS: optionalStringWithDefault('http://localhost:3009'),
    // Polar payment integration (optional -- app works without these)
    POLAR_ACCESS_TOKEN: optionalStringWithDefault(''),
    POLAR_WEBHOOK_SECRET: optionalStringWithDefault(''),
    POLAR_PRO_PRODUCT_ID: optionalStringWithDefault(''),
    POLAR_SUCCESS_URL: optionalStringWithDefault('/settings?checkout=success'),
    POLAR_PORTAL_RETURN_URL: optionalStringWithDefault('/settings'),
    POLAR_SANDBOX: optionalStringWithDefault('false'),
  },
  experimental__runtimeEnv: process.env,
});
