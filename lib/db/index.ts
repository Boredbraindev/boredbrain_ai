import { withReplicas } from 'drizzle-orm/pg-core';
import * as schema from '@/lib/db/schema';
import { serverEnv } from '@/env/server';

const useLocalDb = process.env.USE_LOCAL_DB === '1';

async function createDb() {
  if (useLocalDb) {
    // Standard PostgreSQL via postgres.js (for Docker / self-hosted)
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const client = postgres(serverEnv.DATABASE_URL);
    return drizzle(client, { schema });
  } else {
    // Neon serverless + Upstash cache (for Vercel)
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { neon } = await import('@neondatabase/serverless');
    const { upstashCache } = await import('drizzle-orm/cache/upstash');

    const replicaCacheConfig = {
      url: serverEnv.UPSTASH_REDIS_REST_URL,
      token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
      global: true,
      config: { ex: 600 },
    } as const;

    const sql = neon(serverEnv.DATABASE_URL);
    const maindb = drizzle(sql, { schema, cache: upstashCache(replicaCacheConfig) });

    const replicaUrls = [serverEnv.READ_DB_1, serverEnv.READ_DB_2].filter(
      (url): url is string => Boolean(url && url.trim()),
    );

    const replicas = replicaUrls
      .filter((url) => url !== serverEnv.DATABASE_URL)
      .map((url) => drizzle(neon(url), { schema, cache: upstashCache(replicaCacheConfig) }));

    return replicas.length > 0
      ? withReplicas(maindb, replicas as [typeof maindb, ...typeof replicas])
      : maindb;
  }
}

// Eagerly initialize (top-level await supported in Next.js server modules)
export const db = await createDb();
export const maindb = db;
