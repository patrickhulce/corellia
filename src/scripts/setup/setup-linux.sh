#!/bin/bash

set -euo pipefail

HOSTNAME="LokiLinux"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

hostnamectl set-hostname "$HOSTNAME"

sudo apt-get update
sudo apt-get install -y dkms build-essential linux-headers-$(uname -r)
sudo apt-get install -y git curl openssh-server gcc net-tools ubuntu-drivers-common v4l-utils hardinfo zsh direnv unzip pipx

git config --global user.name "Patrick Hulce"
git config --global user.email "patrick.hulce@gmail.com"

# Install Git LFS
# From https://github.com/git-lfs/git-lfs/blob/main/INSTALLING.md
curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs
git lfs install

# Install NVIDIA drivers and CUDA
sudo add-apt-repository ppa:graphics-drivers/ppa
sudo apt update
NVIDIA_DRIVER_VERSION=$(sudo ubuntu-drivers list | sort | grep -v open | grep -v server | tail -n 1 | cut -d"," -f1)
sudo apt-get install -y "${NVIDIA_DRIVER_VERSION}"
sudo modprobe nvidia
lsmod | grep nvidia

# Make sure they don't get autoupdated and kill your NVML config.
sudo apt-mark hold "${NVIDIA_DRIVER_VERSION}"

# From https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=Ubuntu&target_version=22.04&target_type=deb_network
cd /tmp
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update
sudo apt-get -y install nvidia-cuda-toolkit cuda-toolkit-12-3
cd "${SCRIPT_DIR}"
nvcc --version

## START DOCKER SETUP ##
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
sudo usermod -aG docker ${USER}
newgrp docker

docker run hello-world
docker run --rm --gpus all nvidia/cuda:12.3.1-devel-ubuntu22.04 nvidia-smi
## END DOCKER SETUP ##

# Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# From https://docs.conda.io/projects/conda/en/latest/user-guide/install/linux.html
mkdir -p ~/code/miniconda3
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/code/miniconda3/miniconda.sh
bash ~/code/miniconda3/miniconda.sh -b -u -p ~/code/miniconda3
rm -rf ~/code/miniconda3/miniconda.sh

~/code/miniconda3/bin/conda init "$(basename "${SHELL}")" # Setup in your shell
~/code/miniconda3/bin/conda config --set auto_activate_base false # Don't activate by default
# Ensure pipx works
pipx ensurepath

# Setup SSH
sudo sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config
sudo sed -i 's/#PubkeyAuthentication/PubkeyAuthentication/' /etc/ssh/sshd_config
sudo sed -i 's/#AuthorizedKeysFile/AuthorizedKeysFile/' /etc/ssh/sshd_config
sudo systemctl restart sshd
sudo ufw allow ssh

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# shellcheck source=/dev/null
source ~/.zshrc
