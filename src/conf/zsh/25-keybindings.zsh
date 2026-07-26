# Key bindings. Loaded after 20-tools.zsh, so zsh-autosuggestions' widgets exist.
# zsh-only, but still has to parse under bash 3.2; see README.md.

if [ -n "${ZSH_VERSION:-}" ]; then
  # Plain motions, so the shifted keys stop printing stray D and C. Ghostty
  # binds these to adjust_selection, which does nothing without a mouse
  # selection and leaks the half-encoded sequence to zsh; src/conf/ghostty/config
  # unbinds them so they arrive here instead.
  bindkey '^[[1;2D' backward-char
  bindkey '^[[1;2C' forward-char
  bindkey '^[[1;4D' backward-word
  bindkey '^[[1;4C' forward-word
  bindkey '^[[1;2H' beginning-of-line
  bindkey '^[[1;2F' end-of-line

  # Tab accepts an autosuggestion when one is showing; otherwise complete as usual.
  # Shift+Tab walks completion matches backward. Inert if zsh-autosuggestions isn't
  # installed.
  if [[ -n ${widgets[autosuggest-accept]} ]]; then
    _corellia_tab() {
      local -i max_cursor=$#BUFFER
      if [[ $KEYMAP = vicmd ]]; then
        max_cursor=$((max_cursor - 1))
      fi
      if (( $#POSTDISPLAY && CURSOR == max_cursor )); then
        zle autosuggest-accept
        # POSTDISPLAY was drawn gray; redraw so accepted text uses normal input styling.
        _zsh_autosuggest_highlight_reset
        zle -R
      else
        zle expand-or-complete
      fi
    }
    zle -N _corellia_tab
    bindkey '^I' _corellia_tab
  fi
  bindkey '^[[Z' reverse-menu-complete
fi
