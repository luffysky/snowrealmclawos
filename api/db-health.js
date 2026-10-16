import pg from 'pg';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const token = process.env.CLAWOS_HEALTH_TOKEN;
  const provided = req.headers['x-clawos-health-token'];
  // Fail closed until the operator configures an independent secret token.
  if (!token || typeof provided !== 'string' || provided !== token) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, database: 'not_configured' });
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    ssl: { rejectUnauthorized: true }
  });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT 1 AS alive');
    return res.status(200).json({ ok: rows[0]?.alive === 1, database: 'connected' });
  } catch {
    return res.status(503).json({ ok: false, database: 'unreachable' });
  } finally {
    await client.end().catch(() => {});
  }
}
