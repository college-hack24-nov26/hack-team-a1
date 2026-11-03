# scripts\sync-to-fork.ps1
# Synchronizes Buildtri source files from outer project to the VS Code fork built-in extension directory,
# then performs typechecking and builds the production bundle.
$ErrorActionPreference = "Stop"

$outerRoot = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $outerRoot "vscode\extensions\buildtri"

Write-Host "=== Buildtri Fork Synchronization ===" -ForegroundColor Cyan
Write-Host "Source:      $outerRoot"
Write-Host "Destination: $dest"

# Ensure destination directory exists
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

# 1. Plain copy for the two JSON files
Write-Host "`n[1/3] Copying package.json and tsconfig.json..." -ForegroundColor Yellow
Copy-Item (Join-Path $PSScriptRoot "fork-package.json") (Join-Path $dest "package.json") -Force
Copy-Item (Join-Path $PSScriptRoot "fork-tsconfig.json") (Join-Path $dest "tsconfig.json") -Force
Write-Host "  -> Copied package.json and tsconfig.json" -ForegroundColor Green

# 2. Robocopy /MIR for the folders (src, ui-placeholder, resources)
# Excludes node_modules, dist, test, .buildtri, docs, logs
Write-Host "`n[2/3] Mirroring folders (src, ui-placeholder, resources)..." -ForegroundColor Yellow
$folders = @("src", "ui-placeholder", "resources")
foreach ($folder in $folders) {
    $srcFolder = Join-Path $outerRoot $folder
    $destFolder = Join-Path $dest $folder
    if (Test-Path $srcFolder) {
        Write-Host "  Mirroring $folder -> $destFolder"
        # Robocopy exit code < 8 indicates success (0-7 are standard non-error status codes)
        robocopy $srcFolder $destFolder /MIR /NFL /NDL /NJH /NJS /nc /ns /np
        if ($LASTEXITCODE -ge 8) {
            throw "Robocopy failed for $folder with exit code $LASTEXITCODE"
        }
    } else {
        Write-Warning "Source folder not found: $srcFolder"
    }
}
Write-Host "  -> Folders mirrored successfully." -ForegroundColor Green

# 3. Typecheck and build the bundle
Write-Host "`n[3/3] Running typecheck and building bundle in fork..." -ForegroundColor Yellow
Push-Location $dest
try {
    Write-Host "Running typecheck (tsc --noEmit)..."
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "Typecheck failed with exit code $LASTEXITCODE"
    }
    Write-Host "  -> Typecheck passed with 0 errors!" -ForegroundColor Green

    Write-Host "Building bundle (esbuild)..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }

    $distFile = Join-Path $dest "dist\extension.js"
    if (Test-Path $distFile) {
        $size = (Get-Item $distFile).Length
        Write-Host "  -> Bundle generated successfully: dist\extension.js ($size bytes)" -ForegroundColor Green
    } else {
        throw "dist\extension.js was not found after build!"
    }
} finally {
    Pop-Location
}

Write-Host "`n=== Synchronization & Build Complete! ===" -ForegroundColor Cyan

