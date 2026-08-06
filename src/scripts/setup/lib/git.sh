#!/usr/bin/env bash
# Git configuration and the personal repository clones, shared by the macOS and
# Linux setups. Source this after lib/common.sh, don't run it.

configure_git() {
  step "Configuring git"
  git config --global user.name "$CORELLIA_GIT_NAME"
  git config --global user.email "$CORELLIA_GIT_EMAIL"
  git config --global init.defaultBranch main

  git config --global merge.conflictStyle zdiff3

  # delta replaces diff-so-fancy: a distribution package rather than a global
  # npm package, so git works before Node is installed.
  #
  # Guarded because naming a pager git cannot find breaks every `git log` and
  # `git diff` on the machine. Homebrew always has it; on Linux it is one of the
  # tools a release too old to carry it has to fetch from upstream, and that
  # download is allowed to fail without taking git's configuration with it.
  if have delta; then
    git config --global core.pager delta
    git config --global interactive.diffFilter 'delta --color-only'
    git config --global delta.navigate true
  else
    warn "delta is not installed; leaving git's pager alone"
  fi

  link_config "$CORELLIA_CONF_DIR/gitignore" "$HOME/.gitignore"
  git config --global core.excludesfile "$HOME/.gitignore"

  install_git_lfs
}

install_git_lfs() {
  if git config --system --get filter.lfs.clean >/dev/null 2>&1; then
    skip "git-lfs already installed system-wide"
    return
  fi

  step "Installing git-lfs system-wide"
  note "This one needs sudo, so it may ask for your password."
  sudo git lfs install --system
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

  # The bootstrap phase clones over HTTPS because no key exists yet. Now that
  # one does, switch to SSH so pushes don't prompt.
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
