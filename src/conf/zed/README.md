# Zed

Zed is installed by the `zed` cask in [`../Brewfile`](../Brewfile). This
directory holds its configuration, symlinked file by file into `~/.config/zed`
by `setup-macos.sh`:

| Repo file | Link |
| --- | --- |
| `settings.json` | `~/.config/zed/settings.json` |
| `keymap.json` | `~/.config/zed/keymap.json` |

Both are JSONC — Zed allows comments, so each setting is explained where it
lives rather than here.

## Why this is versioned when Cursor and VS Code aren't

The two of them sync settings and extensions through an account, so a repo copy
would fight that sync and the losing side is whichever wrote last. That's why
[`editor-extensions.md`](../../docs/setup/editor-extensions.md) is a reference
list rather than an install step.

Zed has no such sync. Its configuration is a text file and nothing else, which
puts it in the same category as Ghostty and direnv: version it, link it, edit it
here.

## Linked as files, not as a directory

`~/.config/zed` is also where Zed keeps state that has no business in a repo —
`extensions.json`, downloaded themes, prompt and thread history. Linking the two
files leaves that alone.

It also avoids the worse of Zed's two symlink quirks. A linked *directory* stops
the file watcher from noticing edits at all, so changes need a
`workspace: reload` before they apply
([zed#48729](https://github.com/zed-industries/zed/issues/48729)). With linked
files the settings load and apply normally; the residue is that Zed matches its
JSON schema on the resolved path, so autocomplete in the settings buffer is
missing ([zed#54888](https://github.com/zed-industries/zed/issues/54888)). Edit
the files in this repo, where they're ordinary JSONC, and that costs nothing.

Writing through the symlink is safe. Zed canonicalizes before saving, so the
settings UI and `theme selector: toggle` update the file in this repo instead of
replacing the link with a copy — which is what they used to do
([zed#4469](https://github.com/zed-industries/zed/issues/4469), fixed in
v0.123). A settings change made in the app shows up as a diff here; commit it or
throw it away.
