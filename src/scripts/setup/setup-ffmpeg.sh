#!/usr/bin/env bash
#
# Builds ffmpeg from source with BlackMagic DeckLink capture, NVIDIA NVENC and
# NVDEC, and OpenEXR. Safe to re-run.
#
#   ./src/scripts/setup/setup-ffmpeg.sh
#
# Almost nobody wants this. setup-linux.sh installs the distribution's ffmpeg,
# which handles everything short of talking to a capture card or encoding on the
# GPU; this is for when one of those two is the point. It takes the better part
# of an hour, needs the DeckLink SDK downloaded by hand from BlackMagic, and
# produces a binary in ~/code/ffmpeg/bin rather than on PATH — deliberately, so
# it doesn't shadow the packaged one.
#
# Run setup-linux-gpu.sh first for the CUDA toolkit this links against.

set -euo pipefail

CORELLIA_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib"
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$CORELLIA_LIB_DIR/common.sh"

ROOT_DIRECTORY="${CORELLIA_FFMPEG_DIR:-$HOME/code/ffmpeg}"
SOURCES_DIRECTORY="$ROOT_DIRECTORY/sources"
BUILD_DIRECTORY="$ROOT_DIRECTORY/build"
BIN_DIRECTORY="$ROOT_DIRECTORY/bin"

BLACKMAGIC_DIRECTORY="$SOURCES_DIRECTORY/blackmagic"
BLACKMAGIC_URL="https://www.blackmagicdesign.com/support/family/capture-and-playback"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Builds ffmpeg from source with DeckLink, NVENC/NVDEC, and OpenEXR support.

Options:
$(common_flags_help)

Environment:
  CORELLIA_FFMPEG_DIR  Where to build (default: $ROOT_DIRECTORY).
EOF
}

BUILD_TOOLS="\
  autoconf automake build-essential cmake git-core libtool meson ninja-build \
  nasm yasm pkg-config texinfo unzip wget zlib1g-dev \
  libc6 libc6-dev libnuma1 libnuma-dev \
  libgnutls28-dev libsdl2-dev libva-dev libvdpau-dev \
  libass-dev libfreetype6-dev \
  libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev"

CODECS="\
  libx264-dev libx265-dev libvpx-dev libfdk-aac-dev libmp3lame-dev \
  libopus-dev libvorbis-dev libdav1d-dev \
  libavcodec-dev libavformat-dev libswscale-dev libv4l-dev \
  libxvidcore-dev libjpeg-dev libpng-dev libtiff-dev \
  gfortran openexr libopenexr-dev libatlas-base-dev \
  libtbb-dev libdc1394-dev \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  gstreamer1.0-tools gstreamer1.0-alsa \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav"

install_dependencies() {
  local pkg wanted="" unavailable=""

  # Same reason as setup-linux.sh: one name this release doesn't have would
  # otherwise fail the whole apt transaction. libtbb2 went away in 24.04, and
  # the OpenEXR and gstreamer package names have moved around more than once.
  for pkg in $BUILD_TOOLS $CODECS; do
    if apt_installed "$pkg" || apt_available "$pkg"; then
      wanted="$wanted $pkg"
    else
      unavailable="$unavailable $pkg"
    fi
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the package list
  apt_install $wanted

  if [ -n "$unavailable" ]; then
    warn "this release has no package for:$unavailable"
  fi
}

# --- sources ----------------------------------------------------------------

# clone_or_update <url> <directory>
#
# The old version of this called `git clone` outright, so a second run died on
# "destination path already exists" before it reached the build.
clone_or_update() {
  local url="$1"
  local dir="$2"

  if [ -d "$dir/.git" ]; then
    step "Updating $(basename "$dir")"
    git -C "$dir" pull --ff-only || warn "could not update $dir; building what's there"
    return
  fi

  step "Cloning $(basename "$dir")"
  git clone "$url" "$dir"
}

