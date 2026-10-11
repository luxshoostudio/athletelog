// Maps AthleteLog v1 days onto an athletelog-next profile and merges them.
//
// Food and workout ids match frontend/src/lib/import-athletelog.js in that
// repo, so the month already imported (the hash of day key, index, v1 id,
// name and time) is the same row and is not inserted again. After the first
// link, the v1 id remembers that server id, so a later time edit still
// updates the same row.
//
// The merge is last-writer-wins on each entry's stamp. Rows the server has
// and this device has never linked stay put, including coach inbox copies
// and sessions logged in athletelog-next.

export const DEFAULT_SERVER_URL = 'https://livy-athletelog.tailab1d78.ts.net'
export const PUSH_DELAY_MS = 1500
export const PULL_INTERVAL_MS = 30000

const ENABLED_KEY = 'alog_next_enabled'
const URL_KEY = 'alog_next_url'
const TOKEN_KEY = 'alog_next_token'
const USER_KEY = 'alog_next_user'
const MEMORY_KEY = 'alog_next_memory'
const BASE_KEY = 'alog_next_base'
const OWED_KEY = 'alog_next_owed'

const ENTRY_META = new Set(['id', '_ts', '_f', '_u'])

const hash = text => {
  let h = 2166136261
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0
const clone = value => JSON.parse(JSON.stringify(value))
const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value)
const dateOfKey = key => /^alog_(\d{4})_(\d{2})_(\d{2})$/.exec(key)?.slice(1).join('-') || null
const keyOfDate = date => /^(\d{4})-(\d{2})-(\d{2})$/.test(date) ? 'alog_' + date.replace(/-/g, '_') : null
const startOf = (date, time = '12:00') => new Date(`${date}T${/^\d\d:\d\d$/.test(time) ? time : '12:00'}:00`).getTime()
const splitNumbers = value => String(value ?? '').split(/[,/x×\s]+/).map(num).filter(x => x > 0)
const wordsOf = name => String(name || '').toLowerCase().match(/[a-z0-9]+/g) || []
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const FILLER = new Set(['morning', 'evening', 'easy', 'long', 'outdoor', 'indoor', 'the', 'a', 'an', 'my', 'daily', 'light', 'slow', 'fast', 'steady', 'interval', 'tempo', 'session', 'workout', 'training', 'static', 'mins', 'min', 'minutes', 'mile', 'miles', 'km'])
const CARDIO = new Set(['run', 'running', 'jog', 'jogging', 'sprint', 'sprinting', 'walk', 'walking', 'hike', 'hiking', 'treadmill', 'cardio', 'cycle', 'cycling', 'bike', 'biking', 'swim', 'swimming', 'elliptical'])
const RUN = new Set(['run', 'running', 'jog', 'jogging', 'sprint', 'sprinting'])
const TIMED = new Set(['stretch', 'stretching', 'balance', 'balancing', 'hold', 'holding', 'plank', 'planks', 'warmup'])

function normalizedFood(item = {}, fallbackName = '') {
  return {
    name: String(item.name || fallbackName || '').trim(),
    protein: num(item.protein ?? item.p), calories: num(item.calories ?? item.kcal),
    fat: num(item.fat), carbs: num(item.carbs), fiber: num(item.fiber),
    unit: item.unit || 'serving', qty: num(item.qty) || 1,
    ...(item.barcode ? { barcode: String(item.barcode) } : {}),
    ...(item.source ? { source: item.source } : {}),
  }
}

function isWarmup(words) {
  if (words.includes('warmup')) return true
  const i = words.indexOf('warm')
  return i >= 0 && words[i + 1] === 'up'
}

function exerciseMode(exercise) {
  if (exercise?.run) return 'running'
  if (exercise?.hold) return 'time'
  const words = wordsOf(exercise?.name)
  const warmup = isWarmup(words)
  const meaningful = words.filter(w => !FILLER.has(w) && w !== 'warm' && w !== 'up' && !/^\d/.test(w))
  const timedWord = warmup || words.some(w => TIMED.has(w))
  const onlyKnown = meaningful.length > 0 && meaningful.every(w => CARDIO.has(w) || TIMED.has(w))
  const onlyTimed = (meaningful.length > 0 && meaningful.every(w => TIMED.has(w))) || (warmup && meaningful.every(w => TIMED.has(w)))
  if (onlyKnown && words.some(w => RUN.has(w)) && !timedWord) return 'running'
  if (onlyKnown && words.some(w => CARDIO.has(w)) && !timedWord) return 'cardio'
  if (onlyTimed && !words.some(w => CARDIO.has(w))) return 'time'
  return 'reps'
}

