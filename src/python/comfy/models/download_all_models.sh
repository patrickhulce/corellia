#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

bash "$MODEL_SCRIPTS_DIR/download_base_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_control_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_cv_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_insightface_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_deepfake_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_upscale_models.sh"
bash "$MODEL_SCRIPTS_DIR/download_video_models.sh"

