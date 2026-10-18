$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Python environment missing. Run scripts\setup.ps1 first."
}

Write-Host "Full residential Squarefoot crawl (about 26,000 pages; roughly 7-10 hours)."
Write-Host "Resume is automatic: parsed pages are skipped on the next run."
& $python -m pipeline.full_crawl --delay 1.0