const logMode = mode => (mode === 'running' ? 'cardio' : mode)

function sessionMinutes(day, exercises) {
  const explicit = [day?.duration, day?.minutes, day?.gym?.duration, day?.gym?.minutes, day?.gym?.sessionMinutes].map(num).find(v => v > 0)
  if (explicit) return explicit
  let sum = 0
  for (const ex of exercises) {
    const min = num(ex?.runTime || ex?.duration || ex?.minutes)
    if (min > 0) sum += min
  }
  return sum
}

function customExercise(exercise) {
  const mode = exerciseMode(exercise)
  const logged = logMode(mode)
  return {
    id: `al-${hash(String(exercise.name).toLocaleLowerCase())}`,
    n: String(exercise.name || 'Imported exercise').toLocaleLowerCase(), custom: true,
    eq: logged === 'reps' ? 'custom' : 'body weight', bp: logged === 'cardio' ? 'cardio' : 'waist',
    tg: '', desc: 'Imported from AthleteLog', athleteLogMode: mode === 'running' ? 'running' : logged,
  }
}

function importedSets(exercise) {
  const mode = logMode(exerciseMode(exercise))
  const count = Math.max(1, num(exercise.sets) || splitNumbers(exercise.reps).length || 1)
  const rawWeight = String(exercise.weight || '').trim()
  const bodyweight = /^(?:bw|body\s*weight)$/i.test(rawWeight)
  const weights = splitNumbers(rawWeight)
  if (mode === 'cardio') {
    const min = num(exercise.runTime || exercise.duration || exercise.minutes)
    const miles = num(exercise.distance)
    const mph = min > 0 && miles > 0 ? miles / (min / 60) : 0
    return [{ min: min || 1, speed: +(mph * 1.609344).toFixed(3), distanceMi: miles || null, done: exercise.completed !== false, migrated: true }]
  }
  if (mode === 'time') {
    const text = `${exercise.runTime || ''} ${exercise.reps || ''} ${exercise.name || ''}`
    const mins = /([\d.]+)\s*min/i.exec(text)
    const secs = /([\d.]+)\s*(?:sec|s\b)/i.exec(text)
    const sec = mins ? num(mins[1]) * 60 : secs ? num(secs[1]) : num(exercise.reps) || 60
    return Array.from({ length: count }, (_, i) => ({
      sec, w: bodyweight ? 0 : (weights[i] ?? weights[0] ?? 0),
      done: exercise.completed !== false, migrated: true,
      ...(bodyweight ? { bodyweight: true } : {}),
    }))
  }
  const reps = splitNumbers(exercise.reps)
  return Array.from({ length: count }, (_, i) => ({
    w: bodyweight ? 0 : (weights[i] ?? weights[0] ?? 0), r: reps[i] ?? reps[0] ?? 0,
    done: exercise.completed !== false, migrated: true,
    ...(bodyweight ? { bodyweight: true } : {}),
    ...(exercise.feeling != null ? { rpe: num(exercise.feeling) } : {}),
    ...((String(exercise.sets || '').match(/[,a-z]/i) || String(exercise.reps || '').match(/[a-z]/i)) ? { migratedRaw: { sets: exercise.sets, reps: exercise.reps, weight: exercise.weight } } : {}),
  }))
}

export function foodServerId(dayKey, index, food) {
  return `al-food-${hash(`${dayKey}|${index}|${food?.id || ''}|${food?.name}|${food?.time || ''}`)}`
}

export function workoutServerId(dayKey) {
  return `al-workout-${hash(dayKey)}`
}

export function normalizeServerUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  let url
  try { url = new URL(raw) } catch { return '' }
  const host = url.hostname
  const local = host === 'localhost' || host === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return ''
  return url.origin
}

function emptyMemory() {
  return { foods: {}, workouts: {}, snapshot: {}, dirtyAt: 0 }
}

