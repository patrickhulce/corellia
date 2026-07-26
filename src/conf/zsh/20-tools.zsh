# Shell integrations for the tools in src/conf/Brewfile.
#
# Each is guarded so a partially-installed machine still gets a working shell.

# These tools print shell-specific code to be evaluated, so they need telling
# which shell is asking. Detected rather than hardcoded to zsh, because this file
# is also sourced from bash. See README.md.
if [ -n "${ZSH_VERSION:-}" ]; then
  _corellia_shell=zsh
else
  _corellia_shell=bash
fi

# Load project-local .envrc files on cd. This is where per-project config and
# 1Password secret references live; see src/docs/setup/mac-setup.md#secrets.
if command -v direnv >/dev/null 2>&1; then
  eval "$(direnv hook "$_corellia_shell")"
fi

# Node, Java, and Go versions, resolved per project from .tool-versions,
# .node-version, or .nvmrc. Replaces nvm and sdkman.
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate "$_corellia_shell")"
fi

if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init "$_corellia_shell")"
fi

if command -v fzf >/dev/null 2>&1; then
  eval "$(fzf "--$_corellia_shell")"
fi

# Prompt, in place of an oh-my-zsh theme. 05-oh-my-zsh.zsh leaves ZSH_THEME
# empty so nothing is drawn twice.
#
# The prompt lives in src/conf/starship rather than here, because it's the one
# piece of this configuration worth having on a work machine or a box you only
# ever reach over ssh. See src/scripts/setup/setup-starship.sh.
if [ -r "${CORELLIA_HOME:-}/src/conf/starship/init.sh" ]; then
  . "$CORELLIA_HOME/src/conf/starship/init.sh"
fi

# Last, so it can wrap the widgets everything above bound — in particular
# oh-my-zsh's history-substring-search, whose up and down widgets it clears the
# suggestion for.
#
# zsh only. The nearest bash equivalent, ble.sh, isn't worth its startup cost.
if [ -n "${ZSH_VERSION:-}" ] && [ -n "${HOMEBREW_PREFIX:-}" ] &&
  [ -r "$HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh" ]; then
  # fg=8 is nearly invisible on Carbonfox; fg=244 without bold — bold inherits from
  # starship's character module and reads as solid white until zle redraws.
  ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=244'
  . "$HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
fi

unset _corellia_shell
