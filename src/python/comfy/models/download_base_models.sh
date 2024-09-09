#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="checkpoints"
download_model "sd15_base.safetensors" "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/1d0c4ebf6ff58a5caecab40fa1406526bca4b5b9/v1-5-pruned.safetensors"
download_model "sd15_realisticvision_v5.safetensors" "https://civitai.com/api/download/models/130072?type=Model&format=SafeTensor&size=full&fp=fp16"
download_model "sd15_cyberrealistic.safetensors" "https://civitai.com/api/download/models/537505?type=Model&format=SafeTensor&size=pruned&fp=fp16"
download_model "sdxl_base.safetensors" "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/462165984030d82259a11f4367a4eed129e94a7b/sd_xl_base_1.0.safetensors"
download_model "sdxl_juggernaut.safetensors" "https://civitai.com/api/download/models/782002?type=Model&format=SafeTensor&size=full&fp=fp16"
download_model "sdxl_cyberrealistic.safetensors" "https://civitai.com/api/download/models/709456?type=Model&format=SafeTensor&size=pruned&fp=fp16"

MODEL_TYPE="clip_vision"
download_model "CLIP_ViT_H_14_laion2B_s32B_b79K.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/image_encoder/model.safetensors"
download_model "CLIP_ViT_bigG_14_laion2B_39B_b160k.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/sdxl_models/image_encoder/model.safetensors"

MODEL_TYPE="loras"
download_model "lora_sd15_detail_slider_v4.safetensors" "https://huggingface.co/nyaa314/loras/resolve/50d504833e9c53d663d15c5ac452fb7860195767/detail/detail_slider_v4.safetensors"
download_model "lora_sdxl_juggernaut_cinema.safetensors" "https://civitai.com/api/download/models/131991?type=Model&format=SafeTensor"

MODEL_TYPE="vae"
download_model "vae_ft_mse_840000_ema_pruned.safetensors" "https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/629b3ad3030ce36e15e70c5db7d91df0d60c627f/vae-ft-mse-840000-ema-pruned.safetensors"
