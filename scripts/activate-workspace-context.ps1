# Dot-sourced by the integrated terminal for this repo (see .vscode/settings.json).
# Sets: GitHub CLI account, Supabase access token (for CLI + tooling), and prints Chrome profile hints.
# Optional: -LaunchChrome to open dashboard URLs in that Chrome profile.
param(
  [switch]$LaunchChrome
)

$ErrorActionPreference = "Continue"
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir -and $PSCommandPath) { $ScriptDir = Split-Path -Parent $PSCommandPath }
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ConfigPath = Join-Path $ScriptDir "identity.config.json"

if (-not (Test-Path $ConfigPath)) {
  Write-Warning "Missing scripts/identity.config.json (copy from identity.config.example.json)"
  return
}

$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$label = if ($cfg.label) { $cfg.label } else { "Workspace" }

function Resolve-TokenPath {
  param([string]$Rel)
  if ([string]::IsNullOrWhiteSpace($Rel)) { return $null }
  if ($Rel -match '^[A-Za-z]:\\' -or $Rel -match '^\$env:') {
    $expanded = $Rel -replace '^\$env:USERPROFILE', $env:USERPROFILE
    return $expanded
  }
  return (Join-Path $env:USERPROFILE $Rel.TrimStart('\', '/'))
}

Write-Host ""
Write-Host "-------- $label - workspace context --------" -ForegroundColor Cyan

# GitHub: switch active gh user for this org/repo (add both accounts with: gh auth login; then gh auth switch)
if (Get-Command gh -ErrorAction SilentlyContinue) {
  if ($cfg.ghUser) {
    $out = & gh auth switch -u $cfg.ghUser 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "gh:  active account  $($cfg.ghUser)" -ForegroundColor Green
    } else {
      Write-Host "gh:  could not switch to $($cfg.ghUser). Log in: gh auth login" -ForegroundColor Yellow
      if ($out) { Write-Host $out -ForegroundColor DarkGray }
    }
  }
} else {
  Write-Warning "GitHub CLI (gh) not in PATH. Install: winget install GitHub.cli"
}

# Supabase CLI uses SUPABASE_ACCESS_TOKEN from Account / Access tokens
$tf = Resolve-TokenPath $cfg.supabaseTokenFile
if ($tf) {
  if (Test-Path -LiteralPath $tf) {
    $env:SUPABASE_ACCESS_TOKEN = (Get-Content -LiteralPath $tf -Raw).Trim()
    $env:SUPABASE_ACCESS_TOKEN = $env:SUPABASE_ACCESS_TOKEN.Trim()
    Write-Host "Supabase: token loaded (CLI + API)" -ForegroundColor Green
  } else {
    $env:SUPABASE_ACCESS_TOKEN = $null
    Write-Host "Supabase: create token file (plain text, one line):" -ForegroundColor Yellow
    Write-Host "  $tf" -ForegroundColor DarkGray
    Write-Host "  (Supabase dashboard - Account - Access Tokens)" -ForegroundColor DarkGray
  }
} else {
  $env:SUPABASE_ACCESS_TOKEN = $null
}

# Chrome: human hint (profiles are separate from Cursor; use the matching profile in Chrome)
if ($cfg.chrome) {
  $c = $cfg.chrome
  if ($c.profileDirectory) {
    Write-Host "Chrome: use this profile in Google Chrome: $($c.profileName) (User Data dir: $($c.profileDirectory))" -ForegroundColor Cyan
  }
  if ($LaunchChrome -and $c.exePath -and (Test-Path -LiteralPath $c.exePath)) {
    $pd = $c.profileDirectory
    $urls = @($c.openUrls)
    if ($urls.Count -gt 0) {
      foreach ($u in $urls) {
        if ($pd) {
          & $c.exePath "--profile-directory=$pd" $u
        } else {
          & $c.exePath $u
        }
      }
    }
  }
}

Write-Host "--------" -ForegroundColor Cyan
Write-Host ""
