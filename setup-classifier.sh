#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 -m venv .venv-classifier
.venv-classifier/bin/python -m pip install 'torch>=2.6,<3' 'transformers==5.10.2' 'huggingface_hub>=1,<2'
.venv-classifier/bin/python local-toxic/download_model.py
