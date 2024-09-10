#!/bin/bash

set -euxo pipefail

CURRENT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
CONDA_DIR="$HOME/code/miniconda3"

conda create -n kohya python=3.10 -y
source "$CONDA_DIR/bin/activate" kohya

cd "$CURRENT_DIR"
pip install -r requirements_kohya.txt

mkdir -p ~/code/comfy

cd ~/code/comfy
git clone -b v24.0.8 --recursive https://github.com/bmaltais/kohya_ss.git
cd ~/code/comfy/kohya_ss
docker compose up -d

open http://localhost:7860 # Kohya
open http://localhost:6006 # Tensorboard
