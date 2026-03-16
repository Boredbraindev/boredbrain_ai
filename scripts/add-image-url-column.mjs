/**
 * Migration: Add image_url column to topic_debate table
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read DATABASE_URL from .env.local
const envPath = resolve(import.meta.dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/^DATABASE_URL="(.+)"$/m);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(match[1]);

async function migrate() {
  console.log('Adding image_url column to topic_debate...');
  await sql`ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS image_url TEXT`;
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
