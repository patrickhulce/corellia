#!/usr/bin/env bash
#
# Phase 2 of the macOS setup: packages, shell config, git, identity, and repos.
# Assumes setup-zsh.sh has already run. Safe to re-run.
#
#   ./src/scripts/setup/setup-macos.sh [--skip-managed]

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

GIT_NAME="${CORELLIA_GIT_NAME:-Patrick Hulce}"
GIT_EMAIL="${CORELLIA_GIT_EMAIL:-patrick.hulce@gmail.com}"

SSH_KEY="$HOME/.ssh/id_ed25519"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs Homebrew packages, links shell and git configuration, sets up SSH
identity, and clones the personal repositories.

Options:
$(common_flags_help)
$(managed_flags_help)

Git identity comes from CORELLIA_GIT_NAME and CORELLIA_GIT_EMAIL, defaulting to
"$GIT_NAME" <$GIT_EMAIL>.
EOF
}

# --- packages ---------------------------------------------------------------

install_packages() {
  have brew || die "Homebrew is missing; run setup-zsh.sh first"

  step "Installing packages from src/conf/Brewfile"
  brew bundle install --file "$CORELLIA_CONF_DIR/Brewfile" --no-upgrade

  # Delegated so the same detection and flags apply whether this runs as part of
  # the phase or on its own. The child reads the decision from the environment.
  export CORELLIA_SKIP_MANAGED
  bash "$CORELLIA_SETUP_DIR/setup-managed-apps.sh"
}

# --- shell ------------------------------------------------------------------

