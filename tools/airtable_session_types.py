#!/usr/bin/env python3
"""Keep Training.Session Type in the Health base in step with the app.

Airtable's "update field" API only accepts a name and a description — sending
`options` comes back 422 "Changing a field's type is not supported", and the
MCP server does not expose select choices either. The supported way to add a
single-select option is to write a record with `typecast: true`, which makes
Airtable mint the missing choice rather than reject the write.

So: one throwaway record per missing option, deleted immediately after. The
2,483 real rows are never touched.

    python3 tools/airtable_session_types.py --dry-run
    python3 tools/airtable_session_types.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "app4zOmpexx6EK48F"
TABLE = "tblgJgZeIIiE7ikIu"
FIELD = "Session Type"
PRIMARY = "Exercise"

# Must match SESSION_TYPES in index.html and the buckets in _parser_gym.py.
WANTED = [
    "Lower Body", "Lat & Back", "Shoulder & Arm", "Handstand Drill",
    "Core", "Running", "Walking", "Rest Day", "Other",
]


def token() -> str:
    key = os.environ.get("AIRTABLE_API_KEY")
    if key:
        return key
    # Fall back to the key the airtable MCP server already uses.
    try:
        cfg = json.load(open(os.path.expanduser("~/.claude.json")))
        return cfg["mcpServers"]["airtable"]["env"]["AIRTABLE_API_KEY"]
    except Exception:
        sys.exit("Set AIRTABLE_API_KEY, or configure the airtable MCP server.")


def api(method: str, path: str, key: str, body: dict | None = None):
    req = urllib.request.Request(
        f"https://api.airtable.com/v0/{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        sys.exit(f"{method} {path} failed {err.code}: {err.read().decode()[:300]}")


def current_choices(key: str) -> list[str]:
    tables = api("GET", f"meta/bases/{BASE}/tables", key)["tables"]
    table = next(t for t in tables if t["id"] == TABLE)
    field = next(f for f in table["fields"] if f["name"] == FIELD)
    return [c["name"] for c in field["options"]["choices"]]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    key = token()
    have = current_choices(key)
    missing = [name for name in WANTED if name not in have]

    print("current :", ", ".join(have))
    if not missing:
        print("nothing to add.")
        return
    print("missing :", ", ".join(missing))
    if args.dry_run:
        return

    for name in missing:
        created = api("POST", f"{BASE}/{TABLE}", key, {
            "records": [{"fields": {PRIMARY: f"__option_seed_{name}", FIELD: name}}],
            "typecast": True,
        })
        rid = created["records"][0]["id"]
        api("DELETE", f"{BASE}/{TABLE}/{rid}", key)
        print(f"  added {name!r} (temp record {rid} removed)")

    print("now     :", ", ".join(current_choices(key)))


if __name__ == "__main__":
    main()
