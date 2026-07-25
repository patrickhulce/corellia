# Setup Audit

The gaps between what the old machine had and what this repo provisions, and the
decisions taken about each. The full list of software is in
[`mac-setup.md`](mac-setup.md#inventory-of-the-old-machine); this file is the
open questions and the reasoning.

Note that this setup has never been run start to finish on the machine it was
written from — it targets the *next* machine. So "not installed here" is the
normal state for anything in the Brewfile, and not a finding.

Regenerate the raw comparison on a machine that has been provisioned:

```sh
brew bundle dump --file /tmp/Brewfile.actual
diff <(sort src/conf/Brewfile) <(sort /tmp/Brewfile.actual)
```

Open items are checkboxes. Everything else is a decision, not a task.

## Now provisioned

Added to the setup as part of this pass, having previously been manual:

- Rust, via the `rustup` formula plus `clippy`, `rustfmt`, and `rust-analyzer` in
  `setup-languages.sh`. `wasm-pack` comes from its bottle rather than
  `cargo install`, which builds from source and takes minutes.
- Window management, via the `rectangle` cask. See the note below on why not
  Raycast.
- Dictation on Cmd+F5, via the `superwhisper` cask, with `setup-macos-defaults.sh`
  clearing the three macOS hotkeys that sit on F5.
- App preferences, via `setup-app-prefs.sh` and `src/conf/defaults`. Rectangle's
  window shortcuts, superwhisper's dictation binding, Scroll Reverser, and
  ImageOptim's lossy settings were all re-entered by hand on each machine before
  this.
- Elgato Control Center, Scroll Reverser, Tailscale, Amphetamine, and a Nerd Font,
  all previously items on a checklist or nowhere at all.

## Why Rectangle instead of Raycast

Raycast stores everything, window-management shortcuts included, in
`~/Library/Application Support/com.raycast.macos/raycast-enc.sqlite` — 17MB,
encrypted. It cannot be exported to anything reviewable, and its "Export Settings
& Data" blob carries clipboard history and snippets along with it.

Rectangle keeps its shortcuts in `com.knollsoft.Rectangle`, an ordinary plist. So
Rectangle owns window management and Raycast stays the launcher on Cmd+Space.

## Dictation is a closed-source dependency

superwhisper is closed source and its paid features need a licence, so signing in
is a manual step whenever those are wanted. The setup deliberately doesn't care:
the two bindings live in ordinary `defaults` keys, so Cmd+F5 is configured from
this repo regardless of licence state.

`handy` (MIT, `brew install --cask handy`) is the open-source equivalent if that
ever becomes the deciding factor. Recorded as the alternative rather than
installed.

## Open items

### Cleanups on the old machine

One-time fixes to the machine this was written from. A freshly provisioned Mac
won't have any of them, which is why they're here and not in the setup guide.

- [ ] Stop the database daemons the Brewfile argues against. `postgresql@14` and
      `redis` are running:

      brew services stop postgresql@14
      brew services stop redis

- [ ] Remove the superseded cask: `brew uninstall --cask google-cloud-sdk`. Having
      it alongside `gcloud-cli` is what produces the stale-Caskroom warning on
      every `brew` run.
- [ ] `brew upgrade`. 161 formulae and 14 casks are behind.
- [ ] Drop `. "$HOME/.cargo/env"` from `~/.zshenv`. `src/conf/zsh/10-path.zsh` now
      owns `~/.cargo/bin`. Worth doing before the next machine, since that one gets
      rustup from Homebrew, where the formula is keg-only and its `cargo` and
      `rustc` proxies live in the Cellar rather than `~/.cargo/bin`.
- [ ] Fix the dead PATH entry in `~/.zshrc`. It points at
      `~/.config/work/dotfiles/scripts`; the work dotfiles are actually at
      `~/Library/Application Support/work/dotfiles`. `is_managed_machine()` now
      checks both locations, but this stale entry is separate.
- [ ] Migrate the remaining pipx tools to `uv tool install`: `aider-chat`,
      `yt-dlp`, `viztracer`, `asitop`, `maturin`, `hatch`, `tox`, `invoke`. Leave
      `nflx-*` to the work dotfiles.
- [ ] Delete the stale `.zcompdump*` files, one of which is still named after a
      previous hostname.

### Not yet captured

- [x] Rectangle's shortcuts, captured in
      `src/conf/defaults/com.knollsoft.Rectangle.plist`: Ctrl+Opt+Cmd with the
      arrow keys for maximize, left and right halves, and centre, plus Ctrl+Shift
      for the Todo mode. The old machine's equivalents were in Raycast and
      unreadable, so they were re-entered by hand once. That was the last time.
- [ ] Elgato Control Center light scenes, under
      `~/Library/Application Support/Elgato Control Center`. Not a plist, so
      `setup-app-prefs.sh` can't reach them; they'd need a copy step, and the
      lights are discovered over the network so the profiles are only
      semi-portable.
- [ ] Ghostty, `gh`, `uv`, and `pip` configs. `~/.config/gh/config.yml`,
      `~/.config/uv/uv.toml`, and `~/.config/pip/pip.conf` are all small and
      stable enough to version. `hosts.yml` must stay out: it holds the token.
- [ ] Personal fonts in `~/Library/Fonts`: Aurebesh, Starjedi, BonheurRoyale,
      BrunoAce, Handodle. Small enough to commit to `src/conf/fonts` and symlink.
- [ ] `~/.ssh/config` is doing double duty, with work `Include`s alongside the
      corellia block. Worth splitting so the personal half can be versioned.
- [ ] No commit signing. There is no `~/.gnupg` and `gpg` isn't installed; SSH
      signing via the existing ed25519 key would be the cheaper option.

### Decisions worth revisiting

- [ ] npm globals installed here but not in `setup-languages.sh`:
      `@openai/codex`, `cursor-history`, `git2txt`, `http-server`, `surge`,
      `vercel`. Each is a genuine global CLI; the list was just never updated.
- [ ] `displayplacer` (tap `jakehilborn/jakehilborn`) would let monitor
      arrangement be scripted, which is currently nowhere.
- [ ] Ice and Amphetamine aren't tracked in `src/conf/defaults` at all, though
      both are installed by the Brewfile. Neither is configured far enough from
      its defaults to earn a committed plist, and both fight being captured: Ice's
      `MenuBarAppearanceConfigurationV2` serializes a whole ICC profile into every
      colour, 63K of it, re-encoded and reordered on each launch, and Amphetamine
      accumulates a session-duration array. That's a diff every restart and a
      drift warning on every apply, for a menu bar tint. Revisit if either ever
      gets a setting worth carrying between machines.
- [ ] Editor extensions are a reference list in
      [`editor-extensions.md`](editor-extensions.md) rather than an install step,
      because Cursor and VS Code sync them through their own accounts and a
      scripted install fights that sync. Revisit if a machine ever needs them
      without signing in.
- [ ] A 1.4G `chrome_trace.json` is sitting in `$HOME`.
