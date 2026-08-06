#!/usr/bin/env bash
# Shell configuration shared by the macOS and Linux setups. Source this after
# lib/common.sh, don't run it.
#
# What lives here is everything both platforms want: the loader block, the
# config that isn't tied to a GUI app, the ~/.scripts link, and the login shell.
# Ghostty, Zed, and the Home/End key bindings stay in setup-macos.sh, since a
# headless box has no use for any of them.

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

  link_config "$CORELLIA_CONF_DIR/direnv/direnv.toml" "$HOME/.config/direnv/direnv.toml"
  link_config "$CORELLIA_CONF_DIR/tmux/tmux.conf" "$HOME/.tmux.conf"
}

# src/conf/zsh/05-oh-my-zsh.zsh sources oh-my-zsh for its history, completion,
# and key binding defaults, so the loader above needs it on disk.
#
# setup-zsh.sh has its own copy of this rather than calling here: it runs over
# curl on a Mac that has no checkout yet, so it can't source anything.
install_oh_my_zsh() {
  # --keep-zshrc is only honoured when a ~/.zshrc already exists; without one the
  # installer writes its template, theme and plugin list included. The versioned
  # config in src/conf/zsh owns all of that, so give the installer a file to keep.
  if [ ! -f "$HOME/.zshrc" ]; then
    step "Creating ~/.zshrc"
    printf '# Configuration lives in corellia, at src/conf/zsh/*.zsh.\n' >"$HOME/.zshrc"
  fi

  if [ -d "$HOME/.oh-my-zsh" ]; then
    skip "oh-my-zsh already installed"
    return
  fi

  # --unattended keeps it from replacing the shell and exiting out from under us.
  step "Installing oh-my-zsh"
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" \
    "" --unattended --keep-zshrc
}

install_global_scripts() {
  # init.sh refuses to clobber a real ~/.scripts directory. That's a reason to
  # look, not a reason to abandon the rest of the setup.
  bash "$CORELLIA_ROOT/src/scripts/global/init.sh" ||
    warn "could not link ~/.scripts; resolve it and re-run"
}

# macOS has logged you into zsh since Catalina, so this only ever does anything
# on Linux — where `apt-get install zsh` puts the shell on disk and leaves the
# account logging into bash, and the whole configuration above then never loads.
#
# Through sudo rather than a bare `chsh`, which asks for the account password
# and, on a box reached over ssh with no password set, cannot be satisfied.
ensure_login_shell() {
  local zsh_bin current user

  zsh_bin="$(command -v zsh 2>/dev/null)" || zsh_bin=""
  if [ -z "$zsh_bin" ]; then
    warn "zsh is not installed; leaving the login shell alone"
    return
  fi

  user="$(id -un)"
  current="$(getent passwd "$user" 2>/dev/null | cut -d: -f7)" || current=""
  [ -n "$current" ] || current="${SHELL:-}"

  if [ "$current" = "$zsh_bin" ]; then
    skip "zsh is already the login shell"
    return
  fi

  # chsh refuses a shell that isn't listed, and the error it gives ("chsh: is
  # not a valid shell") reads like the binary is broken rather than unlisted.
  if ! grep -qxF "$zsh_bin" /etc/shells 2>/dev/null; then
    step "Adding $zsh_bin to /etc/shells"
    printf '%s\n' "$zsh_bin" | sudo tee -a /etc/shells >/dev/null
  fi

  step "Making zsh the login shell"
  sudo chsh -s "$zsh_bin" "$user" ||
    warn "could not change the login shell; run 'chsh -s $zsh_bin'"
}
