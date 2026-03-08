import * as schema from '@/lib/db/schema';
import { serverEnv } from '@/env/server';

const useLocalDb = process.env.USE_LOCAL_DB === '1';

async function createDb() {
  const dbUrl = serverEnv.DATABASE_URL;

  // If no DATABASE_URL, return a proxy that throws helpful errors on use
  if (!dbUrl) {
    console.warn('[db] DATABASE_URL not set — database operations will fail gracefully');
    return null as any;
  }

  if (useLocalDb) {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const client = postgres(dbUrl);
    return drizzle(client, { schema });
  } else {
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { neon } = await import('@neondatabase/serverless');

    let cacheConfig: any = undefined;

    // Only use Upstash cache if credentials are available
    if (serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const { upstashCache } = await import('drizzle-orm/cache/upstash');
        cacheConfig = upstashCache({
          url: serverEnv.UPSTASH_REDIS_REST_URL,
          token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
          global: true,
          config: { ex: 600 },
        } as const);
      } catch {
        // Upstash cache not available
      }
    }

    const sql = neon(dbUrl);
    const maindb = drizzle(sql, { schema, ...(cacheConfig ? { cache: cacheConfig } : {}) });

    const replicaUrls = [serverEnv.READ_DB_1, serverEnv.READ_DB_2].filter(
      (url): url is string => Boolean(url && url.trim()),
    );

    const replicas = replicaUrls
      .filter((url) => url !== dbUrl)
      .map((url) => drizzle(neon(url), { schema, ...(cacheConfig ? { cache: cacheConfig } : {}) }));

    if (replicas.length > 0) {
      const { withReplicas } = await import('drizzle-orm/pg-core');
      return withReplicas(maindb, replicas as [typeof maindb, ...typeof replicas]);
    }

    return maindb;
  }
}

// Eagerly initialize (top-level await supported in Next.js server modules)
export const db = await createDb();
export const maindb = db;
