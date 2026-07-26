#!/usr/bin/env bash
#
# Installs the corellia starship prompt on a machine that isn't this Mac — a work
# laptop, or a box you only reach over ssh.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-starship.sh)"
#
# Leaves ~/.config/starship and a loader block in ~/.zshrc and ~/.bashrc, and
# nothing afterwards needs this repo. Safe to re-run; re-running is how you pick
# up a change.
#
# Always fetches over the network, even from a checkout, because it usually runs
# as the curl one-liner above with no checkout to read from. For the same reason
# it can't source lib/common.sh, hence the two helpers below.

set -euo pipefail

RAW_BASE="https://raw.githubusercontent.com/patrickhulce/corellia/main/src/conf/starship"
CONFIG_DIR="$HOME/.config/starship"

step() { printf '\033[1;32m  +\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"

if command -v starship >/dev/null 2>&1; then
  printf '    starship already installed (%s)\n' "$(command -v starship)"
else
  step "Installing starship to ~/.local/bin"
  mkdir -p "$HOME/.local/bin"
  curl -fsSL https://starship.rs/install.sh |
    sh -s -- --yes --bin-dir "$HOME/.local/bin" || die "starship install failed"
fi

mkdir -p "$CONFIG_DIR"
for name in starship.toml init.sh; do
  curl -fsSL -o "$CONFIG_DIR/$name" "$RAW_BASE/$name" ||
    die "could not download $RAW_BASE/$name"
  step "Wrote $CONFIG_DIR/$name"
done

# Quoted delimiter: $HOME and $PATH must reach the file unexpanded. A function
# rather than a heredoc inside the "$( )" below, because bash 3.2 scans a heredoc
# nested in a command substitution for quotes instead of taking it literally.
# See src/docs/setup/mac-setup.md#shell-compatibility.
loader_block() {
  cat <<'EOF'
# >>> corellia starship >>>
# Prompt configuration. Edit ~/.config/starship/starship.toml, not this block.
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) PATH="$HOME/.local/bin:$PATH" ;;
esac
export PATH
if [ -r "$HOME/.config/starship/init.sh" ]; then
  . "$HOME/.config/starship/init.sh"
fi
# <<< corellia starship <<<
EOF
}

# Both files, because which one a machine reads depends on its login shell. The
# block is POSIX and works in either.
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  if [ -f "$rc" ] && grep -qF '>>> corellia starship >>>' "$rc"; then
    printf '    loader already in %s\n' "$rc"
  else
    printf '\n%s\n' "$(loader_block)" >>"$rc"
    step "Added the loader to $rc"
  fi
done

printf '\nDone. Open a new shell, or run:\n\n  . %s/init.sh\n' "$CONFIG_DIR"
