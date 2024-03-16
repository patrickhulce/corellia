#!/bin/bash

set -eo pipefail
npm install -g diff-so-fancy pkgfiles siegem yarn pnpm source-map-explorer @patrickhulce/scripts jest typescript
nvm install v18 --reinstall-packages-from=v20

pipx install jupyter-core
pipx install nbconvert
git config --global filter.strip-notebook-output.clean 'jupyter nbconvert --ClearOutputPreprocessor.enabled=True --to=notebook --stdin --stdout --log-level=ERROR'
