import { readFile } from 'node:fs/promises';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(74812001)");
  await client.query(await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Database migration complete.');
} catch { console.error('Migration failed; check database connectivity and permissions.'); process.exitCode = 1; }
finally { await client.end(); }
