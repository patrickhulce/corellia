#!/usr/bin/env bash
#
# Phase 5 of the macOS setup: language runtimes, global tooling, and agent
# skills. Safe to re-run.
#
#   ./src/scripts/setup/setup-languages.sh

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

# `lts` tracks whichever line is in Active LTS rather than pinning a major that
# quietly goes end-of-life. Node moves to annual majors after 26.
NODE_VERSION="${CORELLIA_NODE_VERSION:-lts}"

# Genuinely global CLIs only. Things like typescript and yarn belong to projects,
# where a global pin just creates version skew.
NPM_GLOBALS="pnpm jest @patrickhulce/scripts source-map-explorer pkgfiles siegem"

# clippy and rustfmt come with the default profile; rust-analyzer does not, and
# editors expect the rustup-managed copy rather than a bundled one.
RUST_COMPONENTS="clippy rustfmt rust-analyzer"

SKILLZ_DIR="${CORELLIA_SKILLZ_DIR:-$HOME/Code/OpenSource/skillz}"
SKILLZ_INSTALLER="https://raw.githubusercontent.com/patrickhulce/skillz/main/install.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs Node via mise, global npm CLIs, the Rust toolchain via rustup, Python
tooling via uv, and the skillz agent skills.

Options:
$(common_flags_help)

Environment:
  CORELLIA_NODE_VERSION  Node version to install (default: $NODE_VERSION).
  CORELLIA_SKILLZ_DIR    skillz checkout to install from (default: $SKILLZ_DIR).
EOF
}

install_node() {
  have mise || die "mise is missing; run setup-macos.sh first"

  step "Installing Node $NODE_VERSION"
  mise use --global "node@$NODE_VERSION"
  skip "node $(mise exec -- node --version)"
}

install_npm_globals() {
  step "Installing global npm packages"
  # Run through mise so this works in a shell that hasn't activated it yet.
  # shellcheck disable=SC2086 # NPM_GLOBALS is a deliberate word-split list
  mise exec -- npm install --global --silent $NPM_GLOBALS
}

# Rust gets rustup rather than mise, even though mise owns node and java here:
# rust-toolchain.toml files, clippy, and rust-analyzer all expect rustup to be
# the thing managing toolchains.
install_rust() {
  have rustup || die "rustup is missing; run setup-macos.sh first"

  # Homebrew ships rustup as the renamed rustup-init binary, so there is no
  # separate installer step. `rustup default` installs the toolchain when it is
  # missing and is a no-op afterwards.
  step "Installing the stable Rust toolchain"
  rustup default stable

  step "Adding components: $RUST_COMPONENTS"
  # shellcheck disable=SC2086 # RUST_COMPONENTS is a deliberate word-split list
  rustup component add $RUST_COMPONENTS

  # The formula is keg-only, so cargo and rustc are only on PATH once
  # src/conf/zsh/10-path.zsh has been sourced. Ask rustup directly instead.
  skip "$(rustup run stable rustc --version)"
}

install_python_tools() {
  have uv || die "uv is missing; run setup-macos.sh first"

  step "Installing Python tools with uv"
  uv tool install --quiet jupyter-core
  uv tool install --quiet nbconvert

  # Strip notebook output on commit. Resolved through uvx so the filter doesn't
  # depend on whatever PATH git happens to run with.
  step "Configuring the notebook output filter"
  git config --global filter.strip-notebook-output.clean \
    'uvx --from nbconvert jupyter-nbconvert --ClearOutputPreprocessor.enabled=True --to=notebook --stdin --stdout --log-level=ERROR'
}

# Editor extensions are deliberately not installed here. Cursor and VS Code both
# sync them through their own accounts, so a scripted install fights that sync
# instead of helping it. src/docs/setup/editor-extensions.md keeps the list as a
# reference for deciding what a new machine should have.

# Personal agent skills, installed into ~/.agents/skills. The installer is
# non-destructive on re-run, so this doubles as the update path.
#
# Runs out of the checkout setup-macos.sh clones, so a skill can be edited and
# reinstalled without a round trip through GitHub. The curl path stays as the
# fallback for a machine that hasn't done the SSH setup yet.
install_skills() {
  if [ ! -f "$SKILLZ_DIR/install.sh" ]; then
    warn "no skillz checkout at $SKILLZ_DIR; installing from GitHub instead"
    step "Installing skillz"
    curl -fsSL "$SKILLZ_INSTALLER" | bash -s -- --target user --yes
    return
  fi

  step "Updating the skillz checkout"
  git -C "$SKILLZ_DIR" pull --ff-only ||
    warn "could not update $SKILLZ_DIR; installing the version on disk"

  step "Installing skillz from $SKILLZ_DIR"
  bash "$SKILLZ_DIR/install.sh" --target user --yes
}

main() {
  require_macos
  parse_common_flags "$@"

  log "Node"
  install_node
  install_npm_globals

  log "Rust"
  install_rust

  log "Python"
  install_python_tools

  log "Agent skills"
  install_skills

  cat <<'EOF'

Phase 5 complete. Open a new shell to pick up mise and cargo, then check:

  node --version
  rustc --version
  uv --version
  ls ~/.agents/skills
EOF
}

main "$@"
