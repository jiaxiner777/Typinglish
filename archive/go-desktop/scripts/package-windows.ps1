$ErrorActionPreference = "Stop"

npm run build

New-Item -ItemType Directory -Force -Path "release" | Out-Null
$env:GOCACHE = Join-Path (Get-Location) ".gocache"
go build -ldflags="-s -w" -o "release\Typinglish.exe" "."

Write-Host "Built release\Typinglish.exe"
