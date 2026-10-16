# Neon connectivity smoke test on Vercel

Vercel was linked to Neon and the operator confirmed `DATABASE_URL` exists.
This does **not** establish successful query execution or a complete ClawOS backend.

## Setup

1. Keep `DATABASE_URL` server-side and Sensitive.
2. Add a new **server-side**, Sensitive env var named `CLAWOS_HEALTH_TOKEN`.
   Generate a long random string using a password manager. Never paste it into chat.
3. Ensure Neon variables and `CLAWOS_HEALTH_TOKEN` are enabled for the intended environment (Preview and/or Production).
4. Redeploy Vercel to make env changes available.

## Verification

From your own terminal (do not share the token):

```bash
curl -H "x-clawos-health-token: YOUR_PRIVATE_TOKEN" https://YOUR_DEPLOYMENT.vercel.app/api/db-health
```

Expected success: HTTP 200 `{"ok":true,"database":"connected"}`.
Failure responses are intentionally generic. HTTP 401 means token is missing/incorrect; HTTP 503 means the database is not configured or is unreachable.

## Scope / limits

- This endpoint runs a single read-only `SELECT 1`; it does **not** migrate data or create tables.
- It does **not** expose Neon credentials or query user tables.
- Existing browser UI still uses local storage only.
- Do not run old Supabase-specific SQL on Neon.
- The Neon migration `infra/neon/001_foundation.sql` is a draft and must be inspected and applied to an isolated dev DB before connecting a production API.
- Authentication and per-tenant authorization have not yet been implemented.
