# Ghostty tab titles when connected over SSH. At a prompt: "host: ~/path".
# While a command runs: "host: command". Ghostty's built-in title integration
# only shows cwd/command and does not include the remote hostname.
#
# zsh-only — uses precmd/preexec hooks and zsh prompt expansion.

if [ -n "${ZSH_VERSION:-}" ] && [ -n "${SSH_CONNECTION:-}" ]; then
  # zsh sets $HOST at startup on every platform. $HOSTNAME is an optional env var
  # that SSH sessions often omit (Linux and macOS). hostname -s is the fallback.
  _corellia_ssh_title_host=${${HOST:-${HOSTNAME:-$(hostname -s 2>/dev/null)}}%%.*}

  _corellia_ssh_title_precmd() {
    print -rn $'\e]2;'${_corellia_ssh_title_host}': '${(%):-%~}$'\a'
  }

  _corellia_ssh_title_preexec() {
    # $1 is the full command line; collapse newlines so multiline input doesn't break OSC.
    local cmd=${1//$'\n'/ }
    print -rn $'\e]2;'${_corellia_ssh_title_host}': '${cmd}$'\a'
  }

  precmd_functions+=(_corellia_ssh_title_precmd)
  preexec_functions+=(_corellia_ssh_title_preexec)
fi
