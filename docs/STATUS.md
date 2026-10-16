# ClawOS engineering status — v0.5

Implemented and tested: local web UI, JSON persistence, optional OpenAI-compatible chat, rule-based task planning, human approval, allowlisted local text artifact creation, AI proposal generation with strict schema validation, installed-but-disabled Skills and Bundle manifests.

Not implemented: production authentication, Supabase multi-tenant RLS, durable distributed queues, safe sandboxed third-party code, real autonomous multi-step work, Android/iOS builds, creator rendering, marketplace transactions.

Security: local loopback server only; fixed demo token in browser; do not expose to internet. Model output is untrusted and can only propose one text artifact; explicit approval is required to write it.

Next: production identity + tenant isolation + transactional job leasing; then isolated workers and additional allowlisted tools.


v0.7: Added local job queue with lease, retries, idempotency keys, GET/POST API and one-shot deterministic worker. Not a distributed queue; not production-safe.
