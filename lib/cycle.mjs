// Logged periods are inclusive date ranges. Predictions are computed from
// those ranges and are never stored as period days.
//
// A one-day log is kept, but it does not pull the usual length down when a
// longer period exists: those single days are the ones she forgot to finish.

export const STORAGE_KEY = 'alog_cycles'
export const MIGRATION_FLAG = 'alog_cycles_migrated_v1'
export const DEFAULT_PERIOD_LENGTH = 5
export const DEFAULT_CYCLE_LENGTH = 28

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86400000
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIso(value) {
  const match = ISO.exec(String(value || ''))
  if (!match) return false
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
  return date.getUTCFullYear() === +match[1]
    && date.getUTCMonth() === +match[2] - 1
    && date.getUTCDate() === +match[3]
}

function utc(iso) {
  const match = ISO.exec(iso)
  return Date.UTC(+match[1], +match[2] - 1, +match[3])
}

export function addDays(iso, days) {
  if (!isIso(iso)) return ''
  const date = new Date(utc(iso) + days * DAY_MS)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

export function daysBetween(start, end) {
  if (!isIso(start) || !isIso(end)) return 0
  return Math.round((utc(end) - utc(start)) / DAY_MS)
}

export function normalizeEpisodes(episodes) {
  const clean = []
  for (const raw of episodes || []) {
    let start = raw?.start
    let end = raw?.end || start
    if (!isIso(start) || !isIso(end)) continue
    if (end < start) [start, end] = [end, start]
    clean.push({ start, end })
  }
  clean.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : (a.end < b.end ? -1 : 1))
  const merged = []
  for (const episode of clean) {
    const last = merged[merged.length - 1]
    if (!last || daysBetween(last.end, episode.start) > 1) merged.push({ ...episode })
    else if (episode.end > last.end) last.end = episode.end
  }
  return merged
}

export function episodesFromPeriodDates(dates) {
  const unique = [...new Set((dates || []).filter(isIso))].sort()
  const episodes = []
  for (const iso of unique) {
    const last = episodes[episodes.length - 1]
    if (!last || daysBetween(last.end, iso) > 1) episodes.push({ start: iso, end: iso })
    else last.end = iso
  }
  return episodes
}

export function periodLengthOf(episode) {
  return daysBetween(episode.start, episode.end) + 1
}

export function averagePeriodLength(episodes) {
  const lengths = normalizeEpisodes(episodes)
    .map(periodLengthOf)
    .filter(length => length >= 2 && length <= 10)
    .slice(-6)
  if (!lengths.length) return DEFAULT_PERIOD_LENGTH
  return Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length)
}

export function averageCycleLength(episodes) {
  const list = normalizeEpisodes(episodes)
  const intervals = []
  for (let index = 1; index < list.length; index++) {
    const gap = daysBetween(list[index - 1].start, list[index].start)
    if (gap >= 21 && gap <= 45) intervals.push(gap)
  }
  const recent = intervals.slice(-6)
  if (!recent.length) return DEFAULT_CYCLE_LENGTH
  return Math.round(recent.reduce((sum, gap) => sum + gap, 0) / recent.length)
}

function overlapsLogged(episodes, start, end) {
  return episodes.some(episode => start <= episode.end && end >= episode.start)
}

export function predictPeriods(episodes, from, until) {
  const list = normalizeEpisodes(episodes)
  const periodLength = averagePeriodLength(list)
  const cycleLength = averageCycleLength(list)
  const periods = []
  const fertile = []
  const ovulation = []
  if (!list.length) return { periodLength, cycleLength, periods, fertile, ovulation }
  const last = list[list.length - 1]
  const origin = isIso(from) ? from : last.end
  const limit = isIso(until) ? until : addDays(origin, 180)
  let start = addDays(last.start, cycleLength)
  if (isIso(from) && daysBetween(start, from) > 0) {
    const steps = Math.floor(daysBetween(start, from) / cycleLength)
    if (steps > 0) start = addDays(start, steps * cycleLength)
  }
  let previousEnd = last.end
  let guard = 0
  while (start <= limit && guard < 24) {
    const end = addDays(start, periodLength - 1)
    if (daysBetween(previousEnd, start) >= 1 && !overlapsLogged(list, start, end)) {
      periods.push({ start, end })
      const ov = addDays(start, -14)
      if (daysBetween(previousEnd, ov) >= 1) {
        let windowStart = addDays(ov, -5)
        const dayAfter = addDays(previousEnd, 1)
        if (windowStart < dayAfter) windowStart = dayAfter
        if (windowStart <= ov) {
          fertile.push({ start: windowStart, end: ov })
          ovulation.push(ov)
        }
      }
      previousEnd = end
    }
    start = addDays(start, cycleLength)
    guard++
  }
  return { periodLength, cycleLength, periods, fertile, ovulation }
}

