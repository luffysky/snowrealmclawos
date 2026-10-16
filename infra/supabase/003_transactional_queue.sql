-- ClawOS v0.8 transactional queue. Apply after schema.sql and 002_tenant_foundation.sql.
-- Worker RPC functions are deliberately inaccessible to anon/authenticated.
-- Provision a dedicated trusted worker DB role with EXECUTE grants after reviewing credentials.
create table if not exists public.agent_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 job_type text not null check(job_type ~ '^[a-z][a-z0-9_.-]{1,63}$'),
 payload jsonb not null default '{}'::jsonb,
 idempotency_key text,
 status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
 attempts integer not null default 0 check(attempts >= 0),
 max_attempts integer not null default 3 check(max_attempts between 1 and 20),
 available_at timestamptz not null default now(),
 lease_until timestamptz,
 lease_token uuid,
 worker_id text,
 result jsonb,
 error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint running_lease_consistency check (
  (status='running' and lease_until is not null and lease_token is not null and worker_id is not null)
  or (status<>'running' and lease_until is null and lease_token is null and worker_id is null)
 )
);
create unique index if not exists agent_jobs_idempotency_unique on public.agent_jobs(workspace_id,idempotency_key) where idempotency_key is not null;
create index if not exists agent_jobs_claim_idx on public.agent_jobs(available_at,created_at) where status in ('queued','running');
alter table public.agent_jobs enable row level security;
revoke all on public.agent_jobs from public,anon,authenticated;
-- Owners can inspect their jobs but cannot directly forge worker results.
create policy agent_jobs_owner_read on public.agent_jobs for select to authenticated
 using (public.is_workspace_owner(workspace_id));
grant select on public.agent_jobs to authenticated;

-- Enqueue through a constrained authenticated RPC; ownership checked inside transaction.
create or replace function public.enqueue_agent_job(p_workspace uuid,p_type text,p_payload jsonb default '{}'::jsonb,p_key text default null)
returns public.agent_jobs language plpgsql security definer set search_path = '' as $$
declare v public.agent_jobs;
begin
 if (select auth.uid()) is null or not public.is_workspace_owner(p_workspace) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_type !~ '^[a-z][a-z0-9_.-]{1,63}$' or p_type not in ('plan.create') then raise exception 'Unsupported job type'; end if;
 if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload)>65536 then raise exception 'Invalid payload'; end if;
 if p_key is not null and (length(p_key)<1 or length(p_key)>128) then raise exception 'Invalid idempotency key'; end if;
 insert into public.agent_jobs(workspace_id,job_type,payload,idempotency_key)
 values(p_workspace,p_type,p_payload,p_key)
 on conflict (workspace_id,idempotency_key) where idempotency_key is not null do nothing
 returning * into v;
 if v.id is null then select * into v from public.agent_jobs where workspace_id=p_workspace and idempotency_key=p_key; end if;
 return v;
end $$;
revoke all on function public.enqueue_agent_job(uuid,text,jsonb,text) from public,anon;
grant execute on function public.enqueue_agent_job(uuid,text,jsonb,text) to authenticated;

-- SECURITY DEFINER workers: grant EXECUTE only to a dedicated trusted DB role.
create or replace function public.worker_claim_job(p_worker text,p_lease_seconds integer default 60)
returns public.agent_jobs language plpgsql security definer set search_path = '' as $$
declare v public.agent_jobs;
begin
 if p_worker is null or length(p_worker) not between 1 and 128 or p_lease_seconds not between 10 and 3600 then raise exception 'Invalid worker/lease'; end if;
 with candidate as (
  select id from public.agent_jobs
  where (status='queued' and available_at<=now()) or (status='running' and lease_until<=now())
  order by available_at,created_at for update skip locked limit 1
 )
 update public.agent_jobs j set
  status=case when j.attempts>=j.max_attempts then 'failed' else 'running' end,
  attempts=case when j.attempts>=j.max_attempts then j.attempts else j.attempts+1 end,
  lease_until=case when j.attempts>=j.max_attempts then null else now()+make_interval(secs=>p_lease_seconds) end,
  lease_token=case when j.attempts>=j.max_attempts then null else gen_random_uuid() end,
  worker_id=case when j.attempts>=j.max_attempts then null else p_worker end,
  error=case when j.attempts>=j.max_attempts then 'Maximum attempts reached' else j.error end,
  updated_at=now()
 from candidate where j.id=candidate.id returning j.* into v;
 if v.status='failed' then return null; end if;
 return v;
end $$;
revoke all on function public.worker_claim_job(text,integer) from public,anon,authenticated;

create or replace function public.worker_finish_job(p_id uuid,p_token uuid,p_success boolean,p_result jsonb default null,p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 update public.agent_jobs set
 status=case when p_success then 'completed' when attempts>=max_attempts then 'failed' else 'queued' end,
 result=case when p_success then p_result else null end,
 error=case when p_success then null else left(coalesce(p_error,'Worker failed'),500) end,
 available_at=case when p_success then available_at else now()+make_interval(secs=>least(300,5*power(2,least(attempts,6))::int)) end,
 lease_until=null,lease_token=null,worker_id=null,updated_at=now()
 where id=p_id and lease_token=p_token and status='running' and lease_until>now();
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.worker_finish_job(uuid,uuid,boolean,jsonb,text) from public,anon,authenticated;

create or replace function public.worker_heartbeat_job(p_id uuid,p_token uuid,p_lease_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if p_lease_seconds not between 10 and 3600 then raise exception 'Invalid lease'; end if;
 update public.agent_jobs set lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now()
 where id=p_id and lease_token=p_token and status='running' and lease_until>now();
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.worker_heartbeat_job(uuid,uuid,integer) from public,anon,authenticated;
-- Required production provisioning (not performed by this migration):
-- CREATE ROLE clawos_worker LOGIN PASSWORD '<generate-in-secret-manager>';
-- GRANT USAGE ON SCHEMA public TO clawos_worker;
-- GRANT EXECUTE ON FUNCTION public.worker_claim_job(text,integer) TO clawos_worker;
-- GRANT EXECUTE ON FUNCTION public.worker_finish_job(uuid,uuid,boolean,jsonb,text) TO clawos_worker;
-- GRANT EXECUTE ON FUNCTION public.worker_heartbeat_job(uuid,uuid,integer) TO clawos_worker;
-- This migration is unverified against a live Supabase instance.
