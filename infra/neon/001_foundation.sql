-- SnowRealm ClawOS: Neon PostgreSQL foundation v0.19 (DRAFT)
-- Apply only to a new development branch/database after review.
-- Identity is issued by a separately configured authentication provider;
-- the client must NEVER access Neon directly. All access is server-authorized.
-- This schema does not yet implement RLS, production API, or external identity verification.
create extension if not exists pgcrypto;
create table if not exists public.workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_subject text not null check (length(owner_subject) between 3 and 255),
 name text not null check(length(name) between 1 and 100),
 created_at timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_subject);
create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null check(length(title) between 3 and 1000),
 status text not null default 'queued' check(status in ('queued','running','waiting_approval','completed','failed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create index if not exists tasks_workspace_created_idx on public.tasks(workspace_id,created_at desc);
create table if not exists public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 author_subject text,
 role text not null check(role in ('user','assistant','system')),
 content text not null check(length(content) between 1 and 20000),
 created_at timestamptz not null default now()
);
create index if not exists chat_messages_workspace_idx on public.chat_messages(workspace_id,created_at desc);
create table if not exists public.extension_installations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 extension_id text not null,
 version text not null,
 permissions jsonb not null default '[]'::jsonb check(jsonb_typeof(permissions)='array'),
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 unique(workspace_id,extension_id)
);
create table if not exists public.agent_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 job_type text not null,
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
 idempotency_key text,
 attempts int not null default 0 check(attempts>=0),
 max_attempts int not null default 3 check(max_attempts between 1 and 20),
 available_at timestamptz not null default now(),
 lease_until timestamptz,
 lease_token uuid,
 worker_id text,
 result jsonb,
 error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint agent_jobs_running_lease check(
  (status='running' and lease_until is not null and lease_token is not null and worker_id is not null) or
  (status<>'running' and lease_until is null and lease_token is null and worker_id is null)
 )
);
create unique index if not exists jobs_workspace_key_idx on public.agent_jobs(workspace_id,idempotency_key) where idempotency_key is not null;
create index if not exists jobs_claim_idx on public.agent_jobs(available_at,created_at) where status in ('queued','running');
create table if not exists public.approval_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 task_id uuid not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','expired')),
 requested_action jsonb not null,
 reviewed_by_subject text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,task_id) references public.tasks(workspace_id,id) on delete cascade
);
create table if not exists public.audit_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 actor_subject text,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists audit_events_workspace_idx on public.audit_events(workspace_id,created_at desc);
-- SECURITY: Do not expose direct browser DB credentials.
-- TODO before production: least-privilege runtime DB role; RLS strategy or equivalent
-- verified server-side tenant isolation; transactional claim/lease functions;
-- credentials rotation; integration tests with two separate user identities.
