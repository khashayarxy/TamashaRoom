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
      2. Extract there, retaining previous hashed assets for open tabs and rollback.
      3. Delete the zip from the server.
#>

param(
    [switch]$SkipBuild,
    [string]$OutputPath = 'deploy-assets.zip'
)

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
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "artisan")) -or -not (Test-Path -LiteralPath (Join-Path $projectRoot "package.json"))) {
    Write-Error "Could not locate the project root (no artisan/package.json found walking up from $((Get-Location).Path)). Run this script from inside the TamashaRoom checkout."
    exit 1
}
Set-Location -LiteralPath $projectRoot

if (-not $SkipBuild) {
    Write-Host "Building release assets (VITE_* values must be reviewed before production use)..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed - fix the build before packaging."
    }
}

$buildDir = Join-Path $projectRoot "public/build"
if (-not (Test-Path -LiteralPath $buildDir)) {
    Write-Error "public/build not found after build ? aborting."
    exit 1
}

$manifestPath = Join-Path $buildDir 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'public/build/manifest.json is missing; refusing to package an incomplete build.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (@($manifest.PSObject.Properties).Count -eq 0) {
    throw 'Build manifest is empty.'
}
foreach ($entry in $manifest.PSObject.Properties) {
    if (-not (Test-Path -LiteralPath (Join-Path $buildDir $entry.Value.file) -PathType Leaf)) {
        throw "Build manifest references a missing asset: $($entry.Name)"
    }
}

$zipPath = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $projectRoot $OutputPath }
$zipPath = [IO.Path]::GetFullPath($zipPath)
if ($zipPath.StartsWith([IO.Path]::GetFullPath($buildDir) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The output archive must be outside public/build/.'
}
if (Test-Path -LiteralPath $zipPath) {
    throw 'Output already exists; choose a new -OutputPath to preserve the earlier release artifact.'
}

# Extraction into the verified public/ root must create build/manifest.json.
Compress-Archive -LiteralPath $buildDir -DestinationPath $zipPath

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $names = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    if ($names -notcontains 'build/manifest.json' -or @($names | Where-Object { -not $_.StartsWith('build/') }).Count -gt 0) {
        throw 'Unexpected archive layout; do not upload this artifact.'
    }
} finally {
    $archive.Dispose()
}

$sizeMB = "{0:N2}" -f ((Get-Item -LiteralPath $zipPath).Length / 1MB)
Write-Host ""
Write-Host "Created $zipPath ($sizeMB MB) with build/manifest.json."
Write-Host ""
Write-Host "Next steps (cPanel File Manager):"
Write-Host "  1. After release approval, upload $(Split-Path -Leaf $zipPath) to public_html/tamasharoom/public/"
Write-Host "  2. Extract there (build/ root); retain previous hashed assets for open tabs and rollback."
Write-Host "  3. Remove the uploaded zip from the web root."
Write-Host "  4. Run the smoke checks and record the code SHA + artifact checksum."
