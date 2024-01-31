#!/bin/bash

set -eo pipefail
npm install -g diff-so-fancy pkgfiles siegem yarn pnpm source-map-explorer @patrickhulce/scripts jest typescript
nvm install v18 --reinstall-packages-from=v20
