# Neon database schema rollout

Vercel `DATABASE_URL` is **not readable from GitHub or this chat**. The assistant can prepare/push migrations, but cannot execute them against Neon without a database-capable connector or an authorized trusted runtime.

### Steps in Neon (no secret sharing)

1. Open Neon console > SQL Editor. Select a **development/Preview branch**, not production.
2. Copy and run `infra/neon/001_foundation.sql`.
3. Copy and run `infra/neon/002_clawos_extensions.sql`.
4. Run the verification query below. Expected result: 12.
5. On the Vercel side keep `DATABASE_URL` as Secret. The current deployed Web preview is not yet connected to these tables.

```sql
select count(*) as clawos_tables
from information_schema.tables
where table_schema='public'
and table_name in ('workspaces','tasks','chat_messages','agent_jobs',
'approval_requests','extension_installations','audit_events',
'task_events','bundle_catalog','bundle_versions','bundle_installations',
'user_theme_preferences');
```

### Alternative: trusted Node runner

If you can provide `DATABASE_URL` as an **environment variable in your own terminal**, never paste it into a chat:

```sh
npm ci
CLAWOS_ALLOW_DB_MIGRATION=yes npm run db:migrate
npm run db:verify
```

The runner creates `public.clawos_schema_migrations`, serializes concurrent migrations, verifies checksums, and wraps each migration in a transaction. It only reads SQL files under `infra/neon`. Running the SQL manually in Neon does not populate this migration tracking table, so **do not subsequently run the runner on the same branch without reconciling migration history**.

**Security:** Schema creation is not product readiness. The current authorization model and user identity integration are not finished. Do not expose untrusted users to a direct DB connection or to a write API.
