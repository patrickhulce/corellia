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
  brew_bundle "$CORELLIA_CONF_DIR/Brewfile"

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
#
# A function rather than a heredoc inside the "$( )" below, because bash 3.2 —
# the only bash a fresh Mac has — scans a heredoc body nested in a command
# substitution for quote characters instead of taking it literally. The
# apostrophe in "zsh's" below is enough to swallow the rest of the file and fail
# the whole script at parse time.
# See src/docs/setup/mac-setup.md#shell-compatibility.
zshrc_loader_block() {
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
}

link_shell_config() {
  if ensure_block "$HOME/.zshrc" '>>> corellia >>>' "$(zshrc_loader_block)"; then
    step "Added the corellia loader to ~/.zshrc"
  else
    skip "corellia loader already in ~/.zshrc"
  fi

  link_config "$CORELLIA_CONF_DIR/ghostty/config" "$HOME/.config/ghostty/config"
  link_config "$CORELLIA_CONF_DIR/direnv/direnv.toml" "$HOME/.config/direnv/direnv.toml"
  link_config "$CORELLIA_CONF_DIR/tmux/tmux.conf" "$HOME/.tmux.conf"
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
    note "This one needs sudo, so it may ask for your password."
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
    step "Generating an ed25519 key"
    note "It asks for a passphrase. Choose one; the Keychain remembers it."
    ssh-keygen -t ed25519 -C "$GIT_EMAIL ($(machine_name))" -f "$SSH_KEY"
  fi

  configure_ssh_defaults
  trust_github_host_key
  load_ssh_key
  upload_ssh_key
}

# A catch-all appended after any existing Host blocks, which is the right place
# for it: ssh takes the first value it finds for most keywords, so anything more
# specific already in the file still wins.
#
# A function for the same reason as zshrc_loader_block above: a heredoc nested in
# a command substitution is a bash 3.2 parse error waiting for someone to write
# an apostrophe in it.
ssh_config_block() {
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
}

configure_ssh_defaults() {
  if ensure_block "$HOME/.ssh/config" '>>> corellia >>>' "$(ssh_config_block)"; then
    step "Wrote ssh defaults to ~/.ssh/config"
  else
    skip "ssh defaults already in ~/.ssh/config"
  fi
  chmod 600 "$HOME/.ssh/config"
}

# GitHub's published ed25519 host key fingerprint:
# https://docs.github.com/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
GITHUB_HOST_KEY="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"
GITHUB_KNOWN_HOSTS="$HOME/.ssh/known_hosts"

