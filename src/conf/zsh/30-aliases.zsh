# Aliases.
#
# Nothing here shadows a coreutil. `ls`, `cat`, and friends keep their usual
# behaviour so copied-and-pasted commands and scripts stay predictable.

alias chrome='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome'
alias chrome-canary='/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary'

if command -v eza >/dev/null 2>&1; then
  alias ll='eza --long --git --group-directories-first'
  alias la='eza --long --all --git --group-directories-first'
  alias lt='eza --tree --level=2 --group-directories-first'
fi
