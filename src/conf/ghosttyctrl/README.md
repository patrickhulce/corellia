# ghosttyctrl

`ghosttyctrl` opens a Ghostty tab-and-split layout from a YAML template. The
script is
[`src/scripts/global/bin/ghosttyctrl`](../../scripts/global/bin/ghosttyctrl);
this directory holds the templates, symlinked to `~/.config/ghosttyctrl/templates`
by `setup-macos.sh`.

It knows nothing about ssh. A pane that wants a remote tmux session runs
[`sshx`](../../scripts/global/bin/sshx), which is a separate script for exactly
that and nothing else.

```sh
ghosttyctrl                            # the `default` template, or `extend`
ghosttyctrl new                        # a new window at $HOME
ghosttyctrl new dir=~/Code/corellia
ghosttyctrl code host=myserver session=claude
ghosttyctrl code host=myserver --dry-run
ghosttyctrl --list
```

| Argument | Meaning |
| --- | --- |
| `TEMPLATE` | template name; see the default below |
| `KEY=VALUE` | a value for a variable the template declares |
| `--list` | list the templates on the search path |
| `--dry-run` | print the generated AppleScript instead of running it |

The template name may be left off entirely when only overrides are given, so
`ghosttyctrl dir=~/Code` is the default template with a directory.

With no name, `ghosttyctrl` runs `default` if a `default.yml` exists anywhere on
the search path and `extend` if none does. Nothing here ships a `default.yml`:
it is a hook for deciding what a bare `ghosttyctrl` does on one machine — say, a
`~/.config/ghosttyctrl/templates/default.yml` that opens your usual project —
without touching the templates in the repo.

## Stock templates

| Template | What it does |
| --- | --- |
| `extend` | one more shell tab in the frontmost window, inheriting its directory unless `dir=` says otherwise; the default when there is no `default.yml` |
| `new` | a separate window with one shell tab, at `$HOME` or `dir=` |
| `code` | a remote tmux session next to a remote shell, both in `dir` on `host` |

They are ordinary YAML here rather than special cases in the script, so a
`~/.config/ghosttyctrl/templates/new.yml` of your own shadows the one in the
repo.

## Template format

A template is `<name>.yml` in this directory. Lookup order is
`$GHOSTTYCTRL_TEMPLATES` (colon-separated), `~/.config/ghosttyctrl/templates`,
then the repo copy.

```yaml
window: extend
vars:
  host:
  dir: $HOME
tabs:
  - splits:
      - command: sshx %host%
      - dir: ~/Code
  - splits:
      - command: ssh %host% 'exec tail -f %dir%/logs/app.log'
        keep_open: true
```

- `window` is `extend` (the default) or `new`. `extend` adds tabs to the
  frontmost Ghostty window, opening one only when Ghostty has none; `new`
  always opens its own window.
- Each entry under `tabs` is one Ghostty tab. The first entry in its `splits`
  is the tab's initial pane; each one after that splits the previous pane to
  the right.
- `command` is optional. A split without one is a plain login shell, which is
  all `new` and `extend` need.
- `dir` sets the pane's initial working directory. It is an AppleScript
  property, not a shell string, so a `~` or `$HOME` in it is expanded *here*
  before the pane opens — the opposite of how a value inside `command` is
  treated. An empty `dir` is left unset, and Ghostty inherits as it normally
  would.
- `keep_open: true` leaves the pane open after its command exits, which is how
  you see why a command that fails immediately failed. The default is to close
  the pane, so a finished ssh doesn't leave a dead surface behind.

### Variables

`%name%` is replaced by a key from `vars`. A placeholder with no value is an
error, and so is a `key=value` for a var the template never declared — both are
typos worth catching before three panes open.

- A `vars` entry with a value is a default: `ghosttyctrl code dir=foo`
  overrides `dir`.
- A `vars` entry with *no* value, like `host:` above, is required. Leaving it
  off is an error rather than a pane that runs `ssh ''`.
- Values are not expanded locally, so a `$HOME` or `~` inside a `command`
  reaches the shell that runs it — as long as the template's own quoting lets
  it. A value used as a `dir` is the exception described above.

## Why the commands look like that

Two shells sit between Ghostty and the process you actually want. Ghostty
handles the near one; a remote command's is the template's job:

- Locally, Ghostty runs a `command` with arguments through a shell, but execs
  it: a pane is `login -flp USER /bin/bash --noprofile --norc -c 'exec -l
  COMMAND'`. Nothing lingers, and a `command` that starts with `exec` of its
  own is *broken*, not redundant — `exec -l exec ssh ...` looks for a program
  named `exec` and the pane dies before ssh runs. This is also why a directory
  belongs in `dir` and not in a `cd x && ...` command.
- Remotely, `ssh host '...'` runs the command through the remote login shell,
  which does stay alive underneath it. That is the `exec` a template has to
  write, as in `ssh %host% 'exec tail -f ...'`.

`ssh -t` is required whenever the remote command wants a terminal. Without it
tmux exits with "open terminal failed: not a terminal" and — with the default
`keep_open: false` — the pane vanishes before the message can be read. `sshx`
already passes `-t`.

## macOS permissions

The first run prompts to let the calling terminal control Ghostty. If it was
denied, re-enable it under System Settings > Privacy & Security > Automation.
