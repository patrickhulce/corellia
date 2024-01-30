#!/bin/bash

set -euxo pipefail

# Install brew dependencies
brew update
brew install git mysql redis postgresql coreutils findutils rename jq git-lfs direnv ffmpeg hub
brew install --cask google-chrome google-chrome-canary firefox spotify spectacle docker slack google-cloud-sdk rescuetime microsoft-edge raycast miniconda

brew services start mysql
brew services start postgresql
brew services start redis

# Configure SSH
ssh-keygen -t ed25519 -C "patrick@$(hostname | sed 's/.local//')"
# TODO: figure out how to add this to GitHub

# Configure git
sudo git lfs install --system
git config --global --user.name 'Patrick Hulce'
git config --global --user.name 'patrick.hulce@gmail.com'
git config --global core.pager "diff-so-fancy | less --tabs=4 -RF"
git config --global interactive.diffFilter "diff-so-fancy --patch"
git config --global core.excludesfile ~/.gitignore
cat > ~/.gitignore <<EOF
.vscode/
.idea/
.nyc_output/
coverage/
node_modules/

*.local
*.secret
.envrc

npm-debug.log
yarn-error.log
lerna-debug.log

# from https://gist.github.com/octocat/9257657
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
EOF

# Install NVM https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

nvm install v20
nvm alias default v20
nvm use v20

# Install direnv hook
echo '\n# automatically load .envrc files\neval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc

# Install conda hooks
conda init "$(basename "${SHELL}")" # Setup conda in your shell
conda config --set auto_activate_base false # Don't activate by default

# Install Home/End Fix KeyBindings
# See https://apple.stackexchange.com/questions/16135/remap-home-and-end-to-beginning-and-end-of-line/271111
mkdir -p ~/Library/KeyBindings && cat > ~/Library/KeyBindings/DefaultKeyBinding.dict <<EOF
{
    "\UF729"  = moveToBeginningOfLine:; // home
    "\UF72B"  = moveToEndOfLine:; // end
    "$\UF729" = moveToBeginningOfLineAndModifySelection:; // shift-home
    "$\UF72B" = moveToEndOfLineAndModifySelection:; // shift-end
}
EOF

# Install ZSH configurations / hacks
cat >> ~/.zshrc <<'EOF'
export PATH="$PATH:$HOME/.scripts"

alias chrome='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome'
alias chrome-canary='/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary'
EOF

# Setup key repositories.

mkdir -p ~/Code/OpenSource
mkdir -p ~/Code/Playgrounds

cd ~/Code/OpenSource
git clone git@github.com:patrickhulce/corellia.git
git clone git@github.com:patrickhulce/blog.patrickhulce.com.git
