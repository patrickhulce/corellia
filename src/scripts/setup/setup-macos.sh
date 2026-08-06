#!/usr/bin/env bash
#
# Phase 2 of the macOS setup: packages, shell config, git, identity, and repos.
# Assumes setup-zsh.sh has already run. Safe to re-run.
#
#   ./src/scripts/setup/setup-macos.sh [--skip-managed]

set -euo pipefail

CORELLIA_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib"
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$CORELLIA_LIB_DIR/common.sh"
# shellcheck source-path=SCRIPTDIR source=lib/shell.sh
source "$CORELLIA_LIB_DIR/shell.sh"
# shellcheck source-path=SCRIPTDIR source=lib/git.sh
source "$CORELLIA_LIB_DIR/git.sh"
# shellcheck source-path=SCRIPTDIR source=lib/ssh.sh
source "$CORELLIA_LIB_DIR/ssh.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs Homebrew packages, links shell and git configuration, sets up SSH
identity, and clones the personal repositories.

Options:
$(common_flags_help)
$(managed_flags_help)

Git identity comes from CORELLIA_GIT_NAME and CORELLIA_GIT_EMAIL, defaulting to
"$CORELLIA_GIT_NAME" <$CORELLIA_GIT_EMAIL>.
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

# The loader block, direnv, tmux, and ~/.scripts are in lib/shell.sh, shared
# with the Linux setup. What's left is the config for the GUI applications, none
# of which a headless machine has any use for.
link_desktop_config() {
  link_config "$CORELLIA_CONF_DIR/ghostty/config" "$HOME/.config/ghostty/config"
  link_config "$CORELLIA_CONF_DIR/ghosttyctrl/templates" "$HOME/.config/ghosttyctrl/templates"

  # Copied, not linked: Zed writes to these files itself, and a link means it
  # writes into the repo. See src/conf/zed/README.md.
  copy_config "$CORELLIA_CONF_DIR/zed/settings.json" "$HOME/.config/zed/settings.json"
  copy_config "$CORELLIA_CONF_DIR/zed/keymap.json" "$HOME/.config/zed/keymap.json"
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
  link_desktop_config
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
