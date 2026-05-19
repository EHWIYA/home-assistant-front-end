# 터미널·utf8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'ensure-utf8.ps1')
