# Shell integrations for the tools in src/conf/Brewfile.
#
# Each is guarded so a partially-installed machine still gets a working shell.

# Load project-local .envrc files on cd. This is where per-project config and
# 1Password secret references live; see src/docs/setup/mac-setup.md#secrets.
if command -v direnv >/dev/null 2>&1; then
  eval "$(direnv hook zsh)"
fi

# Node, Java, and Go versions, resolved per project from .tool-versions,
# .node-version, or .nvmrc. Replaces nvm and sdkman.
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate zsh)"
fi

if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

if command -v fzf >/dev/null 2>&1; then
  source <(fzf --zsh)
fi

# Prompt, in place of an oh-my-zsh theme. 05-oh-my-zsh.zsh leaves ZSH_THEME
# empty so nothing is drawn twice.
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

# Last, so it can wrap the widgets everything above bound — in particular
# oh-my-zsh's history-substring-search, whose up and down widgets it clears the
# suggestion for.
if [ -n "${HOMEBREW_PREFIX:-}" ] &&
  [ -r "$HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh" ]; then
  source "$HOMEBREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
fi
