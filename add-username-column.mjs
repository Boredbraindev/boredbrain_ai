import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('Adding username column to user table...');
    
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text`;
    console.log('✓ Column added');
    
    await sql`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_username_unique"`;
    await sql`ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username")`;
    console.log('✓ Unique constraint added');
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