# Without this the first clone stops on "The authenticity of host 'github.com'
# can't be established", in the middle of the stretch where nothing else needs
# you. Checking what ssh-keyscan returns against the fingerprint GitHub
# publishes also makes it a better decision than the prompt, which most people
# answer "yes" to without comparing anything.
trust_github_host_key() {
  if [ -f "$GITHUB_KNOWN_HOSTS" ] &&
    ssh-keygen -F github.com -f "$GITHUB_KNOWN_HOSTS" >/dev/null 2>&1; then
    skip "github.com already in ~/.ssh/known_hosts"
    return
  fi

  local scanned fingerprint
  if ! scanned="$(ssh-keyscan -t ed25519 github.com 2>/dev/null)" || [ -z "$scanned" ]; then
    warn "could not reach github.com for its host key; the first clone will ask"
    return
  fi

  if ! fingerprint="$(printf '%s\n' "$scanned" | ssh-keygen -lf - | awk '{print $2}')" ||
    [ "$fingerprint" != "$GITHUB_HOST_KEY" ]; then
    warn "github.com offered an unrecognised host key ($fingerprint); not trusting it"
    return
  fi

  printf '%s\n' "$scanned" >>"$GITHUB_KNOWN_HOSTS"
  step "Added the github.com host key to ~/.ssh/known_hosts"
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

# The base64 key material, without the type or comment around it. This is what
# `gh ssh-key list` prints, and the fingerprint is not, so comparing fingerprints
# never matched and every run tried to re-add a key that was already there.
key_body() {
  awk '{print $2}' "$SSH_KEY.pub"
}

# Uploading a key needs a scope the default login doesn't request.
GH_KEY_SCOPE="admin:public_key"

# Closes the old "TODO: figure out how to add this to GitHub" comment.
upload_ssh_key() {
  if ! have gh; then
    warn "gh is not installed; add $SSH_KEY.pub to GitHub yourself"
    return
  fi

  # Explicitly zero: a sign-in you skipped or abandoned has already warned, and
  # is not a reason to take the phases after this one down with it.
  sign_in_to_github || return 0

  if gh ssh-key list 2>/dev/null | grep -qF "$(key_body)"; then
    skip "public key already on GitHub"
    return
  fi

  step "Adding the public key to GitHub"
  gh ssh-key add "$SSH_KEY.pub" --title "$(machine_name)" ||
    warn "could not add the key automatically; add it at https://github.com/settings/keys"
}

# Nothing that can prompt may be redirected here. Both commands below stop and
# ask you to copy a one-time code, and one of them used to run with its output
# on /dev/null: from the outside that is indistinguishable from a hung script,
# and it is exactly where this setup appeared to freeze. `gh auth status` is the
# exception, since it only reports.
sign_in_to_github() {
  if ! gh auth status >/dev/null 2>&1; then
    step "Signing in to GitHub"
    note "gh prints a one-time code, then opens your browser. It waits for you."
    # --skip-ssh-key: the upload happens below, with a title naming the machine.
    gh auth login --hostname github.com --git-protocol ssh \
      --scopes "$GH_KEY_SCOPE" --skip-ssh-key || {
      warn "GitHub sign-in did not complete; re-run this script once it has"
      return 1
    }
    return 0
  fi

  # An older login won't have the scope, since it wasn't asked for until now.
  if gh auth status 2>&1 | grep -q "$GH_KEY_SCOPE"; then
    skip "already signed in to GitHub"
    return 0
  fi

  step "Granting gh the $GH_KEY_SCOPE scope"
  note "gh prints a one-time code, then opens your browser. It waits for you."
  gh auth refresh --hostname github.com --scopes "$GH_KEY_SCOPE" || {
    warn "could not grant $GH_KEY_SCOPE; add the key at https://github.com/settings/keys"
    return 1
  }
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

# --- fonts ------------------------------------------------------------------

FONT_DIR="$HOME/Library/Fonts"
DAFONT_URL="https://dl.dafont.com/dl/?f="

# The personal fonts with no Homebrew cask. BonheurRoyale and BrunoAce are on
# Google Fonts and come from src/conf/Brewfile instead; these three are fetched
# at setup time rather than committed, since none of them is redistributable.
#
# Columns: name, dafont slug, zip members to install, glob meaning "already here".
#
# The member pattern is the part that earns its keep. dafont's Star Jedi archive
# carries eight faces across four directories and only the base one is wanted,
# and the Aurebesh and Handodle archives bundle a licence file and a PDF next to
# the fonts.
FONTS="\
Aurebesh|aurebesh|*.otf|Aurebesh.otf
Star Jedi|star_jedi|*Starjedi.ttf|Starjedi.ttf
Handodle|handodle|*.ttf|Handodle*.ttf"

install_fonts() {
  mkdir -p "$FONT_DIR"

  local name slug members probe
  while IFS='|' read -r name slug members probe; do
    [ -n "$name" ] || continue

    if compgen -G "$FONT_DIR/$probe" >/dev/null; then
      skip "$name already installed"
      continue
    fi

    install_font "$name" "$slug" "$members"
  done <<EOF
$FONTS
EOF
}

# Split out so the temp directory is removed on every path out, a failed
# download included. A font that can't be fetched warns rather than aborting:
# dafont is a third party, and a dead link there shouldn't stop the setup.
install_font() {
  local name="$1"
  local slug="$2"
  local members="$3"

  local tmp
  tmp="$(mktemp -d)"

  if ! curl -fsSL --max-time 60 -o "$tmp/font.zip" "$DAFONT_URL$slug"; then
    warn "could not download $name from dafont; install it by hand"
  elif ! unzip -qql "$tmp/font.zip" >/dev/null 2>&1; then
    # A slug dafont doesn't know answers with an HTML page and a 200, so a
    # renamed font arrives as a successful download of something that is not an
    # archive. Checked separately, or it would be reported as an empty archive.
    warn "$DAFONT_URL$slug did not return a zip; check the font's page on dafont"
  elif ! unzip -joq "$tmp/font.zip" "$members" -d "$FONT_DIR" >/dev/null 2>&1; then
    warn "no files matching $members in the $name archive; install it by hand"
  else
    step "Installed $name"
  fi

  rm -rf "$tmp"
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

  log "Fonts"
  install_fonts

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
