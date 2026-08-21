#!/usr/bin/env python3
"""Push Lux's current eating protocol into the Gist that AthleteLog reads.

The protocol lives in the Obsidian vault as a Markdown document written for
a human. This script does not restructure it — it ships the Markdown as-is
and extracts only the one thing the app needs as data: the day-by-day
template schedule, so Today can say "today is a C day" without asking.

    athletelog-plan.json
    {
      "title": "八月末 10 天饮食方案（8/22–8/31）",
      "source": "2026-08-21 八月末 10 天饮食方案.md",
      "updated": "2026-08-21",
      "markdown": "…the whole document…",
      "schedule": {
        "2026-08-23": {"template": "C", "activity": "走路 10K", "focus": "🍊 维 C 双份"}
      }
    }

Setup
-----
    export GITHUB_TOKEN='ghp_…'          # same token as the app's Gist backup
    python3 tools/plan_sync.py --dry-run
    python3 tools/plan_sync.py

Scheduled by com.luxshoo.athletelog.plan.plist (daily, 06:00).
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

VAULT_PLANS = os.path.expanduser(
    "~/Library/Mobile Documents/iCloud~md~obsidian/Documents/"
    "Lux's Bank/2 Areas/Fitness/Plans & Analysis"
)
PLAN_GLOB = "*饮食方案*.md"
GIST_FILENAME = "athletelog-plan.json"
GIST_DESCRIPTION = "AthleteLog · eating protocol"

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
# A row of the 逐日排布 table: | **8/22** | 六 | 力量 | **A** | 🥩 铁 | 备注 |
DAY_ROW_RE = re.compile(r"^\|(.+)\|\s*$")


def newest_plan(directory: str) -> str:
    matches = glob.glob(os.path.join(directory, PLAN_GLOB))
    if not matches:
        sys.exit(f"No plan file matching {PLAN_GLOB!r} in {directory}")
    # Filenames start with an ISO date, so a plain sort is chronological;
    # fall back to mtime for anything that does not.
    return sorted(matches, key=lambda p: (os.path.basename(p)[:10], os.path.getmtime(p)))[-1]


def read_frontmatter(text: str) -> dict:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    out = {}
    for line in match.group(1).splitlines():
        if ":" not in line or line.startswith(" "):
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def clean_cell(cell: str) -> str:
    return cell.replace("**", "").replace("⭐", "").strip()


def parse_schedule(text: str, year: int) -> dict:
    """Pull `M/D → template` out of the day-by-day table.

    The table's columns are 日期 | 星期 | 预计活动 | 模板 | 营养重点 | 备注.
    Rows that do not start with a date are ignored, so the same routine is
    safe to run over a document whose other tables look similar.
    """
    schedule: dict[str, dict] = {}
    for line in text.splitlines():
        row = DAY_ROW_RE.match(line.strip())
        if not row:
            continue
        cells = [clean_cell(c) for c in row.group(1).split("|")]
        if len(cells) < 4:
            continue
        date_match = re.match(r"^(\d{1,2})\s*/\s*(\d{1,2})$", cells[0])
        if not date_match:
            continue
        template = cells[3].upper()
        if template not in {"A", "B", "C"}:
            continue
        month, day = int(date_match.group(1)), int(date_match.group(2))
        try:
            iso = dt.date(year, month, day).isoformat()
        except ValueError:
            continue
        entry = {"template": template}
        if len(cells) > 2 and cells[2] and cells[2] != "—":
            entry["activity"] = cells[2]
        if len(cells) > 4 and cells[4] and cells[4] != "—":
            entry["focus"] = cells[4]
        if len(cells) > 5 and cells[5]:
            entry["note"] = cells[5]
        schedule[iso] = entry
    return schedule


def build_payload(path: str) -> dict:
    text = open(path, encoding="utf-8").read()
    meta = read_frontmatter(text)
    body = FRONTMATTER_RE.sub("", text, count=1)

    date_str = meta.get("date") or os.path.basename(path)[:10]
    try:
        year = dt.date.fromisoformat(date_str).year
    except ValueError:
        year = dt.date.today().year

    schedule = parse_schedule(body, year)
    return {
        "title": meta.get("title") or os.path.basename(path)[:-3],
        "source": os.path.basename(path),
        "updated": date_str,
        "synced": dt.date.today().isoformat(),
        "markdown": body.strip(),
        "schedule": schedule,
    }


def push_to_gist(payload: dict) -> str:
    import requests

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("Set GITHUB_TOKEN (the same token the app uses for Gist backup)")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    listing = requests.get(
        "https://api.github.com/gists?per_page=50", headers=headers, timeout=30
    )
    listing.raise_for_status()
    existing = next(
        (g for g in listing.json() if GIST_FILENAME in (g.get("files") or {})), None
    )

    body = {
        "description": GIST_DESCRIPTION,
        "files": {GIST_FILENAME: {"content": json.dumps(payload, ensure_ascii=False, indent=2)}},
    }
    if existing:
        resp = requests.patch(
            f"https://api.github.com/gists/{existing['id']}", headers=headers, json=body, timeout=30
        )
    else:
        resp = requests.post(
            "https://api.github.com/gists",
            headers=headers,
            json={**body, "public": False},
            timeout=30,
        )
    resp.raise_for_status()
    return resp.json()["html_url"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="specific plan file (default: newest in the vault)")
    parser.add_argument("--dir", default=VAULT_PLANS, help="where to look for plan files")
    parser.add_argument("--dry-run", action="store_true", help="print, do not push")
    args = parser.parse_args()

    path = args.file or newest_plan(args.dir)
    print(f"Reading {os.path.basename(path)}")
    payload = build_payload(path)
    print(f"  title:    {payload['title']}")
    print(f"  schedule: {len(payload['schedule'])} days "
          f"({', '.join(sorted(payload['schedule'])[:2])}…)" if payload["schedule"]
          else "  schedule: none found")
    print(f"  markdown: {len(payload['markdown'])} chars")

    if args.dry_run:
        print(json.dumps({**payload, "markdown": payload["markdown"][:200] + "…"},
                         ensure_ascii=False, indent=2))
        return
    print("Pushed →", push_to_gist(payload))


if __name__ == "__main__":
    main()
