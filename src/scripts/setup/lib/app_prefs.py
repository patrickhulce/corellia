#!/usr/bin/env python3
"""Plist transforms for setup-app-prefs.sh.

Deliberately does no preference reading or writing of its own: `defaults export`
and `defaults import` own that, so cfprefsd stays in the loop and every value
keeps the type it had. This only rewrites plist files on disk.

plistlib reads binary and XML transparently and is told to always write XML with
sorted keys, which is what makes the committed copies reviewable in a diff.
"""

from __future__ import annotations

import argparse
import fnmatch
import plistlib
import sys
from pathlib import Path


def split_list(value: str | None) -> list[str]:
    """Comma-separated, because several of these keys contain spaces."""
    if not value:
        return []
    return [item for item in (part.strip() for part in value.split(",")) if item]


def load(path: Path) -> dict:
    """An absent or empty file is an empty domain, not an error.

    `defaults export` produces one for an app that has never been launched.
    """
    if not path.exists() or path.stat().st_size == 0:
        return {}

    with path.open("rb") as handle:
        loaded = plistlib.load(handle)

    if not isinstance(loaded, dict):
        raise SystemExit(f"{path}: expected a plist dictionary, got {type(loaded).__name__}")

    return loaded


def dump(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(data, handle, fmt=plistlib.FMT_XML, sort_keys=True)


def cmd_filter(args: argparse.Namespace) -> int:
    data = load(Path(args.source))
    keys = split_list(args.keys)
    excludes = split_list(args.exclude)

    if keys:
        missing = [key for key in keys if key not in data]
        if missing:
            print(f"missing keys: {', '.join(missing)}", file=sys.stderr)
        data = {key: data[key] for key in keys if key in data}

    dropped = [
        key
        for key in data
        if any(fnmatch.fnmatchcase(key, pattern) for pattern in excludes)
    ]
    for key in dropped:
        del data[key]

    if not data:
        return 1

    if dropped and args.verbose:
        print(f"dropped {len(dropped)}: {', '.join(sorted(dropped))}", file=sys.stderr)

    dump(data, Path(args.dest))
    return 0


def cmd_merge(args: argparse.Namespace) -> int:
    # A shallow update on purpose. The committed file holds whole values, so a
    # deep merge would only invent states neither side ever had.
    merged = load(Path(args.base))
    merged.update(load(Path(args.overlay)))
    dump(merged, Path(args.dest))
    return 0


def cmd_compare(args: argparse.Namespace) -> int:
    """Report keys from <expected> that <actual> doesn't agree with.

    Worth checking rather than assuming: an app that is mid-quit can flush its
    in-memory preferences over a write that has already landed, which loses a
    setting silently. One-directional on purpose, since <actual> holding extra
    keys is the normal case.
    """
    actual = load(Path(args.actual))
    expected = load(Path(args.expected))

    drifted = sorted(key for key, value in expected.items() if actual.get(key) != value)
    for key in drifted:
        print(key)

    return 1 if drifted else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    filter_cmd = commands.add_parser("filter", help="copy a plist, keeping a subset of keys")
    filter_cmd.add_argument("source")
    filter_cmd.add_argument("dest")
    filter_cmd.add_argument("--keys", help="comma-separated keys to keep; default is all")
    filter_cmd.add_argument("--exclude", help="comma-separated glob patterns to drop")
    filter_cmd.add_argument("-v", "--verbose", action="store_true")
    filter_cmd.set_defaults(func=cmd_filter)

    merge_cmd = commands.add_parser("merge", help="overlay one plist onto another")
    merge_cmd.add_argument("base")
    merge_cmd.add_argument("overlay")
    merge_cmd.add_argument("dest")
    merge_cmd.set_defaults(func=cmd_merge)

    compare_cmd = commands.add_parser("compare", help="list expected keys that did not stick")
    compare_cmd.add_argument("actual")
    compare_cmd.add_argument("expected")
    compare_cmd.set_defaults(func=cmd_compare)

    return parser


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