function readMemory(raw) {
  const memory = emptyMemory()
  if (!isMap(raw)) return memory
  if (isMap(raw.foods)) memory.foods = { ...raw.foods }
  if (isMap(raw.workouts)) memory.workouts = { ...raw.workouts }
  if (isMap(raw.snapshot)) memory.snapshot = { ...raw.snapshot }
  memory.dirtyAt = num(raw.dirtyAt)
  return memory
}

function foodCanon(entry) {
  return JSON.stringify({
    name: entry?.name || '',
    protein: num(entry?.protein), calories: num(entry?.calories),
    fat: num(entry?.fat), carbs: num(entry?.carbs), fiber: num(entry?.fiber),
    unit: entry?.unit || 'serving', qty: num(entry?.qty) || 1,
    date: entry?.date || '', time: entry?.time || '',
    source: entry?.source || '', barcode: entry?.barcode || '',
    components: entry?.components || null,
  })
}

function workoutCanon(entry) {
  const minutes = entry?.end && entry?.start ? Math.round((entry.end - entry.start) / 60000) : 0
  return JSON.stringify({
    d: entry?.d || '', name: entry?.name || '', minutes,
    entries: (entry?.entries || []).map(item => ({ id: item?.id || '', sets: item?.sets || [], target: item?.target || null })),
  })
}

function stampEntry(old, next, now) {
  next._ts = now
  if (!old || typeof old !== 'object') return next
  const stamps = isMap(old._f) ? { ...old._f } : {}
  for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
    if (ENTRY_META.has(key)) continue
    if ((key in old) !== (key in next) || !sameJSON(old[key], next[key])) stamps[key] = now
  }
  if (Object.keys(stamps).length) next._f = stamps
  else delete next._f
  return next
}

function mapLocal(localDays, memory) {
  const foods = []
  const workouts = []
  const custom = new Map()
  const links = []
  const keys = Object.keys(localDays || {}).sort()
  for (const key of keys) {
    const date = dateOfKey(key)
    const day = localDays[key]
    if (!date || !isMap(day)) continue
    const list = Array.isArray(day.food) ? day.food : []
    list.forEach((food, index) => {
      const item = normalizedFood(food)
      if (!item.name) return
      const fresh = foodServerId(key, index, food)
      const id = (food.id && memory.foods[food.id]) || fresh
      const entry = {
        ...item, id, date,
        time: /^\d\d:\d\d$/.test(food.time) ? food.time : '12:00',
        createdAt: startOf(date, food.time),
        source: food.source || 'athletelog-import',
        ...(Array.isArray(food.components) ? { components: food.components.map(normalizedFood) } : {}),
      }
      foods.push({ entry, v1Id: food.id || '', dayKey: key })
      if (food.id) links.push(['food', food.id, id])
    })
    const exercises = Array.isArray(day.gym?.exercises) ? day.gym.exercises.filter(item => item?.name) : []
    if (!exercises.length) continue
    const entries = exercises.map(exercise => {
      const customEx = customExercise(exercise)
      custom.set(customEx.id, customEx)
      const mode = logMode(exerciseMode(exercise))
      const loaded = splitNumbers(exercise.weight).length > 0 && !/^(?:bw|body\s*weight)$/i.test(String(exercise.weight || '').trim())
      return {
        id: customEx.id, sets: importedSets(exercise),
        target: mode === 'cardio' ? { id: customEx.id, mode, sets: 1, min: num(exercise.runTime) || 1, speed: 0 }
          : mode === 'time' ? { id: customEx.id, mode, sets: num(exercise.sets) || 1, sec: 60, bodyweight: !loaded, ...(loaded ? { weight: num(exercise.weight) } : {}) }
            : { id: customEx.id, mode, sets: num(exercise.sets) || 1, reps: splitNumbers(exercise.reps)[0] || 0, weight: num(exercise.weight), bodyweight: /bw/i.test(exercise.weight || '') },
      }
    })
    const start = startOf(date)
    const minutes = sessionMinutes(day, exercises)
    const id = memory.workouts[key] || workoutServerId(key)
    workouts.push({
      entry: {
        id, d: date, start, ...(minutes > 0 ? { end: start + minutes * 60000 } : {}),
        routineIds: [], routineId: null, name: day.gym.session || 'AthleteLog', entries, prs: [], migrated: true,
      },
      dayKey: key,
    })
    links.push(['workout', key, id])
  }
  return { foods, workouts, customEx: [...custom.values()], links }
}

