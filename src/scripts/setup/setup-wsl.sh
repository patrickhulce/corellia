#!/usr/bin/env bash
#
# The GPU stack under WSL. Safe to re-run.
#
#   ./src/scripts/setup/setup-wsl.sh [--skip-docker]
#
# A wrapper rather than a script of its own. WSL needs the same CUDA toolkit,
# Docker, and container toolkit as any other GPU box, differing only in that the
# card belongs to Windows — its driver is projected into the guest at
# /usr/lib/wsl/lib, so no Linux driver is installed, and CUDA comes from
# NVIDIA's wsl-ubuntu repository instead of the one named for the release.
#
# That was a second copy of the same apt-repository dance for years, and it
# drifted on its own schedule: it was still using `apt-key`, retired in 22.04,
# to install `nvidia-docker2`, replaced in 2023. One implementation with a flag
# is what stops that happening again.
#
# setup-linux-gpu.sh detects WSL on its own, so this exists as the name to reach
# for rather than as something you have to run. Run setup-linux.sh first for the
# shell and tooling.

set -euo pipefail

exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-linux-gpu.sh" --wsl "$@"
