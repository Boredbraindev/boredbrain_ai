import { drizzle } from 'drizzle-orm/neon-http';
import { withReplicas } from 'drizzle-orm/pg-core';
import * as schema from '@/lib/db/schema';
import { serverEnv } from '@/env/server';
import { upstashCache } from 'drizzle-orm/cache/upstash';
import { neon } from '@neondatabase/serverless';

const replicaCacheConfig = {
  url: serverEnv.UPSTASH_REDIS_REST_URL,
  token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
  global: true,
  config: { ex: 600 },
} as const;

const sql = neon(serverEnv.DATABASE_URL);

export const maindb = drizzle(sql, {
  schema,
  cache: upstashCache(replicaCacheConfig),
});

const replicaUrls = [serverEnv.READ_DB_1, serverEnv.READ_DB_2].filter(
  (url): url is string => Boolean(url && url.trim()),
);

const replicas = replicaUrls
  .filter((url) => url !== serverEnv.DATABASE_URL)
  .map((url) =>
    drizzle(neon(url), {
      schema,
      cache: upstashCache(replicaCacheConfig),
    }),
  );

export const db = replicas.length > 0 ? withReplicas(maindb, replicas as [typeof maindb, ...typeof replicas]) : maindb;
