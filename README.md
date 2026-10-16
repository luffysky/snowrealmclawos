# SnowRealm ClawOS

ClawOS is an experimental AI Agent workspace for chat, tasks, human approvals, Skills, Bundles, Creator Studio, and Marketplace.

## Repository status

**Initial GitHub integration scaffold.** The tested v0.18 prototype has **not yet been fully transferred into this repository**. Do not deploy this repository as a functioning app until the complete application source is imported.

The original v0.18 archive contains 39 publishable files after excluding local data and capture previews. Its Node.js test suite passed 30/30 tests locally on 2026-10-16.

## Planned runtime

- Node.js >= 20
- Web UI, API, Agent tools, and PostgreSQL migration drafts
- Local demo authentication only, not secure for public deployment
- Cloud Auth, PostgreSQL integration, persistent background workers, and native clients still require implementation and validation

## Security

Never publicly expose the demo API or hardcode an API token in a production client. Do not commit API keys, .env files, local user records, uploads, or database credentials.

## Immediate next steps

1. Import all validated v0.18 application sources and background asset.
2. Run npm test with GitHub Actions.
3. Integrate Supabase Auth and real PostgreSQL with tested RLS policies.
4. Replace local-only API auth before Vercel or other public deployment.
5. Verify working UI screenshots at desktop and mobile viewport sizes.
