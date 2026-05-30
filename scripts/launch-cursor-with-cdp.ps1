# Launch Cursor with Chrome DevTools Protocol enabled (required for CursorRemote).
# Also patches Desktop + Start Menu shortcuts so normal launches keep CDP on.
param(
    [string]$Workspace = "C:\Users\info\Desktop\Lamtek",
    [switch]$Restart,
    [switch]$PatchShortcutsOnly
)

$ErrorActionPreference = "Stop"
$CursorExe = Join-Path $env:LOCALAPPDATA "Programs\cursor\Cursor.exe"
$CdpArg = "--remote-debugging-port=9222"

if (-not (Test-Path $CursorExe)) {
    Write-Error "Cursor not found at $CursorExe"
}

function Set-CursorShortcut {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($Path)
    $lnk.TargetPath = $CursorExe
    $lnk.Arguments = $CdpArg
    $lnk.WorkingDirectory = Split-Path $CursorExe -Parent
    $lnk.Description = "Cursor IDE (CDP enabled for CursorRemote)"
    $lnk.Save()
    return $true
}

$shortcutPaths = @(
    (Join-Path $env:USERPROFILE "Desktop\Cursor.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Cursor\Cursor.lnk")
)

foreach ($p in $shortcutPaths) {
    if (Set-CursorShortcut -Path $p) {
        Write-Host "Patched shortcut: $p"
    }
}

if ($PatchShortcutsOnly) { exit 0 }

if ($Restart) {
    Write-Host "Restarting Cursor with CDP in 3 seconds..."
    Start-Sleep -Seconds 3
    Get-Process -Name "Cursor" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

$args = @($CdpArg)
if ($Workspace -and (Test-Path $Workspace)) {
    $args += $Workspace
}

Start-Process -FilePath $CursorExe -ArgumentList $args
Write-Host "Started Cursor with $CdpArg"
Write-Host "Verify CDP: http://localhost:9222/json"
