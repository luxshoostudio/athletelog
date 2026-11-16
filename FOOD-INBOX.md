# Food inbox

Lux tells Amber what she ate. Amber appends an entry here and pushes.
The app fetches this file on launch and merges entries it has not applied
yet into the day log. Lux does nothing but open the app.

## Entry format

```json
{
  "id": "2026-11-16-0830-01",
  "date": "2026-11-16",
  "time": "08:30",
  "name": "greek yogurt",
  "qty": 1,
  "unit": "serving",
  "p": 10,
  "kcal": 59,
  "fat": 0.4,
  "carbs": 3.6,
  "fiber": 0
}
```

- `id` must be unique per entry. Format: `YYYY-MM-DD-HHMM-NN`.
  The app dedupes on it, so reusing an id means the entry never lands.
- `date` is the log day, `YYYY-MM-DD`. `time` is `HH:MM` (defaults to
  `12:00` when missing).
- Macros are numbers per entry as logged. Missing macros default to 0.
- `qty` and `unit` are optional and pass through to the day entry.

## Merge rules (see `lib/food-inbox.mjs`)

- Food only. The merge appends to `day.food` and leaves every other field
  (gym, water, period, Garmin) exactly as it was. Workout content is never
  touched.
- Entries with a bad id, date, or name are skipped, never applied.
- Applied inbox ids are kept in localStorage
  (`alog_food_inbox_applied_v1`), so an entry is never logged twice, even
  if the file is fetched again.
- Days that do not exist yet are created with an empty gym session.

## Fetching

The app tries, in order:

1. `https://luxshoostudio.github.io/athletelog/food-inbox.json`
2. `./food-inbox.json` (same-origin fallback)

Both use `cache: 'no-store'`, and `sw.js` serves this file network-first,
so an installed PWA never merges a stale copy. The native build has no
service worker and no bundled copy of this file, so it always reads the
live URL. Offline launches simply skip the merge and try again next time.

## Pruning

Keep the file to a rolling window of about 14 days. When appending, drop
entries older than 14 days whose ids are already applied (the app has them
in the day log by then). Never drop unapplied entries.

## Testing

`npm test` runs `test/food-inbox.test.mjs`, which covers the merge,
dedup, validation, and fetch fallback.
