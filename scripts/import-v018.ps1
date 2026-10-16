param(
  [string]$Archive = (Join-Path $PSScriptRoot 'SnowRealm-ClawOS-v0.18.zip'),
  [string]$Repo = 'https://github.com/luffysky/snowrealmclawos.git'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Archive)) { throw "Archive not found: $Archive" }
$work = Join-Path ([System.IO.Path]::GetTempPath()) ('clawos-import-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  $unpack = Join-Path $work 'unpack'
  $target = Join-Path $work 'repo'
  Expand-Archive -LiteralPath $Archive -DestinationPath $unpack -Force
  $source = Join-Path $unpack 'clawos'
  if (-not (Test-Path (Join-Path $source 'services/api/server.mjs'))) {
    throw 'Archive does not contain the expected ClawOS v0.18 source'
  }
  git clone $Repo $target
  if ($LASTEXITCODE -ne 0) { throw 'Git clone failed' }
  $names = @('apps', 'services', 'tests', 'infra', 'docs')
  foreach ($n in $names) {
    $from = Join-Path $source $n
    $to = Join-Path $target $n
    if (Test-Path $from) {
      New-Item -ItemType Directory -Force -Path $to | Out-Null
      Copy-Item -LiteralPath (Join-Path $from '*') -Destination $to -Recurse -Force -ErrorAction SilentlyContinue
      # LiteralPath wildcard does not expand in some PowerShell versions; copy each item explicitly.
      Get-ChildItem -LiteralPath $from -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $to -Recurse -Force
      }
    }
  }
  # Keep current deployment's public/index.html, Vercel build scripts, api/db-health,
  # and Neon credentials/config untouched. Legacy Supabase migrations are archived for
  # reference only and MUST NOT be applied to Neon.
  Copy-Item -LiteralPath (Join-Path $source '.env.example') -Destination (Join-Path $target '.env.legacy.example') -Force
  $readme = Join-Path $target 'docs/LEGACY_V018_IMPORT.md'
  @'
# ClawOS v0.18 source import
Legacy source is stored in `apps/web`, `services/api`, `tests` and `infra/supabase`.
The deployed static preview at `public/index.html` has NOT been replaced with the
legacy single-user demo. The API has local-only demo authentication and must never
be publicly exposed without a verified identity and tenant authorization.
Supabase migration scripts are archived for reference, NOT compatible with Neon.
'@ | Set-Content -LiteralPath $readme -Encoding UTF8
  Push-Location $target
  try {
    git add apps services tests infra docs .env.legacy.example
    $staged = git diff --cached --name-only
    $forbidden = $staged | Where-Object { $_ -match '(^|/)data/|capture-preview|(^|/)\.env$|(^|/)node_modules/' }
    if ($forbidden) { throw "Sensitive or forbidden files staged: $forbidden" }
    if (-not $staged) { Write-Host 'No files to import'; return }
    git commit -m 'feat: import ClawOS v0.18 local prototype source'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
    git push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
    Write-Host 'Import pushed. Do not publish legacy API until authentication is fixed.'
  } finally { Pop-Location }
} finally {
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
