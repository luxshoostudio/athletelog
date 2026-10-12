import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultPlan, normalizePlan, todayCard, mergePlan, planFromServer, planRoutineId, WEEKDAYS,
} from '../lib/week-plan.mjs'
import { reconcile } from '../lib/next-sync.mjs'

test('the seeded week is Lux\'s strength days, runs, rest, and the same meals', () => {
  const plan = defaultPlan()
  assert.equal(plan.protein, 125)
  assert.equal(plan.fiber, 25)
  assert.equal(plan.days.mon.workout.name, 'Upper strength')
  assert.equal(plan.days.wed.workout.name, 'Lower Body')
  assert.equal(plan.days.fri.workout.name, 'Shoulder & Arm')
  assert.equal(plan.days.tue.workout.minutes, 30)
  assert.equal(plan.days.thu.workout.minutes, 30)
  assert.equal(plan.days.sat.workout.minutes, 60)
  assert.equal(plan.days.sun.workout.type, 'rest')
  assert.match(plan.days.mon.meals.breakfast.name, /Greek yogurt/)
  assert.match(plan.days.mon.meals.lunch.name, /tea egg/)
  assert.equal(plan.days.mon.meals.snack.name, 'Protein shake')
  assert.equal(plan.days.mon.meals.dinner.optional, true)
  assert.equal(plan.days.mon.meals.breakfast.protein + plan.days.mon.meals.lunch.protein + plan.days.mon.meals.snack.protein, 125)
})

test('today\'s card compares planned protein with what was logged and matches the workout', () => {
  const plan = defaultPlan()
  const monday = new Date('2026-10-12T12:00:00')
  assert.equal(monday.getDay(), 1)
  const card = todayCard(plan, monday, [{ p: 45 }, { p: 20 }], { session: 'Upper', exercises: [{ name: 'Bench press', completed: true }] })
  assert.equal(card.proteinLogged, 65)
  assert.equal(card.proteinPlanned, 125)
  assert.equal(card.proteinTarget, 125)
  assert.equal(card.fiberTarget, 25)
  assert.equal(card.workout.done, true)
  assert.equal(card.updatedByLivy, false)

  const tuesday = todayCard(plan, new Date('2026-10-13T12:00:00'), [], { session: 'Easy', exercises: [{ name: 'Run', run: true, runTime: 30 }] })
  assert.equal(tuesday.workout.name, 'Slow run')
  assert.equal(tuesday.workout.done, true)

  const missed = todayCard(plan, new Date('2026-10-13T12:00:00'), [], { session: 'Upper', exercises: [{ name: 'Row' }] })
  assert.equal(missed.workout.done, false)

  const sunday = todayCard(plan, new Date('2026-10-11T12:00:00'), [], { session: '', exercises: [] })
  assert.equal(sunday.workout.rest, true)
  assert.equal(sunday.workout.done, true)
})

function luxProfile() {
  return {
    foodEntries: [],
    workouts: [],
    routines: [
      { id: 'lux-upper', name: 'Upper', ex: [{ id: 'bench' }] },
      { id: 'lux-slow-run', name: 'Slow run', ex: [{ id: 'easy', min: 30, sets: 4 }] },
      { id: 'lux-lower', name: 'Lower Body', ex: [{ id: 'squat' }] },
      { id: 'lux-tempo-run', name: 'Tempo', ex: [] },
      { id: 'lux-shoulder-arm', name: 'Shoulder & Arm', ex: [{ id: 'raise' }] },
      { id: 'lux-long-run', name: 'Long run', ex: [{ id: 'long', sets: 1 }] },
      { id: planRoutineId(1), name: 'Stray', ex: [], athleteLogPlan: true, planType: 'strength', planDetail: 'Ignore me' },
    ],
    week: {
      1: ['lux-upper', planRoutineId(1)],
      2: 'lux-slow-run',
      3: 'lux-lower',
      4: 'lux-tempo-run',
      5: 'lux-shoulder-arm',
      6: 'lux-long-run',
    },
    nutritionTargets: { calories: 1300, protein: 125, fiber: 25 },
  }
}

test('the first sync adopts Lux\'s week and does not seed al-plan routines', () => {
  const server = luxProfile()
  const merged = mergePlan(server, defaultPlan(), 1000)
  assert.equal(merged.needsPush, false)
  assert.equal(merged.pulled, true)
  assert.equal(merged.plan.editedAt, 0)
  assert.equal(merged.plan.holdMeals, true)
  assert.equal(merged.plan.protein, 125)
  assert.equal(merged.plan.fiber, 25)
  assert.equal(merged.plan.days.mon.workout.routineId, 'lux-upper')
  assert.equal(merged.plan.days.mon.workout.name, 'Upper')
  assert.equal(merged.plan.days.mon.workout.type, 'strength')
  assert.equal(merged.plan.days.tue.workout.minutes, 30)
  assert.equal(merged.plan.days.thu.workout.minutes, 30)
  assert.equal(merged.plan.days.sat.workout.minutes, 60)
  assert.equal(merged.plan.days.sun.workout.type, 'rest')
  assert.equal(merged.plan.days.sun.workout.routineId, undefined)
  assert.match(merged.plan.days.mon.meals.breakfast.name, /Greek yogurt/)
  assert.equal(merged.state.mealPlan, undefined)
  assert.deepEqual(merged.state.routines.map(item => item.id), server.routines.map(item => item.id))
  assert.deepEqual(merged.state.week, server.week)
  assert.equal(merged.state.nutritionTargets.calories, 1300)
  const again = mergePlan(merged.state, merged.plan, 2000)
  assert.equal(again.needsPush, false)
  assert.equal(again.state.mealPlan, undefined)
  assert.ok(!again.state.routines.some(item => item.id === planRoutineId(2)))
})

