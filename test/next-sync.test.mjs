import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_SERVER_URL, PUSH_DELAY_MS, PULL_INTERVAL_MS,
  createSyncController, foodServerId, normalizeServerUrl, reconcile, workoutServerId,
} from '../lib/next-sync.mjs'

const day = {
  alog_2026_09_11: {
    food: [
      { id: 'f1', name: 'greek yogurt', p: 10, kcal: 59, fiber: 0, time: '09:15' },
      { id: 'f2', name: 'oats', time: '08:00', p: 5, kcal: 100 },
    ],
    gym: {
      session: 'Upper',
      exercises: [
        { id: 'e1', name: 'Bent over row', completed: true, sets: '3', reps: '10,9,8', weight: '95' },
        { name: 'Morning stretching', completed: true, sets: '1', reps: '10 min', weight: '' },
        { name: 'Running', completed: true, run: true, distance: '3.1', runTime: '30' },
      ],
    },
  },
}

const profileOf = result => result.state

describe('AthleteLog import ids', () => {
  it('uses the same food and workout ids as athletelog-next import', () => {
    assert.equal(foodServerId('alog_2026_09_11', 0, day.alog_2026_09_11.food[0]), 'al-food-1bd5jng')
    assert.equal(foodServerId('alog_2026_09_11', 1, day.alog_2026_09_11.food[1]), 'al-food-1vhd1ak')
    assert.equal(workoutServerId('alog_2026_09_11'), 'al-workout-1dzsgtk')
    const result = reconcile({ localDays: day, serverState: {}, now: 1_000 })
    const state = profileOf(result)
    assert.deepEqual(state.foodEntries.map(entry => entry.id), ['al-food-1bd5jng', 'al-food-1vhd1ak'])
    assert.equal(state.foodEntries[0].protein, 10)
    assert.equal(state.foodEntries[0].calories, 59)
    assert.equal(state.foodEntries[0].date, '2026-09-11')
    assert.equal(state.foodEntries[0].time, '09:15')
    assert.equal(state.foodEntries[0].source, 'athletelog-import')
    assert.equal(state.workouts[0].id, 'al-workout-1dzsgtk')
    assert.equal(state.workouts[0].d, '2026-09-11')
    assert.deepEqual(state.workouts[0].entries.map(entry => entry.target.mode), ['reps', 'time', 'cardio'])
    assert.deepEqual(state.workouts[0].entries[0].sets.map(set => set.r), [10, 9, 8])
    assert.equal(state.workouts[0].entries[2].sets[0].distanceMi, 3.1)
    assert.equal(state.workouts[0].end - state.workouts[0].start, 30 * 60000)
    assert.ok(state.customEx.some(entry => entry.n === 'running' && entry.athleteLogMode === 'running'))
  })

  it('keeps a v1 id pointed at the imported row after the time changes', () => {
    const first = reconcile({ localDays: day, serverState: {}, now: 1_000 })
    const edited = structuredClone(day)
    edited.alog_2026_09_11.food[0].time = '10:40'
    edited.alog_2026_09_11.food[0].p = 12
    const second = reconcile({
      localDays: edited,
      serverState: first.state,
      memory: { ...first.memory, dirtyAt: 5_000 },
      now: 5_000,
    })
    assert.equal(second.state.foodEntries.find(entry => entry.id === 'al-food-1bd5jng').time, '10:40')
    assert.equal(second.state.foodEntries.find(entry => entry.id === 'al-food-1bd5jng').protein, 12)
    assert.equal(second.state.foodEntries.filter(entry => entry.name === 'greek yogurt').length, 1)
    assert.ok(second.needsPush)
    assert.ok(second.state.foodEntries.find(entry => entry.id === 'al-food-1bd5jng')._ts >= 5_000)
  })
})

