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

test('a Livy write replaces the local plan and keeps routines v1 does not own', () => {
  const local = defaultPlan()
  const server = {
    routines: [{ id: 'push', name: 'Push', ex: [{ id: 'bench' }] }],
    week: { 1: 'push' },
    mealPlan: {
      _ts: 5000,
      updatedBy: 'livy',
      protein: 130,
      fiber: 30,
      days: { 1: { breakfast: { name: 'Eggs', protein: 24 }, snacks: [{ name: 'Shake', protein: 30 }] } },
    },
    routinesExtra: true,
  }
  server.routines.push({
    id: planRoutineId(1), name: 'Upper strength', emoji: '💪', ex: [], athleteLogPlan: true,
    planType: 'strength', planDetail: 'Upper, add a row', planMinutes: 0, planSource: 'livy', _ts: 5000,
  })
  const merged = mergePlan(server, local, 1000)
  assert.equal(merged.needsPush, false)
  assert.equal(merged.pulled, true)
  assert.equal(merged.plan.updatedBy, 'livy')
  assert.equal(merged.plan.protein, 130)
  assert.equal(merged.plan.days.mon.meals.breakfast.name, 'Eggs')
  assert.equal(merged.plan.days.mon.workout.detail, 'Upper, add a row')
  assert.equal(server.routines.some(item => item.id === 'push'), true)
  assert.equal(todayCard(merged.plan, new Date('2026-10-12T12:00:00'), [], {}).updatedByLivy, true)
})

test('a later local edit wins, and the weekday plan keeps the other routine', () => {
  const local = defaultPlan()
  local.editedAt = 8000
  local.days.mon.workout.detail = 'Upper, pause rows'
  const server = {
    routines: [{ id: 'push', name: 'Push', ex: [] }],
    week: { 1: ['push'] },
    mealPlan: { _ts: 1000, protein: 125, fiber: 25, days: {} },
  }
  const merged = mergePlan(server, local, 8000)
  assert.equal(merged.needsPush, true)
  const routine = merged.state.routines.find(item => item.id === planRoutineId(1))
  assert.equal(routine.planDetail, 'Upper, pause rows')
  assert.equal(routine.athleteLogPlan, true)
  assert.ok(merged.state.routines.some(item => item.id === 'push'))
  const monday = [].concat(merged.state.week[1])
  assert.ok(monday.includes('push'))
  assert.ok(monday.includes(planRoutineId(1)))
  assert.equal(merged.state.mealPlan.protein, 125)
  assert.equal(merged.state.mealPlan.days[1].breakfast.name.includes('Greek yogurt'), true)
  const again = mergePlan(merged.state, merged.plan, 8000)
  assert.equal(again.needsPush, false)
})

test('reconcile pushes the plan without dropping a server routine', () => {
  const result = reconcile({
    localDays: {},
    serverState: { foodEntries: [], workouts: [], routines: [{ id: 'keep', name: 'Keep', ex: [] }], week: { 2: 'keep' } },
    memory: {},
    localPlan: defaultPlan(),
    now: 50,
  })
  assert.equal(result.needsPush, true)
  assert.ok(result.state.routines.some(item => item.id === 'keep'))
  assert.ok(result.state.routines.some(item => item.id === planRoutineId(2)))
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