# BlackMagic puts both downloads behind a registration form, so there is no URL
# to fetch them from. This tells you what to put where and stops.
install_decklink_sdk() {
  if [ -d "$BLACKMAGIC_DIRECTORY/sdk" ]; then
    skip "the DeckLink SDK is already unpacked"
    return
  fi

  mkdir -p "$BLACKMAGIC_DIRECTORY"

  if [ ! -f "$BLACKMAGIC_DIRECTORY/blackmagic.tar.gz" ]; then
    die "download Desktop Video from $BLACKMAGIC_URL and save it as $BLACKMAGIC_DIRECTORY/blackmagic.tar.gz"
  fi

  if [ ! -f "$BLACKMAGIC_DIRECTORY/blackmagic-sdk.zip" ]; then
    die "download the Desktop Video SDK from $BLACKMAGIC_URL and save it as $BLACKMAGIC_DIRECTORY/blackmagic-sdk.zip"
  fi

  step "Installing Desktop Video"
  tar -xzf "$BLACKMAGIC_DIRECTORY/blackmagic.tar.gz" -C "$BLACKMAGIC_DIRECTORY"
  # ./*.deb rather than *.deb: a package whose name starts with a dash would
  # otherwise be read by dpkg as an option.
  (
    cd "$BLACKMAGIC_DIRECTORY"/Blackmagic_Desktop_Video_Linux_*/deb/x86_64
    sudo dpkg -i ./*.deb || sudo apt-get install -f -y
  )
  BlackmagicFirmwareUpdater status || warn "no DeckLink card found"

  step "Unpacking the DeckLink SDK"
  unzip -qo "$BLACKMAGIC_DIRECTORY/blackmagic-sdk.zip" -d "$BLACKMAGIC_DIRECTORY"
  cp -R "$BLACKMAGIC_DIRECTORY"/Blackmagic\ DeckLink\ SDK\ */Linux "$BLACKMAGIC_DIRECTORY/sdk"
}

install_nv_codec_headers() {
  clone_or_update https://git.videolan.org/git/ffmpeg/nv-codec-headers.git \
    "$SOURCES_DIRECTORY/nv-codec-headers"

  step "Installing the NVENC/NVDEC headers"
  make -C "$SOURCES_DIRECTORY/nv-codec-headers" -j"$(nproc)"
  sudo make -C "$SOURCES_DIRECTORY/nv-codec-headers" install
}

build_ffmpeg() {
  clone_or_update https://github.com/FFmpeg/FFmpeg.git "$SOURCES_DIRECTORY/ffmpeg"
  mkdir -p "$BUILD_DIRECTORY" "$BIN_DIRECTORY"

  step "Configuring ffmpeg"
  note "This and the build take the better part of an hour."
  (
    cd "$SOURCES_DIRECTORY/ffmpeg"
    PATH="$BIN_DIRECTORY:$PATH" \
      PKG_CONFIG_PATH="$BUILD_DIRECTORY/lib/pkgconfig" \
      ./configure \
      --prefix="$BUILD_DIRECTORY" \
      --pkg-config-flags="--static" \
      --extra-cflags="-I$BUILD_DIRECTORY/include" \
      --extra-cflags="-I$BLACKMAGIC_DIRECTORY/sdk/include" \
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

    step "Building ffmpeg"
    make -j"$(nproc)"
    make install
  )
}

main() {
  require_linux
  parse_common_flags "$@"

  have apt-get || die "no apt-get found; this script targets Debian and Ubuntu"
  mkdir -p "$SOURCES_DIRECTORY"

  log "Dependencies"
  install_dependencies

  log "DeckLink"
  install_decklink_sdk

  log "NVENC/NVDEC"
  install_nv_codec_headers

  log "ffmpeg"
  build_ffmpeg

  cat <<EOF

Done. The build is in $BIN_DIRECTORY, deliberately not on PATH so it doesn't
shadow the packaged ffmpeg. Check it with:

  $BIN_DIRECTORY/ffmpeg -hide_banner -encoders | grep nvenc
  $BIN_DIRECTORY/ffmpeg -hide_banner -f decklink -list_devices 1 -i dummy
EOF
}

main "$@"
