# utf8·래퍼

$globalScript = Join-Path $env:USERPROFILE '.cursor\ensure-utf8.ps1'
if (Test-Path -LiteralPath $globalScript) {
    . $globalScript
    return
}

# fallback
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

try {
    chcp 65001 | Out-Null
} catch {
    # chcp skip
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
