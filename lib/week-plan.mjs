// Weekly plan shared by the v1 Plan tab and the athletelog-next profile.
//
// The first sync adopts routines already assigned on week (lux-upper and the
// rest of Lux's week) and does not add al-plan-* beside them. An untouched
// seed (editedAt 0) is not pushed over that week, so the default meals stay
// on the device until she edits. A later edit updates the assigned routine
// in place. An al-plan-<weekday> routine is created only for an empty day
// whose workout is not rest. Meals live on mealPlan. Last writer wins by
// stamp. A missing local plan is left alone so a sync that only knows about
// food does not invent one.

export const PLAN_STORAGE_KEY = 'alog_week_plan'
export const SYNCED_GOALS_KEY = 'alog_synced_goals'

// Header fallbacks until a sync has stored the profile. The device calorie
// goal is separate (RMR plus training) and does not read nutritionTargets.calories.
export const GOAL_PROTEIN_FALLBACK = 140
export const GOAL_FIBER_FALLBACK = 30

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
  const workout = {
    type,
    name,
    detail: text(raw?.detail ?? base.detail) || name,
    minutes: type === 'run' ? Math.max(0, num(raw?.minutes ?? base.minutes)) : 0,
  }
  const routineId = text(raw?.routineId ?? base.routineId)
  if (routineId) workout.routineId = routineId
  const named = exerciseNamesOf(raw)
  const exercises = named.length ? named : exerciseNamesOf(base)
  if (exercises.length) workout.exercises = exercises
  return workout
}

