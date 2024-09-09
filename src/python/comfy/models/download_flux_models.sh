#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="checkpoints"
download_model "flux1_schnell_fp8.safetensors" "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/f2808ab17fe9ff81dcf89ed0301cf644c281be0a/flux1-schnell-fp8.safetensors"

MODEL_TYPE="clip"
download_model "clip_flux1_L.safetensors" "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/2f74b39c0606dae3b2196d79c18c2a40b71f3250/clip_l.safetensors"
download_model "clip_flux1_t5xxl_fp8_e4m3fn.safetensors" "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/2f74b39c0606dae3b2196d79c18c2a40b71f3250/t5xxl_fp8_e4m3fn.safetensors?download=true"

MODEL_TYPE="unet"
download_model "flux1_schnell.safetensors" "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/012d2fdbdfbc0fb4b0c8179d22e97f64df59ea01/flux1-schnell.safetensors"

MODEL_TYPE="vae"
download_model "vae_flux1_ae.safetensors" "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/012d2fdbdfbc0fb4b0c8179d22e97f64df59ea01/ae.safetensors"
