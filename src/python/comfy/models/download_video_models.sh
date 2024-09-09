#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="animatediff"
download_model "mm_sdxl_beta.ckpt" "https://huggingface.co/guoyww/animatediff/resolve/fdfe36afa161e51b3e9c24022b0e368d59e7345e/mm_sdxl_v10_beta.ckpt"
download_model "mm_sd15_v2.ckpt" "https://huggingface.co/guoyww/animatediff/resolve/fdfe36afa161e51b3e9c24022b0e368d59e7345e/mm_sd_v15_v2.ckpt"
download_model "mm_sd15_v3_adapter.ckpt" "https://huggingface.co/guoyww/animatediff/resolve/fdfe36afa161e51b3e9c24022b0e368d59e7345e/v3_sd15_adapter.ckpt"
download_model "mm_sd15_v3.ckpt" "https://huggingface.co/guoyww/animatediff/resolve/fdfe36afa161e51b3e9c24022b0e368d59e7345e/v3_sd15_mm.ckpt"

