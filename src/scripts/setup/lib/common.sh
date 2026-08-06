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

# What the next command is about to do to your patience: a download with no
# progress of its own, a step that sits silent for minutes, a prompt you have to
# answer. Setup runs for the better part of an hour and most of that is spent
# watching output that has stopped, so the difference between "slow" and "stuck"
# has to be on screen before the silence starts, not after it ends.
note() { printf '\033[2m    %s\033[0m\n' "$*"; }

die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }

# --- operating system -------------------------------------------------------

# Resolved once, so the branches throughout these scripts are a string
# comparison rather than a fork of `uname` each time.
case "$(uname -s)" in
  Darwin) CORELLIA_OS=macos ;;
  Linux) CORELLIA_OS=linux ;;
  *) CORELLIA_OS=unsupported ;;
esac

is_macos() { [ "$CORELLIA_OS" = macos ]; }
is_linux() { [ "$CORELLIA_OS" = linux ]; }

require_macos() {
  is_macos || die "this script only supports macOS"
}

require_linux() {
  is_linux || die "this script only supports Linux"
}

require_supported_os() {
  case "$CORELLIA_OS" in
    macos | linux) ;;
    *) die "unsupported operating system: $(uname -s)" ;;
  esac
}

# The script that provisions this machine, so the "run X first" messages name
# the right one on both platforms instead of always pointing at the Mac.
os_setup_script() {
  if is_macos; then
    printf 'setup-macos.sh\n'
  else
    printf 'setup-linux.sh\n'
  fi
}

# --- identity ---------------------------------------------------------------

# Used by both the git configuration and the ssh key comment.
# shellcheck disable=SC2034 # read by the scripts that source this file
CORELLIA_GIT_NAME="${CORELLIA_GIT_NAME:-Patrick Hulce}"
# shellcheck disable=SC2034 # read by the scripts that source this file
CORELLIA_GIT_EMAIL="${CORELLIA_GIT_EMAIL:-patrick.hulce@gmail.com}"

# --- path -------------------------------------------------------------------

# src/conf/zsh/10-path.zsh puts these on PATH in the *next* shell. This one has
# to be told, or every step that uses what the step before it just installed —
# setup-languages.sh reaching for the mise the Linux setup fetched a minute
# earlier, say — fails to find a binary that is sitting right there.
ensure_setup_path() {
  local dir
  for dir in "$HOME/.cargo/bin" "$HOME/.local/bin"; do
    case ":$PATH:" in
      *":$dir:"*) ;;
      *) PATH="$dir:$PATH" ;;
    esac
  done
  export PATH
}

ensure_setup_path

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

