# Auto-activate a project .venv on cd and shell start. Active venvs are shown by
# starship's $python module ($VIRTUAL_ENV). Global is exported only in a
# pyproject.toml project (cwd or git root). zsh-only; must still parse under bash.

if [ -n "${ZSH_VERSION:-}" ]; then
  _corellia_pyproject_context=false

  _corellia_update_pyproject_context() {
    if [ -f pyproject.toml ]; then
      _corellia_pyproject_context=true
      return
    fi

    local root
    root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
      _corellia_pyproject_context=false
      return
    }

    if [ -f "$root/pyproject.toml" ]; then
      _corellia_pyproject_context=true
    else
      _corellia_pyproject_context=false
    fi
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

  _corellia_deactivate_venv() {
    if typeset -f deactivate >/dev/null 2>&1; then
      deactivate
      return
    fi

    if [ -n "${VIRTUAL_ENV:-}" ]; then
      path=(${(@)path:#${VIRTUAL_ENV}/bin})
      unset VIRTUAL_ENV VIRTUAL_ENV_PROMPT
    fi
  }

  _corellia_manage_venv() {
    local target=""

    if [ -r ".venv/bin/activate" ]; then
      target="${PWD:A}/.venv"
    fi

    if [ -n "${VIRTUAL_ENV:-}" ]; then
      if [ -z "$target" ] || [ "${VIRTUAL_ENV:A}" != "$target" ]; then
        _corellia_deactivate_venv
      fi
    fi

    if [ -n "$target" ] && [ -z "${VIRTUAL_ENV:-}" ]; then
      . "$target/bin/activate" 2>/dev/null
    fi

    _corellia_sync_py_prompt
  }

  _corellia_on_chpwd() {
    _corellia_update_pyproject_context
    _corellia_manage_venv
  }

  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd _corellia_on_chpwd
  add-zsh-hook precmd _corellia_sync_py_prompt
  _corellia_on_chpwd
fi
