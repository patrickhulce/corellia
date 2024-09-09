#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="liveportrait"
download_model "appearance_feature_extractor.safetensors" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/appearance_feature_extractor.safetensors"
download_model "landmark.onnx" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/landmark.onnx"
download_model "motion_extractor.safetensors" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/motion_extractor.safetensors"
download_model "spade_generator.safetensors" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/spade_generator.safetensors"
download_model "stitching_retargeting_module.safetensors" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/stitching_retargeting_module.safetensors"
download_model "warping_module.safetensors" "https://huggingface.co/Kijai/LivePortrait_safetensors/resolve/9e2ebb628f4c5046a54d7cbfe044edb124e8dc0a/warping_module.safetensors"

MODEL_TYPE="ultralytics/bbox"
download_model "face_yolov8m.pt" "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/detection/bbox/face_yolov8m.pt"

MODEL_TYPE="insightface"
download_model "inswapper_128.onnx" "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/inswapper_128.onnx?download=true"
