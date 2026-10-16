# ClawOS v0.10: persistence and integrity hardening

## What changed
- Added owner-scoped SQL for chat insertion and listing.
- Added atomic task state transition using a compare-and-swap UPDATE.
- Added migration `004_task_workspace_integrity.sql` enforcing workspace/task consistency.
- Restricted direct writes to approvals by the `authenticated` database role.

## What has NOT been done
- No Supabase project was connected, and no SQL was executed on PostgreSQL.
- The demo HTTP server still uses local JSON and a demo token. Never expose it publicly.
- No verified JWT authentication, distributed worker, payment, creator rendering, or mobile APK.
- Direct SQL access through a service-role connection bypasses RLS: production needs a verified auth boundary and least-privilege database roles.

## At-home verification
1. Install Node.js >=20 and unzip this package.
2. Run `npm install` then `npm test`.
3. Run `npm start` and visit `http://127.0.0.1:3000`.
4. Do not use real customer data or API credentials in the demo.

## Next engineering gate
Implement verified Supabase Auth (JWKS JWT verification), workspace-bound API routes, and a disposable PostgreSQL integration-test environment before production deployment.
