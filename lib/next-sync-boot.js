// Browser wiring for lib/next-sync.mjs. The page stays a single app; this
// file only talks to the sync server. Gist backup is untouched.
import { createSyncController, DEFAULT_SERVER_URL } from './next-sync.mjs'

const DAY = /^alog_\d{4}_\d{2}_\d{2}$/

function readDays() {
  const days = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !DAY.test(key)) continue
    try {
      const value = JSON.parse(localStorage.getItem(key))
      if (value && typeof value === 'object') days[key] = value
    } catch { /* a damaged day is skipped, not pushed */ }
  }
  return days
}

const storage = {
  get: key => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, String(value)),
  remove: key => localStorage.removeItem(key),
}

const sync = createSyncController({
  storage,
  fetch: (...args) => fetch(...args),
  getDays: readDays,
  setDay(key, day) {
    localStorage.setItem(key, JSON.stringify(day))
  },
  onStatus(info) {
    if (typeof renderNextSyncStatus === 'function') renderNextSyncStatus(info)
  },
  onDaysApplied() {
    if (typeof applyNextSyncDays === 'function') applyNextSyncDays()
  },
})

window.AthleteLogNext = sync
window.ATHLETELOG_NEXT_URL = DEFAULT_SERVER_URL

if (window.__alogNextPending) {
  window.__alogNextPending = false
  sync.noteLocalChange()
}

window.addEventListener('online', () => sync.syncSoon())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sync.syncSoon()
})

sync.start()
