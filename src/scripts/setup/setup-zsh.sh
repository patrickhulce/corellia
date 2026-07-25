#!/usr/bin/env bash
#
# Phase 1 of the macOS setup: everything needed before this repo exists on disk.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-zsh.sh)"
#
# Installs the Xcode command line tools, Rosetta, Touch ID for sudo, Homebrew,
# oh-my-zsh, and Ghostty, then clones corellia so the remaining phases can run
# from the checkout. Safe to re-run.
#
# This script deliberately duplicates the small helpers from lib/common.sh: it is
# fetched over curl and runs before the repo has been cloned, so it cannot source
# anything from disk.

set -euo pipefail

CORELLIA_REPO="https://github.com/patrickhulce/corellia.git"
# A dedicated setup checkout, deliberately not ~/Code/OpenSource/corellia: this
# one is sparse and shallow, and it has to stay on disk forever because ~/.zshrc
# sources its shell config and ~/.config symlinks point into it. That leaves the
# usual Code path free for a full clone when you want to work on the monorepo.
CORELLIA_DIR="$HOME/.corellia"
# Repo-relative, because it's read with `git show` before a working tree exists.
SPARSE_PATHS_FILE="src/scripts/setup/sparse-paths"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
step() { printf '\033[1;32m  +\033[0m %s\n' "$*"; }
skip() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }

die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

install_xcode_tools() {
  if xcode-select -p >/dev/null 2>&1; then
    skip "Xcode command line tools already installed"
    return
  fi

  step "Installing Xcode command line tools"
  xcode-select --install >/dev/null 2>&1 || true

  # The installer is a separate GUI process, so poll rather than assuming the
  # command above blocked.
  echo "    Complete the installer dialog; waiting for it to finish..."
  until xcode-select -p >/dev/null 2>&1; do
    sleep 10
  done
  step "Xcode command line tools installed"
}

install_rosetta() {
  if [ "$(uname -m)" != "arm64" ]; then
    skip "Not Apple Silicon, skipping Rosetta"
    return
  fi

  if [ -d /Library/Apple/usr/share/rosetta ]; then
    skip "Rosetta already installed"
    return
  fi

  step "Installing Rosetta"
  softwareupdate --install-rosetta --agree-to-license
}

# Touch ID for sudo. /etc/pam.d/sudo_local is the file Apple added for exactly
# this, and unlike edits to /etc/pam.d/sudo it survives OS updates.
enable_touch_id_sudo() {
  if [ -f /etc/pam.d/sudo_local ] && grep -q '^auth.*pam_tid.so' /etc/pam.d/sudo_local; then
    skip "Touch ID for sudo already enabled"
    return
  fi

  if [ ! -f /etc/pam.d/sudo_local.template ]; then
    warn "no /etc/pam.d/sudo_local.template; skipping Touch ID for sudo"
    return
  fi

  step "Enabling Touch ID for sudo"
  sed 's/^#auth/auth/' /etc/pam.d/sudo_local.template | sudo tee /etc/pam.d/sudo_local >/dev/null
}

# Homebrew, plus the PATH setup its installer only prints instructions for. On
# Apple Silicon nothing else in this script can find `brew` without it.
install_homebrew() {
  local brew_bin=""

  if [ -x /opt/homebrew/bin/brew ]; then
    brew_bin=/opt/homebrew/bin/brew
    skip "Homebrew already installed"
  elif [ -x /usr/local/bin/brew ]; then
    brew_bin=/usr/local/bin/brew
    skip "Homebrew already installed"
  else
    step "Installing Homebrew"
    NONINTERACTIVE=1 /bin/bash -c \
      "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [ -x /opt/homebrew/bin/brew ]; then
      brew_bin=/opt/homebrew/bin/brew
    elif [ -x /usr/local/bin/brew ]; then
      brew_bin=/usr/local/bin/brew
    else
      die "Homebrew install finished but brew is not where we expected it"
    fi
  fi

  eval "$("$brew_bin" shellenv)"

  if [ -f "$HOME/.zprofile" ] && grep -qF 'brew shellenv' "$HOME/.zprofile"; then
    skip "brew shellenv already in ~/.zprofile"
  else
    step "Adding brew shellenv to ~/.zprofile"
    # shellcheck disable=SC2016 # the $() must land in the file unexpanded
    printf '\neval "$(%s shellenv)"\n' "$brew_bin" >>"$HOME/.zprofile"
  fi
}

