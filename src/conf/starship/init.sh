# starship prompt setup, for any dotfiles to source:
#
#   . ~/.config/starship/init.sh
#
# Split out from src/conf/zsh/20-tools.zsh so a work laptop or an ssh-only box
# can have the prompt without the rest of corellia. setup-starship.sh installs
# this and starship.toml into ~/.config/starship there.
#
# Sourced, not run: no shebang, and no `set -e` — it would follow the caller out.
#
# shellcheck shell=sh

# An explicitly chosen config wins; otherwise prefer the checkout, so edits there
# are live.
if [ -z "${STARSHIP_CONFIG:-}" ]; then
  for _corellia_starship_config in \
    "${CORELLIA_HOME:-}/src/conf/starship/starship.toml" \
    "$HOME/.config/starship/starship.toml"; do
    if [ -r "$_corellia_starship_config" ]; then
      export STARSHIP_CONFIG="$_corellia_starship_config"
      break
    fi
  done
  unset _corellia_starship_config
fi

# Guarded, so a half-finished install still gives you a working shell. The shell
# is detected rather than hardcoded because this is sourced from bash too.
if command -v starship >/dev/null 2>&1; then
  if [ -n "${ZSH_VERSION:-}" ]; then
    eval "$(starship init zsh)"
  else
    eval "$(starship init bash)"
  fi
fi
