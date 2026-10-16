# v0.9 database integration status

## Implemented
- A real PostgreSQL repository with parameterized workspace and task CRUD queries.
- Owner-scoped writes and explicit owner checks for reads.
- Database health check and an enqueue RPC adapter.
- Mock-backed repository unit tests (no database server needed).

## Not implemented / important limits
- The HTTP API STILL uses the local JSON demo store and demo token.
- PostgreSQL queries have NOT been executed against a live Supabase database.
- `enqueue_agent_job` relies on `auth.uid()`; a normal direct PostgreSQL service connection does not automatically have Supabase user JWT context. It will be denied unless the connection is properly user-scoped. Do not bypass the database check with a service-role credential.
- `DATABASE_URL` is optional and the `pg` package must be installed with `npm install` before using the adapter.
- Current SQL migrations need live execution, RLS review, tenant-cross-reference constraints, and transactional integration tests.

## Setup after receiving a dedicated test database
1. Apply schema.sql, 002_tenant_foundation.sql, 003_transactional_queue.sql in order to a disposable Supabase project after review.
2. Configure server-only DATABASE_URL and install dependencies (`npm install`).
3. Run `npm test`, then a separate integration suite using two Supabase Auth users.
4. Only after RLS/JWT integration succeeds, replace the demo API's JSON store with this repository.

Never expose the demo HTTP API publicly.