install_oh_my_zsh() {
  # --keep-zshrc is only honoured when a ~/.zshrc already exists; without one the
  # installer writes its template, theme and plugin list included. The versioned
  # config in src/conf/zsh owns all of that (05-oh-my-zsh.zsh sources oh-my-zsh
  # itself), so give the installer a file to keep.
  if [ ! -f "$HOME/.zshrc" ]; then
    step "Creating ~/.zshrc"
    printf '# Configuration lives in corellia, at src/conf/zsh/*.zsh.\n' >"$HOME/.zshrc"
  fi

  if [ -d "$HOME/.oh-my-zsh" ]; then
    skip "oh-my-zsh already installed"
    return
  fi

  # --unattended keeps it from replacing the shell and exiting out from under us.
  step "Installing oh-my-zsh"
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" \
    "" --unattended --keep-zshrc
}

# `brew install` on an already-present cask exits non-zero ("there is already an
# App at ..."), which would abort a re-run, so check first.
install_terminal() {
  step "Installing git, gh, and Ghostty"

  local formula
  for formula in git gh; do
    brew list --formula "$formula" >/dev/null 2>&1 || brew install --quiet --formula "$formula"
  done

  brew list --cask ghostty >/dev/null 2>&1 || brew install --quiet --cask ghostty
}

clone_corellia() {
  if [ -d "$CORELLIA_DIR/.git" ]; then
    skip "corellia already cloned at $CORELLIA_DIR"
    return
  fi

  # Shallow, blobless, and sparse. The monorepo is over 10G of side projects and
  # local scratch data; setup needs well under a megabyte of it.
  #
  # HTTPS on purpose: SSH keys don't exist yet. setup-macos.sh switches the
  # remote to SSH once identity is configured.
  step "Cloning corellia to $CORELLIA_DIR"
  mkdir -p "$(dirname "$CORELLIA_DIR")"
  git clone --depth=1 --filter=blob:none --sparse "$CORELLIA_REPO" "$CORELLIA_DIR"
  apply_sparse_paths
}

# Read from the object store rather than the working tree, because at this point
# there isn't one to speak of: --sparse checks out root-level files and nothing
# else, so src/ doesn't exist on disk yet. `git show` doesn't care — it resolves the
# path against the commit, and on a blobless clone fetches that one blob on demand.
#
# This is the whole reason the list can live next to the setup scripts instead of
# cluttering the repo root.
apply_sparse_paths() {
  local paths

  if ! paths="$(git -C "$CORELLIA_DIR" show "HEAD:$SPARSE_PATHS_FILE" 2>/dev/null)"; then
    warn "could not read $SPARSE_PATHS_FILE; checking out the whole repo instead"
    git -C "$CORELLIA_DIR" sparse-checkout disable
    return
  fi

  step "Limiting the checkout to the setup directories"
  printf '%s\n' "$paths" |
    grep -Ev '^[[:space:]]*(#|$)' |
    git -C "$CORELLIA_DIR" sparse-checkout set --stdin
}

main() {
  [ "$(uname -s)" = "Darwin" ] || die "this script only supports macOS"

  log "Prerequisites"
  install_xcode_tools
  install_rosetta
  enable_touch_id_sudo

  log "Homebrew"
  install_homebrew

  log "Shell and terminal"
  install_oh_my_zsh
  install_terminal

  log "Repository"
  clone_corellia

  cat <<EOF

Phase 1 complete.

Next, open Ghostty (so the rest runs in the terminal you'll actually use) and:

  cd $CORELLIA_DIR
  ./src/scripts/setup/bootstrap.sh --name <this-machine>

Add --skip-managed if this is a work machine and IT installs Cursor, Adobe,
Slack, and friends for you. See src/docs/setup/mac-setup.md for the details.

The checkout above is shallow and sparse, holding only src/conf, src/docs/setup,
and the scripts. To work on the rest of the monorepo, clone it properly:

  git clone git@github.com:patrickhulce/corellia.git ~/Code/OpenSource/corellia
EOF
}

main "$@"
