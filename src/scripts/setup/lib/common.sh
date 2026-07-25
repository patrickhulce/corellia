#!/usr/bin/env bash
# Shared helpers for the corellia setup scripts. Source this, don't run it.
#
# Every script that sources this file is safe to re-run: steps check for their
# own result first and report "already done" instead of failing.

CORELLIA_SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORELLIA_ROOT="$(cd "$CORELLIA_SETUP_DIR/../../.." && pwd)"
# shellcheck disable=SC2034 # read by the scripts that source this file
CORELLIA_CONF_DIR="$CORELLIA_ROOT/src/conf"

# --- output -----------------------------------------------------------------

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
step() { printf '\033[1;32m  +\033[0m %s\n' "$*"; }
skip() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }

die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }

require_macos() {
  [ "$(uname -s)" = "Darwin" ] || die "this script only supports macOS"
}

# --- file editing -----------------------------------------------------------

# ensure_block <file> <marker> <content>
#
# Appends <content> to <file> unless <marker> already appears in it. Returns 0
# when it wrote, 1 when the block was already present, so callers should always
# branch on it rather than calling it bare under `set -e`:
#
#   if ensure_block ~/.zprofile 'brew shellenv' "$block"; then ... else ... fi
ensure_block() {
  local file="$1"
  local marker="$2"
  local content="$3"

  if [ -f "$file" ] && grep -qF -- "$marker" "$file"; then
    return 1
  fi

  printf '\n%s\n' "$content" >>"$file"
  return 0
}

# link_config <target> <link>
#
# Points <link> at <target>, moving any real file already there out of the way
# rather than destroying it.
link_config() {
  local target="$1"
  local link="$2"

  if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then
    skip "$link already linked"
    return
  fi

  if [ -e "$link" ] && [ ! -L "$link" ]; then
    local backup
    backup="$link.bak.$(date +%Y%m%d%H%M%S)"
    warn "$link exists; moving it to $backup"
    mv "$link" "$backup"
  fi

  mkdir -p "$(dirname "$link")"
  ln -sfn "$target" "$link"
  step "Linked $link"
}

# --- sparse checkout --------------------------------------------------------

# ensure_sparse_paths
#
# Re-applies sparse-paths to a sparse setup checkout. Without this, a directory
# added to the repo later would stay invisible on every machine that cloned
# before it existed, because sparse-checkout only knows the patterns it was last
# given. A no-op on a full clone.
#
# Read from disk here, unlike in setup-zsh.sh: src/scripts/setup is one of the
# paths in the list, so by the time this runs the file is checked out.
ensure_sparse_paths() {
  local paths_file="$CORELLIA_SETUP_DIR/sparse-paths"

  [ -f "$paths_file" ] || return 0

  # Exits non-zero on a worktree that isn't sparse, which is the check we want.
  if ! git -C "$CORELLIA_ROOT" sparse-checkout list >/dev/null 2>&1; then
    skip "checkout is not sparse, nothing to reapply"
    return 0
  fi

  step "Reapplying the sparse checkout paths"
  grep -Ev '^[[:space:]]*(#|$)' "$paths_file" |
    git -C "$CORELLIA_ROOT" sparse-checkout set --stdin
}

# --- enterprise-managed software -------------------------------------------

# Software in Brewfile.managed is installed by an employer's IT department on a
# work machine, so we must not install the Homebrew build there. Detection is a
# best-effort default; --skip-managed and --include-managed always win.
CORELLIA_SKIP_MANAGED="${CORELLIA_SKIP_MANAGED:-}"

is_managed_machine() {
  # Work dotfiles checked out means this is a work machine. Both locations are
  # checked because employers put them in different places, and a probe for only
  # one of them fails open: it reports a work machine as personal and installs
  # software IT already owns.
  [ -d "$HOME/.config/work" ] && return 0
  [ -d "$HOME/Library/Application Support/work/dotfiles" ] && return 0

  # MDM enrollment (Jamf, Kandji, Intune, ...) is the strongest signal.
  if have profiles; then
    if profiles status -type enrollment 2>/dev/null | grep -q ': Yes'; then
      return 0
    fi
  fi

  return 1
}

should_install_managed() {
  case "$CORELLIA_SKIP_MANAGED" in
    1 | true | yes) return 1 ;;
    0 | false | no) return 0 ;;
  esac

  if is_managed_machine; then
    return 1
  fi
  return 0
}

# parse_common_flags "$@"
#
# Consumes the flags every setup script understands. Scripts that need their own
# flags should handle those first and pass the rest here. Relies on the calling
# script defining usage().
parse_common_flags() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --skip-managed) CORELLIA_SKIP_MANAGED=1 ;;
      --include-managed) CORELLIA_SKIP_MANAGED=0 ;;
      -h | --help)
        usage
        exit 0
        ;;
      *) die "unknown argument: $1 (try --help)" ;;
    esac
    shift
  done
}

# Help text. Every script accepts the managed flags so they can be passed along
# harmlessly, but only the ones that actually install software advertise them.
common_flags_help() {
  cat <<'EOF'
  -h, --help          Show this help.
EOF
}

managed_flags_help() {
  cat <<'EOF'
  --skip-managed      Don't install software an employer's IT owns (Cursor,
                      Adobe, Slack, ...). Detected automatically on a machine
                      with MDM enrollment or work dotfiles checked out.
  --include-managed   Install it anyway, overriding that detection.

The CORELLIA_SKIP_MANAGED environment variable works the same as --skip-managed.
EOF
}
