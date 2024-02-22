#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export PYTHONPATH="$SCRIPT_DIR/src:${PYTHONPATH:-}"
python -m rtvideo.bin.runner