export function cycleSnapshot(episodes, from, until) {
  const list = normalizeEpisodes(episodes)
  const prediction = predictPeriods(list, from, until)
  const today = isIso(from) ? from : ''
  const next = prediction.periods.find(period => !today || period.end >= today) || null
  return { episodes: list, next, prediction, periodLength: prediction.periodLength, cycleLength: prediction.cycleLength }
}

export function markDay(iso, snap) {
  const logged = (snap?.episodes || []).some(episode => iso >= episode.start && iso <= episode.end)
  const predicted = !logged && (snap?.prediction?.periods || []).some(episode => iso >= episode.start && iso <= episode.end)
  const fertile = !logged && !predicted && (snap?.prediction?.fertile || []).some(window => iso >= window.start && iso <= window.end)
  const ovulation = !logged && (snap?.prediction?.ovulation || []).includes(iso)
  return { logged, predicted, fertile, ovulation }
}

function shortDate(iso) {
  const [, month, day] = iso.split('-')
  return `${MONTHS[+month - 1]} ${+day}`
}

export function rangeText(episode) {
  if (!episode) return ''
  const start = shortDate(episode.start)
  const end = shortDate(episode.end)
  if (start === end) return start
  if (episode.start.slice(0, 7) === episode.end.slice(0, 7)) return `${start}\u2013${Number(episode.end.slice(8))}`
  return `${start}\u2013${end}`
}

export function cycleStatus(episodes, today, until) {
  const snap = cycleSnapshot(episodes, today, until)
  const current = isIso(today) ? snap.episodes.find(episode => today >= episode.start && today <= episode.end) || null : null
  let headline = 'No period logged yet'
  let detail = 'Log a start once. The usual length fills in, including a past day you forgot.'
  let primary = 'log'
  if (!snap.episodes.length) {
    // The defaults above are the empty state.
  } else if (current) {
    const dayNum = daysBetween(current.start, today) + 1
    const length = periodLengthOf(current)
    headline = `Period · day ${dayNum} of ${length}`
    detail = `Logged ${rangeText(current)}.`
    primary = current.end > today ? 'end-today' : 'logged'
  } else if (snap.next) {
    const delta = daysBetween(today, snap.next.start)
    if (delta > 1) headline = `Next period in ${delta} days`
    else if (delta === 1) headline = 'Next period in 1 day'
    else if (delta === 0) headline = 'Period expected today'
    else if (delta === -1) headline = 'Period expected yesterday'
    else headline = `Period · ${-delta} days late`
    detail = `Predicted ${rangeText(snap.next)} · about every ${snap.cycleLength} days · usually ${snap.periodLength} days`
  } else {
    headline = `Last period · ${rangeText(snap.episodes[snap.episodes.length - 1])}`
    detail = `About every ${snap.cycleLength} days`
  }
  return { ...snap, current, headline, detail, primary, loggedToday: !!current }
}

export function logPeriodStart(episodes, start) {
  const list = normalizeEpisodes(episodes)
  if (!isIso(start)) return list
  const others = list.filter(episode => start < episode.start || start > episode.end)
  const length = averagePeriodLength(others)
  return normalizeEpisodes([...list, { start, end: addDays(start, length - 1) }])
}