test('a newer Livy write on the existing routine replaces the local plan', () => {
  const local = defaultPlan()
  local.editedAt = 1000
  const server = luxProfile()
  const upper = server.routines.find(item => item.id === 'lux-upper')
  upper.name = 'Upper strength'
  upper.planType = 'strength'
  upper.planDetail = 'Upper, add a row'
  upper.planSource = 'livy'
  upper._ts = 5000
  server.mealPlan = {
    _ts: 5000,
    updatedBy: 'livy',
    protein: 130,
    fiber: 30,
    days: { 1: { breakfast: { name: 'Eggs', protein: 24 }, snacks: [{ name: 'Shake', protein: 30 }] } },
  }
  const merged = mergePlan(server, local, 1000)
  assert.equal(merged.needsPush, false)
  assert.equal(merged.pulled, true)
  assert.equal(merged.plan.updatedBy, 'livy')
  assert.equal(merged.plan.protein, 130)
  assert.equal(merged.plan.days.mon.meals.breakfast.name, 'Eggs')
  assert.equal(merged.plan.days.mon.workout.detail, 'Upper, add a row')
  assert.equal(merged.plan.days.mon.workout.routineId, 'lux-upper')
  assert.equal(todayCard(merged.plan, new Date('2026-10-12T12:00:00'), [], {}).updatedByLivy, true)
  assert.deepEqual(merged.state.routines.map(item => item.id), server.routines.map(item => item.id))
})

test('a later local edit updates lux-upper and does not add a duplicate routine', () => {
  const adopted = mergePlan(luxProfile(), defaultPlan(), 1000)
  const local = normalizePlan(adopted.plan)
  local.editedAt = 8000
  local.holdMeals = false
  local.days.mon.workout.detail = 'Upper, pause rows'
  local.protein = 130
  const merged = mergePlan(adopted.state, local, 8000)
  assert.equal(merged.needsPush, true)
  const upper = merged.state.routines.find(item => item.id === 'lux-upper')
  assert.equal(upper.planDetail, 'Upper, pause rows')
  assert.equal(upper.athleteLogPlan, undefined)
  assert.deepEqual(upper.ex, [{ id: 'bench' }])
  assert.ok(!merged.state.routines.some(item => item.id === planRoutineId(2)))
  assert.ok(!merged.state.routines.some(item => item.id === planRoutineId(0)))
  const monday = [].concat(merged.state.week[1])
  assert.deepEqual(monday, ['lux-upper', planRoutineId(1)])
  assert.equal(merged.state.mealPlan.protein, 130)
  assert.equal(merged.state.mealPlan.days[1].breakfast.name.includes('Greek yogurt'), true)
  assert.equal(merged.state.nutritionTargets.protein, 130)
  assert.equal(merged.state.nutritionTargets.calories, 1300)
  const again = mergePlan(merged.state, merged.plan, 8000)
  assert.equal(again.needsPush, false)
})

test('an empty server week still gets the seeded plan, except a rest day with no routine', () => {
  const result = reconcile({
    localDays: {},
    serverState: { foodEntries: [], workouts: [], routines: [{ id: 'keep', name: 'Keep', ex: [] }], week: {} },
    memory: {},
    localPlan: defaultPlan(),
    now: 50,
  })
  assert.equal(result.needsPush, true)
  assert.ok(result.state.routines.some(item => item.id === 'keep'))
  assert.ok(result.state.routines.some(item => item.id === planRoutineId(2)))
  assert.equal(result.state.routines.some(item => item.id === planRoutineId(0)), false)
  assert.equal(result.state.mealPlan.fiber, 25)
  assert.equal(WEEKDAYS.length, 7)
  const quiet = reconcile({
    localDays: {},
    serverState: result.state,
    memory: {},
    localPlan: result.plan,
    now: 50,
  })
  assert.equal(quiet.needsPush, false)
  assert.equal(normalizePlan(planFromServer(quiet.state)).days.sat.workout.minutes, 60)
})

test('reconcile adopts a Tuesday routine instead of writing al-plan beside it', () => {
  const result = reconcile({
    localDays: {},
    serverState: {
      foodEntries: [],
      workouts: [],
      routines: [{ id: 'keep', name: 'Keep', ex: [{ id: 'row' }] }],
      week: { 2: 'keep' },
      nutritionTargets: { calories: 1300, protein: 125, fiber: 25 },
    },
    memory: {},
    localPlan: defaultPlan(),
    now: 50,
  })
  assert.equal(result.needsPush, false)
  assert.equal(result.planPulled, true)
  assert.equal(result.plan.days.tue.workout.routineId, 'keep')
  assert.equal(result.plan.days.tue.workout.name, 'Keep')
  assert.deepEqual(result.state.routines.map(item => item.id), ['keep'])
  assert.equal(result.state.mealPlan, undefined)
  assert.equal(result.state.week[2], 'keep')
})
