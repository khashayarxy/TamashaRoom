#Requires -Version 5.1
<#
.SYNOPSIS
    Package freshly-built frontend assets for cPanel shared hosting.

.DESCRIPTION
    The production server has no Node.js, so `public/build/` must be built
    locally and uploaded. This script rebuilds the assets and zips ONLY
    `public/build/` into `deploy-assets.zip` at the project root.

    Deliberately assets-only: NEVER zip `vendor/` ? it contains
    Windows-built platform binaries that would break the Linux host.
    PHP dependencies are installed on the server with Composer instead
    (see docs/deployment-checklist.md).

    Upload flow (cPanel File Manager):
      1. Upload `deploy-assets.zip` to `public_html/tamasharoom/public/`.
      2. Extract there, replacing the existing `build/` directory.
      3. Delete the zip from the server.
#>

$ErrorActionPreference = "Stop"

# Resolve the project root by walking up from the working directory until the
# Laravel markers are found. This works in every invocation style (direct
# call, -File, ISE, double-click) and never depends on $PSScriptRoot, which
# is empty under some nested/automation shells.
$projectRoot = (Get-Location).Path
$depth = 0
while ($depth -lt 5) {
    $hasArtisan = Test-Path -LiteralPath (Join-Path $projectRoot "artisan")
    $hasPackageJson = Test-Path -LiteralPath (Join-Path $projectRoot "package.json")
    if ($hasArtisan -and $hasPackageJson) {
        break
    }
    $parent = Split-Path -Parent $projectRoot
    if (-not $parent -or $parent -eq $projectRoot) {
        break
    }
    $projectRoot = $parent
    $depth++
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "artisan"))) {
    Write-Error "Could not locate the project root (no artisan/package.json found walking up from $((Get-Location).Path)). Run this script from inside the TamashaRoom checkout."
    exit 1
}
Set-Location -LiteralPath $projectRoot

Write-Host "Building frontend assets..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build failed - fix the build before packaging."
    exit 1
}

$buildDir = Join-Path $projectRoot "public/build"
if (-not (Test-Path -LiteralPath $buildDir)) {
    Write-Error "public/build not found after build ? aborting."
    exit 1
}

$zipPath = Join-Path $projectRoot "deploy-assets.zip"
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

# Zip the CONTENTS of public/build (so extraction drops files directly
# into public/build/ on the server, no extra nesting level).
$entries = Get-ChildItem -LiteralPath $buildDir
Compress-Archive -Path $entries.FullName -DestinationPath $zipPath -Force

$sizeMB = "{0:N2}" -f ((Get-Item -LiteralPath $zipPath).Length / 1MB)
Write-Host ""
Write-Host "Created deploy-assets.zip ($sizeMB MB) from public/build/."
Write-Host ""
Write-Host "Next steps (cPanel File Manager):"
Write-Host "  1. Upload deploy-assets.zip to public_html/tamasharoom/public/"
Write-Host "  2. Extract it there, replacing the existing build/ directory."
Write-Host "  3. Delete the zip from the server."
Write-Host "  4. Verify: load the site and check the new UI + version."
