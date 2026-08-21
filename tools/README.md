# AthleteLog relays

## `garmin_sync.py` — Garmin → Gist → app

Garmin's Health API is a partner programme with server-side OAuth 1.0a and
webhooks, so a static PWA cannot call it. This script does the fetch on a
machine you control and drops the result in the Gist the app already syncs
with. AthleteLog reads it on launch and whenever the Summary tab opens.

```bash
python3 -m venv ~/.venvs/athletelog
~/.venvs/athletelog/bin/pip install garminconnect requests

export GARMIN_EMAIL='you@example.com'
export GARMIN_PASSWORD='…'
export GITHUB_TOKEN='ghp_…'          # same token as the app's Gist backup

~/.venvs/athletelog/bin/python tools/garmin_sync.py --days 7 --dry-run
~/.venvs/athletelog/bin/python tools/garmin_sync.py --days 7
```

Then schedule it (07:00 and 22:00):

```bash
cp tools/com.luxshoo.athletelog.garmin.plist ~/Library/LaunchAgents/
chmod 600 ~/Library/LaunchAgents/com.luxshoo.athletelog.garmin.plist
# fill in the three REPLACE_ME values first
launchctl load ~/Library/LaunchAgents/com.luxshoo.athletelog.garmin.plist
```

Logs land in `/tmp/athletelog-garmin.log` and `/tmp/athletelog-garmin.err`.

Garmin publishes no contract for the endpoint this uses, so it can break
without notice. When it does, the app falls back to the manual override
field in the Garmin sheet and no data is lost.

## `plan_sync.py` — eating protocol → Gist → app

The protocol lives in the vault as Markdown written for a human. This script
ships that Markdown as-is and extracts one thing as data — the day-by-day
template schedule — so Today can show which template today falls on instead
of asking. The app's **Plan** button renders it, and the AI coach reads it as
the source of truth.

```bash
export GITHUB_TOKEN='ghp_…'          # same token as the app's Gist backup

python3 tools/plan_sync.py --dry-run
python3 tools/plan_sync.py
```

It picks the newest file matching `*饮食方案*.md` under
`2 Areas/Fitness/Plans & Analysis/`. Point it elsewhere with `--file` or
`--dir`. Schedule it daily:

```bash
cp tools/com.luxshoo.athletelog.plan.plist ~/Library/LaunchAgents/
chmod 600 ~/Library/LaunchAgents/com.luxshoo.athletelog.plan.plist
# fill in GITHUB_TOKEN first
launchctl load ~/Library/LaunchAgents/com.luxshoo.athletelog.plan.plist
```

Write a new plan file in the vault and the app picks it up on the next run —
no code change. Logs: `/tmp/athletelog-plan.log`, `/tmp/athletelog-plan.err`.

### File format

```json
{
  "title": "八月末 10 天饮食方案（8/22–8/31）",
  "source": "2026-08-21 八月末 10 天饮食方案.md",
  "updated": "2026-08-21",
  "markdown": "…the whole document…",
  "schedule": { "2026-08-23": { "template": "C", "activity": "走路 10K", "focus": "🍊 维 C 双份" } }
}
```

The schedule comes from the 逐日排布 table: rows whose first cell is `M/D`
and whose fourth cell is A, B or C. Everything else in the document is
carried through untouched.

## Alternative relay: iOS Shortcuts

If the Mac is not always on, an iPhone automation can write the same file
from Apple Health (Garmin syncs into it):

1. Shortcuts → Automation → Time of Day → 22:00
2. **Find Health Samples** → Active Energy → Today → Sum
3. **Text**: `{"YYYY-MM-DD": {"activeKcal": <result>}}` (use Format Date)
4. **Get contents of URL** → `PATCH https://api.github.com/gists/<gist id>`
   with header `Authorization: Bearer <token>` and a JSON body of
   `{"files": {"athletelog-garmin.json": {"content": "<text>"}}}`

The app merges whatever days the file contains, so both relays can coexist.

## File format

```json
{
  "2026-08-20": { "activeKcal": 620, "steps": 12043, "sleepHours": 7.4 }
}
```

Only `activeKcal` is required. `steps` and `sleepHours` are stored on the day
for later use.
