# rtvideo

Examples of real-time video inference using OpenCV, cupy, and ONNX with CUDA support.

## Windows Setup

- Install CUDA Toolkit 12.3 / Update drivers
- Install cuDNN 8.x.x latest
- Insatll C++ Redistributable
- Install anaconda
- Install git bash
- conda create -n cv python=3.10
- conda activate cv
- pip install numpy opencv-python
- conda install -c conda-forge cupy cuda-version=12.3
- pip install onnxruntime-gpu --force-reinstall --extra-index-url https://aiinfra.pkgs.visualstudio.com/PublicPackages/_packaging/onnxruntime-cuda-12/pypi/simple/

## Linux Setup

- Update / install drivers
- Install CUDA toolkit
- Install conda
- conda create -n cv python=3.10
- conda activate cv
- pip install numpy opencv-python
- conda install -c conda-forge cupy cuda-version=12.3
- conda install -c conda-forge cudnn
- pip install onnxruntime-gpu --force-reinstall --extra-index-url https://aiinfra.pkgs.visualstudio.com/PublicPackages/_packaging/onnxruntime-cuda-12/pypi/simple/
