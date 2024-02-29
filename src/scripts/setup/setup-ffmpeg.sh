#!/bin/bash

set -euxo pipefail

ROOT_DIRECTORY="$HOME/code/ffmpeg"
SOURCES_DIRECTORY="$ROOT_DIRECTORY/sources"
BUILD_DIRECTORY="$ROOT_DIRECTORY/build"
BIN_DIRECTORY="$ROOT_DIRECTORY/bin"

# Installs ffmpeg from source with support for...
#   - BlackMagic DeckLink
#   - NVIDIA NVENC/NVDEC GPU acceleration
#   - EXR files

# Install dependencies
sudo apt-get update
# Build tools
sudo apt-get -y install \
  autoconf \
  automake \
  build-essential \
  cmake \
  git-core \
  libc6 libc6-dev unzip wget libnuma1 libnuma-dev \
  libgnutls28-dev \
  libsdl2-dev \
  libva-dev \
  libvdpau-dev \
  libass-dev \
  libfreetype6-dev \
  libtool \
  pkg-config \
  texinfo \
  wget \
  nasm yasm \
  libxcb1-dev \
  libxcb-shm0-dev \
  libxcb-xfixes0-dev \
  meson \
  ninja-build \
  pkg-config \
  zlib1g-dev
# Codecs
sudo apt-get -y install \
  libx264-dev \
  libx265-dev \
  libnuma-dev \
  libvpx-dev \
  libfdk-aac-dev \
  libmp3lame-dev \
  libopus-dev \
  libvorbis-dev \
  libavcodec-dev libdav1d-dev libavformat-dev libswscale-dev libv4l-dev \
    libxvidcore-dev libjpeg-dev libpng-dev libtiff-dev \
    gfortran openexr libatlas-base-dev \
    libtbb2 libtbb-dev libdc1394-dev libopenexr-dev \
    libgstreamer-plugins-base1.0-dev libgstreamer1.0-dev \
    gstreamer1.0-tools gstreamer1.0-alsa \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav

mkdir -p "$SOURCES_DIRECTORY/blackmagic"

# Install BlackMagic DeckLink SDK
# Download 2 files from https://www.blackmagicdesign.com/support/family/capture-and-playback
#   - Desktop Video
#   - Desktop Video SDK
if [ ! -d "$SOURCES_DIRECTORY/blackmagic/sdk" ]; then
  BLACKMAGIC_DIR="$SOURCES_DIRECTORY/blackmagic"
  if [ ! -f "$BLACKMAGIC_DIR/blackmagic.tar.gz" ]; then
    echo "Please download the BlackMagic Desktop Video and SDK from https://www.blackmagicdesign.com/support/family/capture-and-playback"
    echo "Then place the tar.gz file in $BLACKMAGIC_DIR/blackmagic.tar.gz"
    exit 1
  fi

  cd "$BLACKMAGIC_DIR"
  tar -xzf blackmagic.tar.gz
  cd Blackmagic_Desktop_Video_Linux_*/deb/x86_64
  sudo dpkg -i *.deb
  sudo apt-get install -f
  BlackmagicFirmwareUpdater status

  if [ ! -f "$BLACKMAGIC_DIR/blackmagic-sdk.zip" ]; then
    echo "Please download the BlackMagic Desktop Video and SDK from https://www.blackmagicdesign.com/support/family/capture-and-playback"
    echo "Then place the zip file in $BLACKMAGIC_DIR/blackmagic-sdk.zip"
    exit 1
  fi

  unzip blackmagic-sdk.zip
  cp -R Blackmagic\ DeckLink\ SDK\ */Linux "$BLACKMAGIC_DIR/sdk"
fi

# Install NVIDIA NVENC/NVDEC SDK
git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git "$SOURCES_DIRECTORY/nv-codec-headers"
cd "$SOURCES_DIRECTORY/nv-codec-headers"
make -j$(nproc)
sudo make install

# Build FFmpeg
git clone https://github.com/FFmpeg/FFmpeg.git "$SOURCES_DIRECTORY/ffmpeg"
cd "$SOURCES_DIRECTORY/ffmpeg"
mkdir -p "$BUILD_DIRECTORY"
mkdir -p "$BIN_DIRECTORY"

PATH="$BIN_DIRECTORY:$PATH" \
  PKG_CONFIG_PATH="$BUILD_DIRECTORY/lib/pkgconfig" \
  ./configure \
    --prefix="$BUILD_DIRECTORY" \
    --pkg-config-flags="--static" \
    --extra-cflags="-I$BUILD_DIRECTORY/include" \
    --extra-cflags="-I$SOURCES_DIRECTORY/blackmagic/sdk/include" \
    --extra-cflags="-I/usr/local/cuda/include" \
    --extra-ldflags="-L/usr/local/cuda/lib64" \
    --extra-ldflags="-L$BUILD_DIRECTORY/lib" \
    --extra-libs="-lpthread -lm" \
    --bindir="$BIN_DIRECTORY" \
    --enable-gpl \
    --enable-libass \
    --enable-libfdk-aac \
    --enable-libfreetype \
    --enable-libmp3lame \
    --enable-libopus \
    --enable-libvorbis \
    --enable-libvpx \
    --enable-libx264 \
    --enable-libx265 \
    --enable-libv4l2 \
    --enable-libdav1d \
    --enable-cuda-nvcc \
    --enable-libnpp \
    --enable-nonfree \
    --enable-decklink

make -j$(nproc)
