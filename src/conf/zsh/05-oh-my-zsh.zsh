# oh-my-zsh, kept deliberately small.
#
# It's loaded from here rather than from ~/.zshrc so the configuration is
# version controlled, and because everything oh-my-zsh is usually installed for
# is already covered elsewhere: starship draws the prompt, zsh-autosuggestions
# comes from Homebrew, and 20-tools.zsh and 30-aliases.zsh handle the rest. What
# remains is its history, completion, and key binding defaults.

if [ -d "$HOME/.oh-my-zsh" ]; then
  export ZSH="$HOME/.oh-my-zsh"

  # Empty on purpose: starship replaces the prompt a moment later in
  # 20-tools.zsh, so loading a theme here is startup time spent on nothing.
  ZSH_THEME=""

  # A short list on purpose. git for its aliases, and history-substring-search to
  # make the up arrow filter history by what's already typed. Anything else here
  # either duplicates a Homebrew tool or goes unused.
  #
  # history-substring-search has to load before zsh-autosuggestions, which
  # 20-tools.zsh handles by loading later.
  plugins=(git history-substring-search)

  # oh-my-zsh precomputes git_prompt_info in the background before each prompt,
  # for themes to display. With no theme nothing reads it and starship works out
  # the repository status itself, so it's a fork per prompt for a discarded value.
  zstyle ':omz:alpha:lib:git' async-prompt no

  # Never self-update. Homebrew is how everything else here gets updated, and the
  # default behaviour is to stop and ask, which hangs any shell that isn't a human
  # sitting at a terminal. Run `omz update` when you want it.
  #
  # Deliberately not `zstyle ':omz:update' mode disabled`: setting that zstyle at
  # all is what makes oh-my-zsh ignore this variable, so don't set both.
  DISABLE_AUTO_UPDATE="true"

  # Don't count untracked files when deciding whether a repository is dirty. It's
  # a large speedup in big repositories.
  DISABLE_UNTRACKED_FILES_DIRTY="true"

  # Skip oh-my-zsh's paste and URL-quoting wrappers, whose most noticeable
  # effect is making long pastes slow.
  DISABLE_MAGIC_FUNCTIONS=true

  source "$ZSH/oh-my-zsh.sh"
fi
