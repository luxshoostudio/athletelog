// Weekly plan shared by the v1 Plan tab and the athletelog-next profile.
//
// Workouts reuse the server's weekday plan: one routine per day, id
// al-plan-<getDay()> (Sunday is 0, the same key the server uses), and that
// id is added to week[day] without removing routines already scheduled there.
// Meals live on mealPlan, which the server did not have. Last writer wins by
// stamp. A missing local plan is left alone so a sync that only knows about
// food does not invent one.

export const PLAN_STORAGE_KEY = 'alog_week_plan'

export const WEEKDAYS = [
  { key: 'mon', weekday: 1, label: 'Monday', short: 'Mon' },
  { key: 'tue', weekday: 2, label: 'Tuesday', short: 'Tue' },
  { key: 'wed', weekday: 3, label: 'Wednesday', short: 'Wed' },
  { key: 'thu', weekday: 4, label: 'Thursday', short: 'Thu' },
  { key: 'fri', weekday: 5, label: 'Friday', short: 'Fri' },
  { key: 'sat', weekday: 6, label: 'Saturday', short: 'Sat' },
  { key: 'sun', weekday: 0, label: 'Sunday', short: 'Sun' },
]

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
const FILLER = new Set(['strength', 'workout', 'training', 'session', 'min', 'mins', 'minute', 'minutes', 'the', 'and', 'body'])

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0
const clone = value => JSON.parse(JSON.stringify(value))
const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value)
const text = value => String(value ?? '').trim()
const words = value => text(value).toLowerCase().match(/[a-z0-9]+/g) || []

export function planRoutineId(weekday) {
  return `al-plan-${Number(weekday)}`
}

function meal(name, protein, extra = {}) {
  return { name, protein, ...extra }
}

const SAME_MEALS = {
  breakfast: meal('Greek yogurt (double) + blueberries + raspberries + overnight oats + chia', 45),
  lunch: meal('Chicken + rice/quinoa + peas + a tea egg', 50),
  snack: meal('Protein shake', 30),
  dinner: meal('Optional', 0, { optional: true }),
}

function dayTemplate(workout) {
  return { workout, meals: clone(SAME_MEALS) }
}

export function defaultPlan() {
  return {
    protein: 125,
    fiber: 25,
    updatedBy: null,
    editedAt: 0,
    days: {
      mon: dayTemplate({ type: 'strength', name: 'Upper strength', detail: 'Upper', minutes: 0 }),
      tue: dayTemplate({ type: 'run', name: 'Slow run', detail: 'Slow run 30 min', minutes: 30 }),
      wed: dayTemplate({ type: 'strength', name: 'Lower Body', detail: 'Lower Body', minutes: 0 }),
      thu: dayTemplate({ type: 'run', name: 'Tempo run', detail: 'Tempo run 30 min', minutes: 30 }),
      fri: dayTemplate({ type: 'strength', name: 'Shoulder & Arm', detail: 'Shoulder & Arm', minutes: 0 }),
      sat: dayTemplate({ type: 'run', name: 'Long run', detail: 'Long run 60 min', minutes: 60 }),
      sun: dayTemplate({ type: 'rest', name: 'Rest', detail: 'Rest', minutes: 0 }),
    },
  }
}

function cleanMeal(raw, fallback) {
  const base = fallback || { name: '', protein: 0 }
  const next = {
    name: text(raw?.name ?? base.name),
    protein: Math.max(0, num(raw?.protein ?? base.protein)),
  }
  if (raw?.optional || base.optional) next.optional = true
  return next
}

function cleanWorkout(raw, fallback) {
  const base = fallback || { type: 'rest', name: 'Rest', detail: 'Rest', minutes: 0 }
  const type = ['strength', 'run', 'rest'].includes(raw?.type) ? raw.type : base.type
  const name = text(raw?.name ?? base.name) || base.name
  return {
    type,
    name,
    detail: text(raw?.detail ?? base.detail) || name,
    minutes: type === 'run' ? Math.max(0, num(raw?.minutes ?? base.minutes)) : 0,
  }
}

export function normalizePlan(raw) {
  const seed = defaultPlan()
  const source = isMap(raw) ? raw : {}
  const days = {}
  for (const day of WEEKDAYS) {
    const incoming = isMap(source.days) ? source.days[day.key] : null
    const fallback = seed.days[day.key]
    const meals = {}
    for (const slot of MEALS) meals[slot] = cleanMeal(incoming?.meals?.[slot], fallback.meals[slot])
    days[day.key] = { workout: cleanWorkout(incoming?.workout, fallback.workout), meals }
  }
  return {
    protein: Math.max(0, num(source.protein ?? seed.protein)) || seed.protein,
    fiber: Math.max(0, num(source.fiber ?? seed.fiber)) || seed.fiber,
    updatedBy: source.updatedBy === 'livy' ? 'livy' : null,
    editedAt: num(source.editedAt),
    days,
  }
}

