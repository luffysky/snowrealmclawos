# ClawOS v0.18 full import and Neon validation

Updated: 2026-10-16.

## Source status
The latest archived source is SnowRealm-ClawOS-v0.18.zip. Local Node.js v22.16.0 `npm test` succeeded **30/30** on the extracted source. The public deployment must retain `public/index.html` and `api/db-health.js` until a production-grade identity and API layer replaces them.

**IMPORTANT:** This repository is not yet a complete copy of the v0.18 archive. The existing import script `scripts/import-v018.ps1` is the explicit one-time import path from the archive. It excludes local data and capture-preview files. Never mark the import complete merely from the test result.

## Executed database checks
- Project: `neon-claw-os` (`tiny-shadow-10372139`)
- Development branch: `clawos-schema-dev` (`br-long-boat-a1hwskzi`)
- Production branch untouched.
- Neon verified all **12 expected tables**.
- Executed a transaction inserting one dedicated smoke-test workspace and one queued task.
- Queried result: `test_workspaces=1`, `test_tasks=1`, `tables_found=12`.
- Data left isolated in the dev branch for inspection. No production writes.

## Remaining blockers
- GitHub full-source import has not run from a connected Git filesystem.
- Auth, multi-user isolation, and Vercel database APIs are not ready.
- Old local demo service should never be exposed on a public network.
