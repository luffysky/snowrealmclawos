-- ClawOS Neon second-stage schema. Apply AFTER 001_foundation.sql.
-- Contains no DROP, TRUNCATE, or destructive data edits.
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null,
  event_type text not null check(length(event_type) between 1 and 100),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (workspace_id,task_id) references public.tasks(workspace_id,id) on delete cascade
);
create index if not exists task_events_workspace_time on public.task_events(workspace_id,created_at desc);

create table if not exists public.bundle_catalog (
  id uuid primary key default gen_random_uuid(),
  publisher_subject text not null check(length(publisher_subject) between 3 and 255),
  slug text not null unique check(length(slug) between 3 and 80),
  name text not null check(length(name) between 1 and 140),
  description text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.bundle_versions (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundle_catalog(id) on delete cascade,
  version text not null check(length(version) between 5 and 40),
  manifest jsonb not null check(jsonb_typeof(manifest)='object'),
  created_at timestamptz not null default now(),
  unique(bundle_id,version)
);
create table if not exists public.bundle_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bundle_version_id uuid not null references public.bundle_versions(id) on delete restrict,
  enabled boolean not null default false,
  installed_at timestamptz not null default now(),
  unique(workspace_id,bundle_version_id)
);
create table if not exists public.user_theme_preferences (
  owner_subject text primary key check(length(owner_subject) between 3 and 255),
  settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object'),
  background_object_key text,
  updated_at timestamptz not null default now()
);
-- No browser/public database access is authorized. Use server-only credentials,
-- signed sessions and tested tenant authorization before enabling writes.
