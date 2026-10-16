import pg from 'pg';
import { randomUUID, timingSafeEqual } from 'node:crypto';

// Security: never log or return the token, Authorization header, connection URL,
// or any secret-derived hash. Diagnostics are written only to Vercel Runtime Logs.
const VERSION = 'db-health-diagnostics-v2';
const equalSecret = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};
const report = (requestId, phase, extra = {}) => {
  console.info(JSON.stringify({
    event: 'clawos.db_health',
    requestId,
    version: VERSION,
    phase,
    ...extra
  }));
};
export default async function handler(req, res) {
  const requestId = randomUUID();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-ClawOS-Diagnostic-Version', VERSION);
  res.setHeader('X-ClawOS-Request-Id', requestId);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed', requestId });
  }

  const configured = process.env.CLAWOS_HEALTH_TOKEN;
  const received = req.headers['x-clawos-health-token'];
  const configuredPresent = typeof configured === 'string' && configured.length > 0;
  const headerPresent = typeof received === 'string' && received.length > 0;
  const matched = configuredPresent && headerPresent && equalSecret(configured, received);

  if (!matched) {
    // Internals visible only in server logs. The HTTP response intentionally does
    // not reveal whether the server secret exists or whether a header was received.
    report(requestId, 'authorization_denied', {
      configuredPresent,
      headerPresent,
      matched: false,
      vercelEnvironment: process.env.VERCEL_ENV || 'unknown'
    });
    return res.status(401).json({ ok: false, error: 'unauthorized', requestId });
  }

  if (!process.env.DATABASE_URL) {
    report(requestId, 'database_not_configured');
    return res.status(503).json({ ok: false, database: 'not_configured', requestId });
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
    const ok = rows[0]?.alive === 1;
    report(requestId, ok ? 'database_connected' : 'database_invalid_result');
    return res.status(ok ? 200 : 503).json({ ok, database: ok ? 'connected' : 'unreachable', requestId });
  } catch (error) {
    // Do not log error.message: connection errors can contain private hostnames.
    report(requestId, 'database_unreachable', {
      pgCode: typeof error?.code === 'string' && /^[0-9A-Z]{2,8}$/.test(error.code) ? error.code : 'unknown'
    });
    return res.status(503).json({ ok: false, database: 'unreachable', requestId });
  } finally {
    await client.end().catch(() => {});
  }
}
