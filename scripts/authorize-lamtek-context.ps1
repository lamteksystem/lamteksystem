# One-time: save Supabase account access token for Lamtek workspace, link CLI, verify GitHub.
# Run: pwsh -NoProfile -File ./scripts/authorize-lamtek-context.ps1
# (Optional: a window may be opened to Supabase to create a token: Account > Access tokens.)
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$root = Split-Path -Parent $PSScriptRoot
$tokenDir = Join-Path $env:USERPROFILE ".config\lamtek"
$tokenFile = Join-Path $tokenDir "supabase-access-token"
$configPath = Join-Path $ScriptDir "identity.config.json"
$projectRef = "jhmepthfxnpmwpjobumj"

Write-Host ""
Write-Host "-------- Lamtek — authorisation setup --------" -ForegroundColor Cyan
Write-Host ""

# --- GitHub CLI: ensure org account
if (Get-Command gh -ErrorAction SilentlyContinue) {
  if (Test-Path -LiteralPath $configPath) {
    $cfg = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.ghUser) {
      Write-Host "GitHub CLI: switching to $($cfg.ghUser) ..." -ForegroundColor Cyan
      $sw = & gh auth switch -u $cfg.ghUser 2>&1
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  Active: $($cfg.ghUser)" -ForegroundColor Green
        $who = gh api user -q .login 2>$null
        if ($who) { Write-Host "  API: $who" -ForegroundColor Green }
      } else {
        Write-Host "  Run after login:  gh auth login" -ForegroundColor Yellow
        if ($sw) { Write-Host "  $sw" -ForegroundColor DarkGray }
      }
    }
  } else {
    Write-Host "GitHub CLI: install & log in:  winget install GitHub.cli" -ForegroundColor Yellow
  }
} else {
  Write-Warning "GitHub CLI (gh) not in PATH. Install: winget install GitHub.cli"
}
Write-Host ""

# --- Supabase: token file + link
New-Item -ItemType Directory -Path $tokenDir -Force | Out-Null
Write-Host "Supabase" -ForegroundColor Cyan
Write-Host "  Token file: $tokenFile" -ForegroundColor DarkGray
Write-Host "  Create a token: https://supabase.com/dashboard/account/tokens" -ForegroundColor White
Write-Host "  Paste it below (input is not displayed)." -ForegroundColor White
Write-Host ""
if (Test-Path -LiteralPath $tokenFile) {
  $overwrite = Read-Host "A token file already exists. Replace it? (y/N)"
  if ($overwrite -ne "y" -and $overwrite -ne "Y") {
    $env:SUPABASE_ACCESS_TOKEN = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
    Set-Location $root
    Write-Host "  Using existing token. Verifying with Supabase API..." -ForegroundColor Cyan
    npx supabase projects list
    npx supabase link --project-ref $projectRef
    Write-Host "  Done (existing token)." -ForegroundColor Green
    exit 0
  }
}

# SecureString works on Windows PowerShell 5.1+ and PowerShell 7+
$secure = Read-Host "  Paste Supabase access token" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
$token = $token.Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "No token entered. Create one at https://supabase.com/dashboard/account/tokens and run this script again."
}
Set-Content -LiteralPath $tokenFile -Value $token -NoNewline -Encoding UTF8
$env:SUPABASE_ACCESS_TOKEN = $token
Write-Host "  Token saved." -ForegroundColor Green

Set-Location $root
Write-Host "  Verifying: listing projects ..." -ForegroundColor Cyan
& npx supabase projects list
if ($LASTEXITCODE -ne 0) { Write-Error "Supabase CLI could not use this token. Check the token in the dashboard and try again." }
Write-Host "  Linking project $projectRef ..." -ForegroundColor Cyan
& npx supabase link --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { Write-Error "supabase link failed. See messages above." }

Write-Host ""
Write-Host "Lamtek context is ready: Supabase + GitHub" -ForegroundColor Green
Write-Host "--------" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close this window" | Out-Null
