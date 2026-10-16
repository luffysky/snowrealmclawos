-- ClawOS v0.10. Enforce that task events and approvals belong to the same workspace as their task.
-- Apply after 003_transactional_queue.sql. Run on a staging DB and back up before migration.
-- Existing inconsistent records will cause constraint validation to fail, deliberately.
create unique index if not exists tasks_id_workspace_unique on public.tasks(id,workspace_id);
alter table public.task_events drop constraint if exists task_events_task_workspace_fk;
alter table public.task_events add constraint task_events_task_workspace_fk
  foreign key(task_id,workspace_id) references public.tasks(id,workspace_id) on delete cascade;
alter table public.approval_requests drop constraint if exists approval_requests_task_workspace_fk;
alter table public.approval_requests add constraint approval_requests_task_workspace_fk
  foreign key(task_id,workspace_id) references public.tasks(id,workspace_id) on delete cascade;
-- Authenticated clients must not be able to self-approve by writing directly to approval_requests.
revoke insert,update,delete on public.approval_requests from authenticated;
-- Future approval endpoint must use a narrowly scoped SECURITY DEFINER RPC with explicit auth checks.
