#!/usr/bin/env bash
#
# Installs the software in src/conf/Brewfile.managed — the apps an employer's IT
# department normally owns. On a work machine this refuses to install anything
# and prints the list so you can pick it up from the corporate portal instead.
#
# Run directly, or let setup-macos.sh call it.

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs enterprise-managed applications from src/conf/Brewfile.managed.

Options:
$(common_flags_help)
$(managed_flags_help)
EOF
}

BREWFILE="$CORELLIA_CONF_DIR/Brewfile.managed"

# Cask tokens turned into something readable, so the skip notice stays in sync
# with the Brewfile instead of drifting from a hardcoded list.
managed_app_names() {
  sed -n 's/^cask "\([^"]*\)".*/\1/p' "$BREWFILE"
}

main() {
  require_macos
  parse_common_flags "$@"

  [ -f "$BREWFILE" ] || die "missing $BREWFILE"

  if ! should_install_managed; then
    log "Skipping enterprise-managed software"
    if [ "$CORELLIA_SKIP_MANAGED" = "" ]; then
      skip "This looks like a work machine (MDM enrollment or ~/.config/work)."
      skip "Pass --include-managed to install anyway."
    fi
    echo
    echo "Install these from your company's self-service portal instead:"
    managed_app_names | sed 's/^/  - /'
    echo
    return 0
  fi

  have brew || die "Homebrew is missing; run setup-zsh.sh first"

  log "Installing enterprise-managed software"
  brew bundle install --file "$BREWFILE" --no-upgrade
}

main "$@"
