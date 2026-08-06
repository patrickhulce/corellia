# Homebrew environment.
#
# setup-zsh.sh also writes this into ~/.zprofile, which covers login shells.
# Repeating it here is idempotent and makes non-login shells (and shells started
# before that file existed) work too.
#
# Nothing installs Homebrew on Linux — setup-linux.sh uses apt and the upstream
# installers instead — but a machine that has it anyway should still find it,
# since HOMEBREW_PREFIX is what 10-path.zsh and 20-tools.zsh look under.

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  # Intel Macs, and Apple Silicon machines running under Rosetta.
  eval "$(/usr/local/bin/brew shellenv)"
elif [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi
