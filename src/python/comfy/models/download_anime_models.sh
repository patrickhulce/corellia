#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="checkpoints"
download_model "sd15_anything_ink.safetensors" "https://huggingface.co/X779/Anything_ink/resolve/be08e0f6ed0b2dd95ae2d703073200672813dc24/Anything-ink.safetensors"
download_model "sd15_cartoon_mix.safetensors" "https://civitai.com/api/download/models/239306?type=Model&format=SafeTensor&size=full&fp=bf16"
download_model "sd15_disney_pixar_cartoon_type_a.safetensors" "https://civitai.com/api/download/models/69832?type=Model&format=SafeTensor&size=pruned&fp=fp16"
download_model "sd15_spybg_conceptart.safetensors" "https://civitai.com/api/download/models/17292"
download_model "sd15_realcartoon3d_v8.safetensors" "https://civitai.com/api/download/models/159751"
download_model "sdxl_cartoon_mix.safetensors" "https://civitai.com/api/download/models/239306"

MODEL_TYPE="loras"
download_model "lora_sd15_danmilligan_storyboard.safetensors" "https://civitai.com/api/download/models/71839"
download_model "lora_sd15_disney_styler.safetensors" "https://civitai.com/api/download/models/196013"
download_model "lora_sd15_ghibli.safetensors" "https://civitai.com/api/download/models/7657"
download_model "lora_sd15_monochrome_anime.safetensors" "https://civitai.com/api/download/models/261140"
download_model "lora_sd15_pixar.safetensors" "https://civitai.com/api/download/models/20450"
download_model "lora_sd15_tangled.safetensors" "https://civitai.com/api/download/models/295339"
download_model "lora_sdxl_animated_patan77.safetensors" "https://civitai.com/api/download/models/210701?type=Model&format=SafeTensor"
