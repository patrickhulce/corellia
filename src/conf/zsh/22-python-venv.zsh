# Auto-activate a project .venv on cd and shell start. Active venvs are shown by
# starship's $python module ($VIRTUAL_ENV). Global is exported only in a
# pyproject.toml project (cwd or git root). zsh-only; must still parse under bash.
#
# $VIRTUAL_ENV is only a label: it is inherited across `exec zsh`, tmux panes,
# and editor terminals, and says nothing about whether the venv is on PATH. So
# "activated" here means $VIRTUAL_ENV/bin is the *first* PATH entry, checked on
# every prompt. Treating the variable alone as the flag left shells whose PATH
# had been rebuilt by 00-homebrew.zsh and 10-path.zsh showing a venv in the
# prompt while `python` resolved to the global one.

if [ -n "${ZSH_VERSION:-}" ]; then
  _corellia_pyproject_context=false
  # Nearest .venv for the cwd, resolved on cd so the per-prompt check is a
  # string comparison rather than a directory walk.
  _corellia_venv_target=""
  # The venv we last saw activated, and one the user deactivated by hand and so
  # does not want put back until the next cd.
  _corellia_venv_activated=""
  _corellia_venv_optout=""

  # One `git rev-parse` per cd, shared by both lookups below.
  _corellia_update_dir_context() {
    local root dir

    root="$(git rev-parse --show-toplevel 2>/dev/null)" || root=""
    if [ -n "$root" ]; then
      root="${root:A}"
    fi

    if [ -f pyproject.toml ] || { [ -n "$root" ] && [ -f "$root/pyproject.toml" ]; }; then
      _corellia_pyproject_context=true
    else
      _corellia_pyproject_context=false
    fi

    # Search upwards so a subdirectory of a project keeps the project's venv.
    # The git root is the stopping point; outside a repo there isn't a
    # defensible one, and walking to / would pick up unrelated venvs.
    _corellia_venv_target=""
    dir="${PWD:A}"
    while :; do
      if [ -r "$dir/.venv/bin/activate" ]; then
        _corellia_venv_target="$dir/.venv"
        break
      fi
      if [ -z "$root" ] || [ "$dir" = "$root" ]; then
        break
      fi
      dir="${dir:h}"
    done
  }

  _corellia_venv_active() {
    [ -n "${VIRTUAL_ENV:-}" ] && [ "${path[1]:A}" = "${VIRTUAL_ENV:A}/bin" ]
  }

  _corellia_sync_py_prompt() {
    if [ -n "${VIRTUAL_ENV:-}" ]; then
      unset CORELLIA_PY_GLOBAL
    elif [ "$_corellia_pyproject_context" = true ]; then
      export CORELLIA_PY_GLOBAL=global
    else
      unset CORELLIA_PY_GLOBAL
    fi
  }

  # Both the literal and the resolved form, which differ when the venv is
  # reached through a symlink and only one of the two made it onto PATH.
  _corellia_strip_from_path() {
    local dir="$1"
    [ -n "$dir" ] || return 0
    path=(${(@)path:#$dir})
    path=(${(@)path:#${dir:A}})
  }

  _corellia_deactivate_venv() {
    local old="${VIRTUAL_ENV:-}"

    if typeset -f deactivate >/dev/null 2>&1; then
      deactivate
    fi

    if [ -n "$old" ]; then
      _corellia_strip_from_path "$old/bin"
      unset VIRTUAL_ENV VIRTUAL_ENV_PROMPT
      rehash 2>/dev/null
    fi
  }

  _corellia_activate_venv() {
    local target="$1"

    # activate prepends unconditionally, so an entry already on PATH — the
    # `exec zsh` case, where it survived but got pushed behind Homebrew —
    # would be left behind as a duplicate.
    _corellia_strip_from_path "$target/bin"
    if [ -n "${VIRTUAL_ENV:-}" ]; then
      _corellia_strip_from_path "${VIRTUAL_ENV}/bin"
      unset VIRTUAL_ENV VIRTUAL_ENV_PROMPT
    fi

    . "$target/bin/activate" 2>/dev/null
  }

  _corellia_manage_venv() {
    local target="$_corellia_venv_target"

    # A venv that was active on the last prompt and isn't now was deactivated by
    # hand. Honour that until the next cd instead of undoing it immediately.
    if [ -n "$_corellia_venv_activated" ] && [ -z "${VIRTUAL_ENV:-}" ]; then
      _corellia_venv_optout="$_corellia_venv_activated"
    fi

    if [ -n "${VIRTUAL_ENV:-}" ]; then
      if [ -z "$target" ] || [ "${VIRTUAL_ENV:A}" != "$target" ]; then
        _corellia_deactivate_venv
      fi
    fi

    if [ -n "$target" ] && [ "$_corellia_venv_optout" != "$target" ] &&
      ! _corellia_venv_active; then
      _corellia_activate_venv "$target"
    fi

    if _corellia_venv_active; then
      _corellia_venv_activated="${VIRTUAL_ENV:A}"
    else
      _corellia_venv_activated=""
    fi

    _corellia_sync_py_prompt
  }

  _corellia_on_chpwd() {
    _corellia_update_dir_context
    _corellia_venv_optout=""
    _corellia_venv_activated=""
    _corellia_manage_venv
  }

  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd _corellia_on_chpwd
  add-zsh-hook precmd _corellia_manage_venv
  _corellia_on_chpwd
fi
