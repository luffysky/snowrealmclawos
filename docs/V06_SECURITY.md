# v0.6 database foundation

This release adds `infra/supabase/002_tenant_foundation.sql`, a **draft** tenant-scoped schema with RLS and indexes, plus static schema regression tests.

## Important limitations
- Existing Node server is **still local-only** and uses a shared demo token, not Supabase Auth.
- The SQL has not been applied to a live Supabase project or tested against PostgreSQL in this environment.
- Membership records do **not** grant workspace access; only owners can access tenant data until role policy tests are completed.
- Task event / approval workspace-to-task consistency needs a composite FK or trigger before production.
- Approval decisions need a dedicated, atomic RPC or transaction and immutable audit trail before external tools are allowed.
- Do not deploy publicly or put service-role keys in clients.

## Next engineering steps
1. Provision Supabase staging and run migrations with real PostgreSQL integration tests (two distinct users).
2. Verify Supabase JWTs on a dedicated server, then replace demo token and file-backed store.
3. Implement transactional approval and durable queue worker.
4. Validate plugin permissions per installation, per tool invocation, and per workspace.