function blankDay() {
  return { food: [], gym: { session: '', exercises: [] }, water: 0, waterMl: 0, period: false }
}

function ensureDay(days, key) {
  if (!isMap(days[key])) days[key] = blankDay()
  if (!Array.isArray(days[key].food)) days[key].food = []
  if (!isMap(days[key].gym)) days[key].gym = { session: '', exercises: [] }
  if (!Array.isArray(days[key].gym.exercises)) days[key].gym.exercises = []
  return days[key]
}

function minutesOf(time) {
  const match = /^(\d\d):(\d\d)$/.exec(time || '')
  if (!match) return 12 * 60
  return Number(match[1]) * 60 + Number(match[2])
}

function v1FoodFromServer(entry, id) {
  const time = /^\d\d:\d\d$/.test(entry.time) ? entry.time : '12:00'
  const food = {
    id, name: entry.name || '',
    p: num(entry.protein), kcal: num(entry.calories),
    fat: num(entry.fat), carbs: num(entry.carbs), fiber: num(entry.fiber),
    time, ts: minutesOf(time),
  }
  if (entry.source) food.source = entry.source
  if (entry.unit) food.unit = entry.unit
  if (entry.qty) food.qty = entry.qty
  if (Array.isArray(entry.components)) {
    food.components = entry.components.map(item => ({
      name: item.name, p: num(item.protein ?? item.p), kcal: num(item.calories ?? item.kcal),
      fat: num(item.fat), carbs: num(item.carbs), fiber: num(item.fiber),
    }))
  }
  return food
}

function describeTime(sec) {
  const whole = Math.round(num(sec) || 60)
  if (whole % 60 === 0) return `${whole / 60} min`
  return `${whole} sec`
}

function exercisesFromWorkout(workout, customEx, uid) {
  const names = new Map((customEx || []).filter(item => item?.id).map(item => [item.id, item.n || 'exercise']))
  return (workout.entries || []).map(entry => {
    const sets = Array.isArray(entry.sets) ? entry.sets : []
    const mode = entry.target?.mode || 'reps'
    const base = {
      id: uid(),
      name: names.get(entry.id) || 'exercise',
      completed: sets.length ? sets.every(set => set.done !== false) : true,
    }
    if (mode === 'cardio') {
      const set = sets[0] || {}
      return { ...base, run: true, distance: set.distanceMi || '', runTime: set.min != null ? String(set.min) : '' }
    }
    if (mode === 'time') {
      const set = sets[0] || {}
      return {
        ...base, hold: true, sets: String(sets.length || 1), reps: describeTime(set.sec),
        weight: set.bodyweight ? 'bw' : (set.w ? String(set.w) : ''),
      }
    }
    const feeling = sets.find(set => set.rpe != null)?.rpe
    const weights = sets.map(set => set.bodyweight ? 'bw' : String(set.w ?? 0))
    return {
      ...base, hold: false,
      sets: String(sets.length || 1),
      reps: sets.map(set => set.r).join(','),
      weight: weights.every(item => item === weights[0]) ? (weights[0] === '0' ? '' : weights[0]) : weights.join(','),
      ...(feeling != null ? { feeling } : {}),
    }
  })
}

function laterStamp(entry) {
  const stamped = num(entry?._ts)
  if (stamped) return stamped
  return num(entry?.createdAt)
}

/**
 * Fold v1 days into a copy of the server profile.
 * `needsPush` is false when the profile text would not change.
 * `dayPatches` is the days whose v1 records should follow the server.
 */
