#!/usr/bin/env -S uv run --python 3.12 --script
# /// script
# requires-python = "==3.12.*"
# dependencies = [
#   "httpx==0.28.1",
# ]
# ///
"""Observe Brightwheel's rolling auth cookie without disclosing its value."""

from __future__ import annotations

import argparse
import hashlib
import http.cookies
import os
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any

import httpx

COOKIE_NAME = "_brightwheel_v2"
ORIGIN = "https://schools.mybrightwheel.com"
DEFAULT_PATH = "/api/v1/users/me"


def fingerprint(value: str | None) -> str:
    if value is None:
        return "missing"
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def describe_value(value: str) -> str:
    decoded = urllib.parse.unquote(value)
    return (
        f"sha256={fingerprint(value)} bytes={len(value.encode())} "
        f"url_encoded={decoded != value} double_dash_parts={len(decoded.split('--'))}"
    )


def read_cookie(path: Path) -> str:
    if not path.is_file():
        raise RuntimeError(f"cookie file does not exist: {path}")
    if path.stat().st_mode & 0o077:
        raise RuntimeError(f"cookie file must be private; run: chmod 600 {path}")
    if path.stat().st_size > 16 * 1024:
        raise RuntimeError("cookie file is unexpectedly large")
    value = path.read_text().strip()
    if value.startswith(f"{COOKIE_NAME}="):
        value = value.split("=", 1)[1]
    if not value or ";" in value or "\n" in value or "\r" in value:
        raise RuntimeError(f"cookie file must contain only the {COOKIE_NAME} value")
    return value


def cookie_from_header(header: str | None) -> str | None:
    if not header:
        return None
    parsed = http.cookies.SimpleCookie()
    parsed.load(header)
    morsel = parsed.get(COOKIE_NAME)
    return morsel.value if morsel else None


def set_cookie_observations(response: httpx.Response) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for header in response.headers.get_list("set-cookie"):
        parsed = http.cookies.SimpleCookie()
        try:
            parsed.load(header)
        except http.cookies.CookieError:
            continue
        morsel = parsed.get(COOKIE_NAME)
        if not morsel:
            continue
        observations.append({
            "value": morsel.value,
            "domain": morsel["domain"] or "(host-only)",
            "path": morsel["path"] or "(default)",
            "expires": morsel["expires"] or "(session)",
            "max_age": morsel["max-age"] or "(none)",
            "secure": bool(morsel["secure"]),
            "httponly": bool(morsel["httponly"]),
            "samesite": morsel["samesite"] or "(unspecified)",
        })
    return observations


def jar_entries(client: httpx.Client) -> list[dict[str, Any]]:
    return [
        {
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path,
            "secure": cookie.secure,
            "expires": cookie.expires,
        }
        for cookie in client.cookies.jar
        if cookie.name == COOKIE_NAME
    ]


def save_cookie(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(fd, f"{value}\n".encode())
    finally:
        os.close(fd)
    os.replace(temporary, path)
    os.chmod(path, 0o600)


def run(args: argparse.Namespace) -> int:
    initial = read_cookie(args.auth_cookie_file.resolve())
    url = urllib.parse.urljoin(ORIGIN, args.path)
    if urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(ORIGIN).netloc:
        raise RuntimeError("diagnostic path must stay on schools.mybrightwheel.com")
    cookies = httpx.Cookies()
    cookies.set(COOKIE_NAME, initial, domain="schools.mybrightwheel.com", path="/")
    print(f"initial: {describe_value(initial)}")
    print(f"target: {url}")
    print("Full cookie values are intentionally never printed.\n")
    latest = initial
    with httpx.Client(cookies=cookies, follow_redirects=False, timeout=20.0,
                      headers={"accept": "application/json"}) as client:
        for number in range(1, args.requests + 1):
            response = client.get(url)
            outbound = cookie_from_header(response.request.headers.get("cookie"))
            observations = set_cookie_observations(response)
            entries = jar_entries(client)
            print(f"request {number}: status={response.status_code} outbound={describe_value(outbound) if outbound else 'missing'}")
            print(f"  response: set-cookie headers={len(response.headers.get_list('set-cookie'))} matching={len(observations)}")
            for index, item in enumerate(observations, 1):
                value = item.pop("value")
                latest = value
                print(f"  set-cookie[{index}]: {describe_value(value)} changed_from_outbound={value != outbound}")
                print("    " + " ".join(f"{key}={value}" for key, value in item.items()))
            print(f"  jar: matching_entries={len(entries)}")
            for index, item in enumerate(entries, 1):
                value = item.pop("value")
                print(f"    [{index}] {describe_value(value)} " + " ".join(f"{key}={value}" for key, value in item.items()))
            content_type = response.headers.get("content-type", "")
            if "json" in content_type:
                try:
                    payload = response.json()
                    keys = sorted(payload) if isinstance(payload, dict) else []
                    print(f"  json: type={type(payload).__name__} top_level_keys={keys}")
                except ValueError:
                    print("  json: malformed")
            print()
            if number < args.requests:
                time.sleep(args.delay)
    if args.save_latest:
        save_cookie(args.save_latest.resolve(), latest)
        print(f"latest cookie saved privately to {args.save_latest.resolve()}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auth-cookie-file", type=Path, required=True,
                        help=f"private file containing only the {COOKIE_NAME} value")
    parser.add_argument("--path", default=DEFAULT_PATH,
                        help=f"same-origin GET path to probe (default: {DEFAULT_PATH})")
    parser.add_argument("--requests", type=int, default=3,
                        help="number of sequential requests, 1-10 (default: 3)")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="seconds between requests, at least 0.5 (default: 1.0)")
    parser.add_argument("--save-latest", type=Path,
                        help="optionally save the final observed value to a private file")
    args = parser.parse_args()
    if not 1 <= args.requests <= 10:
        parser.error("--requests must be between 1 and 10")
    if args.delay < 0.5:
        parser.error("--delay must be at least 0.5 seconds")
    if not args.path.startswith("/"):
        parser.error("--path must begin with /")
    return args


def main() -> int:
    try:
        return run(parse_args())
    except (httpx.HTTPError, OSError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
