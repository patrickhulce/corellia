#!/bin/bash

MODEL_SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $MODEL_SCRIPTS_DIR/model_utils.sh

MODEL_TYPE="controlnet"
download_model "control_sd15_v11f1p_depth.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11f1p_sd15_depth/resolve/539f99181d33db39cf1af2e517cd8056785f0a87/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_normalbae.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_normalbae/resolve/cb7296e6587a219068e9d65864e38729cd862aa8/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_canny.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_canny/resolve/115a470d547982438f70198e353a921996e2e819/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_softedge.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_softedge/resolve/b5bcad0c48e9b12f091968cf5eadbb89402d6bc9/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_lineart.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_lineart/resolve/8a158f547e031c5b8fbca19ead09a74767ff4db0/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_pose.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_openpose/resolve/9ae9f970358db89e211b87c915f9535c6686d5ba/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sd15_v11p_inpaint.fp16.safetensors" "https://huggingface.co/lllyasviel/control_v11p_sd15_inpaint/resolve/c96e03a807e64135568ba8aecb66b3a306ec73bd/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sdxl_canny.fp16.safetensors" "https://huggingface.co/diffusers/controlnet-canny-sdxl-1.0/resolve/eb115a19a10d14909256db740ed109532ab1483c/diffusion_pytorch_model.fp16.safetensors"
download_model "control_sdxl_depth.fp16.safetensors" "https://huggingface.co/diffusers/controlnet-depth-sdxl-1.0/resolve/17bb97973f29801224cd66f192c5ffacf82648b4/diffusion_pytorch_model.fp16.safetensors"

MODEL_TYPE="ipadapter"
download_model "ipadapter_sd15.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/ip-adapter_sd15.safetensors"
download_model "ipadapter_sd15_plus.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/ip-adapter-plus_sd15.safetensors"
download_model "ipadapter_sd15_plus_face.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/ip-adapter-plus-face_sd15.safetensors"
download_model "ipadapter_sdxl.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/sdxl_models/ip-adapter_sdxl.safetensors"
download_model "ipadapter_sdxl_vit_h.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/sdxl_models/ip-adapter_sdxl_vit-h.safetensors"
download_model "ipadapter_sdxl_plus_vit_h.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors"
download_model "ipadapter_sdxl_plus_face_vit_h.safetensors" "https://huggingface.co/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors"

MODEL_TYPE="loras"
download_model "lora_sd15_detail_slider_v4.safetensors" "https://huggingface.co/nyaa314/loras/resolve/50d504833e9c53d663d15c5ac452fb7860195767/detail/detail_slider_v4.safetensors"
