param([ValidateSet('auto','cpu','cuda','mps')][string]$Device = 'auto')
$ErrorActionPreference = 'Stop'
$taskPython = Join-Path $PSScriptRoot '.venv-classifier/Scripts/python.exe'
if (!(Test-Path -LiteralPath $taskPython)) { throw 'Run setup-classifier.ps1 first.' }
& $taskPython (Join-Path $PSScriptRoot 'local-toxic/server.py') --device $Device
exit $LASTEXITCODE
