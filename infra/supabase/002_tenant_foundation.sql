-- ClawOS v0.6: tenant-aware relational foundation.
-- Apply AFTER schema.sql in a dedicated Supabase project.
-- Do not expose the legacy demo server to the internet.
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  role text not null check(role in ('user','assistant','system')),
  content text not null check(char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','rejected','expired')),
  requested_action jsonb not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.extension_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  extension_id text not null,
  version text not null,
  permissions text[] not null default '{}',
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(workspace_id,extension_id)
);
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Keep ownership authoritative in workspaces; membership does not grant access yet.
-- This deliberately fails closed until explicit role policies are designed and tested.
create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.workspaces w
    where w.id=target_workspace and w.owner_id=(select auth.uid()))
$$;
-- Explicitly deny anonymous access, and enable RLS for all new tables.
do $$ declare tbl text; begin
  foreach tbl in array array['workspace_members','chat_messages','task_events','approval_requests','extension_installations','audit_events'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon',tbl);
    execute format('drop policy if exists owner_access on public.%I',tbl);
    execute format('create policy owner_access on public.%I for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id))',tbl);
  end loop;
end $$;
create index if not exists tasks_workspace_status_idx on public.tasks(workspace_id,status);
create index if not exists messages_workspace_time_idx on public.chat_messages(workspace_id,created_at desc);
create index if not exists events_workspace_time_idx on public.task_events(workspace_id,created_at desc);
create index if not exists audit_workspace_time_idx on public.audit_events(workspace_id,created_at desc);
-- Foreign-key consistency between task_id and workspace_id must be enforced before production use.