export function shiftStart(episodes, delta) {
  const list = normalizeEpisodes(episodes)
  if (!list.length || !delta) return list
  const last = list[list.length - 1]
  const span = daysBetween(last.start, last.end)
  const start = addDays(last.start, delta)
  list[list.length - 1] = { start, end: addDays(start, span) }
  return normalizeEpisodes(list)
}

export function shiftEnd(episodes, delta) {
  const list = normalizeEpisodes(episodes)
  if (!list.length || !delta) return list
  const last = list[list.length - 1]
  let end = addDays(last.end, delta)
  if (end < last.start) end = last.start
  list[list.length - 1] = { start: last.start, end }
  return normalizeEpisodes(list)
}

export function endOn(episodes, iso) {
  const list = normalizeEpisodes(episodes)
  if (!isIso(iso)) return list
  const index = list.findIndex(episode => iso >= episode.start && iso <= episode.end)
  if (index < 0) return list
  list[index] = { start: list[index].start, end: iso }
  return normalizeEpisodes(list)
}

function removeDay(list, iso) {
  const parts = []
  for (const episode of list) {
    if (iso < episode.start || iso > episode.end) {
      parts.push(episode)
      continue
    }
    if (episode.start === episode.end) continue
    if (iso === episode.start) parts.push({ start: addDays(episode.start, 1), end: episode.end })
    else if (iso === episode.end) parts.push({ start: episode.start, end: addDays(episode.end, -1) })
    else {
      parts.push({ start: episode.start, end: addDays(iso, -1) })
      parts.push({ start: addDays(iso, 1), end: episode.end })
    }
  }
  return normalizeEpisodes(parts)
}

export function applyCalendarTap(episodes, iso) {
  const list = normalizeEpisodes(episodes)
  if (!isIso(iso)) return list
  if (list.some(episode => iso >= episode.start && iso <= episode.end)) return removeDay(list, iso)
  const snap = cycleSnapshot(list, iso)
  if (snap.prediction.periods.some(period => period.start === iso)) return logPeriodStart(list, iso)
  return normalizeEpisodes([...list, { start: iso, end: iso }])
}

export function migrateCycleStore({ stored, periodDates, migrated } = {}) {
  const fromDays = episodesFromPeriodDates(periodDates || [])
  const saved = normalizeEpisodes(stored?.episodes || (Array.isArray(stored) ? stored : []))
  if (migrated) return { episodes: saved, migrated: true }
  return { episodes: normalizeEpisodes([...saved, ...fromDays]), migrated: true }
}

function dayHasContent(day) {
  if (!day || typeof day !== 'object') return false
  if (Array.isArray(day.food) && day.food.length) return true
  if (day.gym?.session) return true
  if (Array.isArray(day.gym?.exercises) && day.gym.exercises.length) return true
  if (Number(day.waterMl) || Number(day.water)) return true
  if (Number(day.garminKcal) || Number(day.garminAutoKcal)) return true
  const checkin = day.checkin
  if (!checkin || typeof checkin !== 'object') return false
  if (checkin.firework || checkin.tomorrow || checkin.thoughts || checkin.lifeCoachSummary) return true
  if (checkin.scores && Object.values(checkin.scores).some(value => value != null && value !== '')) return true
  if (checkin.tasks && Object.values(checkin.tasks).some(Boolean)) return true
  return Array.isArray(checkin.customItems) && checkin.customItems.some(item => item?.label?.trim() || item?.done)
}

export function periodFlagPatches(episodes, dayMap) {
  const wanted = new Set()
  for (const episode of normalizeEpisodes(episodes)) {
    for (let iso = episode.start; iso <= episode.end; iso = addDays(iso, 1)) wanted.add(iso)
  }
  const patches = []
  const seen = new Set(Object.keys(dayMap || {}))
  for (const iso of [...seen].filter(isIso).sort()) {
    const day = dayMap[iso]
    const has = !!day?.period
    if (wanted.has(iso) && !has) patches.push({ iso, op: 'set' })
    else if (!wanted.has(iso) && has) patches.push({ iso, op: dayHasContent(day) ? 'clear' : 'delete' })
  }
  for (const iso of [...wanted].sort()) {
    if (seen.has(iso)) continue
    patches.push({ iso, op: 'set' })
  }
  return patches
}