describe('merge', () => {
  it('does not duplicate a profile that already has the imported month', () => {
    const imported = reconcile({ localDays: day, serverState: {}, now: 1_000 })
    const again = reconcile({
      localDays: day,
      serverState: imported.state,
      memory: imported.memory,
      now: 2_000,
    })
    assert.equal(again.needsPush, false)
    assert.equal(again.state.foodEntries.length, imported.state.foodEntries.length)
    assert.equal(again.state.workouts.length, 1)
  })

  it('keeps server rows v1 has never linked, including routines', () => {
    const server = {
      routines: [{ id: 'push', name: 'Push' }],
      bodyweight: [{ d: '2026-10-01', w: 60 }],
      foodEntries: [{ id: 'livy-eggs', name: 'eggs', protein: 12, calories: 140, fat: 0, carbs: 0, fiber: 0, unit: 'egg', qty: 2, amount: 2, date: '2026-10-11', time: '08:10', source: 'livy', _ts: 50 }],
      workouts: [{ id: 'next-session', d: '2026-10-11', name: 'Push', start: 50, entries: [{ id: 'bench', sets: [{ w: 40, r: 8, done: true }], target: { id: 'bench', mode: 'reps', sets: 1, reps: 8, weight: 40 } }], _ts: 50 }],
      customEx: [{ id: 'bench', n: 'bench press' }],
    }
    const result = reconcile({ localDays: day, serverState: server, now: 100 })
    assert.deepEqual(result.state.routines, server.routines)
    assert.deepEqual(result.state.bodyweight, server.bodyweight)
    assert.ok(result.state.foodEntries.some(entry => entry.id === 'livy-eggs'))
    assert.ok(result.state.workouts.some(entry => entry.id === 'next-session'))
    assert.equal(result.dayPatches.alog_2026_10_11.food.some(entry => entry.name === 'eggs'), true)
    assert.equal(result.dayPatches.alog_2026_10_11.gym.exercises[0].name, 'bench press')
    assert.equal(result.dayPatches.alog_2026_09_11, undefined)
  })

  it('lets a newer server stamp win until v1 saves again', () => {
    const imported = reconcile({ localDays: day, serverState: {}, now: 1_000 })
    const server = structuredClone(imported.state)
    const food = server.foodEntries[0]
    food.protein = 99
    food._ts = 9_000
    const pulled = reconcile({ localDays: day, serverState: server, memory: imported.memory, now: 9_500 })
    assert.equal(pulled.needsPush, false)
    assert.equal(pulled.dayPatches.alog_2026_09_11.food[0].p, 99)
    const saved = structuredClone(day)
    saved.alog_2026_09_11.food[0].p = 11
    const pushed = reconcile({
      localDays: saved,
      serverState: server,
      memory: { ...imported.memory, dirtyAt: 10_000 },
      now: 10_000,
    })
    assert.equal(pushed.state.foodEntries[0].protein, 11)
    assert.ok(pushed.state.foodEntries[0]._ts >= 10_000)
  })

  it('removes a linked food v1 deleted and leaves an unknown one', () => {
    const imported = reconcile({ localDays: day, serverState: { foodEntries: [{ id: 'keep-me', name: 'tea', protein: 0, calories: 0, fat: 0, carbs: 0, fiber: 0, date: '2026-10-01', time: '15:00', source: 'livy' }] }, now: 1_000 })
    const edited = structuredClone(day)
    for (const [key, patch] of Object.entries(imported.dayPatches)) edited[key] = patch
    edited.alog_2026_09_11.food = edited.alog_2026_09_11.food.filter(entry => entry.id !== 'f1')
    const result = reconcile({
      localDays: edited,
      serverState: imported.state,
      memory: { ...imported.memory, dirtyAt: 4_000 },
      now: 4_000,
    })
    assert.equal(result.state.foodEntries.some(entry => entry.id === 'al-food-1bd5jng'), false)
    assert.ok(result.state.deleted.foodEntries['al-food-1bd5jng'] >= 4_000)
    assert.ok(result.state.foodEntries.some(entry => entry.id === 'keep-me'))
    assert.ok(result.state.foodEntries.some(entry => entry.id === 'al-food-1vhd1ak'))
  })

  it('pulls a server workout into an empty day without rewriting it next time', () => {
    const seeded = reconcile({ localDays: day, serverState: {}, now: 5_000 })
    let n = 0
    const pulled = reconcile({
      localDays: {}, serverState: seeded.state, memory: {}, now: 6_000,
      uid: () => `p${++n}`,
    })
    const again = reconcile({
      localDays: pulled.dayPatches, serverState: seeded.state, memory: pulled.memory, now: 7_000,
    })
    assert.equal(again.needsPush, false)
    assert.equal(pulled.dayPatches.alog_2026_09_11.gym.session, 'Upper')
    assert.equal(pulled.dayPatches.alog_2026_09_11.food[0].name, 'greek yogurt')
  })

  it('does not delete on the first link, before this device has a snapshot', () => {
    const server = {
      foodEntries: [{ id: 'al-food-1bd5jng', name: 'greek yogurt', protein: 10, calories: 59, fat: 0, carbs: 0, fiber: 0, unit: 'serving', qty: 1, date: '2026-09-11', time: '09:15', source: 'athletelog-import', _ts: 10 }],
      workouts: [], customEx: [],
    }
    const local = { alog_2026_09_12: { food: [{ id: 'new', name: 'apple', p: 0, kcal: 80, time: '12:00' }], gym: { exercises: [] } } }
    const result = reconcile({ localDays: local, serverState: server, now: 20 })
    assert.ok(result.state.foodEntries.some(entry => entry.id === 'al-food-1bd5jng'))
  })
})

