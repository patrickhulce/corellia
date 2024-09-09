#!/bin/bash

set -euxo pipefail

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"


if [[ -f "$MODEL_SCRIPTS_DIR/../.envrc" ]]; then
    source "$MODEL_SCRIPTS_DIR/../.envrc"
fi

download_model() {
    local filename=$1
    local url=$2
    local relative_path="models/$MODEL_TYPE"
    comfy model download --url $url --relative-path $relative_path --filename $filename
}
