# macOS Setup

Getting a new Mac from "just unboxed" to "ready to work".

## Bootstrap

Phase 1 runs over curl, because the repo isn't on disk yet. It installs the Xcode
command line tools, Rosetta, Touch ID for sudo, Homebrew, oh-my-zsh, and Ghostty,
then clones this repo.

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-zsh.sh)"
```

Open Ghostty, then run the rest:

```sh
cd ~/Code/OpenSource/corellia
./src/scripts/setup/bootstrap.sh --name <this-machine>
```

On a work machine, add `--skip-managed` so it doesn't install software your IT
department owns:

```sh
./src/scripts/setup/bootstrap.sh --name <this-machine> --skip-managed
```

That flag is inferred automatically on a machine with MDM enrollment or a
`~/.config/work` directory; pass `--include-managed` to override the guess.

Finally, open a new shell so `mise`, `direnv`, and `starship` load.

### Phases

`bootstrap.sh` is a convenience wrapper. Every phase is independently runnable
and safe to re-run, so use them directly when you only need one.

| Script                     | What it does                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `setup-zsh.sh`             | Xcode CLT, Rosetta, Touch ID for sudo, Homebrew, oh-my-zsh, Ghostty, clone corellia              |
| `setup-macos.sh`           | Homebrew packages, shell and git config, SSH identity, clone repos, macOS quirks                  |
| `setup-managed-apps.sh`    | The apps IT normally owns, or a checklist of them when skipped                                    |
| `setup-macos-defaults.sh`  | System Settings: computer name, trackpad, Dock, screenshots, Spotlight hotkeys                    |
| `setup-languages.sh`       | Node via mise, global npm CLIs, Python tooling via uv, skillz agent skills                        |

### What lives where

Configuration is version controlled in this repo and linked into place, rather
than appended to your dotfiles by a script. Edit the files here, not the copies
in `$HOME`.

- `src/conf/Brewfile`, `src/conf/Brewfile.managed` — packages
- `src/conf/zsh/*.zsh` — shell config, sourced by one loader block in `~/.zshrc`
- `src/conf/direnv/direnv.toml` — direnv
- `src/conf/ghostty/config` — terminal
- `src/conf/gitignore` — global gitignore, registered as `core.excludesfile`
- `src/conf/DefaultKeyBinding.dict` — the Home/End fix

Machine-specific, non-secret overrides go in `~/.zshrc.local`, which the loader
sources last.

oh-my-zsh is part of that, and stays small: `src/conf/zsh/05-oh-my-zsh.zsh` sources
it with no theme (starship draws the prompt) and one plugin. `~/.zshrc` holds only
the loader, so oh-my-zsh's template — with its own theme and plugin list — never
gets written.

## Manual Configurations

What macOS won't let a script do. `setup-macos-defaults.sh` already covers the
battery percentage, tap to click, bottom-right secondary click, hiding the Dock,
keeping windows when quitting, the screenshot location, and freeing Cmd+Space
from Spotlight.

1. Change the default web browser (System Settings > Desktop & Dock)
1. Configure Dock icons
1. Configure Raycast on Cmd+Space, including its window management hotkeys
   (Raycast replaces Spectacle, which was discontinued in 2020)
1. Sign in to Cursor and enable Settings Sync
1. Install the [Google Drive client](https://www.google.com/drive/download/)
1. Install [ScrollReverser](https://pilotmoon.com/scrollreverser/)
1. Keychain: export each certificate and private key individually from Keychain
   Access. Right-click and "Export" one at a time or they won't be included.
1. Restart any app that was already running, so it picks up the Home/End key
   bindings.

## Secrets

Do not `export` credentials from `~/.zshrc`. A global export leaks into every
process the shell starts, lands in shell history and crash reports, and long
outlives the project that needed it. Two mechanisms replace it.

### Project-local config: direnv

`direnv` is installed by the Brewfile, hooked into zsh by `src/conf/zsh/20-tools.zsh`,
and configured by `src/conf/direnv/direnv.toml`. Give each project an `.envrc`
holding the non-sensitive context it needs; it loads on `cd` in and unloads on
`cd` out.

```sh
# ~/Code/OpenSource/some-project/.envrc
export AWS_PROFILE=personal
export GOOGLE_CLOUD_PROJECT=patrick-hulce-personal
export DATABASE_URL=postgres://localhost:5432/some_project_dev
```

Run `direnv allow` once per project to trust the file. Both `.env` and `.envrc`
are gitignored globally, so commit an `.envrc.example` when a project needs to
document which variables it expects.

### Real secrets: 1Password CLI, on demand

1Password and its CLI are in `src/conf/Brewfile` (on a work machine, take the app
from your company's portal instead). Enable Settings > Developer > "Integrate with
1Password CLI" in the desktop app so `op` authenticates with Touch ID.

Store secret _references_ (`op://vault/item/field`) rather than values, and
resolve them only for the process that needs them:

```sh
# .env — references, not values
GH_TOKEN=op://Private/github/token
NPM_TOKEN=op://Private/npm/token
```

```sh
op run --env-file=.env -- npm publish
```

`op run` resolves the references into a subprocess, masks them if they appear in
output, and they vanish when the command exits. For one-offs, `op read` pulls a
single value without persisting it:

```sh
gh auth login --with-token <<< "$(op read 'op://Private/github/token')"
```

Rotating a credential in 1Password then updates every project and every machine
at once, and no plaintext value ever touches disk.

If a secret genuinely needs to be present for a whole shell session, resolve it
in `.envrc` with `op read` rather than pasting the value. Prefer `op run`:
anything exported into the shell is readable by every process started from it.

### SSH, git, and cloud

- **SSH**: an ordinary `~/.ssh/id_ed25519`. `setup-macos.sh` generates it, adds it
  to ssh-agent with `--apple-use-keychain`, and writes an `~/.ssh/config` catch-all
  with `AddKeysToAgent` and `UseKeychain`, so the passphrase is asked for once and
  then remembered across reboots. 1Password's SSH agent is deliberately not part
  of this — keys are a normal key file, and 1Password is for secrets.
- **GitHub**: `setup-macos.sh` runs `gh auth login` if you aren't signed in, then
  uploads the public key with `gh ssh-key add`. `gh` keeps its token in the login
  Keychain, so there's no need for `GH_TOKEN` in the environment at all.
- **Google Cloud**: `gcloud auth application-default login` writes short-lived
  credentials, so `GOOGLE_APPLICATION_CREDENTIALS` has nothing to point at. Only
  fall back to a downloaded service-account JSON key when something genuinely
  cannot use ADC, and scope it to a single project via `.envrc`.

## Other platforms

`setup-linux.sh`, `setup-wsl.sh`, and `setup-ffmpeg.sh` predate this rewrite and
target Ubuntu 22.04. They have known problems (retired `apt-key` usage, the
replaced `nvidia-docker2` package, a hardcoded hostname) and are due their own
pass. Read them before running them.

## Legacy notes

<details>
<summary>Epson scanner agents</summary>

Epson's software installs two login agents that add a menu bar icon and
notifications. `setup-macos.sh` disables them automatically when the software is
present; the manual version is:

```sh
launchctl disable "gui/$(id -u)/com.epson.scannermonitor"
launchctl disable "gui/$(id -u)/com.epson.eventmanager.agent"
```

See [this writeup](https://stevenwestmoreland.com/2020/07/how-to-remove-the-epson-scansmart-icon-from-the-macos-menu-bar.html).

</details>

<details>
<summary>What this setup replaced</summary>

For anyone wondering where a familiar tool went:

- `nvm` and `sdkman` → `mise`, which reads the same `.nvmrc` files
- `conda` and `pipx` → `uv`
- `diff-so-fancy` → `delta`, a Homebrew formula instead of a global npm package
- `hub` → `gh`
- Spectacle → Raycast
- iTerm2 and its binary `.plist` → Ghostty and a text config
- Long `brew install` lines → `Brewfile` and `brew bundle`
- Always-on mysql, postgresql, and redis services → per-project containers, or
  install one on demand
- Global `typescript` and `yarn` → project dependencies

</details>
