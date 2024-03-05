#!/bin/bash

# This script installs OpenCV CUDA (12.3) on Ubuntu 22.04

set -euxo pipefail

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

# Install cuDNN.
OS="ubuntu/$(lsb_release -sr | tr -d '.')"

cd /tmp
wget https://developer.download.nvidia.com/compute/cuda/repos/$OS/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt-get update
libcudnn_version=$(sudo apt-cache madison libcudnn8 | head -n 1 | cut -d '|' -f 2 | xargs)
sudo apt-get install libcudnn8=$libcudnn_version
sudo apt-get install libcudnn8-dev=$libcudnn_version


# Grab the OpenCV code.
mkdir -p ~/code/opencv
cd ~/code/opencv
git clone https://github.com/opencv/opencv.git
git clone https://github.com/opencv/opencv_contrib.git

cd opencv
mkdir build
cd build