# One loader block in ~/.zshrc that sources the versioned config in the repo.
# The old approach appended settings directly, which duplicated itself on every
# re-run and left the real configuration untracked.
#
# The block stays valid in bash as well as zsh: POSIX `.` rather than the `source`
# builtin, no glob qualifiers, no arrays. See src/conf/zsh/README.md.
link_shell_config() {
  local block
  block="$(
    cat <<EOF
# >>> corellia >>>
# Shell config lives in the repo. Edit src/conf/zsh/*.zsh, not this block.
#
# Deliberately bash-compatible, so the same block works from ~/.bashrc: POSIX
# \`.\` instead of zsh's \`source\`, and no glob qualifiers or arrays.
export CORELLIA_HOME="$CORELLIA_ROOT"
# Guarding on the directory keeps a shell starting cleanly if the repo moves.
# zsh would otherwise abort the loop with "no matches found" on every prompt,
# which is what the (N) qualifier used to handle at the cost of portability.
if [ -d "\$CORELLIA_HOME/src/conf/zsh" ]; then
  for _corellia_rc in "\$CORELLIA_HOME"/src/conf/zsh/*.zsh; do
    [ -r "\$_corellia_rc" ] && . "\$_corellia_rc"
  done
  unset _corellia_rc
fi
# Machine-specific, non-secret overrides.
if [ -r "\$HOME/.zshrc.local" ]; then
  . "\$HOME/.zshrc.local"
fi
# <<< corellia <<<
EOF
  )"

  if ensure_block "$HOME/.zshrc" '>>> corellia >>>' "$block"; then
    step "Added the corellia loader to ~/.zshrc"
  else
    skip "corellia loader already in ~/.zshrc"
  fi

  link_config "$CORELLIA_CONF_DIR/ghostty/config" "$HOME/.config/ghostty/config"
  link_config "$CORELLIA_CONF_DIR/direnv/direnv.toml" "$HOME/.config/direnv/direnv.toml"
}

install_global_scripts() {
  # init.sh refuses to clobber a real ~/.scripts directory. That's a reason to
  # look, not a reason to abandon the rest of the setup.
  bash "$CORELLIA_ROOT/src/scripts/global/init.sh" ||
    warn "could not link ~/.scripts; resolve it and re-run"
}

# --- git --------------------------------------------------------------------

configure_git() {
  step "Configuring git"
  git config --global user.name "$GIT_NAME"
  git config --global user.email "$GIT_EMAIL"
  git config --global init.defaultBranch main

  # delta replaces diff-so-fancy: a Homebrew formula rather than a global npm
  # package, so git works before Node is installed.
  git config --global core.pager delta
  git config --global interactive.diffFilter 'delta --color-only'
  git config --global delta.navigate true
  git config --global merge.conflictStyle zdiff3

  link_config "$CORELLIA_CONF_DIR/gitignore" "$HOME/.gitignore"
  git config --global core.excludesfile "$HOME/.gitignore"

  if git config --system --get filter.lfs.clean >/dev/null 2>&1; then
    skip "git-lfs already installed system-wide"
  else
    step "Installing git-lfs system-wide"
    sudo git lfs install --system
  fi
}

# --- identity ---------------------------------------------------------------

machine_name() {
  scutil --get ComputerName 2>/dev/null || hostname -s
}

# An ordinary on-disk ed25519 key. ssh-agent holds it for the session and the
# login Keychain remembers the passphrase, so this is a one-time prompt. 1Password
# is for secrets (see mac-setup.md#secrets), not for ssh.
configure_ssh() {
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"

  if [ -f "$SSH_KEY" ]; then
    skip "$SSH_KEY already exists"
  else
    step "Generating an ed25519 key (choose a passphrase; the Keychain stores it)"
    ssh-keygen -t ed25519 -C "$GIT_EMAIL ($(machine_name))" -f "$SSH_KEY"
  fi

  configure_ssh_defaults
  load_ssh_key
  upload_ssh_key
}

# A catch-all appended after any existing Host blocks, which is the right place
# for it: ssh takes the first value it finds for most keywords, so anything more
# specific already in the file still wins.
configure_ssh_defaults() {
  local block
  block="$(
    cat <<EOF
# >>> corellia >>>
Host *
  # Load the key into the agent on first use, and let the Keychain answer the
  # passphrase prompt so it survives reboots.
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile $SSH_KEY
# <<< corellia <<<
EOF
  )"

  if ensure_block "$HOME/.ssh/config" '>>> corellia >>>' "$block"; then
    step "Wrote ssh defaults to ~/.ssh/config"
  else
    skip "ssh defaults already in ~/.ssh/config"
  fi
  chmod 600 "$HOME/.ssh/config"
}

load_ssh_key() {
  local fingerprint
  fingerprint="$(key_fingerprint)"

  if ssh-add -l 2>/dev/null | grep -qF "$fingerprint"; then
    skip "key already loaded in ssh-agent"
    return
  fi

  step "Adding the key to ssh-agent"
  ssh-add --apple-use-keychain "$SSH_KEY" ||
    warn "could not add the key to the agent; run 'ssh-add --apple-use-keychain $SSH_KEY'"
}

key_fingerprint() {
  ssh-keygen -lf "$SSH_KEY.pub" | awk '{print $2}'
}

# Closes the old "TODO: figure out how to add this to GitHub" comment.
upload_ssh_key() {
  if ! have gh; then
    warn "gh is not installed; add $SSH_KEY.pub to GitHub yourself"
    return
  fi

  if gh auth status >/dev/null 2>&1; then
    skip "already signed in to GitHub"
  else
    step "Signing in to GitHub"
    gh auth login || {
      warn "GitHub sign-in did not complete; re-run this script once it has"
      return
    }
  fi

  # Adding a key needs a scope the default login doesn't request.
  gh auth refresh -h github.com -s admin:public_key >/dev/null 2>&1 || true

  if gh ssh-key list 2>/dev/null | grep -qF "$(key_fingerprint)"; then
    skip "public key already on GitHub"
    return
  fi

  step "Adding the public key to GitHub"
  gh ssh-key add "$SSH_KEY.pub" --title "$(machine_name)" ||
    warn "could not add the key automatically; add it at https://github.com/settings/keys"
}

# --- repositories -----------------------------------------------------------

clone_repo() {
  local url="$1"
  local dir="$2"

  if [ -d "$dir/.git" ]; then
    skip "$(basename "$dir") already cloned"
    return
  fi

  step "Cloning $(basename "$dir")"
  # Over SSH, so this is the first thing to fail if the agent or key isn't
  # working yet. Warn rather than aborting the phases that follow.
  git clone "$url" "$dir" ||
    warn "could not clone $url; check your SSH setup and re-run"
}

setup_code_directories() {
  mkdir -p "$HOME/Code/OpenSource" "$HOME/Code/Playgrounds"

  # setup-zsh.sh clones over HTTPS because no key exists yet. Now that one does,
  # switch to SSH so pushes don't prompt.
  if [ "$(git -C "$CORELLIA_ROOT" remote get-url origin 2>/dev/null)" = \
    "https://github.com/patrickhulce/corellia.git" ]; then
    step "Switching the corellia remote to SSH"
    git -C "$CORELLIA_ROOT" remote set-url origin git@github.com:patrickhulce/corellia.git
  fi

  clone_repo git@github.com:patrickhulce/blog.patrickhulce.com.git \
    "$HOME/Code/OpenSource/blog.patrickhulce.com"

  # setup-languages.sh runs the installer out of this checkout, so the skills can
  # be edited and reinstalled without a round trip through GitHub.
  clone_repo git@github.com:patrickhulce/skillz.git "$HOME/Code/OpenSource/skillz"
}

# --- macOS quirks -----------------------------------------------------------

fix_home_end_keys() {
  link_config "$CORELLIA_CONF_DIR/DefaultKeyBinding.dict" \
    "$HOME/Library/KeyBindings/DefaultKeyBinding.dict"
}

# Epson's scanner software installs two login agents that show a menu bar icon
# and notifications nobody asked for.
# https://stevenwestmoreland.com/2020/07/how-to-remove-the-epson-scansmart-icon-from-the-macos-menu-bar.html
silence_epson_agents() {
  if [ ! -d "/Applications/Epson Software" ]; then
    skip "Epson software not installed"
    return
  fi

  step "Disabling the Epson menu bar agents"
  local uid
  uid="$(id -u)"
  launchctl disable "gui/$uid/com.epson.scannermonitor" 2>/dev/null || true
  launchctl disable "gui/$uid/com.epson.eventmanager.agent" 2>/dev/null || true
}

# --- main -------------------------------------------------------------------

main() {
  require_macos
  parse_common_flags "$@"

  log "Checkout"
  ensure_sparse_paths

  log "Packages"
  install_packages

  log "Shell configuration"
  link_shell_config
  install_global_scripts

  log "Git"
  configure_git

  log "SSH identity"
  configure_ssh

  log "Repositories"
  setup_code_directories

  log "macOS quirks"
  fix_home_end_keys
  silence_epson_agents

  cat <<'EOF'

Phase 2 complete. Remaining steps:

  ./src/scripts/setup/setup-macos-defaults.sh --name <this-machine>
  ./src/scripts/setup/setup-languages.sh

Then, when you need them:

  gcloud auth application-default login   # short-lived creds, no JSON key on disk
  op signin                               # after Settings > Developer in the app

Per-project configuration goes in an .envrc, picked up by direnv. Real secrets
stay in 1Password and reach the one process that needs them through `op run`,
rather than being exported from ~/.zshrc. See src/docs/setup/mac-setup.md#secrets.
EOF
}

main "$@"
