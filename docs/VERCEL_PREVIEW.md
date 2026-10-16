# Vercel Web Preview

This deployable static preview fixes missing HTML build output. It is **not** the complete v0.18 backend/UI. No real AI, auth, database or remote tool execution is provided. Preview-only tasks and messages are stored in localStorage.

Vercel settings: framework `Other`, root directory `/`, build command `npm run build`, output directory `dist`.

Do not expose the legacy local-demo API publicly. Full original app import and production authentication remain outstanding.
