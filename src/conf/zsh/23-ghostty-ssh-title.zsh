# Ghostty tab titles and starship's tmux segment. Over SSH: "host: ~/path" at a
# prompt, "host: command" while one runs. In tmux: prepend "󯈈 session" to that
# prefix. Ghostty's built-in title integration only shows cwd/command and does
# not include the remote hostname.
#
# zsh-only — uses precmd/preexec hooks and zsh prompt expansion.

if [ -n "${ZSH_VERSION:-}" ] && { [ -n "${SSH_CONNECTION:-}" ] || [ -n "${TMUX:-}" ]; }; then
  # zsh sets $HOST at startup on every platform. $HOSTNAME is an optional env var
  # that SSH sessions often omit (Linux and macOS). hostname -s is the fallback.
  _corellia_ssh_title_host=${${HOST:-${HOSTNAME:-$(hostname -s 2>/dev/null)}}%%.*}

  _corellia_tmux_session_name() {
    local sess

    if [ -z "${TMUX:-}" ]; then
      return 1
    fi

    sess="$(tmux display-message -p '#S' 2>/dev/null)" || return 1
    [ -n "$sess" ] || return 1
    print -rn -- "$sess"
  }

  _corellia_sync_tmux_prompt() {
    local sess

    sess="$(_corellia_tmux_session_name)" || {
      unset CORELLIA_TMUX_SESSION
      return
    }

    if [ -n "$sess" ]; then
      export CORELLIA_TMUX_SESSION="$sess"
    else
      unset CORELLIA_TMUX_SESSION
    fi
  }

  _corellia_title_prefix() {
    local bits=()
    local prefix

    if [ -n "${SSH_CONNECTION:-}" ]; then
      bits+=("${_corellia_ssh_title_host}")
    fi

    if [ -n "${TMUX:-}" ]; then
      local sess

      sess="$(_corellia_tmux_session_name)" || return 1
      [ -n "$sess" ] || return 1
      bits+=($'\uebc8'" $sess")
    fi

    if [ ${#bits[@]} -eq 0 ]; then
      return 1
    fi

    if [ -n "${SSH_CONNECTION:-}" ]; then
      prefix="${bits[1]}:"
      if [ ${#bits[@]} -gt 1 ]; then
        prefix="${prefix} ${bits[2]}  "
      else
        prefix="${prefix} "
      fi
    else
      prefix="${(pj:  :)bits}  "
    fi

    print -rn -- "$prefix"
  }

  _corellia_ssh_title_precmd() {
    local prefix

    _corellia_sync_tmux_prompt
    prefix="$(_corellia_title_prefix)" || return
    print -rn $'\e]2;'${prefix}${(%):-%~}$'\a'
  }

  _corellia_ssh_title_preexec() {
    # $1 is the full command line; collapse newlines so multiline input doesn't break OSC.
    local cmd=${1//$'\n'/ }
    local prefix

    prefix="$(_corellia_title_prefix)" || return
    print -rn $'\e]2;'${prefix}${cmd}$'\a'
  }

  precmd_functions+=(_corellia_ssh_title_precmd)
  preexec_functions+=(_corellia_ssh_title_preexec)
  _corellia_sync_tmux_prompt
fi
