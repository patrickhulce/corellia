#!/usr/bin/env bash
#
# Runs the macOS setup phases in order. A convenience wrapper only: every phase
# is independently runnable and safe to re-run, so reach for them directly when
# you only need one.
#
# setup-zsh.sh is not included: it runs over curl before this repo exists.
#
#   ./src/scripts/setup/bootstrap.sh [--skip-managed] [--name <computer-name>]

set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

COMPUTER_NAME=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Runs setup-macos.sh, setup-macos-defaults.sh, setup-app-prefs.sh, and
setup-languages.sh in order.

Options:
  --name <name>       Passed through to setup-macos-defaults.sh.
$(common_flags_help)
$(managed_flags_help)
EOF
}

parse_args() {
  local rest=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --name)
        [ "$#" -ge 2 ] || die "--name needs a value"
        COMPUTER_NAME="$2"
        shift
        ;;
      *) rest="$rest $1" ;;
    esac
    shift
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the leftovers
  parse_common_flags $rest
}

main() {
  require_macos
  parse_args "$@"

  # The phases read the managed-software decision from the environment.
  export CORELLIA_SKIP_MANAGED

  log "Phase 2: packages, shell, git, identity"
  bash "$CORELLIA_SETUP_DIR/setup-macos.sh"

  log "Phase 3: system preferences"
  if [ -n "$COMPUTER_NAME" ]; then
    bash "$CORELLIA_SETUP_DIR/setup-macos-defaults.sh" --name "$COMPUTER_NAME"
  else
    bash "$CORELLIA_SETUP_DIR/setup-macos-defaults.sh"
  fi

  # After the system defaults, so an app quit and relaunched here isn't then
  # restarted out from under the user by the killall in the phase above.
  log "Phase 4: app preferences"
  bash "$CORELLIA_SETUP_DIR/setup-app-prefs.sh"

  log "Phase 5: languages and tooling"
  bash "$CORELLIA_SETUP_DIR/setup-languages.sh"

  log "Done. Open a new shell for the tooling to load."
  note "Then open each app once by hand: they are quarantined until you do, and"
  note "none of them can ask for Accessibility or Microphone before first launch."
  note "The rest of the manual steps are in src/docs/setup/mac-setup.md."
}

main "$@"
