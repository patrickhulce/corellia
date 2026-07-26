# Key bindings. Loaded after 20-tools.zsh, so zsh-autosuggestions' widgets exist.
# zsh-only, but still has to parse under bash 3.2; see README.md.

if [ -n "${ZSH_VERSION:-}" ]; then
  # Shift-select for Ghostty's modified motion keys. Ghostty binds these to
  # adjust_selection, which does nothing without a mouse selection and leaks the
  # half-encoded sequence to zsh; src/conf/ghostty/config unbinds them so they
  # arrive here instead.
  zle_highlight=(region:standout)

  _select-motion() {
    local widget=$1
    if [ "${REGION_ACTIVE:-0}" -eq 0 ]; then
      zle set-mark-command
    fi
    zle "$widget"
  }

  _select-backward-char() {
    _select-motion backward-char
  }
  _select-forward-char() {
    _select-motion forward-char
  }
  _select-backward-word() {
    _select-motion backward-word
  }
  _select-forward-word() {
    _select-motion forward-word
  }
  _select-beginning-of-line() {
    _select-motion beginning-of-line
  }
  _select-end-of-line() {
    _select-motion end-of-line
  }

  for w in _select-backward-char _select-forward-char \
           _select-backward-word _select-forward-word \
           _select-beginning-of-line _select-end-of-line; do
    zle -N "$w"
  done

  bindkey '^[[1;2D' _select-backward-char
  bindkey '^[[1;2C' _select-forward-char
  bindkey '^[[1;4D' _select-backward-word
  bindkey '^[[1;4C' _select-forward-word
  bindkey '^[[1;2H' _select-beginning-of-line
  bindkey '^[[1;2F' _select-end-of-line

  # Backspace and Delete should kill an active shift-selection. zsh's default
  # backward-delete-char does not always do that in practice; Ghostty's default
  # super+backspace=text:\x15 (^U) is kill-whole-line, which ignores the region
  # and nukes the whole command line — remap ^U to backward-kill-line instead.
  _corellia_kill_region_or() {
    local widget=$1
    if [ "${REGION_ACTIVE:-0}" -ne 0 ]; then
      zle kill-region
    else
      zle "$widget"
    fi
  }

  _corellia_backward_delete_char() {
    _corellia_kill_region_or backward-delete-char
  }
  _corellia_delete_char() {
    _corellia_kill_region_or delete-char
  }
  _corellia_backward_kill_line_or_region() {
    _corellia_kill_region_or backward-kill-line
  }

  zle -N _corellia_backward_delete_char
  zle -N _corellia_delete_char
  zle -N _corellia_backward_kill_line_or_region

  bindkey '^?' _corellia_backward_delete_char
  bindkey '^H' _corellia_backward_delete_char
  bindkey '^[[3~' _corellia_delete_char
  bindkey '^U' _corellia_backward_kill_line_or_region
  if [[ -n ${terminfo[kdch1]} ]]; then
    bindkey "${terminfo[kdch1]}" _corellia_delete_char
  fi

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
