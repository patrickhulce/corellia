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
cd ~/.corellia
./src/scripts/setup/bootstrap.sh --name <this-machine>
```

On a work machine, add `--skip-managed` so it doesn't install software your IT
department owns:

```sh
./src/scripts/setup/bootstrap.sh --name <this-machine> --skip-managed
```

That flag is inferred automatically on a machine with MDM enrollment or work
dotfiles checked out; pass `--include-managed` to override the guess.

Finally, open a new shell so `mise`, `direnv`, and `starship` load.

### The setup checkout

`~/.corellia` is deliberately not `~/Code/OpenSource/corellia`. It's a shallow,
blobless, sparse clone holding only the four directories setup needs, listed in
[`src/scripts/setup/sparse-paths`](../../scripts/setup/sparse-paths):

```sh
git clone --depth=1 --filter=blob:none --sparse ... ~/.corellia
git -C ~/.corellia show HEAD:src/scripts/setup/sparse-paths |
  git -C ~/.corellia sparse-checkout set --stdin
```

That's under 1MB instead of the 11G a full clone pulls, most of which is side
projects and local scratch data that provisioning a Mac has no use for. The
checkout has to stay on disk permanently, because `~/.zshrc` sources its shell
config and the symlinks in `~/.config` point into it.

The `git show` is the interesting part. A `--sparse` clone checks out root-level
files and nothing else, so `src/` doesn't exist on disk when that list is needed —
which is the usual argument for keeping such a file at the repo root. Reading it
out of the object store instead lifts that constraint, so the list can live next to
the scripts that use it. On a blobless clone git fetches that single blob on
demand. `ensure_sparse_paths()` in `lib/common.sh` reads the same file straight
off disk, since by then it's checked out, and reapplies it on every
`setup-macos.sh` run so a directory added to the repo later shows up rather than
staying invisible.

To work on the monorepo itself, clone it properly and leave the setup checkout
alone:

```sh
git clone git@github.com:patrickhulce/corellia.git ~/Code/OpenSource/corellia
```

Or, to turn the setup checkout into a full one:

```sh
git -C ~/.corellia fetch --unshallow
git -C ~/.corellia sparse-checkout disable
```

### Phases

`bootstrap.sh` is a convenience wrapper. Every phase is independently runnable
and safe to re-run, so use them directly when you only need one.

| Script                    | What it does                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `setup-zsh.sh`            | Xcode CLT, Rosetta, Touch ID for sudo, Homebrew, oh-my-zsh, Ghostty, clone corellia  |
| `setup-macos.sh`          | Homebrew packages, shell and git config, SSH identity, clone repos, fonts, quirks    |
| `setup-managed-apps.sh`   | The apps IT normally owns, or a checklist of them when skipped                       |
| `setup-macos-defaults.sh` | System Settings: computer name, trackpad, Dock, screenshots, reserved hotkeys         |
| `setup-app-prefs.sh`      | Per-app preferences from `src/conf/defaults`, or `--export` to capture them           |
| `setup-languages.sh`      | Node via mise, Rust via rustup, Python tooling via uv, skillz agent skills            |

### Shell compatibility

**The setup scripts have to parse and run under bash 3.2.** That is what
`/bin/bash` is on macOS, it is the only bash a new machine has, and both entry
points are stuck with it: `setup-zsh.sh` runs through `bash -c "$(curl ...)"`
before Homebrew exists, and `setup-macos.sh` is the script that installs
everything else. A modern bash is in `src/conf/Brewfile` for other work, but by
the time it lands these scripts have already run.

The trap is that a 3.2 incompatibility is usually a *parse* error, so the script
dies before its first line of output rather than failing at the line at fault.
The one that got us:

```sh
# bash 3.2 scans this heredoc for quote characters instead of taking it
# literally, so the apostrophe swallows the rest of the file:
block="$(
  cat <<EOF
