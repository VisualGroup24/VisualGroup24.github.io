$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"
if (Test-Path $python) {
    & $python -m pytest pipeline\tests -q
} else {
    Write-Warning "Python environment missing; skipping Python tests."
}

npm --prefix app run build
npm --prefix app test

Write-Host "Tests and production build completed."
