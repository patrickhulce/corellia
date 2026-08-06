#!/usr/bin/env bash
#
# Sets up a headless Linux machine — a GPU box, a cloud VM, WSL, or anything you
# only reach over ssh — with the same shell, CLI tooling, and identity as the
# Mac. Safe to re-run.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-linux.sh)"
#
# or, from a checkout:
#
#   ./src/scripts/setup/setup-linux.sh [--name <hostname>]
#
# Deliberately not here: GUI applications, fonts, and anything that only makes
# sense in front of a screen. NVIDIA drivers, CUDA, and Docker are their own
# script, setup-linux-gpu.sh. See src/docs/setup/linux-setup.md.

set -euo pipefail

# Overridable so the bootstrap below can be pointed at a fork or a local mirror,
# which is also the only way to exercise it without pushing to main first.
CORELLIA_REPO="${CORELLIA_REPO:-https://github.com/patrickhulce/corellia.git}"
# The same dedicated setup checkout the Mac gets: sparse, shallow, and permanent,
# since ~/.zshrc sources its shell config and ~/.config symlinks point into it.
CORELLIA_DIR="$HOME/.corellia"
# Repo-relative, because it's read with `git show` before a working tree exists.
SPARSE_PATHS_FILE="src/scripts/setup/sparse-paths"

# --- bootstrap --------------------------------------------------------------
#
# Run over curl there is no checkout to source lib/common.sh from, and no $0 to
# find one relative to either: `bash -c "$(curl ...)"` leaves BASH_SOURCE empty.
# So the first thing this does is put the repo on disk and hand over to the copy
# there, which has the libraries beside it. From a checkout, none of this runs.
#
# The helpers below are duplicated from lib/common.sh for that reason, and live
# only until the exec.

CORELLIA_SELF_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ]; then
  CORELLIA_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ ! -f "$CORELLIA_SELF_DIR/lib/common.sh" ]; then
  boot_log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
  boot_step() { printf '\033[1;32m  +\033[0m %s\n' "$*"; }
  boot_die() {
    printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
    exit 1
  }

  [ "$(uname -s)" = "Linux" ] || boot_die "this script only supports Linux"
  command -v apt-get >/dev/null 2>&1 ||
    boot_die "no apt-get found; this setup targets Debian and Ubuntu"

  # Stands in for sudo when already root and it isn't installed, as lib/common.sh
  # does for everything after the exec. Through `env`, so the `sudo VAR=value
  # cmd` below doesn't have its assignment read as a command name.
  if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { env "$@"; }
  fi

  boot_log "Bootstrap"

  if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    boot_step "Installing git and curl"
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      git curl ca-certificates
  fi

  if [ ! -d "$CORELLIA_DIR/.git" ]; then
    # Shallow, blobless, and sparse, as on macOS: the monorepo is over 10G of
    # side projects and setup needs well under a megabyte of it. HTTPS because
    # no ssh key exists yet; setup_code_directories switches the remote later.
    boot_step "Cloning corellia to $CORELLIA_DIR"
    git clone --depth=1 --filter=blob:none --sparse "$CORELLIA_REPO" "$CORELLIA_DIR"

    # Read from the object store, not the working tree: a --sparse clone checks
    # out root-level files and nothing else, so src/ isn't on disk yet. `git
    # show` resolves the path against the commit and fetches the one blob.
    if boot_paths="$(git -C "$CORELLIA_DIR" show "HEAD:$SPARSE_PATHS_FILE" 2>/dev/null)"; then
      boot_step "Limiting the checkout to the setup directories"
      printf '%s\n' "$boot_paths" |
        grep -Ev '^[[:space:]]*(#|$)' |
        git -C "$CORELLIA_DIR" sparse-checkout set --stdin
    else
      git -C "$CORELLIA_DIR" sparse-checkout disable
    fi
  fi

  boot_step "Handing over to the copy in $CORELLIA_DIR"
  exec bash "$CORELLIA_DIR/src/scripts/setup/setup-linux.sh" "$@"
fi

CORELLIA_LIB_DIR="$CORELLIA_SELF_DIR/lib"
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$CORELLIA_LIB_DIR/common.sh"
# shellcheck source-path=SCRIPTDIR source=lib/shell.sh
source "$CORELLIA_LIB_DIR/shell.sh"
# shellcheck source-path=SCRIPTDIR source=lib/git.sh
source "$CORELLIA_LIB_DIR/git.sh"
# shellcheck source-path=SCRIPTDIR source=lib/ssh.sh
source "$CORELLIA_LIB_DIR/ssh.sh"

HOSTNAME_TO_SET=""

