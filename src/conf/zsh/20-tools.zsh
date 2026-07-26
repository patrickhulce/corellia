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
if [ -n "${ZSH_VERSION:-}" ]; then
  _corellia_autosuggest=""
  ZSH_CUSTOM="${ZSH_CUSTOM:-${ZSH:-$HOME/.oh-my-zsh}/custom}"
  for _corellia_autosuggest in \
    "${HOMEBREW_PREFIX:-}/share/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "$ZSH_CUSTOM/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "/usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh"; do
    if [ -r "$_corellia_autosuggest" ]; then
      # fg=8 is nearly invisible on Carbonfox. No dimmed — faint SGR sticks on accepted
      # text after Tab merges POSTDISPLAY into BUFFER.
      ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=245'
      . "$_corellia_autosuggest"

      # history-substring-search (05-oh-my-zsh.zsh) installs a fallback highlighter when
      # zsh-syntax-highlighting is absent. On zsh 5.9 it hooks zle-line-pre-redraw and
      # clears region_highlight on every printable key — which wipes autosuggestion color
      # until a non-printable key like backspace redraws without clearing. Re-apply after
      # that hook runs (we register later, so this runs last).
      autoload -Uz add-zle-hook-widget
      _corellia_autosuggest_pre_redraw() {
        emulate -L zsh
        _zsh_autosuggest_highlight_reset
        # Tab-accept (25-keybindings.zsh) sets this so backspace can edit the
        # merged line without immediately re-suggesting the deleted suffix. In
        # tmux over SSH, fg=245 often renders as white and looks like the char
        # was not deleted.
        if (( ${+_corellia_autosuggest_suppress} )); then
          POSTDISPLAY=
          if [[ -n $KEYS && $KEYS == [[:print:]] ]]; then
            unset _corellia_autosuggest_suppress
          else
            return 0
          fi
        fi
        _zsh_autosuggest_highlight_apply
      }
      add-zle-hook-widget zle-line-pre-redraw _corellia_autosuggest_pre_redraw
      break
    fi
  done
  unset _corellia_autosuggest
fi

unset _corellia_shell
