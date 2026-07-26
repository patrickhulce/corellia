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
CORELLIA_REPO="https://github.com/patrickhulce/corellia.git"
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
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"

mkdir -p "$ZSH_DIR" "$(dirname "$GHOSTTY_CONFIG")"

# newt may have symlinked vendored zsh files here earlier; curl -o cannot replace
# a symlink pointing at a read-only checkout (curl error 23).
write_download() {
  local dest="$1"
  local url="$2"
  rm -f "$dest"
  curl -fsSL --max-time 30 -o "$dest" "$url"
}

curl_failures=0
for name in "${ZSH_FILES[@]}"; do
  if write_download "$ZSH_DIR/$name" "$RAW_BASE/zsh/$name"; then
    step "Wrote $ZSH_DIR/$name"
  else
    warn "could not download $RAW_BASE/zsh/$name"
    curl_failures=$((curl_failures + 1))
  fi
done

if write_download "$GHOSTTY_CONFIG" "$RAW_BASE/ghostty/config"; then
  step "Wrote $GHOSTTY_CONFIG"
else
  warn "could not download $RAW_BASE/ghostty/config"
  curl_failures=$((curl_failures + 1))
fi

# curl can fail intermittently in locked-down environments; git sparse clone is
# the fallback (same repo, different transport).
if [ "$curl_failures" -gt 0 ]; then
  if ! command -v git >/dev/null 2>&1; then
    die "$curl_failures file(s) could not be downloaded and git is not available"
  fi

  warn "$curl_failures file(s) missing after curl; trying a sparse git clone"
  tmp="$(mktemp -d)"
  if git clone --depth=1 --filter=blob:none --sparse "$CORELLIA_REPO" "$tmp" &&
    git -C "$tmp" sparse-checkout set src/conf/zsh src/conf/ghostty; then
    for name in "${ZSH_FILES[@]}"; do
      if [ ! -s "$ZSH_DIR/$name" ] && [ -f "$tmp/src/conf/zsh/$name" ]; then
        rm -f "$ZSH_DIR/$name"
        cp "$tmp/src/conf/zsh/$name" "$ZSH_DIR/$name"
        step "Copied $ZSH_DIR/$name from git checkout"
      fi
    done
    if [ ! -s "$GHOSTTY_CONFIG" ] && [ -f "$tmp/src/conf/ghostty/config" ]; then
      rm -f "$GHOSTTY_CONFIG"
      cp "$tmp/src/conf/ghostty/config" "$GHOSTTY_CONFIG"
      step "Copied $GHOSTTY_CONFIG from git checkout"
    fi
  else
    warn "sparse git clone failed"
  fi
  rm -rf "$tmp"
fi

missing=0
for name in "${ZSH_FILES[@]}"; do
  if [ ! -s "$ZSH_DIR/$name" ]; then
    warn "missing $ZSH_DIR/$name"
    missing=$((missing + 1))
  fi
done
if [ ! -s "$GHOSTTY_CONFIG" ]; then
  warn "missing $GHOSTTY_CONFIG"
  missing=$((missing + 1))
fi

if [ "$missing" -gt 0 ]; then
  die "$missing required file(s) still missing after curl and git fallback"
fi

printf '\nDone. Open a new shell, or run:\n\n  for f in %s/*.zsh; do . "$f"; done\n' "$ZSH_DIR"