# Already on PATH via src/conf/zsh/10-path.zsh, and the destination for
# everything below that apt doesn't provide.
LOCAL_BIN="$HOME/.local/bin"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Installs the shell, CLI tooling, git configuration, and SSH identity on a
headless Linux machine, then runs setup-languages.sh.

Options:
  --name <name>       Set the system hostname (needs sudo). Skipped when not
                      provided.
$(common_flags_help)

Git identity comes from CORELLIA_GIT_NAME and CORELLIA_GIT_EMAIL, defaulting to
"$CORELLIA_GIT_NAME" <$CORELLIA_GIT_EMAIL>.
EOF
}

parse_args() {
  local rest=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --name)
        [ "$#" -ge 2 ] || die "--name needs a value"
        HOSTNAME_TO_SET="$2"
        shift
        ;;
      *) rest="$rest $1" ;;
    esac
    shift
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the leftovers
  parse_common_flags $rest
}

# --- packages ---------------------------------------------------------------
#
# Three tiers, because the distribution archives are excellent for most of this
# and years behind for the rest. src/conf/Brewfile is the macOS counterpart, and
# the two are meant to stay in step; what has no Linux equivalent at all (casks,
# fonts, mas) is listed in src/docs/setup/linux-setup.md instead.

# Tier one: in the archive, in a version worth having.
APT_PACKAGES="\
  zsh zsh-autosuggestions \
  git git-lfs \
  openssh-client \
  curl wget unzip gnupg ca-certificates rename \
  jq ripgrep btop direnv tmux zoxide httpie tldr \
  ffmpeg imagemagick libimage-exiftool-perl \
  shellcheck \
  build-essential automake cmake meson nasm yasm pkg-config clang-format"

# Tier two: in the archive under a name that isn't the command's. Debian renamed
# both to dodge a collision — fd with fdclone, bat with bacula-console-qt — so
# the binaries land as `fdfind` and `batcat` and nothing that expects the real
# names, this repo's aliases included, finds them.
#
# Columns: package, the binary it installs, the name we want it under.
APT_RENAMED="\
fd-find|fdfind|fd
bat|batcat|bat"

install_packages() {
  install_apt_packages
  install_renamed_packages

  # Tier three, one function each: either the archive has no package at all, or
  # the one it has is too old to be worth the parity.
  install_mise
  install_deno
  install_uv
  install_rustup
  install_starship
  install_fzf
  install_gh
  install_eza
  install_delta
  install_shfmt
  install_awscli
}

# apt fails the whole transaction over one name it doesn't recognise, and the
# archives differ enough between releases that a single missing tool would take
# the other thirty down with it. Ask first, and say what this release lacks.
install_apt_packages() {
  local pkg wanted="" unavailable=""

  for pkg in $APT_PACKAGES; do
    if apt_installed "$pkg" || apt_available "$pkg"; then
      wanted="$wanted $pkg"
    else
      unavailable="$unavailable $pkg"
    fi
  done

  # shellcheck disable=SC2086 # deliberate word splitting of the package list
  apt_install $wanted

  if [ -n "$unavailable" ]; then
    warn "this release has no package for:$unavailable"
  fi
}

install_renamed_packages() {
  local package binary command_name

  while IFS='|' read -r package binary command_name; do
    [ -n "$package" ] || continue

    apt_install "$package"

    if ! have "$binary"; then
      warn "$package did not provide $binary; $command_name is missing"
      continue
    fi

    # A link rather than an alias, so scripts and subprocesses see it too.
    link_local_bin "$command_name" "$(command -v "$binary")"
  done <<EOF
$APT_RENAMED
EOF
}

# link_local_bin <name> <target>
#
# Puts <target> on PATH under <name>. Unlike link_config this doesn't back up
# what's already there: a stale link into a package that has since moved is the
# normal case, and there is nothing in ~/.local/bin worth preserving.
link_local_bin() {
  local name="$1"
  local target="$2"
  local link="$LOCAL_BIN/$name"

  if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then
    skip "$name already linked to $target"
    return
  fi

  mkdir -p "$LOCAL_BIN"
  ln -sfn "$target" "$link"
  step "Linked $name to $target"
}

# --- tier three: upstream builds --------------------------------------------

# latest_github_tag <owner/repo>
#
# The tag of the newest release. Needed for the projects whose asset filenames
# embed the version, which /releases/latest/download can't be used with.
latest_github_tag() {
  curl -fsSL "https://api.github.com/repos/$1/releases/latest" |
    sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
    head -n 1
}

