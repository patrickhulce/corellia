# Aliases.
#
# Nothing here shadows a coreutil. `ls`, `cat`, and friends keep their usual
# behaviour so copied-and-pasted commands and scripts stay predictable.

# Guarded on the binary rather than on the OS, so a Linux box gets no alias
# pointing into a directory it doesn't have and `chrome` stays a clean "command
# not found" instead of a path that reads like a broken install.
if [ -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ]; then
  alias chrome='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome'
fi

if [ -x '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' ]; then
  alias chrome-canary='/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary'
fi

if command -v eza >/dev/null 2>&1; then
  alias ll='eza --long --git --group-directories-first'
  alias la='eza --long --all --git --group-directories-first'
  alias lt='eza --tree --level=2 --group-directories-first'
fi
