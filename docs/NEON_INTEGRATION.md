# Neon PostgreSQL integration for ClawOS

## Decision
Use Neon PostgreSQL instead of Supabase for the database. This does **not** imply replacing all Supabase functionality: choose separate authentication and object storage solutions.

## Provisioning in Vercel
1. Open your Vercel project, Storage > Browse Storage > Neon.
2. Create and link a Neon project. Choose the region nearest the runtime and check the provider's current pricing.
3. Verify a server-only `DATABASE_URL` environment variable is linked (some integrations use other names, so map the URL to `DATABASE_URL`).
4. Trigger redeployment **after** adding environment variables.
5. Never expose `DATABASE_URL` through public browser variables or repository files.

## Current code status
- `infra/neon/001_foundation.sql` is a **draft** for a fresh development Neon database. It has NOT been executed on Neon.
- Existing `infra/supabase/*.sql` references `auth.users`, `auth.uid()`, Supabase grants and RLS; **DO NOT** run those migrations on Neon.
- Legacy PostgresRepository uses `owner_id` UUID; the Neon schema uses `owner_subject` TEXT. **Repository adaptation and verified server authentication are still required**. Do not point the demo API at production Neon yet.
- The Vercel static preview does NOT use the Neon database. Merely linking Neon will not make tasks sync between devices.
- For production: verified identity provider, backend authorization on every operation, transactions, least-privilege DB role, SQL integration tests, and persistent agent worker are mandatory.

## Verification
After provisioning, run a private connection test from a trusted server environment with a non-admin connection role. Test DB connectivity and tenant isolation with two accounts before enabling public writes.
