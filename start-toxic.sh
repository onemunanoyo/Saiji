#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec .venv-classifier/bin/python local-toxic/server.py --device "${1:-auto}"