export function dayKeyForDate(date) {
  const day = date instanceof Date ? date.getDay() : new Date(`${date}T12:00:00`).getDay()
  return WEEKDAYS.find(item => item.weekday === day)?.key || 'sun'
}

function plannedProtein(day) {
  return MEALS.reduce((sum, slot) => sum + num(day?.meals?.[slot]?.protein), 0)
}

function loggedProtein(foods) {
  return (Array.isArray(foods) ? foods : []).reduce((sum, food) => sum + num(food?.p ?? food?.protein), 0)
}

function distinctive(value) {
  return words(value).filter(word => word.length > 2 && !FILLER.has(word))
}

export function workoutStatus(workout, gym) {
  const plan = cleanWorkout(workout, { type: 'rest', name: 'Rest', detail: 'Rest', minutes: 0 })
  if (plan.type === 'rest') return { name: plan.name, detail: plan.detail, done: true, rest: true, minutes: 0 }
  const session = text(gym?.session)
  const exercises = Array.isArray(gym?.exercises) ? gym.exercises : []
  const blob = [session, ...exercises.map(item => item?.name)].filter(Boolean).join(' ')
  const blobWords = new Set(words(blob))
  if (plan.type === 'run') {
    const ran = exercises.some(item => item?.run || words(item?.name).includes('run') || words(item?.name).includes('jog'))
      || blobWords.has('run') || blobWords.has('jog')
    return { name: plan.name, detail: plan.detail, done: ran, rest: false, minutes: plan.minutes }
  }
  const keys = distinctive(`${plan.name} ${plan.detail}`)
  const done = keys.some(key => blobWords.has(key) || blob.toLowerCase().includes(key))
  return { name: plan.name, detail: plan.detail, done, rest: false, minutes: 0 }
}

export function todayCard(plan, date, foods, gym) {
  const normalized = normalizePlan(plan)
  const key = dayKeyForDate(date)
  const day = normalized.days[key]
  const workout = workoutStatus(day.workout, gym)
  return {
    key,
    label: WEEKDAYS.find(item => item.key === key).label,
    proteinLogged: loggedProtein(foods),
    proteinPlanned: plannedProtein(day),
    proteinTarget: normalized.protein,
    fiberTarget: normalized.fiber,
    workout,
    meals: day.meals,
    updatedByLivy: normalized.updatedBy === 'livy',
  }
}

function routineFromDay(weekday, day, stamp, updatedBy) {
  const workout = day.workout
  const emoji = workout.type === 'run' ? '🏃' : workout.type === 'rest' ? '😴' : '💪'
  return {
    id: planRoutineId(weekday),
    name: workout.name,
    emoji,
    ex: [],
    athleteLogPlan: true,
    planType: workout.type,
    planDetail: workout.detail,
    planMinutes: workout.minutes,
    ...(updatedBy === 'livy' ? { planSource: 'livy' } : {}),
    _ts: stamp,
  }
}

function mealPlanFrom(plan, stamp) {
  const days = {}
  for (const day of WEEKDAYS) {
    const source = plan.days[day.key]
    days[String(day.weekday)] = {
      breakfast: source.meals.breakfast,
      lunch: source.meals.lunch,
      dinner: source.meals.dinner,
      snacks: [source.meals.snack],
    }
  }
  return {
    _ts: stamp,
    updatedBy: plan.updatedBy === 'livy' ? 'livy' : null,
    protein: plan.protein,
    fiber: plan.fiber,
    days,
  }
}

function contentOf(entry) {
  if (!isMap(entry)) return ''
  const { _ts, _f, _u, ...rest } = entry
  return JSON.stringify(rest)
}

function weekWith(current, id) {
  const ids = [].concat(current || []).filter(item => item != null && item !== '').map(String)
  if (ids.includes(id)) return current == null ? id : current
  ids.push(id)
  return ids.length === 1 ? id : ids
}