# copy_config <source> <destination>
#
# Seeds <destination> from <source> once, for config an app writes back to.
# Unlike link_config this never overwrites an existing file: the copy is a
# starting point the app then owns, and re-running setup must not undo what it
# has written since. A symlink left by an earlier setup is replaced, which is
# the point — that link is how the app's machine-local state ends up in the repo.
copy_config() {
  local source="$1"
  local destination="$2"

  mkdir -p "$(dirname "$destination")"

  if [ -L "$destination" ]; then
    rm "$destination"
    warn "$destination was a symlink into the repo; replacing it with a copy"
  elif [ -e "$destination" ]; then
    skip "$destination exists; leaving it alone (repo copy: $source)"
    return
  fi

  cp "$source" "$destination"
  step "Copied $destination"
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

# --- homebrew ---------------------------------------------------------------

# brew_bundle <brewfile>
#
# brew bundle refreshes Homebrew's catalog before it installs anything, and that
# refresh is minutes of silence following the last line it printed — the point
# where this looks hung on a fresh machine. `check` gets that wait over with
# while printing the list of what is about to be installed, so the run has both
# a warning and an end in sight before it starts.
brew_bundle() {
  local file="$1"

  note "Homebrew refreshes its catalog first. Expect a few minutes of silence."
  # Non-zero only means something is missing, which is the whole point of asking.
  brew bundle check --verbose --no-upgrade --file "$file" || true

  brew bundle install --verbose --no-upgrade --file "$file"
}

# --- apt --------------------------------------------------------------------

# Already root, and on a machine with no sudo installed — a container, or a run
# through `sudo bash setup-linux.sh`. Standing in for it keeps one code path
# below instead of a $SUDO prefix on thirty commands, and turns "sudo: command
# not found" back into the no-op it should be.
#
# Through `env` rather than a bare "$@", for the `sudo VAR=value cmd` calls: the
# shell decides what is a variable assignment before "$@" is expanded, so it
# would take the assignment for the command name and report it as not found.
# Nothing here passes sudo's own flags, which env would not understand.
if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
  sudo() { env "$@"; }
fi

# Refreshing the catalog is a minute the setup only needs to spend once, but
# every helper below has to be able to assume it has happened.
CORELLIA_APT_UPDATED=""

apt_refresh() {
  [ -z "$CORELLIA_APT_UPDATED" ] || return 0

  step "Refreshing the apt catalog"
  note "A download from the distribution mirrors; quiet for a minute."
  sudo apt-get update -qq
  CORELLIA_APT_UPDATED=1
}

# apt_install <package>...
#
# Installs only the packages that are missing. apt would reach the same
# conclusion on its own, but not before spending the catalog refresh above to
# get there, which turns every re-run into a minute of silence for nothing.
apt_install() {
  local pkg missing=""

  for pkg in "$@"; do
    if apt_installed "$pkg"; then
      skip "$pkg already installed"
    else
      missing="$missing $pkg"
    fi
  done

  [ -n "$missing" ] || return 0

  apt_refresh
  step "Installing:$missing"
  # </dev/null because callers loop over a package table on stdin, and an
  # apt-get that read from it would swallow the rest of the list. Nothing is
  # lost: -y and DEBIAN_FRONTEND already say there is nobody here to ask.
  # shellcheck disable=SC2086 # deliberate word splitting of the package list
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $missing </dev/null
}

apt_installed() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null |
    grep -q '^install ok installed$'
}

# apt_available <package>
#
# Whether this release's archive can install <package> at all. The Linux setup
# asks before falling back to an upstream build, because several of these tools
# arrived in Debian and Ubuntu only recently: eza and git-delta are in 24.04 but
# not 22.04, and the fallback is worth avoiding when the archive has a copy.
apt_available() {
  local candidate

  apt_refresh
  candidate="$(apt-cache policy "$1" 2>/dev/null | awk '/Candidate:/ {print $2}')"
  [ -n "$candidate" ] && [ "$candidate" != "(none)" ]
}

# apt_repo <name> <key-url> <repository-line>
#
# Registers a third-party apt repository, with its key in /etc/apt/keyrings.
# That is what replaced `apt-key add`, which was deprecated in Ubuntu 22.04 and
# is gone in 24.04 — and which trusted every key it was given for the whole
# archive rather than for the one repository that supplied it.
apt_repo() {
  local name="$1"
  local key_url="$2"
  local line="$3"

  local keyring="/etc/apt/keyrings/$name.gpg"
  local list="/etc/apt/sources.list.d/$name.list"

  if [ -s "$keyring" ] && [ -s "$list" ]; then
    skip "the $name apt repository is already registered"
    return 0
  fi

  step "Registering the $name apt repository"
  sudo install -m 0755 -d /etc/apt/keyrings

  # Some projects publish an ASCII-armoured key and some a binary keyring, and
  # apt only takes the latter. Detected rather than assumed, because the two are
  # not distinguishable by URL and `gpg --dearmor` is only correct for one.
  local tmp
  tmp="$(mktemp)"
  curl -fsSL "$key_url" -o "$tmp" || {
    rm -f "$tmp"
    die "could not download the $name signing key from $key_url"
  }

  if grep -q 'BEGIN PGP' "$tmp"; then
    gpg --dearmor --yes -o "$tmp.gpg" <"$tmp"
    mv "$tmp.gpg" "$tmp"
  fi
  sudo install -m 0644 "$tmp" "$keyring"
  rm -f "$tmp"

  sudo chmod 0644 "$keyring"
  printf '%s\n' "$line" | sudo tee "$list" >/dev/null

  # A repository the last refresh didn't know about, so that refresh no longer
  # counts. Clearing the flag is what makes the install that follows see it.
  CORELLIA_APT_UPDATED=""
  apt_refresh
}

# amd64 or arm64, the spelling .deb release assets are named with. Projects that
# ship tarballs instead tend to use the kernel's spelling, which is `uname -m`.
deb_arch() {
  dpkg --print-architecture
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
