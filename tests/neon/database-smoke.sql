-- ClawOS Neon database integration smoke test. SAFE for isolated development branch.
-- Creates temporary test records and deletes them in the same transaction.
-- This is NOT a row-level authorization / Neon Auth test.
BEGIN;
DO $clawos$
DECLARE
  ws_a uuid := gen_random_uuid();
  ws_b uuid := gen_random_uuid();
  task_a uuid := gen_random_uuid();
  blocked boolean := false;
BEGIN
  INSERT INTO public.workspaces(id,owner_subject,name)
  VALUES (ws_a,'smoke-tenant-a','DB smoke workspace A'),(ws_b,'smoke-tenant-b','DB smoke workspace B');
  INSERT INTO public.tasks(id,workspace_id,title)
  VALUES(task_a,ws_a,'Smoke test task');
  INSERT INTO public.chat_messages(workspace_id,author_subject,role,content)
  VALUES(ws_a,'smoke-tenant-a','user','Database test message');
  INSERT INTO public.task_events(workspace_id,task_id,event_type)
  VALUES(ws_a,task_a,'created');
  INSERT INTO public.agent_jobs(workspace_id,job_type,payload,idempotency_key)
  VALUES(ws_a,'smoke.noop','{}'::jsonb,gen_random_uuid()::text);
  INSERT INTO public.approval_requests(workspace_id,task_id,requested_action)
  VALUES(ws_a,task_a,'{}'::jsonb);
  INSERT INTO public.extension_installations(workspace_id,extension_id,version)
  VALUES(ws_a,'clawos.smoke','0.0.1');
  INSERT INTO public.audit_events(workspace_id,actor_subject,action)
  VALUES(ws_a,'smoke-tenant-a','db.smoke');
  IF (SELECT count(*) FROM public.tasks WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.chat_messages WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.task_events WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.agent_jobs WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.approval_requests WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.extension_installations WHERE workspace_id=ws_a) <> 1
    OR (SELECT count(*) FROM public.audit_events WHERE workspace_id=ws_a) <> 1
  THEN RAISE EXCEPTION 'DB smoke test rows missing'; END IF;

  BEGIN
    INSERT INTO public.approval_requests(workspace_id,task_id,requested_action)
    VALUES(ws_b,task_a,'{}'::jsonb);
  EXCEPTION WHEN foreign_key_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Cross-workspace approval foreign key was not enforced'; END IF;
  DELETE FROM public.workspaces WHERE id IN (ws_a,ws_b);
END
$clawos$;
ROLLBACK; -- Defense-in-depth: no test records persist even if cleanup was changed.
