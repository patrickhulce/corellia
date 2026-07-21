#!/usr/bin/env -S uv run --python 3.12 --script
# /// script
# requires-python = "==3.12.*"
# dependencies = [
#   "httpx==0.28.1",
#   "playwright==1.61.0",
# ]
# ///
"""Append-preserving local archive of a Brightwheel parent account.

This uses the private APIs observed while the normal web application is open.  It
deliberately keeps all endpoint-specific logic in ``PayloadAdapter``: Brightwheel
does not publish a parent export API and may change those responses at any time.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import dataclasses
import datetime as dt
import errno
import hashlib
import json
import logging
import mimetypes
import os
import re
import shutil
import signal
import sqlite3
import sys
import tempfile
import unicodedata
import urllib.parse
from collections.abc import Mapping
from pathlib import Path
from typing import Any

LOG = logging.getLogger("brightwheel-archive")
UTC = dt.timezone.utc
SCHEMA_VERSION = 2
LOGIN_URL = "https://schools.mybrightwheel.com/sign-in"
APP_ORIGIN = "https://schools.mybrightwheel.com"
READ_METHODS = {"GET", "HEAD", "OPTIONS"}
BLOCKED_REST_MUTATIONS = ("/messages", "/activities", "/reactions", "/mark-read", "/mark_read")
SIGNED_QUERY_KEYS = {
    "x-amz-algorithm", "x-amz-credential", "x-amz-date", "x-amz-expires",
    "x-amz-security-token", "x-amz-signature", "x-amz-signedheaders",
    "signature", "expires", "token", "policy", "key-pair-id",
}


def utc_now() -> str:
    return dt.datetime.now(UTC).isoformat().replace("+00:00", "Z")


def json_text(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def parse_time(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        seconds = float(value) / (1000 if value > 10_000_000_000 else 1)
        return dt.datetime.fromtimestamp(seconds, UTC).isoformat().replace("+00:00", "Z")
    text = str(value).strip()
    if re.fullmatch(r"\d+(\.\d+)?", text):
        return parse_time(float(text))
    try:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def local_date(utc_timestamp: str | None) -> str:
    if not utc_timestamp:
        return "unknown-date"
    parsed = dt.datetime.fromisoformat(utc_timestamp.replace("Z", "+00:00"))
    return parsed.astimezone().date().isoformat()


def sanitize_component(value: str, fallback: str = "unnamed") -> str:
    value = unicodedata.normalize("NFKC", value).replace("/", "-").replace("\\", "-")
    value = "".join(ch for ch in value if ch >= " " and ch not in '<>:"|?*')
    value = re.sub(r"\s+", " ", value).strip(" .")
    if value in {"", ".", ".."}:
        value = fallback
    return value[:100]


def short_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", value)
    return (cleaned[-8:] if cleaned else hashlib.sha256(value.encode()).hexdigest()[:8]).lower()


def normalize_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if k.lower() not in SIGNED_QUERY_KEYS]
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path,
                                    urllib.parse.urlencode(sorted(query)), ""))


def pick(data: Mapping[str, Any], *names: str) -> Any:
    lowered = {str(k).lower(): v for k, v in data.items()}
    for name in names:
        if name.lower() in lowered and lowered[name.lower()] is not None:
            return lowered[name.lower()]
    return None


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else ([] if value is None else [value])


def record_id(data: Mapping[str, Any]) -> str | None:
    value = pick(data, "id", "uuid", "_id", "object_id", "message_id", "activity_id", "student_id")
    return str(value) if value is not None else None


@dataclasses.dataclass(slots=True)
class RequestSpec:
    url: str
    method: str
    headers: dict[str, str]
    json_body: Any = None
    kind: str | None = None
    child_scope: str | None = None
    pagination: str | None = None
    page_size: int | None = None
    parent_id: str | None = None

    def fingerprint(self) -> str:
        body = strip_pagination(self.json_body)
        parts = urllib.parse.urlsplit(self.url)
        query = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query) if k.lower() not in PAGINATION_KEYS]
        url = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(sorted(query)), ""))
        return hashlib.sha256(json_text([self.method, url, body, self.child_scope,
                                         self.pagination, self.page_size, self.parent_id]).encode()).hexdigest()


PAGINATION_KEYS = {"cursor", "after", "page", "next_cursor", "nextcursor", "offset"}


def strip_pagination(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: strip_pagination(v) for k, v in value.items() if k.lower() not in PAGINATION_KEYS}
    if isinstance(value, list):
        return [strip_pagination(v) for v in value]
    return value


class PayloadError(ValueError):
    pass


class CursorLoop(PayloadError):
    pass


class PayloadAdapter:
    """Conservatively classify private API JSON by URL and structural evidence."""

    KINDS = ("children", "threads", "messages", "activities")
    ITEM_KEYS = {
        "children": ("children", "students", "profiles"),
        "threads": ("threads", "conversations", "channels"),
        "messages": ("messages", "posts"),
        "activities": ("activities", "feed", "events", "timeline"),
    }

    @classmethod
    def items(cls, payload: Any, kind: str) -> list[dict[str, Any]]:
        if kind not in cls.KINDS:
            raise PayloadError(f"unknown payload kind: {kind}")
        candidates: list[Any] = []
        if isinstance(payload, list):
            candidates.append(payload)
        elif isinstance(payload, dict):
            for container in (payload, payload.get("data"), payload.get("result")):
                if isinstance(container, dict):
                    for key in cls.ITEM_KEYS[kind]:
                        if isinstance(container.get(key), list):
                            candidates.append(container[key])
                    for key in ("items", "nodes", "results", "edges"):
                        if isinstance(container.get(key), list):
                            candidates.append(container[key])
        for candidate in candidates:
            out: list[dict[str, Any]] = []
            for item in candidate:
                if isinstance(item, dict) and isinstance(item.get("node"), dict):
                    item = item["node"]
                if kind == "children" and isinstance(item, dict) and isinstance(item.get("student"), dict):
                    relationship = {key: value for key, value in item.items() if key != "student"}
                    item = {**item["student"], "_guardian_relationship": relationship}
                if kind == "messages" and isinstance(item, dict) and isinstance(item.get("message"), dict):
                    wrapper = {key: value for key, value in item.items() if key != "message"}
                    item = {**item["message"], "_response_wrapper": wrapper}
                if isinstance(item, dict) and cls._matches(item, kind):
                    out.append(item)
            if out:
                return out
            if candidate == []:
                return []
        raise PayloadError(f"response does not validate as {kind}")

    @staticmethod
    def _matches(item: Mapping[str, Any], kind: str) -> bool:
        keys = {str(k).lower() for k in item}
        if not record_id(item):
            return False
        evidence = {
            "children": {"first_name", "firstname", "student_id", "birth_date", "last_name"},
            "threads": {"participants", "participant_ids", "channel_type", "last_message", "subject", "thread_id", "student"},
            "messages": {"body", "text", "message", "sender", "sent_at", "attachments"},
            "activities": {"activity_type", "event_type", "action_type", "occurred_at", "media"},
        }
        return bool(keys & evidence[kind])

    @staticmethod
    def next_token(payload: Any) -> tuple[str, str] | None:
        if not isinstance(payload, dict):
            return None
        sources = [payload]
        for key in ("data", "meta", "pagination", "page_info", "pageInfo"):
            if isinstance(payload.get(key), dict):
                sources.append(payload[key])
        for src in sources:
            for key in ("next_cursor", "nextCursor", "after", "cursor"):
                value = src.get(key)
                if value not in (None, ""):
                    return (key, str(value))
            value = src.get("next_page", src.get("nextPage"))
            if value not in (None, "", False):
                return ("page", str(value))
            if src.get("has_next_page") or src.get("hasNextPage"):
                end = src.get("end_cursor", src.get("endCursor"))
                if end:
                    return ("cursor", str(end))
        links = payload.get("links")
        if isinstance(links, dict) and links.get("next"):
            return ("url", str(links["next"]))
        return None

    @classmethod
    def classify(cls, url: str, payload: Any) -> str | None:
        path = urllib.parse.urlsplit(url).path.lower()
        order = sorted(cls.KINDS, key=lambda k: 0 if any(x in path for x in cls.ITEM_KEYS[k]) else 1)
        for kind in order:
            try:
                cls.items(payload, kind)
                return kind
            except PayloadError:
                pass
        return None


MIGRATION = """
CREATE TABLE sync_runs(id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
 status TEXT NOT NULL, summary_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE children(id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, display_name TEXT NOT NULL,
 folder_name TEXT NOT NULL, raw_json TEXT NOT NULL, first_seen_run INTEGER NOT NULL,
 last_seen_run INTEGER NOT NULL REFERENCES sync_runs(id));
CREATE TABLE threads(id TEXT PRIMARY KEY, thread_type TEXT, subject TEXT, raw_json TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL);
CREATE TABLE thread_children(thread_id TEXT NOT NULL, child_id TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 PRIMARY KEY(thread_id, child_id));
CREATE TABLE messages(id TEXT PRIMARY KEY, thread_id TEXT, sender_id TEXT, sender_name TEXT,
 body TEXT, message_type TEXT, sent_at TEXT, raw_json TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL);
CREATE TABLE activities(id TEXT PRIMARY KEY, author_id TEXT, author_name TEXT, activity_type TEXT,
 body TEXT, created_at TEXT, occurred_at TEXT, raw_json TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL);
CREATE TABLE activity_children(activity_id TEXT NOT NULL, child_id TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 PRIMARY KEY(activity_id, child_id));
CREATE TABLE assets(id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL,
 position INTEGER NOT NULL, filename TEXT NOT NULL, mime_type TEXT, byte_length INTEGER,
 raw_json TEXT NOT NULL, first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 download_status TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE asset_owners(asset_id TEXT NOT NULL, owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 PRIMARY KEY(asset_id, owner_kind, owner_id));
CREATE TABLE asset_urls(asset_id TEXT NOT NULL, url TEXT NOT NULL, normalized_url TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 PRIMARY KEY(asset_id, url));
CREATE TABLE local_files(id INTEGER PRIMARY KEY, asset_id TEXT NOT NULL, sha256 TEXT NOT NULL,
 byte_length INTEGER NOT NULL, canonical_path TEXT NOT NULL, verified_at TEXT NOT NULL,
 UNIQUE(asset_id, sha256), UNIQUE(canonical_path));
CREATE INDEX messages_thread ON messages(thread_id, sent_at);
CREATE INDEX assets_owner ON assets(owner_kind, owner_id);
PRAGMA user_version=2;
"""

MIGRATE_1_TO_2 = """
ALTER TABLE activities ADD COLUMN created_at TEXT;
UPDATE activities SET created_at=occurred_at WHERE created_at IS NULL;
CREATE TABLE asset_owners(asset_id TEXT NOT NULL, owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL,
 first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL,
 PRIMARY KEY(asset_id, owner_kind, owner_id));
INSERT OR IGNORE INTO asset_owners(asset_id,owner_kind,owner_id,first_seen_run,last_seen_run)
 SELECT id,owner_kind,owner_id,first_seen_run,last_seen_run FROM assets;
PRAGMA user_version=2;
"""


class ArchiveDB:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        version = self.conn.execute("PRAGMA user_version").fetchone()[0]
        if version == 0:
            self.conn.executescript(MIGRATION)
        elif version == 1:
            self.conn.executescript(MIGRATE_1_TO_2)
        elif version != SCHEMA_VERSION:
            raise RuntimeError(f"unsupported database schema {version}; expected {SCHEMA_VERSION}")
        self.recover_interrupted_runs()

    def recover_interrupted_runs(self) -> int:
        now = utc_now()
        cur = self.conn.execute(
            "UPDATE sync_runs SET finished_at=?,status='interrupted' WHERE status='running'",
            (now,),
        )
        self.conn.commit()
        if cur.rowcount:
            LOG.warning("marked %d abandoned sync run(s) as interrupted", cur.rowcount)
        return cur.rowcount

    def start_run(self) -> int:
        cur = self.conn.execute("INSERT INTO sync_runs(started_at,status) VALUES (?,?)", (utc_now(), "running"))
        self.conn.commit()
        return int(cur.lastrowid)

    def finish_run(self, run: int, status: str, counts: Mapping[str, int]) -> None:
        self.conn.execute("UPDATE sync_runs SET finished_at=?,status=?,summary_json=? WHERE id=?",
                          (utc_now(), status, json_text(counts), run))
        self.conn.commit()

    def upsert(self, table: str, key: Mapping[str, Any], values: Mapping[str, Any], run: int) -> str:
        where = " AND ".join(f"{k}=?" for k in key)
        existed = self.conn.execute(f"SELECT first_seen_run FROM {table} WHERE {where}", tuple(key.values())).fetchone()
        data = {**key, **values, "first_seen_run": existed[0] if existed else run, "last_seen_run": run}
        columns = list(data)
        conflict = ",".join(key)
        updates = ",".join([*(f"{c}=excluded.{c}" for c in values), "last_seen_run=excluded.last_seen_run"])
        sql = (f"INSERT INTO {table}({','.join(columns)}) VALUES ({','.join('?' for _ in columns)}) "
               f"ON CONFLICT({conflict}) DO UPDATE SET {updates}")
        self.conn.execute(sql, tuple(data[c] for c in columns))
        return "updated" if existed else "inserted"

    def verified_file(self, asset_id: str) -> sqlite3.Row | None:
        for row in self.conn.execute("SELECT * FROM local_files WHERE asset_id=? ORDER BY id DESC", (asset_id,)):
            path = Path(row["canonical_path"])
            if path.is_file() and path.stat().st_size == row["byte_length"] and sha256_file(path) == row["sha256"]:
                return row
        return None

    def close(self) -> None:
        self.conn.close()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extension_from_bytes(data: bytes) -> str | None:
    """Return a conservative canonical extension based on a file signature."""
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if data.startswith(b"%PDF-"):
        return ".pdf"
    if data.startswith(b"BM"):
        return ".bmp"
    if data.startswith((b"II*\x00", b"MM\x00*")):
        return ".tiff"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        brand = data[8:12].lower()
        if brand in {b"qt  "}:
            return ".mov"
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"}:
            return ".heic"
        return ".mp4"
    if data.startswith(b"PK\x03\x04"):
        return ".zip"
    return None


def filename_with_extension(filename: str, extension: str | None) -> str:
    if not extension:
        return filename
    current = Path(filename).suffix.lower()
    equivalents = {
        ".jpg": {".jpg", ".jpeg", ".jpe"},
        ".tiff": {".tif", ".tiff"},
        ".heic": {".heic", ".heif"},
    }
    if current in equivalents.get(extension, {extension}):
        return filename
    return f"{Path(filename).stem}{extension}"


def rename_with_extension(path: Path, extension: str) -> Path:
    replacement = path.with_name(filename_with_extension(path.name, extension))
    if replacement == path:
        return path
    if replacement.exists():
        if sha256_file(replacement) == sha256_file(path):
            path.unlink()
            return replacement
        replacement = replacement.with_name(
            f"{replacement.stem}_{sha256_file(path)[:8]}{replacement.suffix}"
        )
        if replacement.exists():
            if sha256_file(replacement) == sha256_file(path):
                path.unlink()
                return replacement
            raise RuntimeError(f"extension repair would overwrite a different file: {replacement}")
    path.rename(replacement)
    return replacement


class ProcessLock:
    def __init__(self, path: Path):
        self.path, self.fd, self.identity = path, None, None

    def __enter__(self) -> "ProcessLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        for _ in range(2):
            try:
                self.fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                os.write(self.fd, f"{os.getpid()}\n".encode())
                held = os.fstat(self.fd)
                self.identity = (held.st_dev, held.st_ino)
                break
            except FileExistsError:
                try:
                    before = self.path.stat()
                    pid = int(self.path.read_text().strip())
                    if pid <= 0:
                        raise ValueError("invalid pid")
                    os.kill(pid, 0)
                except (FileNotFoundError, ValueError, ProcessLookupError):
                    try:
                        after = self.path.stat()
                        if (before.st_dev, before.st_ino) == (after.st_dev, after.st_ino):
                            self.path.unlink()
                            LOG.warning("removed stale sync lock")
                    except (FileNotFoundError, UnboundLocalError):
                        pass
                    continue
                except PermissionError as exc:
                    raise RuntimeError(f"cannot inspect existing sync lock ({self.path})") from exc
                raise RuntimeError(f"another sync is active (pid {pid}, {self.path})") from None
        if self.fd is None:
            raise RuntimeError(f"could not acquire sync lock ({self.path})")
        return self

    def __exit__(self, *_: Any) -> None:
        if self.fd is not None:
            os.close(self.fd)
        try:
            current = self.path.stat()
            if self.identity == (current.st_dev, current.st_ino):
                self.path.unlink()
        except FileNotFoundError:
            pass


class Syncer:
    def __init__(self, db: ArchiveDB, data_dir: Path, run: int):
        self.db, self.data_dir, self.run = db, data_dir, run
        self.counts = {k: 0 for k in ("discovered", "inserted", "updated", "skipped", "downloaded", "failed")}
        self.children: dict[str, str] = {}
        self.endpoints: dict[str, dict[str, RequestSpec]] = {kind: {} for kind in PayloadAdapter.KINDS}

    def count(self, result: str) -> None:
        self.counts[result] += 1

    def ingest(self, kind: str, payload: Any, parent_id: str | None = None) -> None:
        items = PayloadAdapter.items(payload, kind)
        with self.db.conn:
            for item in items:
                if kind == "messages" and parent_id and not pick(item, "thread_id", "conversation_id", "channel_id"):
                    item = {**item, "_thread_id": parent_id}
                if kind == "activities" and parent_id and not self.child_ids(item):
                    item = {**item, "child_id": parent_id}
                self.counts["discovered"] += 1
                if kind == "children": self._child(item)
                elif kind == "threads": self._thread(item)
                elif kind == "messages": self._message(item)
                else: self._activity(item)

    def _child(self, raw: Mapping[str, Any]) -> None:
        ident = record_id(raw)
        assert ident
        first, last = pick(raw, "first_name", "firstName", "given_name"), pick(raw, "last_name", "lastName", "family_name")
        display = str(pick(raw, "display_name", "displayName", "name") or " ".join(x for x in (str(first or ""), str(last or "")) if x).strip() or f"Child {short_id(ident)}")
        base = sanitize_component(display, "child")
        conflict = self.db.conn.execute("SELECT id FROM children WHERE folder_name=? AND id<>?", (base, ident)).fetchone()
        folder = f"{base}-{short_id(ident)}" if conflict else base
        result = self.db.upsert("children", {"id": ident}, {"first_name": first, "last_name": last,
            "display_name": display, "folder_name": folder, "raw_json": json_text(raw)}, self.run)
        self.children[ident] = folder
        self.count(result)

    def child_ids(self, raw: Mapping[str, Any]) -> list[str]:
        values = []
        for key in ("child_id", "student_id", "child_ids", "student_ids", "child", "student", "target", "children", "students"):
            for value in as_list(pick(raw, key)):
                if isinstance(value, dict): value = record_id(value)
                if value is not None and str(value) in self.children: values.append(str(value))
        return list(dict.fromkeys(values))

    def _thread(self, raw: Mapping[str, Any]) -> None:
        ident = record_id(raw); assert ident
        result = self.db.upsert("threads", {"id": ident}, {"thread_type": pick(raw, "thread_type", "channel_type", "type"),
            "subject": pick(raw, "subject", "title", "name"), "raw_json": json_text(raw)}, self.run)
        self.count(result)
        for child in self.child_ids(raw):
            self.db.upsert("thread_children", {"thread_id": ident, "child_id": child}, {}, self.run)

    def _message(self, raw: Mapping[str, Any]) -> None:
        ident = record_id(raw); assert ident
        sender = pick(raw, "sender", "author", "user") or {}
        if not isinstance(sender, dict): sender = {"name": str(sender)}
        thread = pick(raw, "thread_id", "_thread_id", "conversation_id", "channel_id")
        result = self.db.upsert("messages", {"id": ident}, {"thread_id": str(thread) if thread else None,
            "sender_id": record_id(sender), "sender_name": pick(sender, "name", "display_name", "full_name"),
            "body": pick(raw, "body", "text", "message", "content"), "message_type": pick(raw, "message_type", "type"),
            "sent_at": parse_time(pick(raw, "sent_at", "created_at", "timestamp", "date")), "raw_json": json_text(raw)}, self.run)
        self.count(result); self._assets("message", ident, raw)

    def _activity(self, raw: Mapping[str, Any]) -> None:
        ident = record_id(raw); assert ident
        author = pick(raw, "author", "creator", "staff", "user") or {}
        if not isinstance(author, dict): author = {"name": str(author)}
        created = parse_time(pick(raw, "created_at", "createdAt", "inserted_at", "timestamp"))
        occurred = parse_time(pick(raw, "occurred_at", "event_at", "eventAt", "date"))
        result = self.db.upsert("activities", {"id": ident}, {"author_id": record_id(author),
            "author_name": pick(author, "name", "display_name", "full_name"), "activity_type": pick(raw, "activity_type", "event_type", "action_type", "type"),
            "body": pick(raw, "body", "text", "note", "description"), "created_at": created,
            "occurred_at": occurred, "raw_json": json_text(raw)}, self.run)
        self.count(result)
        for child in self.child_ids(raw):
            self.db.upsert("activity_children", {"activity_id": ident, "child_id": child}, {}, self.run)
        self._assets("activity", ident, raw)

    def _assets(self, owner_kind: str, owner_id: str, raw: Mapping[str, Any]) -> None:
        candidates: list[Any] = []
        for key in ("attachments", "assets", "media", "photos", "videos", "files"):
            candidates.extend(as_list(pick(raw, key)))
        observed: set[tuple[str, str]] = set()
        stable_seen: set[str] = set()
        for pos, asset in enumerate(candidates):
            if isinstance(asset, str): asset = {"url": asset}
            if not isinstance(asset, dict): continue
            url = pick(asset, "image_url", "video_url", "download_url", "downloadUrl", "url", "src", "original_url")
            if not url: continue
            filename = str(pick(asset, "filename", "file_name", "name") or Path(urllib.parse.urlsplit(str(url)).path).name or "asset")
            stable = record_id(asset)
            if stable and stable in stable_seen:
                continue
            if stable:
                stable_seen.add(stable)
                ident = stable
            else:
                basis = (normalize_url(str(url)), filename)
                if basis in observed:
                    continue
                observed.add(basis)
                ident = hashlib.sha256(f"{owner_kind}\0{owner_id}\0{basis[0]}\0{filename}".encode()).hexdigest()
            mime = pick(asset, "mime_type", "content_type", "mime") or mimetypes.guess_type(filename)[0]
            existing = self.db.conn.execute("SELECT download_status FROM assets WHERE id=?", (ident,)).fetchone()
            status = existing[0] if existing else "pending"
            self.db.upsert("assets", {"id": ident}, {"owner_kind": owner_kind, "owner_id": owner_id,
                "position": pos, "filename": filename, "mime_type": mime, "byte_length": pick(asset, "byte_length", "size", "file_size"),
                "raw_json": json_text(asset), "download_status": status}, self.run)
            self.db.upsert("asset_owners", {"asset_id": ident, "owner_kind": owner_kind, "owner_id": owner_id}, {}, self.run)
            self.db.upsert("asset_urls", {"asset_id": ident, "url": str(url)}, {"normalized_url": normalize_url(str(url))}, self.run)

    async def paginate(self, client: Any, spec: RequestSpec, kind: str) -> None:
        current, seen = spec, set()
        while True:
            payload = await request_json(client, current)
            items = PayloadAdapter.items(payload, kind)
            token = PayloadAdapter.next_token(payload)
            if not token and spec.pagination == "cursor" and items:
                has_more = isinstance(payload, dict) and payload.get("has_more") is True
                if has_more or (spec.page_size is not None and len(items) >= spec.page_size):
                    last = record_id(items[-1])
                    if last:
                        token = ("starting_after", last)
            if not token and spec.pagination == "page" and spec.page_size is not None and len(items) >= spec.page_size:
                parts = urllib.parse.urlsplit(current.url)
                query = dict(urllib.parse.parse_qsl(parts.query))
                token = ("page", str(int(query.get("page", "0")) + 1))
            if token and token in seen:
                raise CursorLoop(f"repeated pagination token for {spec.url}: {token}")
            self.ingest(kind, payload, spec.parent_id)
            if not token: return
            seen.add(token)
            key, value = token
            if key == "url":
                current = dataclasses.replace(current, url=urllib.parse.urljoin(current.url, value))
            elif current.method == "POST":
                current = dataclasses.replace(current, json_body=set_pagination(current.json_body, key, value))
            else:
                parts = urllib.parse.urlsplit(current.url)
                query = dict(urllib.parse.parse_qsl(parts.query))
                query[key] = value
                current = dataclasses.replace(current, url=urllib.parse.urlunsplit((*parts[:3], urllib.parse.urlencode(query), "")))


def set_pagination(body: Any, response_key: str, value: str) -> Any:
    """Replace the existing request pagination variable without changing its spelling."""
    body = json.loads(json.dumps(body))
    aliases = {response_key.lower(), "cursor", "after", "page", "next_cursor", "nextcursor", "offset"}
    def replace(node: Any) -> bool:
        if not isinstance(node, dict):
            return False
        for key in node:
            if key.lower() in aliases:
                node[key] = int(value) if key.lower() in {"page", "offset"} and value.isdigit() else value
                return True
        return any(replace(child) for child in node.values() if isinstance(child, dict))
    if not replace(body):
        if not isinstance(body, dict):
            raise PayloadError("cannot add pagination to a non-object request body")
        variables = body.setdefault("variables", {})
        variables["cursor"] = value
    return body


async def request_json(client: Any, spec: RequestSpec, attempts: int = 5) -> Any:
    for attempt in range(attempts):
        response = await client.request(spec.method, spec.url, headers=spec.headers,
                                        json=spec.json_body if spec.method == "POST" else None)
        if response.status_code == 429 or 500 <= response.status_code < 600:
            if attempt + 1 == attempts: raise RuntimeError(f"HTTP {response.status_code} after retries: {spec.url}")
            retry = response.headers.get("retry-after")
            await asyncio.sleep(float(retry) if retry and retry.isdigit() else min(16, 2 ** attempt))
            continue
        if response.status_code >= 400: raise RuntimeError(f"HTTP {response.status_code}: {spec.url}")
        try: return response.json()
        except Exception as exc: raise PayloadError(f"non-JSON API response: {spec.url}") from exc
    raise AssertionError("unreachable")


async def bootstrap_children(sync: Syncer, client: Any) -> str:
    me_spec = RequestSpec(f"{APP_ORIGIN}/api/v1/users/me", "GET", {"accept": "application/json"})
    me = await request_json(client, me_spec)
    if not isinstance(me, dict) or not record_id(me):
        raise PayloadError("users/me did not contain a guardian object_id")
    guardian_id = record_id(me)
    query = urllib.parse.urlencode({"include[]": "schools"})
    children_spec = RequestSpec(
        f"{APP_ORIGIN}/api/v1/guardians/{urllib.parse.quote(guardian_id, safe='')}/students?{query}",
        "GET", {"accept": "application/json"}, kind="children",
    )
    sync.endpoints["children"][children_spec.fingerprint()] = children_spec
    await sync.paginate(client, children_spec, "children")
    if not sync.children:
        raise PayloadError("guardian students endpoint returned no children")
    return guardian_id


async def traverse_known_resources(sync: Syncer, client: Any, guardian_id: str) -> None:
    query = urllib.parse.urlencode({"page_limit": 25, "sort_by_unread": "false"})
    threads_spec = RequestSpec(
        f"{APP_ORIGIN}/api/v2/guardians/{urllib.parse.quote(guardian_id, safe='')}/message_threads?{query}",
        "GET", {"accept": "application/json"}, kind="threads", pagination="cursor", page_size=25,
    )
    sync.endpoints["threads"][threads_spec.fingerprint()] = threads_spec
    await sync.paginate(client, threads_spec, "threads")

    thread_ids = [row[0] for row in sync.db.conn.execute(
        "SELECT id FROM threads WHERE last_seen_run=? ORDER BY id", (sync.run,)
    )]
    for thread_id in thread_ids:
        query = urllib.parse.urlencode({"page_limit": 25})
        spec = RequestSpec(
            f"{APP_ORIGIN}/api/v2/guardians/{urllib.parse.quote(guardian_id, safe='')}/message_threads/"
            f"{urllib.parse.quote(thread_id, safe='')}/messages?{query}",
            "GET", {"accept": "application/json"}, kind="messages", pagination="cursor", page_size=25,
            parent_id=thread_id,
        )
        sync.endpoints["messages"][spec.fingerprint()] = spec
        await sync.paginate(client, spec, "messages")

    for child_id in sorted(sync.children):
        query = urllib.parse.urlencode({"page": 0, "page_size": 100, "include_parent_actions": "true"})
        spec = RequestSpec(
            f"{APP_ORIGIN}/api/v1/students/{urllib.parse.quote(child_id, safe='')}/activities?{query}",
            "GET", {"accept": "application/json"}, kind="activities", child_scope=child_id,
            pagination="page", page_size=100, parent_id=child_id,
        )
        sync.endpoints["activities"][spec.fingerprint()] = spec
        await sync.paginate(client, spec, "activities")


def asset_children(db: ArchiveDB, row: sqlite3.Row) -> list[str]:
    sql = """
    SELECT ac.child_id FROM asset_owners ao
      JOIN activity_children ac ON ao.owner_kind='activity' AND ac.activity_id=ao.owner_id
      WHERE ao.asset_id=?
    UNION
    SELECT tc.child_id FROM asset_owners ao
      JOIN messages m ON ao.owner_kind='message' AND m.id=ao.owner_id
      JOIN thread_children tc ON tc.thread_id=m.thread_id
      WHERE ao.asset_id=?
    """
    return [x[0] for x in db.conn.execute(sql, (row["id"], row["id"]))]


async def download_assets(sync: Syncer, client: Any) -> None:
    semaphore = asyncio.Semaphore(3)
    refresh_lock = asyncio.Lock()
    refreshed: set[str] = set()
    rows = list(sync.db.conn.execute("SELECT * FROM assets WHERE last_seen_run=?", (sync.run,)))
    async def fetch(url: str) -> bytes | None:
        for attempt in range(5):
            response = await client.get(url)
            if response.status_code != 429 and not 500 <= response.status_code < 600:
                return response.content if response.status_code < 400 else None
            await asyncio.sleep(min(16, 2 ** attempt))
        return None

    async def refresh_urls(row: sqlite3.Row) -> None:
        async with refresh_lock:
            if row["id"] in refreshed:
                return
            refreshed.add(row["id"])
            owners = sync.db.conn.execute("SELECT owner_kind FROM asset_owners WHERE asset_id=?", (row["id"],)).fetchall()
            kinds = {"messages" if owner[0] == "message" else "activities" for owner in owners}
            for kind in kinds:
                for spec in sync.endpoints[kind].values():
                    try:
                        await sync.paginate(client, spec, kind)
                    except Exception as exc:
                        LOG.debug("could not refresh %s URL through %s: %s", row["id"], spec.url, exc)

    async def one(row: sqlite3.Row) -> None:
        async with semaphore:
            verified = sync.db.verified_file(row["id"])
            if verified:
                materialize(sync, row, Path(verified["canonical_path"])); sync.counts["skipped"] += 1; return
            urls = [x[0] for x in sync.db.conn.execute("SELECT url FROM asset_urls WHERE asset_id=? ORDER BY last_seen_run DESC,rowid DESC", (row["id"],))]
            tried: set[str] = set()
            for refresh_attempt in range(2):
                if refresh_attempt:
                    await refresh_urls(row)
                    urls = [x[0] for x in sync.db.conn.execute("SELECT url FROM asset_urls WHERE asset_id=? ORDER BY last_seen_run DESC,rowid DESC", (row["id"],)) if x[0] not in tried]
                for url in urls:
                    tried.add(url)
                    try:
                        body = await fetch(url)
                        if body is None: continue
                        expected = row["byte_length"]
                        if expected is not None and len(body) != expected: raise IOError("download size mismatch")
                        filename = filename_with_extension(row["filename"], extension_from_bytes(body))
                        if filename != row["filename"]:
                            with sync.db.conn:
                                sync.db.conn.execute("UPDATE assets SET filename=? WHERE id=?", (filename, row["id"]))
                            row = sync.db.conn.execute("SELECT * FROM assets WHERE id=?", (row["id"],)).fetchone()
                        object_key = hashlib.sha256(row["id"].encode()).hexdigest()
                        root = sync.data_dir / ".objects" / object_key[:2]
                        root.mkdir(parents=True, exist_ok=True)
                        target = root / f"{object_key}_{sanitize_component(row['filename'], 'asset')}"
                        part = target.with_name(target.name + ".part")
                        part.write_bytes(body); digest = sha256_file(part); os.replace(part, target)
                        with sync.db.conn:
                            sync.db.conn.execute("INSERT OR IGNORE INTO local_files(asset_id,sha256,byte_length,canonical_path,verified_at) VALUES (?,?,?,?,?)",
                                (row["id"], digest, len(body), str(target), utc_now()))
                            sync.db.conn.execute("UPDATE assets SET download_status='verified',byte_length=? WHERE id=?", (len(body), row["id"]))
                        materialize(sync, row, target); sync.counts["downloaded"] += 1; return
                    except Exception as exc:
                        LOG.warning("asset %s: %s", row["id"], exc)
            sync.db.conn.execute("UPDATE assets SET download_status='failed' WHERE id=?", (row["id"],)); sync.db.conn.commit()
            sync.counts["failed"] += 1
    await asyncio.gather(*(one(row) for row in rows))


def materialize(sync: Syncer, asset: sqlite3.Row, source: Path) -> None:
    owners = sync.db.conn.execute("SELECT owner_kind,owner_id FROM asset_owners WHERE asset_id=?", (asset["id"],)).fetchall()
    for owner in owners:
        if owner["owner_kind"] == "activity":
            found = sync.db.conn.execute("SELECT created_at FROM activities WHERE id=?", (owner["owner_id"],)).fetchone()
            category = "photos"
        else:
            found = sync.db.conn.execute("SELECT sent_at FROM messages WHERE id=?", (owner["owner_id"],)).fetchone()
            category = "attachments"
        timestamp = found[0] if found else None
        stamp = (timestamp or "unknown").replace(":", "-").replace("Z", "")
        name = sanitize_component(f"{stamp}_{asset['id']}_{asset['filename']}", "asset")
        child_ids = asset_children_for_owner(sync.db, owner["owner_kind"], owner["owner_id"])
        for child_id in child_ids:
            child = sync.db.conn.execute("SELECT folder_name FROM children WHERE id=?", (child_id,)).fetchone()
            if not child: continue
            target = sync.data_dir / child[0] / category / local_date(timestamp) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists(): continue
            try: os.link(source, target)
            except OSError as exc:
                if exc.errno not in (errno.EXDEV, errno.EPERM, errno.EACCES): raise
                shutil.copy2(source, target)


def fixup_extensions(data_dir: Path) -> int:
    """Repair extensionless/wrong-extension archived files from verified magic bytes."""
    data_dir = data_dir.resolve()
    repaired = 0
    with ProcessLock(data_dir / ".sync.lock"):
        db = ArchiveDB(data_dir / "brightwheel.sqlite3")
        try:
            rows = list(db.conn.execute("""
                SELECT lf.id AS local_file_id, lf.canonical_path, a.id AS asset_id, a.filename
                FROM local_files lf JOIN assets a ON a.id=lf.asset_id
                ORDER BY lf.id
            """))
            with db.conn:
                for row in rows:
                    source = Path(row["canonical_path"])
                    if not source.is_file():
                        candidates = [p for p in source.parent.glob(f"{source.name}.*") if p.is_file()]
                        if len(candidates) != 1 and "_" in source.name:
                            object_key = source.name.split("_", 1)[0]
                            candidates = [p for p in source.parent.glob(f"{object_key}_*") if p.is_file()]
                        if len(candidates) != 1:
                            continue
                        source = candidates[0]
                        db.conn.execute("UPDATE local_files SET canonical_path=? WHERE id=?",
                                        (str(source), row["local_file_id"]))
                        repaired += 1
                    with source.open("rb") as stream:
                        extension = extension_from_bytes(stream.read(32))
                    if not extension:
                        continue
                    filename = filename_with_extension(row["filename"], extension)
                    renamed_source = rename_with_extension(source, extension)
                    if renamed_source != source:
                        db.conn.execute("UPDATE local_files SET canonical_path=? WHERE id=?",
                                        (str(renamed_source), row["local_file_id"]))
                        repaired += 1
                    if filename != row["filename"]:
                        db.conn.execute("UPDATE assets SET filename=? WHERE id=?", (filename, row["asset_id"]))
                    for child_dir in data_dir.iterdir():
                        if child_dir.name.startswith(".") or not child_dir.is_dir():
                            continue
                        for materialized in child_dir.rglob(f"*_{row['asset_id']}_*"):
                            if not materialized.is_file():
                                continue
                            fixed = rename_with_extension(materialized, extension)
                            if fixed != materialized:
                                repaired += 1
        finally:
            db.close()
    print(f"extension-fixup: repaired={repaired}")
    return repaired


def asset_children_for_owner(db: ArchiveDB, owner_kind: str, owner_id: str) -> list[str]:
    if owner_kind == "activity":
        return [x[0] for x in db.conn.execute("SELECT child_id FROM activity_children WHERE activity_id=?", (owner_id,))]
    return [x[0] for x in db.conn.execute(
        "SELECT tc.child_id FROM messages m JOIN thread_children tc ON tc.thread_id=m.thread_id WHERE m.id=?", (owner_id,))]


def allow_route(route: Any, request: Any, authenticated: bool) -> Any:
    method, url = request.method.upper(), request.url.lower()
    if not authenticated or method in READ_METHODS:
        return route.continue_()
    path = urllib.parse.urlsplit(url).path
    body = request.post_data or ""
    if "graphql" in path:
        try: parsed_body = request.post_data_json
        except Exception: parsed_body = body
        if graphql_is_mutation(parsed_body):
            LOG.warning("blocked post-login GraphQL mutation: %s", url)
            return route.abort("blockedbyclient")
        return route.continue_()
    if any(word in path for word in BLOCKED_REST_MUTATIONS):
        LOG.warning("blocked post-login mutation: %s %s", method, url)
        return route.abort("blockedbyclient")
    return route.continue_()


def graphql_is_mutation(body: Any) -> bool:
    if isinstance(body, dict):
        query = body.get("query")
        if isinstance(query, str):
            query = re.sub(r"#[^\n]*", "", query).lstrip()
            return bool(re.match(r"mutation\b", query, re.IGNORECASE))
        operation = body.get("operationType", body.get("operation_type"))
        return isinstance(operation, str) and operation.lower() == "mutation"
    if isinstance(body, str):
        try: return graphql_is_mutation(json.loads(body))
        except (TypeError, json.JSONDecodeError):
            return bool(re.match(r"\s*mutation\b", body, re.IGNORECASE))
    return False


def request_child_scope(url: str, body: Any, child_ids: set[str]) -> str | None:
    haystack = url + " " + json_text(body)
    matches = [child for child in child_ids if child in haystack]
    return matches[0] if len(matches) == 1 else None


def replay_headers(headers: Mapping[str, str]) -> dict[str, str]:
    keep = {"accept", "content-type", "authorization", "x-csrf-token", "x-requested-with",
            "x-api-version", "x-client-version"}
    return {key: value for key, value in headers.items() if key.lower() in keep}


async def make_http_client(context: Any, page: Any) -> Any:
    import httpx
    cookies = httpx.Cookies()
    for cookie in await context.cookies():
        cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain"), path=cookie.get("path", "/"))
    user_agent = await page.evaluate("navigator.userAgent")
    return httpx.AsyncClient(cookies=cookies, headers={"user-agent": user_agent},
                             follow_redirects=True, timeout=httpx.Timeout(60.0))


async def validate_auth_cookie(context: Any, page: Any) -> None:
    async with await make_http_client(context, page) as client:
        response = await client.get(f"{APP_ORIGIN}/api/v1/users/me")
    if response.status_code != 200:
        raise RuntimeError(
            f"the supplied _brightwheel_v2 cookie was rejected (users/me returned HTTP {response.status_code})"
        )


def is_auth_url(url: str) -> bool:
    parsed = urllib.parse.urlsplit(url)
    location = f"{parsed.netloc}{parsed.path}".lower()
    return any(marker in location for marker in (
        "sign-in", "signin", "login", "authorize", "authentication", "mfa", "otp", "challenge", "verify"
    ))


def read_auth_cookie(path: Path) -> str:
    if not path.is_file():
        raise RuntimeError(f"auth cookie file does not exist: {path}")
    mode = path.stat().st_mode
    if mode & 0o077:
        raise RuntimeError(f"auth cookie file must not be accessible by group/others; run: chmod 600 {path}")
    if path.stat().st_size > 16 * 1024:
        raise RuntimeError("auth cookie file is unexpectedly large")
    value = path.read_text().strip()
    if value.startswith("_brightwheel_v2="):
        value = value.split("=", 1)[1]
    if not value or ";" in value or "\n" in value or "\r" in value:
        raise RuntimeError("auth cookie file must contain only the _brightwheel_v2 value")
    return value


async def authenticate(page: Any, headed: bool, manual_login: bool = False) -> None:
    await page.goto(LOGIN_URL, wait_until="domcontentloaded")
    if not is_auth_url(page.url): return
    if manual_login:
        print("Log in manually in the browser; waiting up to 5 minutes…", file=sys.stderr)
        try:
            await page.wait_for_url(lambda u: not is_auth_url(u), timeout=300_000)
            return
        except Exception as exc:
            raise RuntimeError("manual login did not complete within 5 minutes") from exc
    user, password = os.environ.get("BRIGHTWHEEL_USER"), os.environ.get("BRIGHTWHEEL_PASSWORD")
    if user and password:
        try:
            async with asyncio.timeout(20):
                username_input = page.locator("input#username")
                password_input = page.locator("input#password")
                submit = page.locator('button[type="submit"]')
                await username_input.wait_for(state="visible")
                await password_input.wait_for(state="visible")
                await submit.wait_for(state="visible")
                await username_input.fill(user)
                await password_input.fill(password)
                await submit.click()
        except TimeoutError as exc:
            raise RuntimeError(f"Brightwheel username/password form was not usable within 20 seconds (URL: {page.url})") from exc
    elif not headed:
        raise RuntimeError("BRIGHTWHEEL_USER and BRIGHTWHEEL_PASSWORD are required for headless login")

    if is_auth_url(page.url):
        if not headed:
            try:
                await page.wait_for_url(lambda u: not is_auth_url(u), timeout=30_000)
            except Exception as exc:
                raise RuntimeError("login requires OTP/MFA; rerun with --headed") from exc
        else:
            print("Complete OTP/MFA in the browser; waiting up to 5 minutes…", file=sys.stderr)
            try:
                await page.wait_for_url(lambda u: not is_auth_url(u), timeout=300_000)
            except Exception as exc:
                raise RuntimeError("OTP/MFA login did not complete within 5 minutes") from exc


async def live_sync(args: argparse.Namespace) -> dict[str, int]:
    from playwright.async_api import async_playwright
    data = args.data_dir.resolve(); data.mkdir(parents=True, exist_ok=True)
    os.chmod(data, 0o700)
    with ProcessLock(data / ".sync.lock"):
        db = ArchiveDB(data / "brightwheel.sqlite3"); run = db.start_run(); sync = Syncer(db, data, run)
        failed = False
        interrupted = False
        try:
            async with async_playwright() as pw:
                context = await pw.chromium.launch_persistent_context(str(data / "browser-profile"), channel="chrome",
                    headless=not args.headed, accept_downloads=False)
                page = context.pages[0] if context.pages else await context.new_page()
                authenticated = False
                await context.route("**/*", lambda route, request: allow_route(route, request, authenticated))
                if args.auth_cookie_file:
                    cookie = read_auth_cookie(args.auth_cookie_file.resolve())
                    await context.clear_cookies(name="_brightwheel_v2")
                    await context.add_cookies([{"name": "_brightwheel_v2", "value": cookie, "url": APP_ORIGIN}])
                    await validate_auth_cookie(context, page)
                    authenticated = True
                    await page.goto(APP_ORIGIN + "/", wait_until="domcontentloaded")
                else:
                    await authenticate(page, args.headed, args.manual_login)
                    authenticated = True
                child_ids: set[str] = set()
                async def capture(response: Any) -> None:
                    request = response.request
                    if "/api/" in response.url:
                        LOG.debug("browser API response: %s %s -> %s", request.method, response.url, response.status)
                    if request.method not in {"GET", "POST"} or response.status >= 400: return
                    if "json" not in (response.headers.get("content-type") or "").lower(): return
                    body = None
                    if request.method == "POST":
                        try: body = request.post_data_json
                        except Exception: return
                        if graphql_is_mutation(body): return
                    try: payload = await response.json()
                    except Exception: return
                    kind = PayloadAdapter.classify(response.url, payload)
                    if kind:
                        headers = replay_headers(await request.all_headers())
                        spec = RequestSpec(response.url, request.method, headers, body, kind,
                                           request_child_scope(response.url, body, child_ids))
                        sync.endpoints[kind][spec.fingerprint()] = spec
                page.on("response", capture)
                await page.goto(APP_ORIGIN + "/", wait_until="domcontentloaded", timeout=30_000)
                await page.wait_for_timeout(1_000)
                LOG.debug("application page: url=%s title=%s", page.url, await page.title())
                async with await make_http_client(context, page) as client:
                    guardian_id = await bootstrap_children(sync, client)
                    child_ids.update(sync.children)
                    await traverse_known_resources(sync, client, guardian_id)
                    await download_assets(sync, client)
                await context.close()
        except asyncio.CancelledError:
            interrupted = True
            LOG.warning("sync interrupted; committed pages are preserved")
        except Exception:
            failed = True; sync.counts["failed"] += 1; LOG.exception("sync failed")
        finally:
            status = "interrupted" if interrupted else ("partial" if failed or sync.counts["failed"] else "complete")
            db.finish_run(run, status, sync.counts); db.close()
        if interrupted: raise RuntimeError("sync interrupted; rerun to resume")
        if failed or sync.counts["failed"]: raise RuntimeError("archive is partial; see errors above")
        return sync.counts


async def live_sync_with_signals(args: argparse.Namespace) -> dict[str, int]:
    loop = asyncio.get_running_loop()
    task = asyncio.current_task()
    assert task is not None
    installed: list[signal.Signals] = []
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, task.cancel)
            installed.append(signum)
        except (NotImplementedError, RuntimeError):
            pass
    try:
        return await live_sync(args)
    finally:
        for signum in installed:
            loop.remove_signal_handler(signum)


def self_test() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp); db = ArchiveDB(root / "archive.sqlite3"); run = db.start_run(); sync = Syncer(db, root, run)
        children = {"children": [{"id": "child-aaa11111", "first_name": "A/B", "last_name": "Kid"},
                                  {"id": "child-bbb22222", "first_name": "A/B", "last_name": "Kid"}]}
        sync.ingest("children", children)
        folders = [x[0] for x in db.conn.execute("SELECT folder_name FROM children ORDER BY id")]
        assert folders[0] != folders[1] and all("/" not in x for x in folders)
        sync.ingest("threads", {"threads": [{"id": "t1", "subject": "Staff", "child_ids": ["child-aaa11111"]}]})
        url1 = "https://cdn.example/a.jpg?X-Amz-Signature=old&x=1"
        message = {"messages": [{"id": "m1", "thread_id": "t1", "text": "hello", "sent_at": "2024-01-02T03:04:05Z",
                                 "attachments": [{"id": "asset1", "url": url1, "filename": "a.jpg"}]}]}
        sync.ingest("messages", message)
        sync.ingest("activities", {"activities": [{"id": "a1", "student_id": "child-aaa11111", "activity_type": "photo",
            "created_at": "2024-01-03T01:00:00Z", "occurred_at": "2023-12-01T01:00:00Z",
            "media": {"object_id": "photo-a1", "image_url": "https://cdn.example/p.png?token=x"}}]})
        counts = {t: db.conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("children", "threads", "messages", "activities", "assets")}
        sync.ingest("children", children); sync.ingest("messages", message)
        assert counts == {t: db.conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in counts}
        url2 = "https://cdn.example/a.jpg?X-Amz-Signature=new&x=1"
        rotated = json.loads(json.dumps(message)); rotated["messages"][0]["attachments"][0]["url"] = url2
        sync.ingest("messages", rotated)
        assert db.conn.execute("SELECT count(*) FROM assets WHERE id='asset1'").fetchone()[0] == 1
        assert db.conn.execute("SELECT count(*) FROM asset_urls WHERE asset_id='asset1'").fetchone()[0] == 2
        db.conn.execute("UPDATE assets SET download_status='verified' WHERE id='asset1'")
        sync.ingest("messages", rotated)
        assert db.conn.execute("SELECT download_status FROM assets WHERE id='asset1'").fetchone()[0] == "verified"
        shared = json.loads(json.dumps(message["messages"][0])); shared["id"] = "m2"
        sync.ingest("messages", {"messages": [shared]})
        assert db.conn.execute("SELECT count(*) FROM asset_owners WHERE asset_id='asset1'").fetchone()[0] == 2
        assert normalize_url(url1) == normalize_url(url2) == "https://cdn.example/a.jpg?x=1"
        assert local_date("2024-01-02T03:04:05Z") == dt.datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC).astimezone().date().isoformat()
        activity_times = db.conn.execute("SELECT created_at,occurred_at FROM activities WHERE id='a1'").fetchone()
        assert activity_times[0] == "2024-01-03T01:00:00Z" and activity_times[1] == "2023-12-01T01:00:00Z"
        assert PayloadAdapter.next_token({"meta": {"next_cursor": "x"}}) == ("next_cursor", "x")
        assert set_pagination({"variables": {"after": None}}, "nextCursor", "abc")["variables"]["after"] == "abc"
        assert graphql_is_mutation({"query": "mutation AddMessage { addMessage { id } }"})
        assert not graphql_is_mutation({"query": "query Messages { messages { id } }"})
        assert is_auth_url("https://auth.example.test/u/login")
        assert is_auth_url("https://example.test/sign-in")
        assert is_auth_url("https://auth.example.test/u/mfa-otp-challenge")
        assert not is_auth_url("https://schools.mybrightwheel.com/home")
        assert extension_from_bytes(b"\xff\xd8\xff\xe0") == ".jpg"
        assert extension_from_bytes(b"%PDF-1.7") == ".pdf"
        assert extension_from_bytes(b"RIFFxxxxWEBP") == ".webp"
        assert filename_with_extension("newsletter", ".pdf") == "newsletter.pdf"
        assert filename_with_extension("photo.JPEG", ".jpg") == "photo.JPEG"
        async def cursor_test() -> None:
            class Response:
                status_code, headers = 200, {}
                def json(self) -> Any: return {"messages": [], "next_cursor": "same"}
            class Client:
                async def request(self, *_: Any, **__: Any) -> Response: return Response()
            spec = RequestSpec("https://api.example/messages", "GET", {})
            try: await sync.paginate(Client(), spec, "messages")
            except CursorLoop: return
            raise AssertionError("cursor loop not detected")
        asyncio.run(cursor_test())
        # A verified asset is satisfied entirely locally: the HTTP client must never be touched.
        for asset_id, filename in db.conn.execute("SELECT id,filename FROM assets"):
            local = root / f"verified-{asset_id}-{filename}"; local.write_bytes(asset_id.encode())
            digest = sha256_file(local)
            db.conn.execute("INSERT INTO local_files(asset_id,sha256,byte_length,canonical_path,verified_at) VALUES (?,?,?,?,?)",
                            (asset_id, digest, local.stat().st_size, str(local), utc_now()))
        db.conn.commit()
        class NoFetchClient:
            async def get(self, *_: Any, **__: Any) -> Any: raise AssertionError("verified asset was fetched")
        asyncio.run(download_assets(sync, NoFetchClient()))
        child_folder = db.conn.execute("SELECT folder_name FROM children WHERE id='child-aaa11111'").fetchone()[0]
        assert any((root / child_folder / "attachments" / local_date("2024-01-02T03:04:05Z")).iterdir())
        assert any((root / child_folder / "photos" / local_date("2024-01-03T01:00:00Z")).iterdir())
        assert not (root / child_folder / "photos" / local_date("2023-12-01T01:00:00Z")).exists()
        # Transaction rollback must not leak a partial page.
        try:
            with db.conn:
                db.conn.execute("INSERT INTO children VALUES ('rollback',NULL,NULL,'x','x','{}',1,1)")
                raise RuntimeError("rollback")
        except RuntimeError: pass
        assert not db.conn.execute("SELECT 1 FROM children WHERE id='rollback'").fetchone()
        # Interrupted part files are ignored; corrupt registered files are not verified.
        part = root / "broken.part"; part.write_bytes(b"partial")
        db.conn.execute("INSERT INTO local_files(asset_id,sha256,byte_length,canonical_path,verified_at) VALUES (?,?,?,?,?)",
                        ("corrupt-only", "bad", 7, str(part), utc_now())); db.conn.commit()
        assert db.verified_file("corrupt-only") is None
        assert db.conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        db.finish_run(run, "complete", sync.counts); db.close()
        legacy = root / "legacy.sqlite3"
        conn = sqlite3.connect(legacy)
        conn.executescript("""
            CREATE TABLE sync_runs(id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
              status TEXT NOT NULL, summary_json TEXT NOT NULL DEFAULT '{}');
            CREATE TABLE activities(id TEXT PRIMARY KEY, occurred_at TEXT);
            CREATE TABLE assets(id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL,
              first_seen_run INTEGER NOT NULL, last_seen_run INTEGER NOT NULL);
            INSERT INTO activities VALUES ('old','2020-01-01T00:00:00Z');
            INSERT INTO assets VALUES ('asset-old','message','message-old',1,2);
            PRAGMA user_version=1;
        """); conn.close()
        migrated = ArchiveDB(legacy)
        assert migrated.conn.execute("PRAGMA user_version").fetchone()[0] == 2
        assert migrated.conn.execute("SELECT created_at FROM activities WHERE id='old'").fetchone()[0] == "2020-01-01T00:00:00Z"
        assert migrated.conn.execute("SELECT owner_id FROM asset_owners WHERE asset_id='asset-old'").fetchone()[0] == "message-old"
        migrated.close()
        recovery_db = ArchiveDB(root / "recovery.sqlite3")
        abandoned = recovery_db.start_run(); recovery_db.close()
        recovery_db = ArchiveDB(root / "recovery.sqlite3")
        assert recovery_db.conn.execute("SELECT status FROM sync_runs WHERE id=?", (abandoned,)).fetchone()[0] == "interrupted"
        recovery_db.close()
        lock_path = root / ".sync.lock"
        lock_path.write_text("0\n")
        with ProcessLock(lock_path):
            assert int(lock_path.read_text()) == os.getpid()
        lock_path.write_text(f"{os.getpid()}\n")
        try:
            with ProcessLock(lock_path):
                raise AssertionError("live lock was acquired")
        except RuntimeError as exc:
            assert "another sync is active" in str(exc)
        lock_path.unlink()
        cookie_file = root / "cookie"
        cookie_file.write_text("_brightwheel_v2=test-cookie-value\n"); cookie_file.chmod(0o600)
        assert read_auth_cookie(cookie_file) == "test-cookie-value"
        cookie_file.chmod(0o644)
        try: read_auth_cookie(cookie_file)
        except RuntimeError as exc: assert "chmod 600" in str(exc)
        else: raise AssertionError("insecure cookie file permissions were accepted")
    print("self-test: ok")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(".data"))
    parser.add_argument("--headed", action="store_true", help="show Chrome for MFA/CAPTCHA recovery")
    parser.add_argument("--manual-login", action="store_true",
                        help="never automate credentials; log in manually in headed Chrome")
    parser.add_argument("--auth-cookie-file", type=Path,
                        help="private file containing only the _brightwheel_v2 cookie value")
    parser.add_argument("--fixup-extensions", action="store_true",
                        help="repair existing archive file extensions from magic bytes and exit")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--self-test", action="store_true", help="run offline fixtures and exit")
    args = parser.parse_args()
    if args.manual_login and not args.headed:
        parser.error("--manual-login requires --headed")
    return args


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    if args.self_test: self_test(); return 0
    if args.fixup_extensions:
        try:
            fixup_extensions(args.data_dir)
        except RuntimeError as exc:
            LOG.error("%s", exc); return 1
        return 0
    try:
        counts = asyncio.run(live_sync_with_signals(args))
    except (KeyboardInterrupt, RuntimeError) as exc:
        LOG.error("%s", exc); return 1
    print(" ".join(f"{key}={value}" for key, value in counts.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