export function reconcile({ localDays, serverState, memory, now = Date.now(), uid = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const source = isMap(serverState) ? clone(serverState) : {}
  const remembered = readMemory(memory)
  const mapped = mapLocal(localDays, remembered)
  for (const [kind, key, id] of mapped.links) {
    if (kind === 'food') remembered.foods[key] = id
    else remembered.workouts[key] = id
  }

  const next = clone(source)
  if (!Array.isArray(next.foodEntries)) next.foodEntries = []
  if (!Array.isArray(next.workouts)) next.workouts = []
  if (!Array.isArray(next.customEx)) next.customEx = []
  if (!isMap(next.foodItems)) next.foodItems = {}
  if (!isMap(next.deleted)) next.deleted = {}
  if (!isMap(next.edited)) next.edited = {}

  const days = clone(localDays || {})
  const touched = new Set()
  let needsPush = false
  const dirtyAt = num(remembered.dirtyAt)
  const localByFood = new Map()
  for (const key of Object.keys(days)) {
    const list = Array.isArray(days[key]?.food) ? days[key].food : []
    list.forEach((food, index) => { if (food?.id) localByFood.set(food.id, { key, index }) })
  }

  const foodIndex = new Map(next.foodEntries.filter(entry => entry?.id != null).map((entry, index) => [entry.id, index]))
  const seenFood = new Set()
  let foodChanged = false

  const decide = (serverEntry, localCanon, serverCanon, localStamp) => {
    const previous = remembered.snapshot[serverEntry?.id || '']
    if (!serverEntry) return 'local'
    if (localCanon === serverCanon) return 'same'
    if (previous && previous.canon === localCanon && previous.canon !== serverCanon) return 'server'
    if (previous && previous.canon !== localCanon) {
      if (previous.canon === serverCanon) return 'local'
      return dirtyAt >= laterStamp(serverEntry) ? 'local' : 'server'
    }
    return laterStamp(serverEntry) >= localStamp ? 'server' : 'local'
  }

  for (const item of mapped.foods) {
    const localCanon = foodCanon(item.entry)
    const at = foodIndex.get(item.entry.id)
    const serverEntry = at == null ? null : next.foodEntries[at]
    const winner = decide(serverEntry, localCanon, serverEntry ? foodCanon(serverEntry) : '', item.entry.createdAt || 0)
    seenFood.add(item.entry.id)
    if (winner === 'same' || winner === 'server') {
      const kept = serverEntry || item.entry
      remembered.snapshot[item.entry.id] = { kind: 'food', canon: foodCanon(kept), dayKey: item.dayKey, v1Id: item.v1Id }
      if (winner === 'server' && item.v1Id && localByFood.has(item.v1Id)) {
        const place = localByFood.get(item.v1Id)
        const day = ensureDay(days, place.key)
        day.food[place.index] = v1FoodFromServer(kept, item.v1Id)
        touched.add(place.key)
      }
      continue
    }
    const stamped = stampEntry(serverEntry, { ...(serverEntry ? clone(serverEntry) : {}), ...item.entry, id: item.entry.id }, Math.max(now, laterStamp(serverEntry) + 1))
    if (serverEntry?.createdAt) stamped.createdAt = serverEntry.createdAt
    if (at == null) next.foodEntries.push(stamped)
    else next.foodEntries[at] = stamped
    foodIndex.set(stamped.id, at == null ? next.foodEntries.length - 1 : at)
    remembered.snapshot[stamped.id] = { kind: 'food', canon: localCanon, dayKey: item.dayKey, v1Id: item.v1Id }
    foodChanged = true
    needsPush = true
    const catalogue = stamped.name.toLocaleLowerCase()
    if (catalogue && !next.foodItems[catalogue]) {
      next.foodItems[catalogue] = normalizedFood(stamped)
      needsPush = true
    }
  }

  const deletionStamp = (kind, id) => num(next.deleted?.[kind]?.[id])
  for (const [id, previous] of Object.entries(remembered.snapshot)) {
    if (previous?.kind !== 'food' || seenFood.has(id)) continue
    if (dirtyAt <= 0) continue
    const before = next.foodEntries.length
    next.foodEntries = next.foodEntries.filter(entry => entry?.id !== id)
    if (next.foodEntries.length !== before) {
      foodChanged = true
      needsPush = true
    }
    const prior = deletionStamp('foodEntries', id)
    if (!(prior > dirtyAt)) {
      next.deleted.foodEntries = { ...(next.deleted.foodEntries || {}), [id]: Math.max(now, prior + 1, dirtyAt) }
      needsPush = true
    }
    delete remembered.snapshot[id]
    if (previous.v1Id) delete remembered.foods[previous.v1Id]
  }

  for (const entry of next.foodEntries) {
    if (!entry?.id || seenFood.has(entry.id) || remembered.snapshot[entry.id]) continue
    if (deletionStamp('foodEntries', entry.id) > 0) continue
    const dayKey = keyOfDate(entry.date)
    if (!dayKey) continue
    const v1Id = uid()
    const day = ensureDay(days, dayKey)
    day.food.push(v1FoodFromServer(entry, v1Id))
    touched.add(dayKey)
    remembered.foods[v1Id] = entry.id
    remembered.snapshot[entry.id] = { kind: 'food', canon: foodCanon(entry), dayKey, v1Id }
    seenFood.add(entry.id)
  }

  const workoutIndex = new Map(next.workouts.filter(entry => entry?.id != null).map((entry, index) => [entry.id, index]))
  const seenWork = new Set()
  for (const item of mapped.workouts) {
    const localCanon = workoutCanon(item.entry)
    const at = workoutIndex.get(item.entry.id)
    const serverEntry = at == null ? null : next.workouts[at]
    const winner = decide(serverEntry, localCanon, serverEntry ? workoutCanon(serverEntry) : '', item.entry.start || 0)
    seenWork.add(item.entry.id)
    if (winner === 'same' || winner === 'server') {
      const kept = serverEntry || item.entry
      remembered.snapshot[item.entry.id] = { kind: 'workout', canon: workoutCanon(kept), dayKey: item.dayKey }
      if (winner === 'server') {
        const day = ensureDay(days, item.dayKey)
        day.gym.session = kept.name || day.gym.session || ''
        day.gym.exercises = exercisesFromWorkout(kept, next.customEx, uid)
        touched.add(item.dayKey)
      }
      continue
    }
    const base = serverEntry ? clone(serverEntry) : {}
    const start = base.start || item.entry.start
    const minutes = item.entry.end && item.entry.start ? Math.round((item.entry.end - item.entry.start) / 60000) : 0
    const overlaid = {
      ...base, ...item.entry, id: item.entry.id, start,
      ...(minutes > 0 ? { end: start + minutes * 60000 } : {}),
    }
    if (!minutes) delete overlaid.end
    if (Array.isArray(base.prs) && base.prs.length) overlaid.prs = base.prs
    const stamped = stampEntry(serverEntry, overlaid, Math.max(now, laterStamp(serverEntry) + 1))
    if (at == null) next.workouts.push(stamped)
    else next.workouts[at] = stamped
    remembered.snapshot[stamped.id] = { kind: 'workout', canon: localCanon, dayKey: item.dayKey }
    needsPush = true
    seenWork.add(stamped.id)
  }

  for (const [id, previous] of Object.entries({ ...remembered.snapshot })) {
    if (previous?.kind !== 'workout' || seenWork.has(id)) continue
    if (dirtyAt <= 0) continue
    const before = next.workouts.length
    next.workouts = next.workouts.filter(entry => entry?.id !== id)
    if (next.workouts.length !== before) needsPush = true
    const prior = deletionStamp('workouts', id)
    if (!(prior > dirtyAt)) {
      next.deleted.workouts = { ...(next.deleted.workouts || {}), [id]: Math.max(now, prior + 1, dirtyAt) }
      needsPush = true
    }
    delete remembered.snapshot[id]
    if (previous.dayKey && remembered.workouts[previous.dayKey] === id) delete remembered.workouts[previous.dayKey]
  }

  for (const entry of next.workouts) {
    if (!entry?.id || seenWork.has(entry.id)) continue
    const dayKey = keyOfDate(entry.d)
    if (!dayKey) continue
    const day = days[dayKey]
    const hasLocal = Array.isArray(day?.gym?.exercises) && day.gym.exercises.some(item => item?.name)
    if (hasLocal) continue
    const host = ensureDay(days, dayKey)
    host.gym.session = entry.name || host.gym.session || ''
    host.gym.exercises = exercisesFromWorkout(entry, next.customEx, uid)
    touched.add(dayKey)
    remembered.workouts[dayKey] = entry.id
    remembered.snapshot[entry.id] = { kind: 'workout', canon: workoutCanon(entry), dayKey }
  }

  const haveCustom = new Set(next.customEx.filter(entry => entry?.id != null).map(entry => entry.id))
  for (const entry of mapped.customEx) {
    if (haveCustom.has(entry.id)) continue
    next.customEx.push(entry)
    haveCustom.add(entry.id)
    needsPush = true
  }

  if (foodChanged) next.edited = { ...next.edited, foodEntries: Math.max(now, num(next.edited.foodEntries)) }
  if (needsPush) next._ts = Math.max(num(next._ts), now)
  delete next.active

  const dayPatches = {}
  for (const key of touched) dayPatches[key] = days[key]
  if (!Object.keys(next.deleted).length) delete next.deleted
  return { state: next, needsPush, memory: remembered, dayPatches }
}

export class SyncError extends Error {
  constructor(message, status = 0, data = null) {
    super(message)
    this.status = status
    this.data = data
    this.network = status === 0
  }
}

function storageOf(storage) {
  return {
    get: key => storage.get(key),
    set: (key, value) => storage.set(key, value),
    remove: key => storage.remove(key),
  }
}

/**
 * Debounced push, pull on start and every 30s, and an offline retry.
 * `storage` is a string get/set/remove (localStorage). Food and workout
 * saves call `noteLocalChange`. Gist backup is not involved.
 */
export function createSyncController({
  storage,
  fetch: doFetch,
  now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = id => clearTimeout(id),
  getDays,
  setDay,
  onStatus = () => {},
  onDaysApplied = () => {},
  pushDelay = PUSH_DELAY_MS,
  pullInterval = PULL_INTERVAL_MS,
  uid,
} = {}) {
  if (!storage || !doFetch || !getDays || !setDay) throw new Error('sync controller is missing storage, fetch, or day access')
  const store = storageOf(storage)
  let pushTimer = null
  let pullTimer = null
  let running = null
  let epoch = 0
  let last = { state: 'off', detail: 'Sync is off' }

  const enabled = () => store.get(ENABLED_KEY) === '1'
  const token = () => store.get(TOKEN_KEY) || ''
  const serverUrl = () => normalizeServerUrl(store.get(URL_KEY) || '') || DEFAULT_SERVER_URL

  const emit = (state, detail) => {
    last = { state, detail }
    onStatus(last)
  }
  const syncedDetail = () => {
    const who = store.get(USER_KEY)
    return who ? `Synced · ${who}` : 'Synced'
  }

  const publish = () => {
    if (!enabled()) return emit('off', 'Sync is off')
    if (!token()) return emit('signed-out', 'Paste a pairing code from the server')
    return emit(last.state === 'off' || last.state === 'signed-out' ? 'synced' : last.state, last.detail)
  }

  function readJson(key, fallback) {
    try {
      const raw = store.get(key)
      return raw ? JSON.parse(raw) : fallback
    } catch { return fallback }
  }

  async function request(path, options = {}, { auth = true } = {}) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    if (auth && token()) headers.Authorization = 'Bearer ' + token()
    let response
    try {
      response = await doFetch(serverUrl() + path, { ...options, headers })
    } catch (error) {
      throw new SyncError(error?.message || 'offline')
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new SyncError(data.error || `HTTP ${response.status}`, response.status, data)
    return data
  }

  async function refreshSession() {
    if (!token()) return
    const me = await request('/api/me')
    if (me.token) store.set(TOKEN_KEY, me.token)
    if (me.user?.name) store.set(USER_KEY, me.user.name)
  }

  async function pushMerged(full, memory, startedEpoch) {
    let body = full
    for (let attempt = 0; attempt < 2; attempt++) {
      const serverState = body.state && typeof body.state === 'object' ? body.state : {}
      const result = reconcile({
        localDays: getDays(),
        serverState,
        memory,
        now: now(),
        ...(uid ? { uid } : {}),
      })
      if (startedEpoch === epoch) result.memory.dirtyAt = 0
      else result.memory.dirtyAt = num(readJson(MEMORY_KEY, {}).dirtyAt) || result.memory.dirtyAt
      const finish = () => {
        store.set(MEMORY_KEY, JSON.stringify(result.memory))
        if (startedEpoch === epoch) store.remove(OWED_KEY)
        applyDays(result.dayPatches)
      }
      if (!result.needsPush) {
        store.set(BASE_KEY, JSON.stringify({ rev: body.rev || 0, wid: serverState._wid || body.wid || '' }))
        finish()
        return
      }
      try {
        const saved = await request('/api/data', {
          method: 'PUT',
          body: JSON.stringify({
            state: result.state,
            stamped: true,
            baseRev: body.rev || 0,
            ...(serverState._wid ? { baseWid: serverState._wid } : {}),
          }),
        })
        store.set(BASE_KEY, JSON.stringify({ rev: saved.rev || 0, wid: saved.wid || '' }))
        finish()
        return
      } catch (error) {
        if (error.status === 409 && error.data?.state && attempt === 0) {
          body = { state: error.data.state, rev: error.data.rev || 0 }
          continue
        }
        throw error
      }
    }
  }

  function applyDays(patches) {
    const keys = Object.keys(patches || {})
    if (!keys.length) return
    for (const key of keys) setDay(key, patches[key])
    onDaysApplied(keys)
  }

  async function syncOnce() {
    if (!enabled()) { publish(); return }
    if (!token()) { publish(); return }
    if (running) return running
    const startedEpoch = epoch
    emit('syncing', 'Syncing…')
    running = (async () => {
      try {
        const base = readJson(BASE_KEY, null)
        const owed = store.get(OWED_KEY) === '1' || num(readJson(MEMORY_KEY, {}).dirtyAt) > 0
        const rev = await request('/api/data/rev')
        const moved = !base || rev.rev !== base.rev || (base.wid && rev.wid && rev.wid !== base.wid)
        if (!owed && !moved && startedEpoch === epoch) {
          emit('synced', syncedDetail())
          return
        }
        const full = await request('/api/data')
        await pushMerged(full, readJson(MEMORY_KEY, emptyMemory()), startedEpoch)
        emit('synced', syncedDetail())
        if (epoch !== startedEpoch) schedulePush()
      } catch (error) {
        if (error.status === 401) {
          store.remove(TOKEN_KEY)
          emit('signed-out', 'Sign-in expired. Pair this device again')
          return
        }
        if (num(readJson(MEMORY_KEY, {}).dirtyAt) > 0 || store.get(OWED_KEY) === '1') store.set(OWED_KEY, '1')
        emit(error.network ? 'offline' : 'error', error.network ? 'Offline. Changes will sync when the server is reachable' : error.message)
      } finally {
        running = null
      }
    })()
    return running
  }

  function schedulePush() {
    if (pushTimer) cancel(pushTimer)
    pushTimer = schedule(() => { pushTimer = null; return syncOnce() }, pushDelay)
  }

  function schedulePull() {
    if (pullTimer) cancel(pullTimer)
    pullTimer = schedule(() => { pullTimer = null; syncOnce().finally(schedulePull) }, pullInterval)
  }

  function stop() {
    if (pushTimer) cancel(pushTimer)
    if (pullTimer) cancel(pullTimer)
    pushTimer = null
    pullTimer = null
  }

  return {
    async start() {
      stop()
      if (!enabled() || !token()) { publish(); return }
      try { await refreshSession() }
      catch (error) {
        if (error.status === 401) {
          store.remove(TOKEN_KEY)
          emit('signed-out', 'Sign-in expired. Pair this device again')
          return
        }
      }
      if (!enabled() || !token()) { publish(); return }
      const pending = syncOnce()
      schedulePull()
      return pending
    },
    stop() { stop(); publish() },
    noteLocalChange() {
      if (!enabled() || !token()) return
      epoch += 1
      const memory = readJson(MEMORY_KEY, emptyMemory())
      memory.dirtyAt = now()
      store.set(MEMORY_KEY, JSON.stringify(memory))
      store.set(OWED_KEY, '1')
      schedulePush()
      emit('syncing', 'Waiting to sync…')
    },
    configure({ enabled: on, serverUrl: url }) {
      if (url != null) {
        const clean = normalizeServerUrl(url)
        if (!clean) throw new SyncError('Server URL must start with https://')
        store.set(URL_KEY, clean)
      }
      store.set(ENABLED_KEY, on ? '1' : '0')
      if (on && token()) this.start()
      else { stop(); publish() }
    },
    async signIn(code) {
      const cleaned = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (cleaned.length < 8) throw new SyncError('Enter the pairing code from the server')
      const result = await request('/api/pair/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: cleaned }),
      }, { auth: false })
      if (!result.token) throw new SyncError('The server did not return a sign-in token')
      store.set(TOKEN_KEY, result.token)
      if (result.user?.name) store.set(USER_KEY, result.user.name)
      if (enabled()) this.start()
      else emit('off', `Signed in as ${result.user?.name || 'you'}. Turn sync on to start`)
      return result.user || null
    },
    signOut() {
      store.remove(TOKEN_KEY)
      store.remove(USER_KEY)
      store.remove(OWED_KEY)
      stop()
      publish()
    },
    syncSoon() {
      if (pushTimer) return
      return syncOnce()
    },
    status() { return last },
    serverUrl,
  }
}
