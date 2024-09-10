#!/bin/bash

set -euxo pipefail

# This script is to be run in WSL outside the Docker container

NODE_TO_INSTALL="${1:-ComfyUI-Impact-Pack}"
docker exec comfy_service /bin/bash -c "comfy node install $NODE_TO_INSTALL"
docker exec comfy_service /bin/bash -c "comfy node save-snapshot --output=/tmp/nodes.yaml"
docker cp comfy_service:/tmp/nodes.yaml snapshot.yaml
