#!/usr/bin/env bash
#
# Installs corellia shell config on a machine without a checkout — work laptop,
# Netflix workspace, or any box you only reach over ssh.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-zsh-config.sh)"
#
# Writes ~/.config/zsh/*.zsh and ~/.config/ghostty/config. Safe to re-run;
# re-running is how you pick up a change.
#
# Always fetches over the network. Cannot source lib/common.sh for the same
# reason as setup-starship.sh.

set -euo pipefail

RAW_BASE="https://raw.githubusercontent.com/patrickhulce/corellia/main/src/conf"
ZSH_DIR="$HOME/.config/zsh"
GHOSTTY_CONFIG="$HOME/.config/ghostty/config"

# Keep in sync with src/conf/zsh/*.zsh (excluding README.md).
ZSH_FILES=(
  00-homebrew.zsh
  05-oh-my-zsh.zsh
  10-path.zsh
  20-tools.zsh
  21-term.zsh
  22-python-venv.zsh
  23-ghostty-ssh-title.zsh
  25-keybindings.zsh
  30-aliases.zsh
)

step() { printf '\033[1;32m  +\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"

mkdir -p "$ZSH_DIR" "$(dirname "$GHOSTTY_CONFIG")"

for name in "${ZSH_FILES[@]}"; do
  curl -fsSL -o "$ZSH_DIR/$name" "$RAW_BASE/zsh/$name" ||
    die "could not download $RAW_BASE/zsh/$name"
  step "Wrote $ZSH_DIR/$name"
done

curl -fsSL -o "$GHOSTTY_CONFIG" "$RAW_BASE/ghostty/config" ||
  die "could not download $RAW_BASE/ghostty/config"
step "Wrote $GHOSTTY_CONFIG"

printf '\nDone. Open a new shell, or run:\n\n  for f in %s/*.zsh; do . "$f"; done\n' "$ZSH_DIR"
