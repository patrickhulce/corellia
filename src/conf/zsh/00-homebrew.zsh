# Homebrew environment.
#
# setup-zsh.sh also writes this into ~/.zprofile, which covers login shells.
# Repeating it here is idempotent and makes non-login shells (and shells started
# before that file existed) work too.

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  # Intel Macs, and Apple Silicon machines running under Rosetta.
  eval "$(/usr/local/bin/brew shellenv)"
fi
