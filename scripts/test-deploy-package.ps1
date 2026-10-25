#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Assert-Rejected([scriptblock]$Operation) {
    $rejected = $false
    try { & $Operation } catch { $rejected = $true }
    if (-not $rejected) { throw 'An unsafe or incomplete package was accepted.' }
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tamasharoom-package-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot | Out-Null
$owner = Join-Path $testRoot 'owner'
$foreign = Join-Path $testRoot 'foreign'
$packageScript = Join-Path $owner 'scripts/deploy-package.ps1'
$manifestPath = Join-Path $owner 'public/build/manifest.json'
$archivePath = Join-Path $testRoot 'assets.zip'

try {
    foreach ($project in @($owner, $foreign)) {
        New-Item -ItemType Directory -Path "$project/public/build/assets" -Force | Out-Null
        Set-Content -LiteralPath "$project/artisan" -Value 'fixture'
        Set-Content -LiteralPath "$project/package.json" -Value '{}'
    }
    New-Item -ItemType Directory -Path "$owner/scripts" | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'deploy-package.ps1') -Destination $packageScript
    Set-Content -LiteralPath "$owner/public/build/assets/app.js" -Value 'owner fixture'
    Set-Content -LiteralPath $manifestPath -Value '{"owner":{"file":"assets/app.js"}}'
    Set-Content -LiteralPath "$foreign/public/build/manifest.json" -Value '{"foreign":{"file":"missing.js"}}'
    $foreignHash = (Get-FileHash -LiteralPath "$foreign/public/build/manifest.json").Hash

    Push-Location -LiteralPath $foreign
    try {
        & $packageScript -SkipBuild -OutputPath $archivePath
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
        try {
            if (@($archive.Entries | Where-Object { $_.FullName.Contains('\') -or -not $_.FullName.StartsWith('build/') }).Count -gt 0) {
                throw 'Archive contains entries outside build/.'
            }
            $reader = New-Object IO.StreamReader($archive.GetEntry('build/manifest.json').Open())
            try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
            if (-not $manifest.owner -or $manifest.foreign) { throw 'Foreign project was packaged.' }
        } finally { $archive.Dispose() }
        if ((Get-FileHash -LiteralPath "$foreign/public/build/manifest.json").Hash -ne $foreignHash) {
            throw 'Foreign project was modified.'
        }

        $archiveHash = (Get-FileHash -LiteralPath $archivePath).Hash
        Assert-Rejected { & $packageScript -SkipBuild -OutputPath $archivePath }
        if ((Get-FileHash -LiteralPath $archivePath).Hash -ne $archiveHash) { throw 'Existing artifact was overwritten.' }
        Assert-Rejected { & $packageScript -SkipBuild -OutputPath "$owner/public/build/rejected.zip" }
        Set-Content -LiteralPath $manifestPath -Value '{"owner":{"file":"assets/missing.js"}}'
        Assert-Rejected { & $packageScript -SkipBuild -OutputPath "$testRoot/missing-asset.zip" }
        Set-Content -LiteralPath $manifestPath -Value '{}'
        Assert-Rejected { & $packageScript -SkipBuild -OutputPath "$testRoot/empty-manifest.zip" }
        Write-Output 'PASS: ownership, archive layout, overwrite protection, output boundary and invalid manifests.'
    } finally { Pop-Location }
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Split-Path -Leaf $resolved).StartsWith('tamasharoom-package-test-')) {
        throw 'Refusing cleanup outside the owned temporary test directory.'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
