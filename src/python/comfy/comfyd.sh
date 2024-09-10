#!/bin/bash

set -euxo pipefail

# This script is to be run inside the comfy docker container on setup

mkdir -p /workspace/input
mkdir -p /workspace/output
mkdir -p /workspace/workflows

if [[ -e "./pysssss-workflows" ]]; then
    rm -rf "./pysssss-workflows"
fi

ln -s /workspace/workflows ./pysssss-workflows

comfy launch -- \
    --listen "0.0.0.0" \
    --input-dir "/workspace/input" \
    --output-dir "/workspace/output" \
