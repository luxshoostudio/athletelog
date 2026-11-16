// Food inbox: entries Amber writes to food-inbox.json, merged into the day
// log on launch. Food only; the merge appends to day.food and leaves every
// other field alone. Applied inbox ids dedupe, so an entry never logs twice.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FOOD_INBOX_VERSION,
  dayKeyForDate,
  fetchInboxEntries,
  foodInboxUrls,
  mergeInboxEntries,
  normalizeInboxEntry,
} from '../lib/food-inbox.mjs'

const entry = {
  id: '2026-11-16-0830-01',
  date: '2026-11-16',
  time: '08:30',
  name: 'greek yogurt',
  qty: 1,
  unit: 'serving',
  p: 10,
  kcal: 59,
  fat: 0.4,
  carbs: 3.6,
  fiber: 0,
}

const day = {
  food: [{ id: 'f1', name: 'oats', p: 5, kcal: 100, fat: 1, carbs: 20, fiber: 2, time: '07:30', ts: 450 }],
  gym: { session: 'Upper', exercises: [{ id: 'e1', name: 'Pull-ups' }] },
  water: 2,
  waterMl: 500,
  period: false,
  garminKcal: 320,
}

describe('normalizeInboxEntry', () => {
  it('builds a day entry in the app shape', () => {
    const norm = normalizeInboxEntry(entry)
    assert.equal(norm.inboxId, '2026-11-16-0830-01')
    assert.equal(norm.date, '2026-11-16')
    assert.equal(norm.entry.name, 'greek yogurt')
    assert.equal(norm.entry.time, '08:30')
    assert.equal(norm.entry.ts, 510)
    assert.equal(norm.entry.kcal, 59)
    assert.equal(norm.entry.qty, 1)
    assert.equal(norm.entry.unit, 'serving')
    assert.equal(typeof norm.entry.id, 'string')
    assert.ok(norm.entry.id.length > 0)
  })

  it('defaults missing macros to 0 and a bad time to 12:00', () => {
    const norm = normalizeInboxEntry({ id: 'x1', date: '2026-11-16', name: 'apple' })
    assert.equal(norm.entry.p, 0)
    assert.equal(norm.entry.kcal, 0)
    assert.equal(norm.entry.time, '12:00')
    assert.equal(norm.entry.ts, 720)
  })

  it('rejects entries with a bad id, date, or name', () => {
    assert.equal(normalizeInboxEntry(null), null)
    assert.equal(normalizeInboxEntry({ ...entry, id: '' }), null)
    assert.equal(normalizeInboxEntry({ ...entry, date: 'Nov 16' }), null)
    assert.equal(normalizeInboxEntry({ ...entry, name: '  ' }), null)
  })
})

describe('mergeInboxEntries', () => {
  it('appends to the right day and touches nothing else', () => {
    const days = { alog_2026_11_16: day }
    const { days: next, applied, skipped } = mergeInboxEntries(days, [entry], [])
    assert.deepEqual(applied, ['2026-11-16-0830-01'])
    assert.deepEqual(skipped, [])
    const merged = next.alog_2026_11_16
    assert.equal(merged.food.length, 2)
    assert.equal(merged.food[0].name, 'oats')
    assert.equal(merged.food[1].name, 'greek yogurt')
    assert.equal(merged.gym, day.gym)
    assert.equal(merged.water, 2)
    assert.equal(merged.waterMl, 500)
    assert.equal(merged.period, false)
    assert.equal(merged.garminKcal, 320)
    assert.equal(day.food.length, 1)
  })

  it('creates a missing day with an empty gym session', () => {
    const { days: next } = mergeInboxEntries({}, [entry], [])
    const created = next.alog_2026_11_16
    assert.equal(created.food.length, 1)
    assert.deepEqual(created.gym, { session: '', exercises: [] })
    assert.equal(created.water, 0)
    assert.equal(created.period, false)
  })

  it('never applies the same inbox id twice', () => {
    const first = mergeInboxEntries({}, [entry], [])
    const second = mergeInboxEntries(first.days, [entry], first.appliedIds)
    assert.deepEqual(second.applied, [])
    assert.equal(second.days.alog_2026_11_16.food.length, 1)
    assert.equal(second.days.alog_2026_11_16, first.days.alog_2026_11_16)
  })

  it('skips invalid entries and keeps the valid ones', () => {
    const bad = { ...entry, id: 'bad-1', date: 'not-a-date' }
    const { applied, skipped, days: next } = mergeInboxEntries({}, [bad, entry], [])
    assert.deepEqual(applied, ['2026-11-16-0830-01'])
    assert.deepEqual(skipped, ['bad-1'])
    assert.equal(next.alog_2026_11_16.food.length, 1)
  })

  it('leaves unrelated days untouched by reference', () => {
    const other = { food: [], gym: { session: '', exercises: [] }, water: 0, waterMl: 0, period: false }
    const days = { alog_2026_11_15: other }
    const { days: next } = mergeInboxEntries(days, [entry], [])
    assert.equal(next.alog_2026_11_15, other)
    assert.ok(next.alog_2026_11_16)
  })
})

describe('dayKeyForDate', () => {
  it('matches the app day key format', () => {
    assert.equal(dayKeyForDate('2026-11-16'), 'alog_2026_11_16')
  })
})

describe('fetchInboxEntries', () => {
  it('tries URLs in order and takes the first that parses', async () => {
    const calls = []
    const fakeFetch = async (url) => {
      calls.push(url)
      if (url === 'https://primary/food-inbox.json') return { ok: false }
      return { ok: true, json: async () => ({ version: FOOD_INBOX_VERSION, entries: [entry] }) }
    }
    const entries = await fetchInboxEntries(fakeFetch, ['https://primary/food-inbox.json', './food-inbox.json'])
    assert.deepEqual(calls, ['https://primary/food-inbox.json', './food-inbox.json'])
    assert.deepEqual(entries, [entry])
  })

  it('returns [] when nothing usable can be fetched', async () => {
    const failing = async () => { throw new Error('offline') }
    assert.deepEqual(await fetchInboxEntries(failing, foodInboxUrls()), [])
    const wrongVersion = async () => ({ ok: true, json: async () => ({ version: 99, entries: [entry] }) })
    assert.deepEqual(await fetchInboxEntries(wrongVersion, ['./food-inbox.json']), [])
  })
})