export function planFromServer(state) {
  if (!isMap(state)) return null
  const routines = (Array.isArray(state.routines) ? state.routines : []).filter(item => item?.athleteLogPlan && item.id)
  const mealPlan = isMap(state.mealPlan) ? state.mealPlan : null
  if (!routines.length && !mealPlan) return null
  const byId = new Map(routines.map(item => [item.id, item]))
  const seed = defaultPlan()
  const days = {}
  let stamp = num(mealPlan?._ts)
  for (const day of WEEKDAYS) {
    const routine = byId.get(planRoutineId(day.weekday))
    const serverDay = mealPlan?.days?.[String(day.weekday)] || mealPlan?.days?.[day.weekday]
    const snacks = Array.isArray(serverDay?.snacks) ? serverDay.snacks : []
    const fallback = seed.days[day.key]
    days[day.key] = {
      workout: routine ? cleanWorkout({
        type: routine.planType,
        name: routine.name,
        detail: routine.planDetail,
        minutes: routine.planMinutes,
      }, fallback.workout) : fallback.workout,
      meals: {
        breakfast: cleanMeal(serverDay?.breakfast, fallback.meals.breakfast),
        lunch: cleanMeal(serverDay?.lunch, fallback.meals.lunch),
        dinner: cleanMeal(serverDay?.dinner, fallback.meals.dinner),
        snack: cleanMeal(snacks[0] || serverDay?.snack, fallback.meals.snack),
      },
    }
    stamp = Math.max(stamp, num(routine?._ts))
  }
  const updatedBy = mealPlan?.updatedBy === 'livy' || routines.some(item => item.planSource === 'livy') ? 'livy' : null
  return {
    protein: Math.max(0, num(mealPlan?.protein ?? seed.protein)) || seed.protein,
    fiber: Math.max(0, num(mealPlan?.fiber ?? seed.fiber)) || seed.fiber,
    updatedBy,
    editedAt: stamp,
    days,
  }
}

function plansMatch(state, plan, stamp) {
  const wantMeals = mealPlanFrom(plan, stamp)
  const haveMeals = isMap(state.mealPlan) ? { ...state.mealPlan, _ts: stamp } : null
  if (contentOf(wantMeals) !== contentOf(haveMeals)) return false
  const routines = Array.isArray(state.routines) ? state.routines : []
  for (const day of WEEKDAYS) {
    const id = planRoutineId(day.weekday)
    const have = routines.find(item => item?.id === id)
    const want = routineFromDay(day.weekday, plan.days[day.key], stamp, plan.updatedBy)
    if (contentOf(have) !== contentOf(want)) return false
    const week = isMap(state.week) ? state.week : {}
    const ids = [].concat(week[day.weekday] ?? week[String(day.weekday)] ?? [])
    if (!ids.map(String).includes(id)) return false
  }
  return true
}

export function applyPlanToState(state, plan, now) {
  const next = clone(isMap(state) ? state : {})
  const normalized = normalizePlan(plan)
  const stamp = Math.max(num(now), num(normalized.editedAt), num(next.mealPlan?._ts) + 1)
  if (!Array.isArray(next.routines)) next.routines = []
  if (!isMap(next.week)) next.week = {}
  let changed = false
  for (const day of WEEKDAYS) {
    const routine = routineFromDay(day.weekday, normalized.days[day.key], stamp, normalized.updatedBy)
    const at = next.routines.findIndex(item => item?.id === routine.id)
    if (at < 0) {
      next.routines.push(routine)
      changed = true
    } else if (contentOf(next.routines[at]) !== contentOf(routine)) {
      next.routines[at] = { ...next.routines[at], ...routine }
      changed = true
    }
    const linked = weekWith(next.week[day.weekday], routine.id)
    if (JSON.stringify(linked) !== JSON.stringify(next.week[day.weekday])) {
      next.week[day.weekday] = linked
      changed = true
    }
  }
  const meals = mealPlanFrom(normalized, stamp)
  if (contentOf(next.mealPlan) !== contentOf(meals)) {
    next.mealPlan = meals
    changed = true
  }
  if (changed) next.edited = { ...(isMap(next.edited) ? next.edited : {}), mealPlan: stamp }
  return { state: next, changed, stamp }
}

/**
 * Fold a local weekly plan into a server profile.
 * No local plan: the profile is unchanged.
 * A newer server stamp replaces the local plan, including a Livy write.
 * Otherwise the local plan is written onto the routines, the weekday plan, and mealPlan.
 */
export function mergePlan(serverState, localPlan, now = Date.now()) {
  if (localPlan == null) return { state: serverState, plan: null, needsPush: false, pulled: false }
  const local = normalizePlan(localPlan)
  const serverPlan = planFromServer(serverState)
  const serverStamp = num(serverPlan?.editedAt)
  if (serverPlan && serverStamp > num(local.editedAt)) {
    return { state: serverState, plan: serverPlan, needsPush: false, pulled: true }
  }
  if (plansMatch(serverState || {}, local, serverStamp || num(local.editedAt) || num(now))) {
    return { state: serverState, plan: { ...local, editedAt: serverStamp || local.editedAt }, needsPush: false, pulled: false }
  }
  const applied = applyPlanToState(serverState, local, Math.max(num(now), num(local.editedAt), serverStamp + 1))
  return {
    state: applied.state,
    plan: { ...local, editedAt: applied.stamp },
    needsPush: applied.changed,
    pulled: false,
  }
}
