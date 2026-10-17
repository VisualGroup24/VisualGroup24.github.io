$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating Python 3.13 virtual environment..."
    py -3.13 -m venv .venv
}

Write-Host "Installing Python dependencies..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\pip.exe install -r pipeline\requirements.txt

Write-Host "Installing frontend dependencies..."
npm --prefix app install

Write-Host "Setup complete. Run scripts\build-data.ps1, then scripts\dev.ps1"
