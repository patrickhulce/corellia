#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="esrgan"
download_model "4x_foolhardy_remarci.pth" "https://civitai.com/api/download/models/164821?type=Model&format=PickleTensor"
download_model "4x_NMKD-Superscale-SP178000_G.pth" "https://civitai.com/api/download/models/156841?type=Model&format=PickleTensor"
download_model "4x_ultrasharp.pth" "https://civitai.com/api/download/models/125843?type=Model&format=PickleTensor"
download_model "4x_real_esrgan.pth" "https://huggingface.co/ai-forever/Real-ESRGAN/resolve/main/RealESRGAN_x4.pth?download=true"

MODEL_TYPE="facerestore"
download_model "face_gfpgan.onnx" "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/facerestore_models/GFPGANv1.4.onnx?download=true"
download_model "face_codeformer.pth" "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/facerestore_models/codeformer-v0.1.0.pth?download=true"
