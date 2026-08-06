# Zed

Zed is installed by the `zed` cask in [`../Brewfile`](../Brewfile). This
directory holds a starting point for its configuration, **copied** into
`~/.config/zed` by `setup-macos.sh`:

| Repo file | Copied to |
| --- | --- |
| `settings.json` | `~/.config/zed/settings.json` |
| `keymap.json` | `~/.config/zed/keymap.json` |

Both are JSONC — Zed allows comments, so each setting is explained where it
lives rather than here.

The copy happens once. `setup-macos.sh` never overwrites a `~/.config/zed` file
that already exists, so re-running setup can't throw away settings you changed
in the app. The flip side is that a change made here reaches a machine only if
you copy it over yourself.

## Why this is versioned when Cursor and VS Code aren't

The two of them sync settings and extensions through an account, so a repo copy
would fight that sync and the losing side is whichever wrote last. That's why
[`editor-extensions.md`](../../docs/setup/editor-extensions.md) is a reference
list rather than an install step.

Zed has no such sync. Its configuration is a text file and nothing else, which
puts it in the same category as Ghostty and direnv: version it, link it, edit it
here.

## Copied, never symlinked

These files were symlinked at first, on the theory that a settings change made
in the app would show up here as a diff to accept or discard. Don't do that.

Zed's settings file is not a file you own — it's a file Zed writes to. Every SSH
host you connect to gets recorded in `ssh_connections`, along with the project
paths and port forwards you used. Anything configured through the settings UI
lands there too. Zed canonicalizes before saving, so all of it goes *through*
the link and straight into the repo, and the first time anyone noticed was a
commit carrying an internal hostname, an API endpoint, and the directory layout
of a work machine.

A copy makes the boundary the right way round: this repo holds the settings
worth starting from, `~/.config/zed/settings.json` holds what that machine has
become. Nothing host-specific belongs in here, and nothing here needs to be
purged before committing.

`keymap.json` is copied for the same reason even though Zed rarely writes it —
one rule for the directory is easier to remember than two.

Copying also sidesteps Zed's symlink quirks, which are worth knowing about if
you're tempted anyway: a linked *directory* stops the file watcher entirely, so
edits need a `workspace: reload`
([zed#48729](https://github.com/zed-industries/zed/issues/48729)), and a linked
*file* loads fine but loses schema autocomplete in the settings buffer because
Zed matches on the resolved path
([zed#54888](https://github.com/zed-industries/zed/issues/54888)).

Either way, `~/.config/zed` holds state that has no business in a repo —
`extensions.json`, downloaded themes, prompt and thread history — so it is the
two files or nothing.
