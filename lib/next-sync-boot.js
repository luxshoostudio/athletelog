// Browser wiring for lib/next-sync.mjs. The page stays a single app; this
// file only talks to the sync server. Gist backup is untouched.
import { createSyncController, DEFAULT_SERVER_URL } from './next-sync.mjs'
import * as WeekPlan from './week-plan.mjs'
import * as Breakfast from './usual-breakfast.mjs'

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
  onPlanApplied() {
    if (typeof renderTodayPlan === 'function') renderTodayPlan()
    if (document.getElementById('gym-panel')?.classList.contains('active') && typeof renderExerciseList === 'function') renderExerciseList()
    if (typeof renderWeeklyPlan === 'function' && document.getElementById('plan-panel')?.classList.contains('active')) renderWeeklyPlan()
  },
  onGoalsApplied(goals) {
    if (typeof applySyncedGoals === 'function') applySyncedGoals(goals)
  },
})

window.AthleteLogNext = sync
window.AthleteLogPlan = WeekPlan
window.AthleteLogBreakfast = Breakfast
window.ATHLETELOG_NEXT_URL = DEFAULT_SERVER_URL

if (!localStorage.getItem(WeekPlan.PLAN_STORAGE_KEY)) {
  localStorage.setItem(WeekPlan.PLAN_STORAGE_KEY, JSON.stringify(WeekPlan.defaultPlan()))
}
// The page also seeds this, because an installed phone can keep serving an
// older copy of this file from the service worker cache.
const storedFavourites = (() => {
  try { return JSON.parse(localStorage.getItem(Breakfast.FAVOURITES_KEY) || 'null') }
  catch { return null }
})()
const favouriteDays = {}
for (let index = 0; index < localStorage.length; index++) {
  const key = localStorage.key(index)
  if (!/^alog_\d{4}_\d{2}_\d{2}$/.test(key || '')) continue
  try { favouriteDays[key] = JSON.parse(localStorage.getItem(key)) } catch {}
}
const installedFavourites = Breakfast.favouritesForInstall(storedFavourites, { days: favouriteDays })
if (installedFavourites.seeded) {
  localStorage.setItem(Breakfast.FAVOURITES_KEY, JSON.stringify(installedFavourites.favourites))
}
window.dispatchEvent(new Event('athletelog-libs'))
if (typeof renderTodayPlan === 'function') renderTodayPlan()

if (window.__alogNextPending) {
  window.__alogNextPending = false
  sync.noteLocalChange()
}

window.addEventListener('online', () => sync.syncSoon())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sync.syncSoon()
})

sync.start()