function exerciseNamesOf(raw) {
  const names = []
  for (const item of Array.isArray(raw?.exercises) ? raw.exercises : []) {
    const name = text(typeof item === 'string' ? item : (item?.name || item?.n || ''))
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

function routineExerciseNames(routine) {
  return exerciseNamesOf({ exercises: routine?.ex })
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
    // Default meals filled in for display. They are not written to a profile
    // that already has a week and does not have mealPlan yet.
    holdMeals: source.holdMeals === true,
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
  // A preloaded plan is completed:false until she checks a line. Those rows
  // are not a finished session, and the session title alone is not either.
  const logged = exercises.filter(item => item && item.completed !== false)
  const blob = [logged.length ? session : '', ...logged.map(item => item?.name)].filter(Boolean).join(' ')
  const blobWords = new Set(words(blob))
  if (plan.type === 'run') {
    const ran = logged.some(item => item?.run || words(item?.name).includes('run') || words(item?.name).includes('jog'))
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

function isPlanRoutineId(id) {
  return /^al-plan-[0-6]$/.test(String(id || ''))
}

function assignedIds(week, weekday) {
  if (!isMap(week)) return []
  return [].concat(week[weekday] ?? week[String(weekday)] ?? [])
    .filter(id => id != null && id !== '')
    .map(String)
}

function routineForWeekday(state, weekday) {
  const routines = Array.isArray(state?.routines) ? state.routines : []
  const byId = new Map(routines.filter(item => item?.id).map(item => [String(item.id), item]))
  const assigned = assignedIds(state?.week, weekday).map(id => byId.get(id)).filter(Boolean)
  const preferred = assigned.find(item => !isPlanRoutineId(item.id)) || assigned.find(item => isPlanRoutineId(item.id))
  if (preferred) return preferred
  const synthetic = byId.get(planRoutineId(weekday))
  return synthetic?.athleteLogPlan ? synthetic : null
}

function inferWorkoutType(routine) {
  if (['strength', 'run', 'rest'].includes(routine?.planType)) return routine.planType
  const blob = `${routine?.id || ''} ${routine?.name || ''} ${routine?.planDetail || ''}`.toLowerCase()
  if (/\brest\b/.test(blob)) return 'rest'
  if (/\b(run|jog|tempo)\b/.test(blob)) return 'run'
  return 'strength'
}

function workoutMinutes(routine, type) {
  const stored = num(routine?.planMinutes)
  if (stored > 0) return stored
  const described = `${routine?.name || ''} ${routine?.planDetail || ''}`
  const named = described.match(/(\d+)\s*min\b/i)
  if (named) return num(named[1])
  if (type === 'run' && Array.isArray(routine?.ex)) {
    const sum = routine.ex.reduce((total, item) => total + num(item?.min), 0)
    if (sum > 0) return sum
  }
  if (type === 'run') {
    const blob = `${routine?.id || ''} ${routine?.name || ''}`.toLowerCase()
    if (/\blong\b/.test(blob)) return 60
    if (/\b(slow|tempo)\b/.test(blob)) return 30
  }
  return 0
}

function workoutFromRoutine(routine, fallback) {
  const type = inferWorkoutType(routine)
  const exercises = routineExerciseNames(routine)
  return cleanWorkout({
    type,
    name: routine.name,
    detail: routine.planDetail || routine.name,
    minutes: type === 'run' ? workoutMinutes(routine, type) : num(routine.planMinutes),
    routineId: routine.id,
    ...(exercises.length ? { exercises } : {}),
  }, fallback)
}

function targetRoutine(state, weekday, workout) {
  const assigned = routineForWeekday(state, weekday)
  if (assigned && assignedIds(state?.week, weekday).includes(String(assigned.id))) return assigned
  if (workout?.routineId) {
    const routines = Array.isArray(state?.routines) ? state.routines : []
    const named = routines.find(item => item?.id === workout.routineId)
    if (named) return named
  }
  return assigned
}

function routineFromDay(weekday, day, stamp, updatedBy, existing) {
  const workout = day.workout
  const id = existing?.id || workout.routineId || planRoutineId(weekday)
  const emoji = workout.type === 'run' ? '🏃' : workout.type === 'rest' ? '😴' : '💪'
  const routine = {
    ...(existing || {}),
    id,
    name: workout.name,
    emoji,
    ex: Array.isArray(existing?.ex) ? existing.ex : [],
    planType: workout.type,
    planDetail: workout.detail,
    planMinutes: workout.minutes,
    _ts: stamp,
  }
  if (isPlanRoutineId(id)) routine.athleteLogPlan = true
  else delete routine.athleteLogPlan
  if (updatedBy === 'livy') routine.planSource = 'livy'
  else delete routine.planSource
  return routine
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

function storedTarget(state, key, fallback) {
  const mealPlan = isMap(state.mealPlan) ? state.mealPlan : null
  const goals = isMap(state.nutritionTargets) ? state.nutritionTargets : null
  if (mealPlan && mealPlan[key] != null && mealPlan[key] !== '') return num(mealPlan[key]) || fallback
  if (goals && goals[key] != null && goals[key] !== '') return num(goals[key]) || fallback
  return fallback
}

function positiveGoal(value, fallback) {
  const n = num(value)
  return n > 0 ? n : fallback
}

/**
 * Protein and fiber for the header. mealPlan wins, then nutritionTargets,
 * then the fallback (140 g / 30 g). Calories are not read: the server's
 * nutritionTargets.calories is not the device calorie goal.
 */
export function nutritionGoalsFromProfile(state, fallback = {}) {
  const source = isMap(state) ? state : {}
  return {
    protein: storedTarget(source, 'protein', positiveGoal(fallback.protein, GOAL_PROTEIN_FALLBACK)),
    fiber: storedTarget(source, 'fiber', positiveGoal(fallback.fiber, GOAL_FIBER_FALLBACK)),
  }
}

/** Values written after a sync. Missing or empty storage keeps the fallback. */
export function goalsFromStored(raw, fallback = {}) {
  return {
    protein: positiveGoal(raw?.protein, positiveGoal(fallback.protein, GOAL_PROTEIN_FALLBACK)),
    fiber: positiveGoal(raw?.fiber, positiveGoal(fallback.fiber, GOAL_FIBER_FALLBACK)),
  }
}

// An existing install can have the synced week (125 g / 25 g) without the
// newer alog_synced_goals key. The untouched seed uses the same numbers, so
// only a plan that actually came from the server or was edited counts.
export function planCarriesNutritionGoals(plan) {
  if (!plan || !(num(plan.protein) > 0) || !(num(plan.fiber) > 0)) return false
  if (plan.fromWeek === true || plan.holdMeals === true || plan.updatedBy) return true
  if (num(plan.editedAt) > 0) return true
  const days = isMap(plan.days) ? Object.values(plan.days) : []
  return days.some(day => day?.workout?.routineId)
}

export function headerGoals({ stored, plan } = {}) {
  if (stored && num(stored.protein) > 0 && num(stored.fiber) > 0) {
    return { protein: num(stored.protein), fiber: num(stored.fiber) }
  }
  if (planCarriesNutritionGoals(plan)) {
    return { protein: num(plan.protein), fiber: num(plan.fiber) }
  }
  return { protein: GOAL_PROTEIN_FALLBACK, fiber: GOAL_FIBER_FALLBACK }
}

/**
 * Today's gym list when nothing is logged yet. A session template wins.
 * Named exercises copied off the routine are the fallback. A run with
 * neither still contributes its workout name so the list is not blank.
 */
export function todayWorkoutPlan({ plan, date = new Date(), templates = [], canonicalName = '' } = {}) {
  const normalized = normalizePlan(plan)
  const key = dayKeyForDate(date)
  const workout = normalized.days[key].workout
  if (workout.type === 'rest') {
    return { rest: true, session: '', exerciseNames: [], routineId: workout.routineId || '', source: 'rest' }
  }
  let sessionType = text(canonicalName)
  if ((!sessionType || sessionType === 'Other') && workout.type === 'run') sessionType = 'Running'
  const list = Array.isArray(templates) ? templates : []
  const template = list.find(item => item && item.name === sessionType)
    || list.find(item => item && text(item.name).toLowerCase() === text(workout.name).toLowerCase())
  const templateNames = (template?.exercises || []).map(name => text(name)).filter(Boolean)
  const routineNames = (workout.exercises || []).map(name => text(typeof name === 'string' ? name : name?.name)).filter(Boolean)
  let exerciseNames = templateNames.length ? templateNames : routineNames
  let source = templateNames.length ? 'template' : (routineNames.length ? 'routine' : '')
  if (!exerciseNames.length && workout.type === 'run') {
    exerciseNames = [workout.name || 'Running']
    source = 'name'
  }
  // "Other" with no lines is not a plan. Keep the workout's own name and,
  // when the template is empty, the routine's exercises.
  const useTemplateSession = template && (templateNames.length > 0 || (sessionType && sessionType !== 'Other'))
  return {
    rest: false,
    session: useTemplateSession ? template.name : (workout.name || sessionType),
    exerciseNames,
    routineId: workout.routineId || '',
    source,
  }
}

/** Fills an empty, unselected gym day. Existing exercises or a chosen session stay put. */
export function applyTodayWorkout(gym, planned) {
  const exercises = Array.isArray(gym?.exercises) ? gym.exercises.slice() : []
  const session = text(gym?.session)
  if (exercises.length || session || !planned || planned.rest || !planned.session) {
    return { session, exercises, applied: false }
  }
  return {
    session: planned.session,
    exercises: (planned.exerciseNames || []).map(name => ({ name, completed: false })),
    applied: true,
  }
}

export function planFromServer(state) {
  if (!isMap(state)) return null
  const mealPlan = isMap(state.mealPlan) ? state.mealPlan : null
  const seed = defaultPlan()
  const days = {}
  let stamp = num(mealPlan?._ts)
  let fromWeek = false
  let anyRoutine = false
  const used = []
  for (const day of WEEKDAYS) {
    const routine = routineForWeekday(state, day.weekday)
    if (routine) {
      anyRoutine = true
      used.push(routine)
      if (assignedIds(state.week, day.weekday).includes(String(routine.id))) fromWeek = true
    }
    const serverDay = mealPlan?.days?.[String(day.weekday)] || mealPlan?.days?.[day.weekday]
    const snacks = Array.isArray(serverDay?.snacks) ? serverDay.snacks : []
    const fallback = seed.days[day.key]
    days[day.key] = {
      workout: routine ? workoutFromRoutine(routine, fallback.workout) : fallback.workout,
      meals: {
        breakfast: cleanMeal(serverDay?.breakfast, fallback.meals.breakfast),
        lunch: cleanMeal(serverDay?.lunch, fallback.meals.lunch),
        dinner: cleanMeal(serverDay?.dinner, fallback.meals.dinner),
        snack: cleanMeal(snacks[0] || serverDay?.snack, fallback.meals.snack),
      },
    }
    stamp = Math.max(stamp, num(routine?._ts))
  }
  if (!anyRoutine && !mealPlan) return null
  const updatedBy = mealPlan?.updatedBy === 'livy' || used.some(item => item.planSource === 'livy') ? 'livy' : null
  return {
    protein: storedTarget(state, 'protein', seed.protein),
    fiber: storedTarget(state, 'fiber', seed.fiber),
    updatedBy,
    editedAt: stamp,
    holdMeals: !mealPlan,
    fromWeek,
    days,
  }
}

function plansMatch(state, plan, stamp) {
  const normalized = normalizePlan(plan)
  if (!normalized.holdMeals) {
    const wantMeals = mealPlanFrom(normalized, stamp)
    const haveMeals = isMap(state.mealPlan) ? { ...state.mealPlan, _ts: stamp } : null
    if (contentOf(wantMeals) !== contentOf(haveMeals)) return false
  }
  if (isMap(state.nutritionTargets)) {
    if (num(state.nutritionTargets.protein) !== num(normalized.protein)) return false
    if (num(state.nutritionTargets.fiber) !== num(normalized.fiber)) return false
  }
  const routines = Array.isArray(state.routines) ? state.routines : []
  for (const day of WEEKDAYS) {
    const workout = normalized.days[day.key].workout
    const existing = targetRoutine(state, day.weekday, workout)
    if (!existing && workout.type === 'rest') continue
    const want = routineFromDay(day.weekday, normalized.days[day.key], stamp, normalized.updatedBy, existing)
    const have = routines.find(item => item?.id === want.id)
    if (contentOf(have) !== contentOf(want)) return false
    if (!assignedIds(state.week, day.weekday).includes(String(want.id))) return false
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
    const workout = normalized.days[day.key].workout
    const existing = targetRoutine(next, day.weekday, workout)
    if (!existing && workout.type === 'rest') continue
    const routine = routineFromDay(day.weekday, normalized.days[day.key], stamp, normalized.updatedBy, existing)
    const at = next.routines.findIndex(item => item?.id === routine.id)
    if (at < 0) {
      next.routines.push(routine)
      changed = true
    } else if (contentOf(next.routines[at]) !== contentOf(routine)) {
      next.routines[at] = routine
      changed = true
    }
    if (!assignedIds(next.week, day.weekday).includes(String(routine.id))) {
      const current = next.week[day.weekday] ?? next.week[String(day.weekday)]
      next.week[day.weekday] = weekWith(current, routine.id)
      changed = true
    }
  }
  if (!normalized.holdMeals) {
    const meals = mealPlanFrom(normalized, stamp)
    if (contentOf(next.mealPlan) !== contentOf(meals)) {
      next.mealPlan = meals
      changed = true
    }
  }
  if (isMap(next.nutritionTargets)) {
    const goals = { ...next.nutritionTargets }
    const before = JSON.stringify(goals)
    goals.protein = normalized.protein
    goals.fiber = normalized.fiber
    if (JSON.stringify(goals) !== before) {
      next.nutritionTargets = goals
      changed = true
    }
  }
  if (changed) next.edited = { ...(isMap(next.edited) ? next.edited : {}), mealPlan: stamp }
  return { state: next, changed, stamp }
}

/**
 * Fold a local weekly plan into a server profile.
 * No local plan: the profile is unchanged.
 * An untouched seed adopts a week the server already has and does not push.
 * A newer server stamp replaces the local plan, including a Livy write.
 * Otherwise the local plan updates the routine already on that day.
 */
export function mergePlan(serverState, localPlan, now = Date.now()) {
  if (localPlan == null) return { state: serverState, plan: null, needsPush: false, pulled: false }
  const local = normalizePlan(localPlan)
  const serverPlan = planFromServer(serverState)
  if (num(local.editedAt) === 0 && serverPlan?.fromWeek) {
    return { state: serverState, plan: { ...serverPlan, editedAt: 0 }, needsPush: false, pulled: true }
  }
  const serverStamp = num(serverPlan?.editedAt)
  if (serverPlan && serverStamp > num(local.editedAt)) {
    return { state: serverState, plan: serverPlan, needsPush: false, pulled: true }
  }
  if (plansMatch(serverState || {}, local, serverStamp || num(local.editedAt) || num(now))) {
    return { state: serverState, plan: { ...local, editedAt: serverStamp || local.editedAt }, needsPush: false, pulled: false }
  }
  const applied = applyPlanToState(serverState, local, Math.max(num(now), num(local.editedAt), serverStamp + 1))
  const heldMeals = local.holdMeals && !isMap(applied.state?.mealPlan)
  return {
    state: applied.state,
    plan: { ...local, editedAt: applied.stamp, holdMeals: heldMeals },
    needsPush: applied.changed,
    pulled: false,
  }
}
