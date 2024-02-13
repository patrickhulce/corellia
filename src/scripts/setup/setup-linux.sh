#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

set -euo pipefail

sudo apt-get update
sudo apt-get install -y git curl openssh-server gcc net-tools ubuntu-drivers-common

# Install Git LFS
# From https://github.com/git-lfs/git-lfs/blob/main/INSTALLING.md
curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs
git lfs install

# Install NVIDIA drivers and CUDA
NVIDIA_DRIVER_VERSION=$(sudo ubuntu-drivers list | sort | grep -v open | grep -v server | tail -n 1 | cut -d"," -f1)
sudo apt-get install -y "${NVIDIA_DRIVER_VERSION}"
# From https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=Ubuntu&target_version=22.04&target_type=deb_network
cd /tmp
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update
sudo apt-get -y install cuda-toolkit-12-3
cd "${SCRIPT_DIR}"
nvcc --version

# From https://docs.conda.io/projects/conda/en/latest/user-guide/install/linux.html
mkdir -p ~/code/miniconda3
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/code/miniconda3/miniconda.sh
bash ~/code/miniconda3/miniconda.sh -b -u -p ~/code/miniconda3
rm -rf ~/code/miniconda3/miniconda.sh

~/code/miniconda3/bin/conda init "$(basename "${SHELL}")" # Setup in your shell
~/code/miniconda3/bin/conda config --set auto_activate_base false # Don't activate by default

# Setup SSH
sudo sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config
sudo systemctl restart sshd