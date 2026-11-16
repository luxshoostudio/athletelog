// Food inbox: entries Amber writes to food-inbox.json in the repo, merged
// into the day log when the app launches. Food only. Workout content is
// never touched: the merge only appends to day.food and leaves every other
// field of a day exactly as it was.
//
// Flow: Lux tells Amber what she ate -> Amber appends an entry (unique id)
// to food-inbox.json and pushes -> the app fetches the file on launch and
// merges entries it has not applied yet. Applied inbox ids are kept in
// localStorage, so an entry is never logged twice.

export const FOOD_INBOX_VERSION = 1
export const FOOD_INBOX_PAGE_URL = 'https://luxshoostudio.github.io/athletelog/food-inbox.json'
export const FOOD_INBOX_RELATIVE_URL = './food-inbox.json'
export const FOOD_INBOX_APPLIED_KEY = 'alog_food_inbox_applied_v1'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Absolute first: the native build has no bundled copy of the inbox, so it
// must read the live file. Relative second: same-origin fallback.
export function foodInboxUrls() {
  return [FOOD_INBOX_PAGE_URL, FOOD_INBOX_RELATIVE_URL]
}

export function dayKeyForDate(date) {
  return 'alog_' + date.replace(/-/g, '_')
}

function roundMacro(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Validate one inbox entry. Returns { inboxId, date, entry } or null when
// the entry is unusable (missing id, bad date, empty name). Macros default
// to 0; a missing or malformed time defaults to 12:00. The day entry keeps
// the app's own shape: { id, name, p, kcal, fat, carbs, fiber, time, ts }.
export function normalizeInboxEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const date = typeof raw.date === 'string' ? raw.date.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!id || !DATE_RE.test(date) || !name) return null
  const time = typeof raw.time === 'string' && TIME_RE.test(raw.time.trim()) ? raw.time.trim() : '12:00'
  const [h, m] = time.split(':').map(Number)
  const entry = {
    id: uid(),
    name,
    p: roundMacro(raw.p),
    kcal: roundMacro(raw.kcal),
    fat: roundMacro(raw.fat),
    carbs: roundMacro(raw.carbs),
    fiber: roundMacro(raw.fiber),
    time,
    ts: h * 60 + m,
  }
  if (raw.qty !== undefined) entry.qty = raw.qty
  if (raw.unit !== undefined) entry.unit = raw.unit
  return { inboxId: id, date, entry }
}

// Merge inbox entries into days ({ dayKey: day }). appliedIds holds the
// inbox ids already merged. Days with no new entries are returned by
// reference, unchanged; changed days are new objects whose only difference
// is the appended food entries. Returns
// { days, appliedIds, applied, skipped }.
export function mergeInboxEntries(days, entries, appliedIds) {
  const applied = new Set(appliedIds || [])
  const next = { ...days }
  const appliedNow = []
  const skipped = []
  for (const raw of entries || []) {
    const norm = normalizeInboxEntry(raw)
    if (!norm) {
      skipped.push(raw && typeof raw.id === 'string' ? raw.id : null)
      continue
    }
    if (applied.has(norm.inboxId)) continue
    const key = dayKeyForDate(norm.date)
    const day = next[key] || { food: [], gym: { session: '', exercises: [] }, water: 0, waterMl: 0, period: false }
    const food = Array.isArray(day.food) ? [...day.food, norm.entry] : [norm.entry]
    next[key] = { ...day, food }
    applied.add(norm.inboxId)
    appliedNow.push(norm.inboxId)
  }
  return { days: next, appliedIds: [...applied], applied: appliedNow, skipped }
}

// Fetch the first inbox that parses: tries each URL in order with
// cache:'no-store'. Returns the entries array, or [] when nothing usable
// could be fetched (offline, 404, bad JSON, wrong version). Never throws.
export async function fetchInboxEntries(fetchImpl, urls) {
  const list = urls && urls.length ? urls : foodInboxUrls()
  for (const url of list) {
    try {
      const res = await fetchImpl(url, { cache: 'no-store' })
      if (!res || !res.ok) continue
      const data = await res.json()
      if (data && data.version === FOOD_INBOX_VERSION && Array.isArray(data.entries)) return data.entries
    } catch { /* try the next URL */ }
  }
  return []
}
