#!/usr/bin/env bash
#
# The NVIDIA stack for a Linux box that has a card in it: the driver, the CUDA
# toolkit, Docker, and the container toolkit that lets a container see the GPU.
# Safe to re-run.
#
#   ./src/scripts/setup/setup-linux-gpu.sh [--wsl] [--skip-docker]
#
# Deliberately not part of setup-linux.sh. Most machines this repo provisions
# are laptops and cloud VMs with no GPU, and this installs kernel modules and a
# container runtime on the strength of a decision that has to be made on
# purpose. Run setup-linux.sh first; this assumes the shell and tooling from it.
#
# Ubuntu and Debian derivatives only. See src/docs/setup/linux-setup.md#gpu.

set -euo pipefail

CORELLIA_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib"
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$CORELLIA_LIB_DIR/common.sh"

# The metapackage, so this tracks whatever CUDA is current rather than pinning a
# version that goes stale in the script. Override to pin one, e.g.
# CORELLIA_CUDA_PACKAGE=cuda-toolkit-12-6.
CUDA_PACKAGE="${CORELLIA_CUDA_PACKAGE:-cuda-toolkit}"

# Ubuntu's own nvidia-cuda-toolkit is deliberately not installed alongside it.
# The old version of this script installed both, which puts two nvcc binaries on
# the machine and lets the linker pick between two sets of libraries.

IS_WSL=""
SKIP_DOCKER=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs the NVIDIA driver, the CUDA toolkit, Docker, and the NVIDIA container
toolkit.

Options:
  --wsl               Treat this as WSL: no driver install, and the WSL CUDA
                      repository. Detected automatically.
  --skip-docker       Leave Docker and the container toolkit alone.
$(common_flags_help)

Environment:
  CORELLIA_CUDA_PACKAGE  CUDA package to install (default: $CUDA_PACKAGE).
EOF
}

parse_args() {
  local rest=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --wsl) IS_WSL=1 ;;
      --skip-docker) SKIP_DOCKER=1 ;;
      *) rest="$rest $1" ;;
    esac
    shift
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the leftovers
  parse_common_flags $rest
}

# Under WSL the GPU is the Windows host's. Its driver is projected into the
# guest at /usr/lib/wsl/lib, and installing a Linux driver over the top is the
# documented way to break it.
detect_wsl() {
  [ -z "$IS_WSL" ] || return 0

  if grep -qi microsoft /proc/version 2>/dev/null; then
    IS_WSL=1
    skip "WSL detected; skipping the driver install"
  fi
}

# --- repositories -----------------------------------------------------------

# os_release <key>
#
# A field from /etc/os-release. Read rather than sourced, because sourcing it
# puts ID, NAME, and VERSION into this shell — names a script may well be using
# — and leaves `set -u` to trip over whichever fields this distribution omits.
os_release() {
  sed -n "s/^$1=//p" /etc/os-release 2>/dev/null | tr -d '"' | head -n 1
}

# ubuntu2404, ubuntu2204, or wsl-ubuntu — the directory names NVIDIA publishes
# its apt repository under.
cuda_distro() {
  if [ -n "$IS_WSL" ]; then
    printf 'wsl-ubuntu\n'
    return
  fi

  local id version
  id="$(os_release ID)"
  version="$(os_release VERSION_ID)"

  # A derivative that isn't Ubuntu still takes the Ubuntu repository, and NVIDIA
  # only publishes for releases it has built for, so anything unrecognised falls
  # back to the oldest LTS still supported rather than guessing at a directory.
  case "$id" in
    ubuntu) printf 'ubuntu%s\n' "$(printf '%s' "$version" | tr -d .)" ;;
    *) printf 'ubuntu2204\n' ;;
  esac
}

# x86_64 or sbsa, NVIDIA's spelling for 64-bit ARM servers.
cuda_arch() {
  case "$(uname -m)" in
    aarch64) printf 'sbsa\n' ;;
    *) printf 'x86_64\n' ;;
  esac
}

# NVIDIA distributes a .deb that registers the repository and its key, rather
# than an armoured key at a URL, so this doesn't go through apt_repo.
install_cuda_keyring() {
  if [ -f /usr/share/keyrings/cuda-archive-keyring.gpg ]; then
    skip "the CUDA apt repository is already registered"
    return
  fi

  local url tmp
  url="https://developer.download.nvidia.com/compute/cuda/repos/$(cuda_distro)/$(cuda_arch)/cuda-keyring_1.1-1_all.deb"

  step "Registering the CUDA apt repository"
  tmp="$(mktemp -d)"
  if curl -fsSL --max-time 120 -o "$tmp/cuda-keyring.deb" "$url"; then
    sudo dpkg -i "$tmp/cuda-keyring.deb"
    CORELLIA_APT_UPDATED=""
    apt_refresh
  else
    rm -rf "$tmp"
    die "could not download $url"
  fi
  rm -rf "$tmp"
}

# --- driver -----------------------------------------------------------------

# The newest non-open, non-server branch ubuntu-drivers offers for this card.
# The open modules are still the wrong default for a workstation with a display
# attached, and the server ones drop the graphics stack entirely.
latest_driver_package() {
  ubuntu-drivers list 2>/dev/null |
    grep -v open |
    grep -v server |
    grep -oE 'nvidia-driver-[0-9]+' |
    sort -t- -k3 -n |
    tail -n 1
}

