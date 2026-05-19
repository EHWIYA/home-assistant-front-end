# agent·명령
param(
    [Parameter(Mandatory = $true)]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'ensure-utf8.ps1')

$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Set-Location $repoRoot

Invoke-Expression $Command
if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
