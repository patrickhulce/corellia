# Ghostty sets TERM=xterm-ghostty. SSH forwards that value, but remotes often
# lack the matching terminfo unless Ghostty's ssh-terminfo integration installed
# it (see src/conf/ghostty/config). tmux, htop, and others then fail with
# "missing or unsuitable terminal".
#
# Prefer installing the bundled entry so TERM stays xterm-ghostty and tmux sees
# the correct backspace key (DEL, not BS). Fall back to xterm-256color only when
# tic is unavailable; Ghostty still sends DEL, so fix stty erase and see
# src/conf/tmux/tmux.conf for tmux's outer-terminal override.
if [ "${TERM:-}" = xterm-ghostty ]; then
  if ! command -v infocmp >/dev/null 2>&1 || ! infocmp xterm-ghostty >/dev/null 2>&1; then
    _corellia_ghostty_terminfo=""
    for _corellia_ghostty_terminfo in \
      "${CORELLIA_HOME:-}/src/conf/terminfo/xterm-ghostty.terminfo" \
      "${HOME}/.config/terminfo/xterm-ghostty.terminfo"; do
      if [ -r "$_corellia_ghostty_terminfo" ] && command -v tic >/dev/null 2>&1; then
        mkdir -p "${HOME}/.terminfo" 2>/dev/null
        tic -x "$_corellia_ghostty_terminfo" 2>/dev/null && break
      fi
      _corellia_ghostty_terminfo=""
    done
    unset _corellia_ghostty_terminfo

    if ! command -v infocmp >/dev/null 2>&1 || ! infocmp xterm-ghostty >/dev/null 2>&1; then
      export TERM=xterm-256color
      stty erase '^?' 2>/dev/null
    fi
  fi
fi
