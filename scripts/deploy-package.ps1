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

# Never infer ownership from the caller's directory: another Laravel project
# on the same machine must not be built or packaged by this script.
if (-not $PSCommandPath) {
    throw 'Run the saved TamashaRoom scripts/deploy-package.ps1 file directly.'
}
$projectRoot = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSCommandPath) '..'))
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "artisan")) -or -not (Test-Path -LiteralPath (Join-Path $projectRoot "package.json"))) {
    throw 'The owning TamashaRoom checkout is incomplete (artisan/package.json missing).'
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
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$outputArchive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($asset in Get-ChildItem -LiteralPath $buildDir -File -Recurse) {
        $relativePath = $asset.FullName.Substring($buildDir.Length).TrimStart([char[]]@('/', '\')).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($outputArchive, $asset.FullName, ('build/' + $relativePath)) | Out-Null
    }
} finally {
    $outputArchive.Dispose()
}

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
