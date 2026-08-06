# Linux setup

Provisioning a headless Linux machine — a GPU box, a cloud VM, WSL, or anything
you only reach over ssh — with the same shell, prompt, and CLI tooling as the
Mac. For a Mac, see [mac-setup.md](mac-setup.md).

Debian and Ubuntu only. Everything here assumes `apt`.

## Running it

One command, on a machine with nothing on it:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-linux.sh)"
```

It installs `git` and `curl` if they're missing, clones this repo to
`~/.corellia` — shallow, blobless, and sparse, the same checkout the Mac gets —
and then hands over to the copy on disk. From a checkout it skips all of that:

```sh
./src/scripts/setup/setup-linux.sh --name my-box
```

Safe to re-run; re-running is how you pick up a change. `--name` sets the system
hostname and is skipped when not given.

### Phases

Unlike the Mac, this is one script rather than five. There's no Xcode installer
dialog to wait on and no shell to replace mid-flight, so there is nothing to
split at.

| Phase          | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| Hostname       | `hostnamectl set-hostname`, only with `--name`                       |
| Packages       | The three tiers below                                                |
| Shell          | oh-my-zsh, the `~/.zshrc` loader block, `~/.scripts`, `chsh` to zsh  |
| Git            | Identity, delta as the pager, global gitignore, git-lfs             |
| SSH identity   | An ed25519 key, `~/.ssh/config`, the GitHub host key, `gh ssh-key add` |
| Repositories   | `~/Code/OpenSource`, the corellia remote switched to SSH, blog, skillz |
| Languages      | Delegates to `setup-languages.sh`, the same script the Mac runs      |

Log out and back in afterwards: `chsh` doesn't affect the session you ran it
from, and `~/.local/bin` and `~/.cargo/bin` only reach `PATH` through
`src/conf/zsh/10-path.zsh`.

## Packages

`src/conf/Brewfile` is the macOS counterpart to this list, and the two are meant
to stay in step. Three tiers, because the distribution archives are excellent
for most of it and years behind for the rest.

**Tier one — the archive, as-is.** `zsh`, `zsh-autosuggestions`, `git`,
`git-lfs`, `jq`, `ripgrep`, `btop`, `direnv`, `tmux`, `zoxide`, `httpie`,
`tldr`, `ffmpeg`, `imagemagick`, `exiftool`, `rename`, `shellcheck`, and the
native build toolchain (`build-essential`, `cmake`, `meson`, `nasm`, `yasm`,
`pkg-config`, `clang-format`).

Each name is checked against the archive before the install rather than handed
to `apt` blind, because `apt` fails the whole transaction over one package it
doesn't recognise and the archives differ enough between releases that a single
missing tool would take the other thirty with it. Anything this release doesn't
carry is reported and skipped.

**Tier two — the archive, under the wrong name.** Debian renamed two of these to
avoid collisions, so `fd-find` installs `fdfind` and `bat` installs `batcat`.
Both get a symlink in `~/.local/bin` under the name everything actually expects.

**Tier three — upstream, because the archive is too old or has nothing.**

| Tool             | Why not apt                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `mise`, `uv`     | Not packaged. Both are what this setup replaced conda, pipx, and nvm with |
| `rustup`         | Not packaged. Installed with `--default-toolchain none`; `setup-languages.sh` adds stable |
| `starship`       | Not packaged                                                          |
| `fzf`            | `fzf --zsh`, which `20-tools.zsh` loads the integration with, needs 0.48. 22.04 has 0.29 and 24.04 has 0.44 |
| `gh`             | Not packaged; GitHub publishes its own apt repository                  |
| `eza`            | In the archive from 24.04. Older releases get the project's repository |
| `git-delta`      | In the archive from 24.04. Older releases get the project's `.deb`     |
| `shfmt`          | Recent releases only; otherwise the same binary CI downloads           |
| `awscli`         | The archive's is version 1, a different product                        |
| `deno`           | Not packaged; installed through `mise`, which already owns runtimes    |

`rustup` and `mise` install the toolchains rather than being them, so Node, the
Rust stable toolchain, the global npm CLIs, the `uv` tools, and the agent skills
all come from `setup-languages.sh` — the same script, unchanged, that the Mac
runs as its last phase.

### Not installed

Deliberately, since this targets machines with no screen attached:

- Everything from the `cask` half of the Brewfile: Ghostty, Zed, browsers,
  1Password, Discord, Spotify, and the rest. `src/conf/ghostty/config` and the
  Zed settings are for the machine you sit at, and `ghosttyctrl` drives Ghostty
  over AppleScript, so none of it means anything here.
- Fonts. FiraCode Nerd Font is what draws starship's glyphs, and that rendering
  happens in your local terminal, not on the box you sshed into.
- `mas`, the Mac App Store CLI, and the `setup-macos-defaults.sh` and
  `setup-app-prefs.sh` phases.
- `wasm-pack`, which has no package here. `cargo install wasm-pack` when a
  project needs it.

Terminfo is handled: `src/conf/zsh/21-term.zsh` installs the bundled
`xterm-ghostty` entry on any host that lacks it, so tmux and htop work over ssh
from Ghostty without falling back to `xterm-256color`.

## GPU

<a id="gpu"></a>

NVIDIA drivers, CUDA, Docker, and the container toolkit are a separate script,
never run by the one above:

```sh
./src/scripts/setup/setup-linux-gpu.sh [--wsl] [--skip-docker]
```

Most machines this repo provisions have no GPU, and this installs kernel modules
and a container runtime — a decision worth making on purpose.

WSL is detected automatically and skips the driver: the GPU there is the Windows
host's, its driver is projected into the guest at `/usr/lib/wsl/lib`, and
installing a Linux one over the top is the documented way to break it. CUDA also
comes from NVIDIA's `wsl-ubuntu` repository rather than the one named for the
release. `setup-wsl.sh` is still there as the name to reach for, but it is a
one-line wrapper passing `--wsl`; there is nothing in it you need to run.

Containers see the GPU only when asked — `docker run --gpus all`. `nvidia` is
deliberately not Docker's default runtime.

It installs the newest non-open, non-server driver branch `ubuntu-drivers`
offers and holds it with `apt-mark`, so an unattended upgrade can't swap it out
from under a loaded module and leave `nvidia-smi` reporting a version mismatch.
CUDA comes from NVIDIA's own repository as the `cuda-toolkit` metapackage; pin a
version with `CORELLIA_CUDA_PACKAGE=cuda-toolkit-12-6` if you need one. The CUDA
`PATH` and `LD_LIBRARY_PATH` go in `~/.zshrc.local`, which the corellia loader
sources last.

A driver install needs a reboot before the module loads, and the `docker` group
needs a new login session, so `nvidia-smi` and `docker run --gpus all` are worth
checking after that rather than immediately.

`setup-ffmpeg.sh` builds ffmpeg from source with DeckLink capture, NVENC/NVDEC,
and OpenEXR. Almost nobody wants it — the packaged ffmpeg from tier one covers
everything short of talking to a capture card or encoding on the GPU — and it
needs the BlackMagic SDK downloaded by hand. The build lands in
`~/code/ffmpeg/bin`, deliberately not on `PATH`, so it can't shadow the packaged
one.

## Differences from the Mac

Mostly the identity handling, and all of it is in `lib/ssh.sh`:

- **ssh-agent.** macOS runs one per session through launchd. Here there often
  isn't one, so `load_ssh_key` starts it rather than letting `ssh-add` fail with
  "Could not open a connection to your authentication agent".
- **The passphrase.** `UseKeychain` and `ssh-add --apple-use-keychain` are
  Apple's, and OpenSSH elsewhere *rejects* the `UseKeychain` keyword rather than
  ignoring it — which, in a `Host *` block, would break every ssh on the
  machine. So the block omits it, and a Linux box asks for the passphrase again
  after each reboot.
- **The login shell.** macOS has logged you into zsh since Catalina.
  `apt-get install zsh` puts the shell on disk and leaves the account in bash,
  so `ensure_login_shell` runs `chsh` — through `sudo`, since a box reached over
  ssh may have no account password for `chsh` to ask for.

Everything else — the loader block, the git configuration, the key generation
and `gh` upload, the repository clones — is the same code, in `lib/shell.sh`,
`lib/git.sh`, and `lib/ssh.sh`.

## Shell compatibility

The Linux scripts are held to bash 3.2 like the macOS ones, and CI checks them
on a macOS runner with `/bin/bash -n`. Every Linux has bash 5, so this looks
gratuitous; the reason is that both platforms source the same `lib/`, and a
construct added there that bash 3.2 won't parse would only ever surface on a
Mac. See [mac-setup.md](mac-setup.md#shell-compatibility) for what 3.2 rejects.
