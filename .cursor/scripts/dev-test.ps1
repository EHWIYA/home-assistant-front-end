# lint·build
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'ensure-utf8.ps1')

$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Set-Location $repoRoot

Write-Host '[dev-test] npm ci' -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[dev-test] npm run lint' -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[dev-test] npm run test' -ForegroundColor Cyan
npm run test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[dev-test] npm run build' -ForegroundColor Cyan
$env:VITE_USE_MOCK = 'false'
$env:VITE_API_BASE_URL = if ($env:VITE_API_BASE_URL) { $env:VITE_API_BASE_URL } else { 'https://iot-api.iwhya.kr' }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[dev-test] 완료: lint + test + build OK' -ForegroundColor Green
