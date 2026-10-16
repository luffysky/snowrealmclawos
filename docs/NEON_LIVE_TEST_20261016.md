# Neon live smoke test · 2026-10-16

## Tested on real Neon

- Project: `neon-claw-os` (`tiny-shadow-10372139`)
- Branch: `clawos-schema-dev` (`br-long-boat-a1hwskzi`)
- Production branch `main`: **not modified**
- Existing `001_foundation.sql` and `002_clawos_extensions.sql` had previously created 12 of 12 tables.
- In a transaction, the API successfully inserted and read exactly 1 row each in:
  `tasks`, `chat_messages`, `task_events`, `agent_jobs`,
  `approval_requests`, `extension_installations`, `audit_events`.
- Attempted cross-workspace `approval_requests` insertion with an unrelated task was rejected by a composite foreign key.
- Test records were deleted. Baseline verification afterward:
  1 workspace, 1 task, 0 jobs, 0 messages, 0 approvals.
- No RLS policy or identity-provider-based authorization was validated.
- No real Vercel application write API or persistent Worker was tested.

## Re-run

A transaction-safe, rollback-only smoke test is tracked in `tests/neon/database-smoke.sql`.
Run only on the development branch using a trusted SQL client with an appropriately scoped role.
Do not point unverified APIs at production; do not run legacy Supabase migrations on Neon.

## Public repository precautions

The GitHub repository is public as of this check. Review the **entire Git history**, not only HEAD, for secrets and local user data. Rotation is mandatory for any token ever exposed in a screenshot or repository. No secrets are intentionally included in this test.
