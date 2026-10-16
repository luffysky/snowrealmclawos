# Neon schema verification · 2026-10-16

## Actual execution
- Neon organization: Vercel: Luffysky's projects
- Project: `neon-claw-os` (`tiny-shadow-10372139`)
- Production/default branch: `main` (`br-mute-wind-a1d8qdjx`) — **unchanged**
- Test branch created: `clawos-schema-dev` (`br-long-boat-a1hwskzi`)
- Sources: `infra/neon/001_foundation.sql`, `infra/neon/002_clawos_extensions.sql`
- Migrated via Neon transaction with 20 SQL statements (the API disallows multi-command prepared statements).
- Verification: 12 of 12 expected tables returned by `information_schema.tables`.

## Verified tables
`agent_jobs`, `approval_requests`, `audit_events`, `bundle_catalog`, `bundle_installations`, `bundle_versions`, `chat_messages`, `extension_installations`, `task_events`, `tasks`, `user_theme_preferences`, `workspaces`.

## Important limits
- No end-to-end user authentication, tenant isolation or RLS validation.
- No application read/write integration test yet.
- No migration applied to production; explicit review/approval required before promoting schema changes.
- No assumption that the existing Vercel `DATABASE_URL` points to the test branch.
- Existing local v0.18 application sources are not yet completely imported into the GitHub repository.

## Next steps
1. Validate schema with test data and role permissions on the test branch.
2. Build authenticated server APIs that explicitly enforce workspace authorization.
3. Connect Vercel Preview to the Neon test branch.
4. Run E2E tests before seeking approval to migrate production.