describe('server url', () => {
  it('accepts https and local http only', () => {
    assert.equal(normalizeServerUrl(DEFAULT_SERVER_URL), DEFAULT_SERVER_URL)
    assert.equal(normalizeServerUrl('https://livy-athletelog.tailab1d78.ts.net/extra'), DEFAULT_SERVER_URL)
    assert.equal(normalizeServerUrl('http://localhost:3000'), 'http://localhost:3000')
    assert.equal(normalizeServerUrl('http://example.com'), '')
  })
})

describe('sync controller', () => {
  function harness(fetchImpl, onGoalsApplied = () => {}) {
    const saved = new Map()
    const days = structuredClone(day)
    const calls = []
    const timers = []
    let applied = 0
    const storage = {
      get: key => saved.has(key) ? saved.get(key) : null,
      set: (key, value) => saved.set(key, String(value)),
      remove: key => saved.delete(key),
    }
    const ctl = createSyncController({
      storage,
      fetch: async (url, options) => {
        calls.push({ url, options })
        return fetchImpl(url, options, calls)
      },
      now: () => 10_000,
      schedule: (fn, ms) => {
        const id = timers.push({ fn, ms }) - 1
        return id
      },
      cancel: id => { if (timers[id]) timers[id].cancelled = true },
      getDays: () => days,
      setDay: (key, value) => { days[key] = value },
      onDaysApplied: () => { applied += 1 },
      onGoalsApplied,
      uid: (() => { let n = 0; return () => `id${++n}` })(),
    })
    return { ctl, saved, days, calls, timers, applied: () => applied }
  }

  function json(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }

  it('signs in with a pairing code and waits 1.5s after a save before pushing', async () => {
    let server = { state: { foodEntries: [], workouts: [], routines: [{ id: 'keep' }] }, rev: 3, wid: 'w1' }
    const { ctl, saved, calls, timers } = harness(async (url, options) => {
      if (url.endsWith('/api/pair/redeem')) {
        assert.equal(JSON.parse(options.body).code, 'ABCD2345')
        return json({ token: 'paired-token', user: { name: 'Lux' } })
      }
      if (url.endsWith('/api/me')) return json({ user: { name: 'Lux' } })
      if (url.endsWith('/api/data/rev')) return json({ rev: server.rev, wid: server.wid })
      if (url.endsWith('/api/data') && (!options || !options.method || options.method === 'GET')) return json(server)
      const body = JSON.parse(options.body)
      assert.equal(body.stamped, true)
      assert.equal(body.baseRev, server.rev)
      assert.ok(body.state.routines.some(entry => entry.id === 'keep'))
      assert.ok(body.state.foodEntries.some(entry => entry.id === 'al-food-1bd5jng'))
      server = { state: body.state, rev: server.rev + 1, wid: 'w2' }
      return json({ rev: server.rev, wid: 'w2' })
    })
    const user = await ctl.signIn('ab cd-23 45')
    assert.equal(user.name, 'Lux')
    assert.equal(saved.get('alog_next_token'), 'paired-token')
    assert.equal(calls.some(call => call.url.includes('/api/data')), false)
    saved.set('alog_next_enabled', '1')
    saved.set('alog_next_url', 'http://127.0.0.1:9')
    ctl.noteLocalChange()
    const push = timers.find(timer => timer && timer.ms === PUSH_DELAY_MS && !timer.cancelled)
    assert.ok(push)
    assert.equal(calls.filter(call => call.options?.method === 'PUT').length, 0)
    await push.fn()
    assert.equal(calls.filter(call => call.options?.method === 'PUT').length, 1)
    await ctl.start()
    assert.ok(timers.some(timer => timer && timer.ms === PULL_INTERVAL_MS))
  })

  it('queues a failed push and retries when the network returns', async () => {
    let online = false
    const { ctl, saved, calls, timers } = harness(async (url, options) => {
      if (url.endsWith('/api/me')) return json({ user: { name: 'Lux' } })
      if (!online) throw new Error('failed to fetch')
      if (url.endsWith('/api/data/rev')) return json({ rev: 1, wid: 'w' })
      if (!options.method || options.method === 'GET') return json({ state: { foodEntries: [], workouts: [] }, rev: 1 })
      return json({ rev: 2, wid: 'w2' })
    })
    saved.set('alog_next_enabled', '1')
    saved.set('alog_next_token', 'tok')
    saved.set('alog_next_url', 'http://localhost:9')
    ctl.noteLocalChange()
    await timers.find(timer => timer.ms === PUSH_DELAY_MS).fn()
    assert.equal(ctl.status().state, 'offline')
    assert.equal(saved.get('alog_next_owed'), '1')
    online = true
    await ctl.syncSoon()
    assert.equal(calls.some(call => call.options?.method === 'PUT'), true)
    assert.equal(ctl.status().state, 'synced')
    assert.equal(saved.get('alog_next_owed'), undefined)
  })

  it('stores protein and fiber from the server profile after a sync and leaves calories alone', async () => {
    const seen = []
    const { ctl, saved } = harness(async (url, options) => {
      if (url.endsWith('/api/me')) return json({ user: { name: 'Lux' } })
      if (url.endsWith('/api/data/rev')) return json({ rev: 4, wid: 'w' })
      if (!options?.method || options.method === 'GET') {
        return json({
          state: {
            foodEntries: [],
            workouts: [],
            routines: [],
            nutritionTargets: { calories: 1300, protein: 125, fiber: 25 },
          },
          rev: 4,
          wid: 'w',
        })
      }
      const body = JSON.parse(options.body)
      assert.equal(body.state.nutritionTargets.calories, 1300)
      assert.equal(body.state.nutritionTargets.protein, 125)
      return json({ rev: 5, wid: 'w2' })
    }, goals => seen.push(goals))
    saved.set('alog_next_enabled', '1')
    saved.set('alog_next_token', 'tok')
    await ctl.start()
    assert.equal(seen.length, 1)
    assert.deepEqual(seen[0], { protein: 125, fiber: 25 })
    const stored = JSON.parse(saved.get('alog_synced_goals'))
    assert.deepEqual(stored, { protein: 125, fiber: 25 })
    assert.equal(stored.calories, undefined)
  })

  it('stays off until the toggle is on and does not call the server', async () => {
    const { ctl, calls, saved } = harness(async () => json({}))
    await ctl.start()
    ctl.noteLocalChange()
    assert.equal(calls.length, 0)
    assert.equal(ctl.status().state, 'off')
    assert.throws(() => ctl.configure({ enabled: true, serverUrl: 'http://evil.example' }), /https/)
    ctl.configure({ enabled: false, serverUrl: DEFAULT_SERVER_URL })
    assert.equal(saved.get('alog_next_enabled'), '0')
  })
})
