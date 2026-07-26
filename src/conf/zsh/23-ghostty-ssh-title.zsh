# Ghostty tab titles when connected over SSH. At a prompt: "host: ~/path".
# While a command runs: "host: command". Ghostty's built-in title integration
# only shows cwd/command and does not include the remote hostname.
#
# zsh-only — uses precmd/preexec hooks and zsh prompt expansion.

if [ -n "${ZSH_VERSION:-}" ] && [ -n "${SSH_CONNECTION:-}" ]; then
  _corellia_ssh_title_precmd() {
    print -rn $'\e]2;'${HOSTNAME%%.*}': '${(%):-%~}$'\a'
  }

  _corellia_ssh_title_preexec() {
    print -rn $'\e]2;'${HOSTNAME%%.*}': '${1%%[[:space:]]*}$'\a'
  }

  precmd_functions+=(_corellia_ssh_title_precmd)
  preexec_functions+=(_corellia_ssh_title_preexec)
fi
