#!/bin/bash

set -euxo pipefail

# This script is to be run in git bash in windows (outside WSL)

HOST_MODELS_DIR="/mnt/x/Comfy/models"
HOST_WORKSPACE_DIR="/mnt/x/Comfy/workspace"
DOCKER_BUILD_COMMAND="docker build -t comfy:latest ."
DOCKER_RUN_COMMAND="docker run --name comfy_service -d -p 8188:8188 -v $HOST_MODELS_DIR:/root/comfy/ComfyUI/models -v $HOST_WORKSPACE_DIR:/workspace comfy:latest"

wsl -d Ubuntu -e bash -c "$DOCKER_BUILD_COMMAND"
wsl -d Ubuntu -e bash -c "docker remove -f comfy_service" || true
wsl -d Ubuntu -e bash -c "$DOCKER_RUN_COMMAND"

echo "Started Comfy service in Docker container, waiting for start..."
sleep 5

IP_ADDRESS=$(wsl -d Ubuntu -e bash -c "ip addr show eth0 | grep 'inet ' | awk '{print \$2}' | cut -d/ -f1")
echo "Comfy service started at http://$IP_ADDRESS:8188"

/c/Program\ Files/Google/Chrome/Application/chrome.exe http://$IP_ADDRESS:8188
