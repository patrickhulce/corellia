# Editor extensions

A reference list, not an install step. Both Cursor and VS Code sync extensions
through their own accounts — Settings Sync is already a line on the
[manual checklist](mac-setup.md#manual-configurations) — so scripting the install
would fight the sync rather than help it, and the losing side is whichever ran
last.

What this list is for is the case sync doesn't cover: deciding what belongs on a
new machine, or rebuilding after signing in with a different account. Install
what you actually want:

```sh
code --install-extension esbenp.prettier-vscode
cursor --install-extension rust-lang.rust-analyzer
```

Regenerate either list after a deliberate change:

```sh
code   --list-extensions | grep -v '^netflix\.' | sort
cursor --list-extensions | grep -v '^netflix\.' | sort
```

`netflix.*` extensions are deliberately excluded. They resolve only against an
internal registry, so they fail on a personal machine and belong to the work
dotfiles instead.

## VS Code

```
anthropic.claude-code
charliermarsh.ruff
coder.coder-remote
dbaeumer.vscode-eslint
dkundel.vscode-new-file
docker.docker
editorconfig.editorconfig
esbenp.prettier-vscode
foxundermoon.shell-format
mechatroner.rainbow-csv
mhutchie.git-graph
ms-azuretools.vscode-containers
ms-azuretools.vscode-docker
ms-python.debugpy
ms-python.python
ms-python.vscode-pylance
ms-python.vscode-python-envs
ms-toolsai.jupyter
ms-toolsai.jupyter-keymap
ms-toolsai.jupyter-renderers
ms-toolsai.tensorboard
ms-toolsai.vscode-jupyter-cell-tags
ms-toolsai.vscode-jupyter-slideshow
ms-vscode-remote.remote-containers
ms-vscode-remote.remote-ssh
ms-vscode-remote.remote-ssh-edit
ms-vscode-remote.vscode-remote-extensionpack
ms-vscode.makefile-tools
ms-vscode.remote-explorer
ms-vscode.remote-server
redhat.vscode-xml
tamasfe.even-better-toml
timonwong.shellcheck
vscode-icons-team.vscode-icons
yoavbls.pretty-ts-errors
ziyasal.vscode-open-in-github
```

## Cursor

Deliberately a shorter list than the VS Code one: Cursor builds in the AI, git,
and remote features several of those extensions provide. The `anysphere.*`
entries are Cursor's own and have no VS Code equivalent.

```
anthropic.claude-code
anysphere.cursorpyright
anysphere.remote-ssh
bradlc.vscode-tailwindcss
charliermarsh.ruff
coder.coder-remote
dbaeumer.vscode-eslint
detachhead.basedpyright
esbenp.prettier-vscode
mechatroner.rainbow-csv
ms-python.debugpy
ms-python.python
ms-python.vscode-pylance
ms-python.vscode-python-envs
ms-toolsai.jupyter
ms-toolsai.jupyter-renderers
ms-toolsai.vscode-jupyter-cell-tags
ms-toolsai.vscode-jupyter-slideshow
ms-vscode.makefile-tools
reduckted.vscode-gitweblinks
rust-lang.rust-analyzer
```
