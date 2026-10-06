param([ValidateSet('cpu', 'cuda')][string]$Device = 'cpu')
$ErrorActionPreference = 'Stop'
$taskPython = Join-Path $PSScriptRoot '.venv-toxic/Scripts/python.exe'
if (!(Test-Path -LiteralPath $taskPython)) {
    throw 'Python環境がありません。readme.md の AIフィルタのセットアップを実行してください。'
}
& $taskPython (Join-Path $PSScriptRoot 'local-toxic/server.py') --device $Device
exit $LASTEXITCODE