# Node, Java, and Go versions per project. Not in the archive at all, and the
# tool setup-languages.sh installs Node with.
install_mise() {
  if have mise; then
    skip "mise already installed"
    return
  fi

  step "Installing mise"
  curl -fsSL https://mise.run | sh
}

# On macOS deno is a Brewfile formula; there is no equivalent archive package
# here, and mise manages runtimes anyway. Installed through it rather than
# through its own installer so there is one thing that owns runtime versions.
install_deno() {
  if ! have mise; then
    warn "mise is not installed; skipping deno"
    return
  fi

  if mise which deno >/dev/null 2>&1; then
    skip "deno already installed"
    return
  fi

  step "Installing deno"
  mise use --global deno@latest
}

# Python interpreters, venvs, and tools. The archive's python3-pip and pipx are
# what this replaced; see the migration note in mac-setup.md.
install_uv() {
  if have uv; then
    skip "uv already installed"
    return
  fi

  step "Installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
}

# --no-modify-path: src/conf/zsh/10-path.zsh already has ~/.cargo/bin, and
# rustup's own edit would append a second, unversioned copy to ~/.profile.
#
# The toolchain itself is setup-languages.sh's job, on both platforms.
install_rustup() {
  if have rustup; then
    skip "rustup already installed"
    return
  fi

  step "Installing rustup"
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs |
    sh -s -- -y --no-modify-path --default-toolchain none
}

# Deliberately not delegated to setup-starship.sh, which is for machines with no
# checkout: it also writes its own loader into ~/.zshrc, and here 20-tools.zsh
# already sources the prompt out of the repo. Two loaders means `starship init`
# twice on every shell start.
install_starship() {
  if have starship; then
    skip "starship already installed"
    return
  fi

  step "Installing starship"
  mkdir -p "$LOCAL_BIN"
  curl -fsSL https://starship.rs/install.sh |
    sh -s -- --yes --bin-dir "$LOCAL_BIN"
}

# From upstream even where the archive has a package, because the flag
# 20-tools.zsh uses to load the shell integration — `fzf --zsh` — arrived in
# 0.48, and the archives are behind that: 0.29 on Ubuntu 22.04 and 0.44 on
# 24.04. An older fzf prints "unknown option: --zsh" on every shell start.
install_fzf() {
  if have fzf; then
    skip "fzf already installed ($(fzf --version))"
    return
  fi

  local tag version tmp
  tag="$(latest_github_tag junegunn/fzf)"
  if [ -z "$tag" ]; then
    warn "could not find the latest fzf release; install it by hand"
    return
  fi
  version="${tag#v}"

  step "Installing fzf $version"
  tmp="$(mktemp -d)"
  if curl -fsSL --max-time 120 -o "$tmp/fzf.tar.gz" \
    "https://github.com/junegunn/fzf/releases/download/$tag/fzf-${version}-linux_$(deb_arch).tar.gz" &&
    tar -xzf "$tmp/fzf.tar.gz" -C "$tmp"; then
    mkdir -p "$LOCAL_BIN"
    install -m 0755 "$tmp/fzf" "$LOCAL_BIN/fzf"
  else
    warn "could not install fzf $version; install it by hand"
  fi
  rm -rf "$tmp"
}

# GitHub's own apt repository, which is how they distribute it — there is no gh
# in the Debian or Ubuntu archives.
install_gh() {
  if have gh; then
    skip "gh already installed"
    return
  fi

  apt_repo github-cli \
    https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    "deb [arch=$(deb_arch) signed-by=/etc/apt/keyrings/github-cli.gpg] https://cli.github.com/packages stable main"
  apt_install gh
}

# In the archive from 24.04 on. Older releases get it from the repository the
# project publishes, rather than a tarball, so `apt upgrade` keeps it current.
install_eza() {
  if have eza; then
    skip "eza already installed"
    return
  fi

  if apt_available eza; then
    apt_install eza
    return
  fi

  apt_repo gierens \
    https://raw.githubusercontent.com/eza-community/eza/main/deb.asc \
    "deb [arch=$(deb_arch) signed-by=/etc/apt/keyrings/gierens.gpg] http://deb.gierens.de stable main"
  apt_install eza
}

# git's pager. In the archive from 24.04 on as git-delta; before that, the .deb
# the project publishes, so it is still apt that owns the file list.
install_delta() {
  if have delta; then
    skip "delta already installed"
    return
  fi

  if apt_available git-delta; then
    apt_install git-delta
    return
  fi

  local tag tmp
  tag="$(latest_github_tag dandavison/delta)"
  if [ -z "$tag" ]; then
    warn "could not find the latest delta release; git will use its own pager"
    return
  fi

  step "Installing delta $tag"
  tmp="$(mktemp -d)"
  if curl -fsSL --max-time 120 -o "$tmp/delta.deb" \
    "https://github.com/dandavison/delta/releases/download/$tag/git-delta_${tag}_$(deb_arch).deb"; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$tmp/delta.deb"
  else
    warn "could not install delta $tag; git will use its own pager"
  fi
  rm -rf "$tmp"
}

