#!/usr/bin/env python3
"""Push Garmin daily stats into the Gist that AthleteLog reads.

Garmin's Health API is a partner programme with server-side OAuth and
webhooks, so a browser cannot talk to it. This script logs in the way
Garmin Connect's own web app does, reads the numbers AthleteLog needs,
and writes them to a single Gist file:

    athletelog-garmin.json
    { "2026-08-20": { "activeKcal": 620, "steps": 12043, "sleepHours": 7.4 } }

The app fetches that file on launch and when the Summary tab opens.

Setup
-----
    python3 -m venv ~/.venvs/athletelog
    ~/.venvs/athletelog/bin/pip install garminconnect requests

    export GARMIN_EMAIL='you@example.com'
    export GARMIN_PASSWORD='…'
    export GITHUB_TOKEN='ghp_…'        # same token as the app's Gist backup

    ~/.venvs/athletelog/bin/python tools/garmin_sync.py --days 7

Garmin has no published contract for this endpoint, so it can change
without notice. When it breaks, the app falls back to the manual override
field and nothing is lost.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

GIST_FILENAME = "athletelog-garmin.json"
GIST_DESCRIPTION = "AthleteLog · Garmin relay"
TOKEN_STORE = os.path.expanduser("~/.garminconnect")


def fetch_garmin(days: int) -> dict:
    try:
        from garminconnect import Garmin
    except ImportError:
        sys.exit("garminconnect is not installed: pip install garminconnect")

    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        sys.exit("Set GARMIN_EMAIL and GARMIN_PASSWORD")

    client = Garmin(email, password)
    # Reuse the stored session when there is one; Garmin rate-limits logins.
    try:
        client.login(TOKEN_STORE)
    except Exception:
        client.login()
        try:
            client.garth.dump(TOKEN_STORE)
        except Exception:
            pass

    out: dict[str, dict] = {}
    today = dt.date.today()
    for offset in range(days):
        day = today - dt.timedelta(days=offset)
        iso = day.isoformat()
        entry: dict[str, float] = {}

        try:
            stats = client.get_stats(iso) or {}
            active = stats.get("activeKilocalories")
            if active:
                entry["activeKcal"] = int(active)
            steps = stats.get("totalSteps")
            if steps:
                entry["steps"] = int(steps)
        except Exception as err:
            print(f"  {iso}: stats unavailable ({err})", file=sys.stderr)

        try:
            sleep = (client.get_sleep_data(iso) or {}).get("dailySleepDTO") or {}
            seconds = sleep.get("sleepTimeSeconds")
            if seconds:
                entry["sleepHours"] = round(seconds / 3600, 1)
        except Exception:
            pass

        if entry:
            out[iso] = entry
            print(f"  {iso}: {entry}")

    return out


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

    merged = dict(payload)
    if existing:
        # Keep history the relay no longer covers.
        detail = requests.get(
            f"https://api.github.com/gists/{existing['id']}", headers=headers, timeout=30
        )
        detail.raise_for_status()
        raw = (detail.json().get("files") or {}).get(GIST_FILENAME, {}).get("content")
        if raw:
            try:
                merged = {**json.loads(raw), **payload}
            except json.JSONDecodeError:
                pass

    body = {
        "description": GIST_DESCRIPTION,
        "files": {GIST_FILENAME: {"content": json.dumps(merged, indent=2, sort_keys=True)}},
    }
    if existing:
        resp = requests.patch(
            f"https://api.github.com/gists/{existing['id']}",
            headers=headers,
            json=body,
            timeout=30,
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
    parser.add_argument("--days", type=int, default=3, help="how many days back to pull")
    parser.add_argument("--dry-run", action="store_true", help="print, do not push")
    args = parser.parse_args()

    print(f"Reading {args.days} day(s) from Garmin Connect…")
    payload = fetch_garmin(args.days)
    if not payload:
        print("Nothing to push.")
        return
    if args.dry_run:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return
    print("Pushed →", push_to_gist(payload))


if __name__ == "__main__":
    main()
