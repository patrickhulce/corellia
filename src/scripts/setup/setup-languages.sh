#!/usr/bin/env bash
#
# Phase 3 of the macOS setup: language runtimes, global tooling, and agent skills.
# Safe to re-run.
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

SKILLZ_INSTALLER="https://raw.githubusercontent.com/patrickhulce/skillz/main/install.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs Node via mise, global npm CLIs, Python tooling via uv, and the skillz
agent skills.

Options:
$(common_flags_help)

Override the Node version with CORELLIA_NODE_VERSION (default: $NODE_VERSION).
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

# Personal agent skills, installed into ~/.agents/skills. The installer is
# non-destructive on re-run, so this doubles as the update path.
install_skills() {
  step "Installing skillz"
  curl -fsSL "$SKILLZ_INSTALLER" | bash -s -- --target user --yes
}

main() {
  require_macos
  parse_common_flags "$@"

  log "Node"
  install_node
  install_npm_globals

  log "Python"
  install_python_tools

  log "Agent skills"
  install_skills

  cat <<'EOF'

Phase 3 complete. Open a new shell to pick up mise, then check:

  node --version
  uv --version
  ls ~/.agents/skills
EOF
}

main "$@"
