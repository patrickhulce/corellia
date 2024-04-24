#!/bin/bash

set -euxo pipefail

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONDA_DIR="$HOME/code/miniconda3"

# Following the setup instructions in https://github.com/foivospar/Arc2Face
cd ~/code
git clone git@github.com:patrickhulce/Arc2Face.git arc2face
cd arc2face/

# Install requirements
conda create -n arc2face python=3.10
source "$CONDA_DIR/bin/activate" arc2face
cp "$CURRENT_DIR/requirements.txt" .
pip install -r requirements.txt

# Download all the models.
mkdir -p models/antelopev2/
mkdir -p models/arc2face/
mkdir -p models/encoder/
mkdir -p models/controlnet/

cp "$CURRENT_DIR/download_models.py" models/

# Download the HuggingFace models.
python models/download_models.py

# Download https://drive.google.com/file/d/18wEUfMNohBJ4K3Ly5wpTejPfDzp-8fI8/view models.
curl -L https://github.com/patrickhulce/Arc2Face/releases/download/v0.0.1/antelopev2.tar.gz -o models/antelopev2/antelopev2.tar.gz
cd models/antelopev2/
tar -xvf antelopev2.tar.gz
cd ../..

# Test out your setup.
mkdir -p .data/
python "$CURRENT_DIR/test_arc2face.py"

# Section 3
# Download the EMOCA repository
git submodule update --init external/emoca

# Install the EMOCA requirements
conda create -n arc2face_controlnet python=3.10
source "$CONDA_DIR/bin/activate" arc2face_controlnet
conda install pytorch=1.13.0 torchvision=0.14.0 pytorch-cuda=11.6 -c pytorch -c nvidia
conda install fvcore=0.1.5 iopath=0.1.9 -c fvcore -c iopath -c conda-forge
conda install pytorch3d=0.7.5 -c pytorch3d

# Test everything is working.
python "$CURRENT_DIR/test_pytorch3d.py"

# Install the rest of the requirements.
cp "$CURRENT_DIR/requirements_controlnet.txt" .
pip install -r requirements_controlnet.txt
pip install -e external/emoca

# Test out your setup.
python "$CURRENT_DIR/test_arc2face_controlnet.py"
