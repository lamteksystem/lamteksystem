# Link CLI to Lamtek Supabase project using a token file (works when CLI uses a different account).
# 1) Create: %USERPROFILE%\.config\lamtek\supabase-access-token (one line = token from Supabase -> Account -> Access tokens)
# 2) Run from repo root: pwsh -File ./scripts/supabase-link-lamtek.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $env:USERPROFILE ".config\lamtek\supabase-access-token"
if (-not (Test-Path -LiteralPath $tokenPath)) {
  Write-Error "Create $tokenPath with one line = your access token, then re-run."
}
$env:SUPABASE_ACCESS_TOKEN = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
Write-Host "Linking Supabase project from $root" -ForegroundColor Cyan
Set-Location $root
npx supabase link --project-ref jhmepthfxnpmwpjobumj
