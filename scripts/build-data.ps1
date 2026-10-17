param(
    [switch]$Crawl
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Python environment missing. Run scripts\setup.ps1 first."
}

& $python -m pipeline.build --stage official
if ($Crawl) {
    & $python -m pipeline.build --stage crawl
}
& $python -m pipeline.build --stage analytics
& $python -m pipeline.build --stage build

Write-Host "Done. App data is in app\public\data\latest\"
