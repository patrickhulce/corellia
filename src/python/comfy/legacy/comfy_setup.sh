#!/bin/bash

set -euxo pipefail

CONDA_DIR="$HOME/code/miniconda3"

mkdir -p ~/code/comfy
cd ~/code/comfy

git clone git@github.com:comfyanonymous/ComfyUI.git
cd ComfyUI/
git checkout -f "10fcd09"

conda create -n comfy python=3.10 -y
source "$CONDA_DIR/bin/activate" comfy
pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

curl -L "https://civitai.com/api/download/models/130072?type=Model&format=SafeTensor&size=full&fp=fp16" -o models/checkpoints/RealisticVisionV5_1.safetensors
curl -L "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors?download=true" -o models/checkpoints/sd1_5_pruned.safetensors
curl -L "https://huggingface.co/lllyasviel/sd-controlnet-canny/resolve/main/diffusion_pytorch_model.safetensors?download=true" -o models/controlnet/controlnet_sd1_5_canny.safetensors

cd custom_nodes/
git clone https://github.com/ltdrdata/ComfyUI-Manager.git
git clone https://github.com/Fannovel16/comfyui_controlnet_aux.git
pip install -r comfyui_controlnet_aux/requirements.txt

cd ~/code/comfy/ComfyUI
python main.py