# Mirrors the shell job in .github/workflows/lint.yml, which downloads the same
# binary. shellcheck comes from the archive; shfmt only recently does.
install_shfmt() {
  if have shfmt; then
    skip "shfmt already installed"
    return
  fi

  if apt_available shfmt; then
    apt_install shfmt
    return
  fi

  local tag
  tag="$(latest_github_tag mvdan/sh)"
  if [ -z "$tag" ]; then
    warn "could not find the latest shfmt release; install it by hand"
    return
  fi

  step "Installing shfmt $tag"
  mkdir -p "$LOCAL_BIN"
  if curl -fsSL --max-time 120 -o "$LOCAL_BIN/shfmt" \
    "https://github.com/mvdan/sh/releases/download/$tag/shfmt_${tag}_linux_$(deb_arch)"; then
    chmod +x "$LOCAL_BIN/shfmt"
  else
    rm -f "$LOCAL_BIN/shfmt"
    warn "could not install shfmt $tag; install it by hand"
  fi
}

# The archive's `awscli` is version 1, which is a different product with a
# different release cadence. Version 2 is only distributed as this bundle.
install_awscli() {
  if have aws; then
    skip "awscli already installed ($(aws --version 2>&1))"
    return
  fi

  local tmp
  step "Installing awscli v2"
  tmp="$(mktemp -d)"
  if curl -fsSL --max-time 300 -o "$tmp/awscli.zip" \
    "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" &&
    unzip -qq "$tmp/awscli.zip" -d "$tmp"; then
    sudo "$tmp/aws/install" --update >/dev/null
  else
    warn "could not install awscli; install it by hand"
  fi
  rm -rf "$tmp"
}

# --- hostname ---------------------------------------------------------------

set_hostname() {
  if [ -z "$HOSTNAME_TO_SET" ]; then
    skip "no --name given; leaving the hostname alone"
    return
  fi

  if [ "$(hostname)" = "$HOSTNAME_TO_SET" ]; then
    skip "the hostname is already $HOSTNAME_TO_SET"
    return
  fi

  # WSL and containers have no systemd, and in WSL the name comes from
  # /etc/wsl.conf on the Windows side rather than from in here.
  if ! have hostnamectl; then
    warn "no hostnamectl on this machine; set the hostname yourself"
    return
  fi

  step "Setting the hostname to $HOSTNAME_TO_SET"
  sudo hostnamectl set-hostname "$HOSTNAME_TO_SET" ||
    warn "could not set the hostname"
}

# --- main -------------------------------------------------------------------

# Ask for the password at the start rather than four minutes into a download,
# where a silent prompt is indistinguishable from a stalled transfer.
prime_sudo() {
  # Already root, so there is nothing to ask for — and lib/common.sh's stand-in
  # for sudo, which is what a root container has instead of the real thing,
  # takes no flags to ask with.
  if [ "$(id -u)" -eq 0 ]; then
    return 0
  fi

  if sudo -n true 2>/dev/null; then
    return 0
  fi

  note "The package steps need sudo, so it asks for your password now."
  sudo -v
}

main() {
  require_linux
  parse_args "$@"

  have apt-get || die "no apt-get found; this setup targets Debian and Ubuntu"
  prime_sudo

  log "Checkout"
  ensure_sparse_paths

  log "Hostname"
  set_hostname

  log "Packages"
  install_packages

  log "Shell configuration"
  install_oh_my_zsh
  link_shell_config
  install_global_scripts
  ensure_login_shell

  log "Git"
  configure_git

  log "SSH identity"
  configure_ssh

  log "Repositories"
  setup_code_directories

  log "Languages and tooling"
  bash "$CORELLIA_SETUP_DIR/setup-languages.sh"

  cat <<EOF

Setup complete. Log out and back in for zsh and the new PATH, then check:

  node --version
  rustc --version
  uv --version

The GPU stack — NVIDIA drivers, CUDA, Docker with the container toolkit — is a
separate script, since most machines don't want it:

  $CORELLIA_SETUP_DIR/setup-linux-gpu.sh

Per-project configuration goes in an .envrc, picked up by direnv. Real secrets
stay in 1Password and reach the one process that needs them through \`op run\`.
See src/docs/setup/linux-setup.md.
EOF
}

main "$@"
