# Shell config

Sourced in filename order by the `corellia` loader block in `~/.zshrc`, which
`setup-macos.sh` writes. Edit these files, not the block, and not `~/.zshrc`.

| File | Contents |
| --- | --- |
| `00-homebrew.zsh` | `brew shellenv`, so everything below can find its binaries |
| `05-oh-my-zsh.zsh` | oh-my-zsh, with no theme and two plugins |
| `10-path.zsh` | `PATH` additions |
| `20-tools.zsh` | Shell integrations: direnv, mise, zoxide, fzf, starship |
| `21-term.zsh` | Install bundled `xterm-ghostty` terminfo on SSH hosts; fall back to `xterm-256color` only when `tic` fails |
| `22-python-venv.zsh` | Auto-activate `.venv` on cd; exports for starship's python segment |
| `23-ghostty-ssh-title.zsh` | Ghostty tab titles over SSH; tmux session in tab title and starship |
| `25-keybindings.zsh` | Key bindings, after the plugins whose widgets they use |
| `30-aliases.zsh` | Aliases |

## Keep it valid in bash

**Every file here must be safe to source from bash, not just zsh.** The loader
block is written to the same standard.

The reason is that this is the *personal* shell configuration, and it outlives any
one machine or shell. `sh` is what a Docker image, a CI runner, a `ssh host
'...'`, and most Linux boxes give you, and the failure mode of a zsh-ism reaching
one of those is a login shell that errors on every prompt — which is a
particularly annoying thing to debug over a remote connection. Portability here is
cheap; discovering you don't have it is not.

In practice:

- Use POSIX `.` rather than the `source` builtin.
- No glob qualifiers. `*.zsh(N)` is zsh-only; guard on the directory instead.
- Don't hardcode `zsh` when asking a tool for its shell integration. `20-tools.zsh`
  detects the shell and passes it through, so `mise activate` and friends get the
  right flavour.
- Genuinely zsh-only things — oh-my-zsh, `zstyle`, `bindkey`, ZLE widgets,
  zsh-autosuggestions — go behind `[ -n "${ZSH_VERSION:-}" ]`. They still have to
  *parse* under bash, which is a lower bar than running: an array assignment and
  an unknown command name are both fine.

To check a change, source the files in both shells and confirm neither complains:

```sh
zsh  -c 'for f in src/conf/zsh/*.zsh; do . "$f"; done && echo zsh ok'
bash -c 'for f in src/conf/zsh/*.zsh; do . "$f"; done && echo bash ok'
```

CI parses every file here with both `zsh -n` and `/bin/bash -n`, the latter
being macOS's bash 3.2. The scripts that write and read this configuration are
held to the same version; see
[mac-setup.md](../../docs/setup/mac-setup.md#shell-compatibility) for what 3.2
won't take.

## Local overrides

Machine-specific but non-secret settings go in `~/.zshrc.local`, which the loader
sources last. Real secrets belong in 1Password and reach the process that needs
them through `op run`; see
[mac-setup.md](../../docs/setup/mac-setup.md#secrets).
