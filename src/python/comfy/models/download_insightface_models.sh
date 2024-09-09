#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="insightface"
download_model "1k3d68.onnx" "https://huggingface.co/public-data/insightface/resolve/33c1063c49c785b7652d3fd529f86fa4f149392b/models/buffalo_l/1k3d68.onnx"
download_model "2d106det.onnx" "https://huggingface.co/public-data/insightface/resolve/33c1063c49c785b7652d3fd529f86fa4f149392b/models/buffalo_l/2d106det.onnx"
download_model "det_10g.onnx" "https://huggingface.co/public-data/insightface/resolve/33c1063c49c785b7652d3fd529f86fa4f149392b/models/buffalo_l/det_10g.onnx"
download_model "genderage.onnx" "https://huggingface.co/public-data/insightface/resolve/33c1063c49c785b7652d3fd529f86fa4f149392b/models/buffalo_l/genderage.onnx"
download_model "w600k_r50.onnx" "https://huggingface.co/public-data/insightface/resolve/33c1063c49c785b7652d3fd529f86fa4f149392b/models/buffalo_l/w600k_r50.onnx"