install_driver() {
  if [ -n "$IS_WSL" ]; then
    skip "WSL uses the Windows host's driver"
    return
  fi

  apt_install ubuntu-drivers-common dkms build-essential "linux-headers-$(uname -r)"

  local driver
  driver="$(latest_driver_package)"
  if [ -z "$driver" ]; then
    warn "ubuntu-drivers found no NVIDIA driver for this machine; skipping"
    return
  fi

  if apt_installed "$driver"; then
    skip "$driver already installed"
  else
    apt_install "$driver"
  fi

  # An unattended-upgrades run that swaps the driver out from under a loaded
  # kernel module leaves nvidia-smi reporting a version mismatch until reboot,
  # in the middle of whatever was using the card.
  if apt-mark showhold | grep -qx "$driver"; then
    skip "$driver is already held"
  else
    step "Holding $driver against automatic upgrades"
    sudo apt-mark hold "$driver"
  fi

  # Fails until the machine has rebooted into a kernel the module was built for,
  # which is expected on a first run and not worth aborting over.
  sudo modprobe nvidia 2>/dev/null ||
    note "The module isn't loaded yet; it will be after a reboot."
}

install_cuda() {
  install_cuda_keyring
  apt_install "$CUDA_PACKAGE"
  configure_cuda_path
}

# ~/.zshrc.local is where machine-specific, non-secret settings go — the corellia
# loader sources it last, and it isn't in the repo. The old version of this
# appended an *unquoted* heredoc to ~/.zshrc, which expanded $PATH at write time
# and froze whatever it happened to be into the file.
cuda_path_block() {
  cat <<'EOF'
# >>> corellia cuda >>>
# Added by setup-linux-gpu.sh. nvcc and the CUDA libraries.
if [ -d /usr/local/cuda/bin ]; then
  export PATH="/usr/local/cuda/bin:$PATH"
  export LD_LIBRARY_PATH="/usr/local/cuda/lib64:${LD_LIBRARY_PATH:-}"
fi
# <<< corellia cuda <<<
EOF
}

configure_cuda_path() {
  if ensure_block "$HOME/.zshrc.local" '>>> corellia cuda >>>' "$(cuda_path_block)"; then
    step "Added the CUDA paths to ~/.zshrc.local"
  else
    skip "CUDA paths already in ~/.zshrc.local"
  fi
}

# --- docker -----------------------------------------------------------------

install_docker() {
  if [ -n "$SKIP_DOCKER" ]; then
    skip "--skip-docker given"
    return
  fi

  apt_install ca-certificates curl gnupg

  local flavour codename
  case "$(os_release ID)" in
    debian) flavour=debian ;;
    *) flavour=ubuntu ;;
  esac

  # Derivatives (Mint, Pop, and friends) carry their own VERSION_CODENAME and
  # name the upstream release in UBUNTU_CODENAME, which is the one Docker builds
  # for. Take that when it's there.
  codename="$(os_release UBUNTU_CODENAME)"
  [ -n "$codename" ] || codename="$(os_release VERSION_CODENAME)"
  [ -n "$codename" ] || die "could not work out the release codename for docker's repository"

  apt_repo docker \
    "https://download.docker.com/linux/$flavour/gpg" \
    "deb [arch=$(deb_arch) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$flavour $codename stable"

  apt_install docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  add_user_to_docker_group
}

# Group membership only takes effect in a new login session. The old version of
# this ran `newgrp docker` to pick it up immediately — which forks a *subshell*,
# so every line of setup after it silently never ran.
add_user_to_docker_group() {
  local user
  user="$(id -un)"

  if id -nG "$user" | tr ' ' '\n' | grep -qx docker; then
    skip "$user is already in the docker group"
    return
  fi

  step "Adding $user to the docker group"
  sudo usermod -aG docker "$user"
  note "Log out and back in before docker works without sudo."
}

install_container_toolkit() {
  if [ -n "$SKIP_DOCKER" ]; then
    skip "--skip-docker given"
    return
  fi

  # nvidia-docker2 and the nvidia-docker wrapper this used to install were
  # retired in 2023; nvidia-container-toolkit is the supported replacement.
  apt_repo nvidia-container-toolkit \
    https://nvidia.github.io/libnvidia-container/gpgkey \
    "deb [signed-by=/etc/apt/keyrings/nvidia-container-toolkit.gpg] https://nvidia.github.io/libnvidia-container/stable/deb/\$(ARCH) /"

  apt_install nvidia-container-toolkit

  step "Configuring docker's nvidia runtime"
  sudo nvidia-ctk runtime configure --runtime=docker

  if have systemctl; then
    sudo systemctl restart docker
  else
    note "No systemd here; restart the docker daemon yourself."
  fi
}

# --- main -------------------------------------------------------------------

main() {
  require_linux
  parse_args "$@"

  have apt-get || die "no apt-get found; this script targets Debian and Ubuntu"
  detect_wsl

  log "Driver"
  install_driver

  log "CUDA"
  install_cuda

  log "Docker"
  install_docker
  install_container_toolkit

  cat <<'EOF'

Done. A driver install needs a reboot before the module loads, and the docker
group needs a new login session, so check these afterwards rather than now:

  nvidia-smi
  nvcc --version
  docker run --rm --gpus all ubuntu nvidia-smi

The CUDA paths went into ~/.zshrc.local, which the corellia loader sources last.
EOF
}

main "$@"
