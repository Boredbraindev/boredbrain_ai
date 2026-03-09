// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const clientEnv = createEnv({
  client: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().trim().min(1).optional().default('dummy-google-maps-api-key'),
    NEXT_PUBLIC_APP_URL: z.string().url().optional().default('https://ai.boredbrain.app'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