# ... zsh's ...
EOF
)"
```

Put the heredoc in its own function and call that in the command substitution
instead. More generally, avoid heredocs inside `$( )`, `declare -A`, `mapfile`,
`${var^^}`, and negative array indices.

The `bash 3.2 and zsh` job in [lint.yml](../../../.github/workflows/lint.yml)
runs `/bin/bash -n` over every script on a macOS runner, because the Linux job
only ever sees bash 5 and cannot catch this. Locally, `bash` is whichever one is
first on `PATH`, so check with the absolute path:

```sh
/bin/bash -n src/scripts/setup/*.sh
```

### What lives where

Configuration is version controlled in this repo and linked into place, rather
than appended to your dotfiles by a script. Edit the files here, not the copies
in `$HOME`.

- `src/conf/Brewfile`, `src/conf/Brewfile.managed` — packages
- `src/conf/zsh/*.zsh` — shell config, sourced by one loader block in `~/.zshrc`
- `src/conf/direnv/direnv.toml` — direnv
- `src/conf/ghostty/config` — terminal
- `src/conf/starship/` — the prompt, and the init script that loads it
- `src/conf/gitignore` — global gitignore, registered as `core.excludesfile`
- `src/conf/DefaultKeyBinding.dict` — the Home/End fix
- `src/conf/defaults/*.plist` — per-app preferences, applied by `setup-app-prefs.sh`

Editor extensions are the exception, and stay a reference list in
[`editor-extensions.md`](editor-extensions.md) rather than an install step:
Cursor and VS Code both sync extensions through their own accounts, so scripting
the install fights that sync instead of helping it.

Machine-specific, non-secret overrides go in `~/.zshrc.local`, which the loader
sources last.

oh-my-zsh is part of that, and stays small: `src/conf/zsh/05-oh-my-zsh.zsh` sources
it with no theme (starship draws the prompt) and two plugins. `~/.zshrc` holds only
the loader, so oh-my-zsh's template — with its own theme and plugin list — never
gets written.

The prompt is kept separable, as the one piece worth having on a work laptop or
an ssh-only box: `src/conf/starship` holds `starship.toml` and an `init.sh` that
any dotfiles can source, and `20-tools.zsh` sources it out of the checkout.
Elsewhere, `setup-starship.sh` installs both to `~/.config/starship` with no
checkout and no dependency on this repo:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/patrickhulce/corellia/main/src/scripts/setup/setup-starship.sh)"
```

The shell config, loader block included, is kept **valid in bash as well as zsh** —
POSIX `.` rather than `source`, no glob qualifiers, and the genuinely zsh-only
parts behind a `ZSH_VERSION` guard. This config outlives any one machine, and `sh`
is what a container, a CI runner, or a Linux box hands you; a zsh-ism reaching one
of those means a login shell that errors on every prompt, which is a bad thing to
debug remotely. [`src/conf/zsh/README.md`](../../conf/zsh/README.md) has the rules
and the two commands to check a change against both shells.

## App preferences

Some settings live in an app's own preference domain rather than System Settings,
so `defaults write` with a hardcoded value is the wrong tool: you'd be
transcribing a plist by hand. `setup-app-prefs.sh` goes the other way round.
Configure the app once, capture it, commit it:

```sh
# Set up Rectangle, superwhisper, or Scroll Reverser however you like, then:
./src/scripts/setup/setup-app-prefs.sh --export
git diff src/conf/defaults
```

Applying is the default direction, and it merges rather than replaces: a domain
where only two keys are tracked keeps the other twenty, so capturing a keyboard
shortcut doesn't discard an app's licence or onboarding state.

This is what carries Rectangle's window shortcuts (Ctrl+Opt+Cmd with the arrow
keys — up to maximize, left and right to tile, down to centre) and superwhisper's
dictation binding on Cmd+F5. Both are applied as part of `bootstrap.sh`, so
neither needs setting up by hand again.

Two details worth knowing, both learned the hard way:

- A running app holds its preferences in memory and writes them back when it
  quits, so the script quits each app before writing and relaunches it after.
- It then re-reads the domain and warns if anything didn't stick, because an app
  that is mid-quit can still flush over a write that has already landed.

Only four domains are tracked, and the bar for adding a fifth is that the app is
configured far enough from its defaults to be worth carrying. Amphetamine doesn't
clear it: the Brewfile installs it and it starts fresh on each machine. Thaw, the
menu bar manager that replaced the archived Ice, is the open case — it is
configured by hand here, but its domain mixes real settings with per-machine
state (`KnownDisplays`, the `MenuBarItemManager.*` keys, and an
`NSStatusItem VisibleCC *` variant the excludes don't cover), so capturing it
would need a key allowlist the way superwhisper's does. The tracked domains, the
ones with only some keys captured, and the keys excluded everywhere are all
listed at the top of the script with the reasoning attached.

## Manual Configurations

What macOS won't let a script do. `setup-macos-defaults.sh` already covers the
battery percentage, tap to click, bottom-right secondary click, hiding the Dock,
keeping windows when quitting, the screenshot location, and freeing both Cmd+Space
and Cmd+F5.

### Open every app once

**Budget an hour of clicking after the scripts finish.** Homebrew quarantines
what it downloads, exactly as Safari would, so the first launch of each cask
stops on *"Thaw is an app downloaded from the Internet. Are you sure you want to
open it?"*. Nothing in this repo can answer that for you, and until it is
answered the app has not run even once.

That matters more than the dialog itself, because a first launch is also when an
app asks for the permissions it needs and registers its login item. Rectangle
and Thaw want Accessibility, superwhisper wants the Microphone, Raycast wants
several, and none of those prompts appear until you open the app. A machine
where `brew bundle` reported everything installed can still have an empty menu
bar and no working window shortcuts.

So: open every cask the Brewfile installs, once, by hand. The ones that need it
most are Rectangle, Thaw, Raycast, and superwhisper, since their whole job is to
be running in the background.

Homebrew's `--no-quarantine` would skip the dialog. It is deliberately not used
here: it turns off that check for everything installed, which is a poor trade
for a prompt answered once per app per machine.

1. Change the default web browser (System Settings > Desktop & Dock)
1. Configure Dock icons
1. Set Raycast's hotkey to Cmd+Space
1. Sign in to Cursor and enable Settings Sync, which brings the extensions with
   it. [`editor-extensions.md`](editor-extensions.md) is the reference list for
   when it doesn't.
1. Install the [Google Drive client](https://www.google.com/drive/download/)
1. Keychain: export each certificate and private key individually from Keychain
   Access. Right-click and "Export" one at a time or they won't be included.
1. Restart any app that was already running, so it picks up the Home/End key
   bindings.

## Inventory of the old machine

Everything installed on the machine this setup was written from, so that migrating
is a decision about each item rather than a memory test. `src/conf/Brewfile` and
`src/conf/Brewfile.managed` are the parts that provision themselves; this is the
remainder.

### Installed by hand — no cask exists, or the licence makes one pointless

| App | Notes |
| --- | --- |
| Adobe Acrobat, Media Encoder, Photoshop, Premiere Pro, Substance 3D Painter | All installed *by* Creative Cloud, which is the only piece with a cask |
| DaVinci Resolve, Blackmagic RAW, Blackmagic Proxy Generator | Blackmagic's own downloads, behind a registration form |
| Nuke, RV, REDCINE-X Professional, PIX | Licensed film tools, node-locked or floating-licence |
| Home Designer 2026 | Chief Architect, licensed per version |
| Cricut Design Space | Vendor installer only |
| Lumina | Webcam control |
| Demucs-GUI, Invoke Community Edition | Local ML tools, GitHub releases |
| NVIDIA Nsight Systems | Requires an NVIDIA developer account |
| Parallels Desktop | Licensed |
| Antigravity, Gemini | Google's desktop AI apps |
| AnyDesk, YubiKey Manager | Vendor downloads |
| Google Drive | Vendor download, already on the checklist above |
| YouTube Music Desktop App | A `ytmdesktop-youtube-music` cask exists but tracks a different project |
| Unity editor | The Hub has a cask; the editors it installs do not |

Licensed separately, so installing the app is only half the job: superwhisper,
Home Designer, Nuke, Parallels, Adobe, DaVinci Resolve Studio.

### Deliberately not carried over

Installed on the old machine and left out on purpose. Each is one line to restore
if a specific job needs it — the reason it's absent is the useful part.

| Not carried over | Why |
| --- | --- |
| Alfred | Raycast covers it, and two launchers fighting over one hotkey is worse than either |
| Spectacle | Discontinued in 2020. Rectangle replaces it |
| iTerm2, Warp | Ghostty is the terminal of record, and its config is text rather than a binary plist |
| Wispr Flow | superwhisper does dictation |
| KeyCastr | On-screen keystrokes, only wanted while recording a screencast |
| SketchUp, Sweet Home 3D, OpenSCAD | Occasional CAD. Blender stays, since it earns its keep |
| Unity, Unity Hub | Not doing game work right now |
| Stability Matrix | Superseded by Invoke for local image generation |
| darktable | Lightroom via Creative Cloud covers it |
| Cyberduck | `rclone` or the AWS and gcloud CLIs cover the same ground |
| JetBrains Toolbox, Gateway, PyCharm | Cursor and VS Code are the editors |
| VS Code Insiders | One VS Code channel is enough |
| ChatGPT Classic | Superseded by the current ChatGPT app |
| Microsoft Remote Desktop / Windows App | Install if a Windows box reappears |
| miniconda | Replaced by `uv` |
| XQuartz | A dependency of a few older tools; install when something asks |
| `google-cloud-sdk` cask | Renamed to `gcloud-cli`, which is in the Brewfile. Having both is the cause of the stale-Caskroom warning |
| `hub`, `diff-so-fancy` | Replaced by `gh` and `delta` |
| `nvm`, `sdkman`, `pyenv`, `pipx` | Replaced by `mise` and `uv` |
| `mysql`, `postgresql@14`, `redis` | Three always-on daemons is a bad default. Per-project containers, or start one on demand |
| Global `typescript`, `yarn` | Project dependencies. A global pin only creates version skew |

### Command line tools not in the Brewfile

Homebrew formulae that were installed directly rather than as dependencies, and
are not in `src/conf/Brewfile`:

- `ruff` — Python linter, and the editor extension lists reference it. Comes from
  `uv tool install ruff` per project instead, so it doesn't need to be global.
- `black` — superseded by `ruff format`.
- `caddy` — web server, wanted only when a project needs one.
- `emscripten`, `glew`, `openimageio`, `openjph`, `openvino`, `qt@5`, `tcl-tk` —
  heavy native libraries pulled in for specific projects. Install per project.
- `curl`, `gnu-tar`, `libfido2`, `openldap` — Homebrew builds of things macOS
  already ships. Only worth it when a specific flag is missing.
- `ffmpeg@4` — pinned old major for one project. The Brewfile has current `ffmpeg`.
- `reattach-to-user-namespace` — tmux clipboard glue, unnecessary since macOS 10.14.

Global npm packages that were installed here before `setup-languages.sh` knew
about them: `@openai/codex`, `http-server`, `surge`, and `vercel` have since
joined `NPM_GLOBALS`. `cursor-history` and `git2txt` are left out on purpose, as
is `source-map-explorer`, which was dropped from the list.

The `pipx` tools are migrated. `yt-dlp`, `tox`, and `invoke` come from
`UV_TOOLS`; `poetry`, `hatch`, `pre-commit`, `maturin`, `viztracer`, `asitop`,
and `aider-chat` are per-project or occasional, and `fal` and `runpod` are vendor
SDKs tied to an account, so all of those belong in a project venv reached with
`uvx` rather than installed globally.

### Fonts

`~/Library/Fonts` holds Aurebesh (and its condensed, bold, and italic cuts),
Starjedi, BonheurRoyale, BrunoAce, and Handodle. All of them provision themselves
now, in two ways, and none is committed to this repo: BonheurRoyale and BrunoAce
are on Google Fonts, so they're casks in the Brewfile alongside
`font-fira-code-nerd-font`, while Aurebesh, Star Jedi, and Handodle have no
cask and are downloaded from dafont by `install_fonts()` in `setup-macos.sh`.

Downloaded rather than committed because none of the three is redistributable —
Handodle's free build is personal-use only, with a commercial licence sold
separately. The archives carry more than the fonts wanted, so each row of the
`FONTS` table names the members to install: dafont's Star Jedi ships eight faces
across four directories when only the base one is used here, and the Aurebesh and
Handodle zips bundle a licence file and a PDF.

### Work-managed, out of scope

Installed by IT and not this repo's business. `Brewfile.managed` covers the ones
with casks — Cursor, Creative Cloud, Slack, Zoom, Docker Desktop, Chrome, and
Tailscale — and the rest arrive as portal installs and MDM payloads: Okta Verify,
Ivanti Secure Access, CrowdStrike Falcon, IBM Aspera (Connect, Crypt, Launcher),
Managed Software Center, PCoIPClient, DEPNotify, Nudge, Netflix Notifier, the
licensed Netflix Sans fonts, the `nflx-*` pipx packages, and the `netflix.*`
editor extensions.

Tailscale is the newest arrival there. A VPN client on a work machine is IT's to
enroll and configure, and a second copy of the same one competes for the network
extension slot.

`~/.gitconfig` also opens with a Metatron autoconfig block that the `metatron` CLI
rewrites. That's why `setup-macos.sh` sets individual keys with
`git config --global` rather than symlinking a whole gitconfig from this repo.

## Keyboard shortcuts macOS reserves

Two of the shortcuts this setup wants are taken out of the box, so
`setup-macos-defaults.sh` disables the macOS side in `com.apple.symbolichotkeys`:

| ID    | macOS shortcut                | Default          | Freed for   |
| ----- | ----------------------------- | ---------------- | ----------- |
| `64`  | Spotlight search              | Cmd+Space        | Raycast     |
| `65`  | Finder search window          | Opt+Cmd+Space    | Raycast     |
| `59`  | Turn VoiceOver on or off      | Cmd+F5           | superwhisper |
| `162` | Accessibility Shortcuts panel | Opt+Cmd+F5       | superwhisper |
| `164` | Dictation                     | Ctrl+Opt+Cmd+F5  | superwhisper |

Only the shortcut is disabled for `164`. Dictation itself stays enabled, so it's
still reachable from the Edit menu and nothing breaks if superwhisper goes away.

Two things make this fiddlier than it looks. The masks for `59` and `162` include
the fn bit (`8388608`) on top of the values every reference table lists, because
macOS records fn as part of a function-key shortcut on a keyboard where F5 is a
media key — while `164`, on the same key, doesn't. Each one is the default read
back from `com.apple.symbolichotkeys` rather than worked out from a table, which
is the only way to get them right. And superwhisper uses Carbon key codes rather
than the Cocoa masks above, so its own binding reads
`{"carbonModifiers":256,"carbonKeyCode":96}` — Carbon's `cmdKey` is `256`, and
`96` is F5.

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
- Spectacle → Rectangle, whose shortcuts are a plist this repo can version.
  Raycast is the launcher, not the window manager: its hotkeys live in an
  encrypted SQLite store that can't be exported to anything reviewable.
- Ice → Thaw, the maintained fork, after Ice was archived. Same app, same
  preference keys, different bundle identifier
- iTerm2 and its binary `.plist` → Ghostty and a text config
- Monaco → FiraCode Nerd Font, because starship's prompt draws glyphs Monaco
  doesn't carry
- Long `brew install` lines → `Brewfile` and `brew bundle`
- Always-on mysql, postgresql, and redis services → per-project containers, or
  install one on demand
- Global `typescript` and `yarn` → project dependencies
- A full 11G clone of this repo just to run setup → a sparse one at `~/.corellia`
- Clicking through preference windows on each new machine → `src/conf/defaults`
  and `setup-app-prefs.sh`

</details>
