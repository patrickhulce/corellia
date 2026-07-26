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

  # Accept the autosuggestion without moving to the end of the line first.
  # Costs reverse-menu-complete. Inert if zsh-autosuggestions isn't installed.
  bindkey '^[[Z' autosuggest-accept
fi
