// Idempotent, transactional Neon migrations. Runs only from a trusted server terminal.
// Usage: CLAWOS_ALLOW_DB_MIGRATION=yes DATABASE_URL=... node scripts/migrate-neon.mjs
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

if (process.env.CLAWOS_ALLOW_DB_MIGRATION !== 'yes') {
  console.error('Refusing migration without CLAWOS_ALLOW_DB_MIGRATION=yes.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Never paste its value in logs or chat.');
  process.exit(2);
}
const folder = new URL('../infra/neon/', import.meta.url);
const files = (await readdir(folder)).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: true },
  application_name: 'clawos-migration'
});
try {
  await client.connect();
  // Serialize competing migration runs for the lifetime of the connection.
  await client.query('select pg_advisory_lock(8730119)');
  await client.query('create table if not exists public.clawos_schema_migrations (filename text primary key, sha256 text not null, applied_at timestamptz not null default now())');
  for (const file of files) {
    const sql = await readFile(join(fileURLToPath(folder), file), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('select sha256 from public.clawos_schema_migrations where filename=$1',[file]);
    if (existing.rows.length) {
      if (existing.rows[0].sha256 !== hash) throw new Error('Migration changed after application: ' + file);
      console.log('Already applied: ' + file);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('insert into public.clawos_schema_migrations(filename,sha256) values($1,$2)',[file,hash]);
      await client.query('COMMIT');
      console.log('Applied: ' + file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error('Migration failed: ' + file + ' (' + (err.code || 'query error') + ')');
    }
  }
  const result = await client.query("select count(*)::int as count from information_schema.tables where table_schema='public' and table_name in ('workspaces','tasks','chat_messages','agent_jobs','approval_requests','extension_installations','audit_events','task_events','bundle_catalog','bundle_versions','bundle_installations','user_theme_preferences')");
  console.log('ClawOS base tables found: ' + result.rows[0].count + '/12');
} catch(err) {
  console.error('Migration stopped:', err.message);
  process.exitCode=1;
} finally {
  try { await client.query('select pg_advisory_unlock(8730119)'); } catch {}
  await client.end().catch(()=>{});
}
