$ErrorActionPreference = 'Stop'
$taskExpectedServer = Join-Path $PSScriptRoot 'local-toxic\server.py'
$taskListeners = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
foreach ($taskListener in $taskListeners) {
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskListener.OwningProcess)"
    if (!$taskProcess -or !$taskProcess.CommandLine.Contains($taskExpectedServer)) {
        throw 'Port is owned by a different process; leaving it untouched.'
    }
    Stop-Process -Id $taskListener.OwningProcess
}
Write-Output 'This classifier server is stopped.'
