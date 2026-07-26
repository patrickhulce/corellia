# Ghostty sets TERM=xterm-ghostty. SSH forwards that value, but remotes often
# lack the matching terminfo unless Ghostty's ssh-terminfo integration installed
# it (see src/conf/ghostty/config). tmux, htop, and others then fail with
# "missing or unsuitable terminal". Fall back only when the entry is absent —
# locally infocmp succeeds, so this stays a no-op in Ghostty on the Mac.
if [ "${TERM:-}" = xterm-ghostty ]; then
  if ! command -v infocmp >/dev/null 2>&1 || ! infocmp xterm-ghostty >/dev/null 2>&1; then
    export TERM=xterm-256color
  fi
fi
