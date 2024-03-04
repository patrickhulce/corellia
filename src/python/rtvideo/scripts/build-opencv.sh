#!/bin/bash

# This script installs OpenCV CUDA (12.3) on Ubuntu 22.04

set -euxo pipefail

# Prerequisites
# Run ./install-opencv-deps.sh
# conda create -n cv python=3.10
# conda activate cv
# conda install numpy

# CUDA GPU architecture version. Lookup this value here https://developer.nvidia.com/cuda-gpus
export CUDA_ARCH_BIN="8.9"
export PATH="/usr/local/cuda-12/bin:$PATH"
export LD_LIBRARY_PATH="/usr/local/cuda-12/lib64:${LD_LIBRARY_PATH:-}"

# Path where OpenCV installation will be written.
export PYTHON_VERSION=$(python -c "import sys; print(f'python{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHON_BIN=$(which python)
export PYTHON_LIBRARY=$(python -c "import distutils.sysconfig as sysconfig; print(sysconfig.get_config_var('LIBDIR'))")
export PYTHON_INCLUDE_DIR=$(python -c "from distutils.sysconfig import get_python_inc; print(get_python_inc())")
export SITE_PACKAGE_DIR=$(python -c "import site; print(site.getsitepackages()[0])")

cd ~/code/opencv/opencv
# rm -rf ./build
mkdir -p build
cd build

# Configure and build OpenCV
cmake -D CMAKE_BUILD_TYPE=RELEASE \
    -D CMAKE_INSTALL_PREFIX=/usr/local \
    -D INSTALL_PYTHON_EXAMPLES=ON \
    -D INSTALL_C_EXAMPLES=OFF \
    -D OPENCV_ENABLE_NONFREE=ON \
    -D WITH_CUDA=ON \
    -D WITH_CUDNN=ON \
    -D WITH_GSTREAMER=ON \
    -D OPENCV_DNN_CUDA=ON \
    -D ENABLE_FAST_MATH=1 \
    -D CUDA_FAST_MATH=1 \
    -D CUDNN_INCLUDE_DIR=/usr/include \
    -D CUDNN_LIBRARY=/usr/lib/x86_64-linux-gnu/libcudnn.so \
    -D CUDA_ARCH_BIN="$CUDA_ARCH_BIN" \
    -D WITH_CUBLAS=1 \
    -D OPENCV_EXTRA_MODULES_PATH=../../opencv_contrib/modules \
    -D BUILD_opencv_python3=ON \
    -D PYTHON_EXECUTABLE="$PYTHON_BIN" \
    -D PYTHON_LIBRARY="$PYTHON_LIBRARY" \
    -D PYTHON_INCLUDE_DIR="$PYTHON_INCLUDE_DIR" \
    -D BUILD_EXAMPLES=ON .. | tee cmake.log

if grep "Python3 wrappers can not be generated" cmake.log; then
    echo "Failed to locate python libraries!"
    exit 1
fi

make -j$(nproc)  # Use all cores
sudo make install
sudo ldconfig

ln -s "/usr/local/lib/$PYTHON_VERSION/site-packages/cv2" "$SITE_PACKAGE_DIR/cv2"