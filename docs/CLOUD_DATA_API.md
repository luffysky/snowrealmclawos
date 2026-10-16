# Cloud workspace API (Neon Auth, staged)

Endpoint: `/api/workspace?resource=workspaces|tasks|messages`.

**Not yet integrated into the web client**. Existing preview stays local-only.

Server environment variables:
- `DATABASE_URL`: database branch matching the schema
- `CLAWOS_AUTH_JWKS_URL`: JWKS endpoint from Neon Auth for the **same branch**
- `CLAWOS_AUTH_ISSUER`: expected JWT issuer (validate against issued claims)
- `CLAWOS_AUTH_AUDIENCE`: optional strict audience if provider issues one

The API requires `Authorization: Bearer <Neon Auth JWT>`. Verify JWT signature,
issuer, expiry and subject; the API never accepts caller-supplied owner_subject.
Always scope task/message SQL by workspace owner subject. Writes can create only
`user` messages. No AI model calls, payments, Agent tools or background jobs.

GET `resource=workspaces`: list owned workspaces.
POST `resource=workspaces`: `{"name":"My Workspace"}`.
GET `resource=tasks&workspaceId=UUID`: list tasks.
POST `resource=tasks`: `{"workspaceId":"UUID","title":"Create landing page"}`.
GET `resource=messages&workspaceId=UUID`: list messages.
POST `resource=messages`: `{"workspaceId":"UUID","content":"Hello"}`.

**Operational status:** Neon Auth is provisioned on `clawos-schema-dev`; Vercel
Production is NOT yet configured for this branch and production database
does NOT have these tables. This API is deliberately not wired into the public
UI until Preview environment and two-user tests succeed. Never paste database
credentials or bearer tokens into GitHub, browser front-end configuration or chat.
