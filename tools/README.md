# AthleteLog relays

## `alog-garmin` — Garmin → Gist → app

Garmin's Health API is a partner programme with server-side OAuth 1.0a and
webhooks, so a static PWA cannot call it. This does the fetch on a machine
you control and drops the result in the Gist the app already syncs with.
AthleteLog reads it on launch and whenever the Summary tab opens, and
backfills every day the file covers.

```bash
alog-garmin --dry-run     # fetch and print, publish nothing
alog-garmin               # yesterday and today
alog-garmin --days 7      # backfill a week
```

Setup, once:

```bash
~/.venvs/athletelog/bin/pip install garminconnect
ln -s "$HOME/athletelog/tools/alog-garmin" /usr/local/bin/alog-garmin
```

The first run prompts for the Garmin email, the Garmin password and the
GitHub token, and stores each in the login Keychain — never in a file, never
in shell history. To replace one:

```bash
security add-generic-password -a "$USER" -s athletelog-garmin-password -U -w
```

### Scheduling it

Unlike the eating protocol, this touches nothing inside iCloud — only the
network — so it has no TCC problem and a LaunchAgent works. Install it only
once the command works by hand:

```bash
cp tools/com.luxshoo.athletelog.garmin.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.luxshoo.athletelog.garmin.plist
```

Runs at 07:00 and 22:00. No credentials live in the plist — the wrapper reads
them from the Keychain — so the file is safe to commit and safe to read.
It only runs while the Mac is awake; the iOS Shortcuts relay below does not
have that limitation.

⚠️ `garmin_sync.py` uses the endpoint Garmin Connect's own web app uses,
which Garmin makes no stability promise about. When it breaks, the app shows
"manual entry" and the field in Summary → Garmin still works. Nothing is
lost.

### File format

```json
{ "2026-08-22": { "activeKcal": 620, "steps": 12043, "sleepHours": 7.4 } }
```

Only `activeKcal` is required. `steps` and `sleepHours` are stored on the day
for later use.

## `alog-plan` — eating protocol → Gist → app

The protocol lives in the vault as Markdown written for a human. This ships
that Markdown as-is and extracts one thing as data — the day-by-day template
schedule — so Today can show which template today falls on instead of asking.
The app's **Plan** button renders it, and the AI coach reads it as the source
of truth.

Run it after writing a new plan in Obsidian:

```bash
alog-plan              # publish the newest plan
alog-plan --dry-run    # show what would be published, no token needed
alog-plan --file "…/2026-09 plan.md"
```

The first push prompts for the GitHub token and stores it in the login
Keychain (`athletelog-github-token`) — not in a file, not in shell history.
Every run after that is silent. To replace it:

```bash
security add-generic-password -a "$USER" -s athletelog-github-token -U -w
```

Setup, once:

```bash
python3 -m venv ~/.venvs/athletelog
~/.venvs/athletelog/bin/pip install requests 'urllib3<2'
ln -s "$HOME/athletelog/tools/alog-plan" /usr/local/bin/alog-plan
```

On PATH rather than a shell alias: an alias only reaches a new *login*
shell, so it is missing in the window you already have open — which is
exactly the window you are in when you finish writing a plan. `urllib3<2`
is pinned because the system Python links LibreSSL, and urllib3 v2 prints a
warning on every run that looks like a failure but is not.

It picks the newest file matching `*饮食方案*.md` under
`2 Areas/Fitness/Plans & Analysis/`. Point it elsewhere with `--file` or
`--dir`. Writing a new plan file in the vault is the whole update path — no
code change.

### Why there is no scheduled version

There was one, and it failed silently. `~/Library/Mobile Documents` — where
the Obsidian vault lives — is TCC-protected on macOS. A terminal already
holds that access, but a LaunchAgent is **never prompted** for it, so the
directory read returns empty and the run reports "no plan file matching …"
about a file sitting right there. (`plan_sync.py` now distinguishes denied
from missing and says which it is.)

Automating it means granting Full Disk Access to the interpreter, which for
a symlinked venv resolves to the system `python3` — a broad grant for a
document that changes about once a month. Running one command when the plan
changes is the better trade.

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
and whose fourth cell is A, B or C. Everything else is carried through
untouched.

## `airtable_session_types.py` — keep Session Type in step

The app, `_Data/_parser_gym.py` and `Training.Session Type` in the Health base
must agree on the list of session types, or the health agent reads a
different history than the app shows.

```bash
python3 tools/airtable_session_types.py --dry-run
python3 tools/airtable_session_types.py
```

It reads the key from `AIRTABLE_API_KEY`, falling back to the one the
airtable MCP server already uses.

### Why it writes and deletes a record

Airtable's *update field* API accepts only a name and a description — sending
`options` comes back `422 "Changing a field's type is not supported"`, and the
MCP server does not expose select choices either. The supported way to add a
single-select option is to write a record with `typecast: true`, which makes
Airtable mint the missing choice instead of rejecting the write. So the script
creates one throwaway row per missing option and deletes it immediately. The
real rows are never touched.

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
