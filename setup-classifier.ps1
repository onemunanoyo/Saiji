param([ValidateSet('cpu','cuda')][string]$Backend = 'cuda')
$ErrorActionPreference = 'Stop'
$taskEnv = Join-Path $PSScriptRoot '.venv-classifier'
python -m venv $taskEnv
if ($LASTEXITCODE -ne 0) { throw 'Python venv creation failed' }
$taskPython = Join-Path $taskEnv 'Scripts/python.exe'
$taskIndex = if ($Backend -eq 'cuda') { 'https://download.pytorch.org/whl/cu128' } else { 'https://download.pytorch.org/whl/cpu' }
& $taskPython -m pip install 'torch>=2.6,<3' --index-url $taskIndex
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed' }
& $taskPython -m pip install 'transformers==5.10.2' 'huggingface_hub>=1,<2'
if ($LASTEXITCODE -ne 0) { throw 'Dependencies installation failed' }
& $taskPython (Join-Path $PSScriptRoot 'local-toxic/download_model.py')
if ($LASTEXITCODE -ne 0) { throw 'Model download failed' }
