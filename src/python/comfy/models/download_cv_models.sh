#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="depthanything"
download_model "depth_anything_v2_vits_fp32.safetensors" "https://huggingface.co/Kijai/DepthAnythingV2-safetensors/resolve/5aa7ab578df757d94c743998b157a0204ff29215/depth_anything_v2_vits_fp32.safetensors"
download_model "depth_anything_v2_vitl_fp32.safetensors" "https://huggingface.co/Kijai/DepthAnythingV2-safetensors/resolve/5aa7ab578df757d94c743998b157a0204ff29215/depth_anything_v2_vitl_fp32.safetensors"

MODEL_TYPE="sam2"
download_model "sam2_hiera_tiny.safetensors" "https://huggingface.co/Kijai/sam2-safetensors/resolve/main/sam2_hiera_tiny.safetensors"
download_model "sam2_hiera_small.safetensors" "https://huggingface.co/Kijai/sam2-safetensors/resolve/main/sam2_hiera_small.safetensors"
download_model "sam2_hiera_base_plus.safetensors" "https://huggingface.co/Kijai/sam2-safetensors/resolve/main/sam2_hiera_base_plus.safetensors"
