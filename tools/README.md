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
