#!/bin/bash

set -euo pipefail

# Fail if ~/.scripts already exists.
if [ -d "$HOME/.scripts" ]; then
  # Check if it's a symlink and announce it's already installed.
  if [ -L "$HOME/.scripts" ]; then
    echo "~/.scripts symlink already installed, exiting."
    exit 0
  # Check if it's empty and delete it if so.
  elif [ -z "$(ls -A $HOME/.scripts)" ]; then
    rmdir "$HOME/.scripts"
  else
    echo "Error: ~/.scripts already exists with real files."
    exit 1
  fi
fi

# Alias ~/.scripts to this global bin directory.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ln -s "$SCRIPT_DIR/bin" "$HOME/.scripts"
echo "Installed ~/.scripts symlink to ./src/scripts/global/bin!"
