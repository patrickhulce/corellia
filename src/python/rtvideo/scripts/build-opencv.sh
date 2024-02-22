#!/bin/bash

# This script installs OpenCV CUDA (12.3) on Ubuntu 22.04

set -euxo pipefail

# Prerequisites
# conda create -n cv python=3.10
# conda activate cv
# conda install numpy

# CUDA GPU architecture version. Lookup this value here https://developer.nvidia.com/cuda-gpus
export CUDA_ARCH_BIN="8.9"

# Found on the achive page of the cuDNN download page. https://developer.nvidia.com/rdp/cudnn-archive
export CUDNN_DEB_URL="https://github.com/patrickhulce/football-iq/releases/download/v0.0.1/cudnn-local-repo-ubuntu2204-8.9.7.29_1.0-1_amd64.deb"

# Path where OpenCV installation will be written.
export PYTHON_VERSION=$(python -c "import sys; print(f'python{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHON_BIN=$(which python)
export PYTHON_LIBRARY=$(python -c "import distutils.sysconfig as sysconfig; print(sysconfig.get_config_var('LIBDIR'))")
export PYTHON_INCLUDE_DIR=$(python -c "from distutils.sysconfig import get_python_inc; print(get_python_inc())")
export SITE_PACKAGE_DIR=$(python -c "import site; print(site.getsitepackages()[0])")

# Install the required packages
sudo apt-get install build-essential cmake git pkg-config libgtk-3-dev \
    libavcodec-dev libavformat-dev libswscale-dev libv4l-dev \
    libxvidcore-dev libx264-dev libjpeg-dev libpng-dev libtiff-dev \
    gfortran openexr libatlas-base-dev python3-dev python3-numpy \
    libtbb2 libtbb-dev libdc1394-dev libopenexr-dev \
    libgstreamer-plugins-base1.0-dev libgstreamer1.0-dev \
    gstreamer1.0-tools gstreamer1.0-alsa \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav

# Install cuDNN from deb URL.
cd /tmp
wget -O cudnn.deb "$CUDNN_DEB_URL"
sudo dpkg -i cudnn.deb
sudo apt update
sudo apt install libcudnn8-dev=8.9.7.29-1+cuda12.2
rm cudnn.deb

# Alt:
# export OS="ubuntu2204"
# wget https://developer.download.nvidia.com/compute/cuda/repos/${OS}/x86_64/cuda-${OS}.pin 

# sudo mv cuda-${OS}.pin /etc/apt/preferences.d/cuda-repository-pin-600
# sudo apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/${OS}/x86_64/7fa2af80.pub
# sudo add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/${OS}/x86_64/ /"
# sudo apt-get update
# sudo apt-get install libcudnn8=${cudnn_version}-1+${cuda_version}
# sudo apt-get install libcudnn8-dev=${cudnn_version}-1+${cuda_version}


# Grab the OpenCV code.
cd ~/code/opensource
git clone https://github.com/opencv/opencv.git
git clone https://github.com/opencv/opencv_contrib.git

cd opencv
mkdir build
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
    -D BUILD_EXAMPLES=ON ..

make -j$(nproc)  # Use all cores
sudo make install
sudo ldconfig

ln -s "/usr/local/lib/$PYTHON_VERSION/site-packages/cv2" "$SITE_PACKAGE_DIR/cv2"