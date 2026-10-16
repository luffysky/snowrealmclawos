# Neon connection diagnostics (v2)

This endpoint is intentionally protected. A browser visit without a custom header will correctly return HTTP 401.

## Workflow

1. Configure `CLAWOS_HEALTH_TOKEN` in **Vercel Project > Settings > Environment Variables** for the target deployment.
2. Make sure `DATABASE_URL` is linked to the same Vercel project and environment.
3. Redeploy the latest commit to **Production**, then wait until Ready.
4. Locally, use PowerShell (do not paste any secret into chat):

```powershell
$secure = Read-Host 'CLAWOS_HEALTH_TOKEN' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $secure).Password
try {
  Invoke-RestMethod -Uri 'https://snowrealmclawos.vercel.app/api/db-health' -Headers @{ 'x-clawos-health-token' = $token }
} catch {
  $_.ErrorDetails.Message
} finally {
  Remove-Variable token, secure -ErrorAction SilentlyContinue
}
```

5. Copy **only the returned requestId**. Open **Vercel > Project > Logs** (Runtime Logs), filter the request path `/api/db-health`, and find a log with matching `requestId`.

## Log interpretation

- `authorization_denied`, `configuredPresent:false` => Production function cannot read the server token. Check env name and redeploy.
- `authorization_denied`, `configuredPresent:true,headerPresent:false` => no custom header arrived. Recheck PowerShell request.
- `authorization_denied`, `configuredPresent:true,headerPresent:true` => values differ. Check whether Production and the test client use the same new secret.
- `database_not_configured` => the database URL is not available to this deployment.
- `database_unreachable` => connection or PostgreSQL error. Only non-sensitive PostgreSQL error code is logged.
- `database_connected` => Vercel was able to execute SELECT 1 on Neon.

The endpoint does not expose or log secrets. Do not share screenshots of secret values or the database connection URL.

### Check the deployed revision

The response must include `requestId` and header `X-ClawOS-Diagnostic-Version: db-health-diagnostics-v2`.
If these are absent, the live URL is serving an older deployment; redeploy the new commit rather than changing tokens again.
