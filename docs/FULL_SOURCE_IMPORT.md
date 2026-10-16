# Full source import checkpoint

As of this commit, GitHub still hosts the Vercel-safe static preview, Neon diagnostics, and starter DB schema. The complete v0.18 archive has been verified in the working environment, but the GitHub connector cannot directly ingest the binary ZIP from the local workspace.

Use `scripts/import-v018.ps1` from Windows PowerShell with `SnowRealm-ClawOS-v0.18.zip` downloaded from this conversation. It preserves the live Vercel entry point and database check function, stages only legacy source folders (no local data), and pushes through your own Git credentials.

**Do not mistake this checkpoint for a completed full-source upload.** Verify the next commit includes `services/api/server.mjs`, `apps/web/index.html`, `tests/`, and `infra/`.

Never run the single-user demo API publicly; the Vercel static preview remains the safe deployable entrypoint.
