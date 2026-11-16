import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, daysBetween,
  episodesFromPeriodDates, migrateCycleStore, periodFlagPatches,
  averagePeriodLength, averageCycleLength,
  logPeriodStart, shiftStart, shiftEnd, endOn, applyCalendarTap,
  cycleSnapshot, markDay, cycleStatus,
} from '../lib/cycle.mjs'

test('date math stays on the calendar across months and leap years', () => {
  assert.equal(addDays('2026-12-30', 5), '2027-01-04')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2024-03-01', -1), '2024-02-29')
  assert.equal(daysBetween('2026-11-16', '2026-11-20'), 4)
  assert.equal(daysBetween('2026-11-20', '2026-11-16'), -4)
})

test('period length averages recent logged periods and otherwise defaults to 5', () => {
  assert.equal(averagePeriodLength([]), 5)
  assert.equal(averagePeriodLength([
    { start: '2026-09-01', end: '2026-09-04' },
    { start: '2026-09-29', end: '2026-10-04' },
    { start: '2026-10-28', end: '2026-11-03' },
  ]), 6)
  assert.equal(averagePeriodLength([
    { start: '2026-01-01', end: '2026-01-20' },
  ]), 5)
})

test('cycle length averages recent start-to-start gaps and otherwise defaults to 28', () => {
  assert.equal(averageCycleLength([]), 28)
  assert.equal(averageCycleLength([
    { start: '2026-08-01', end: '2026-08-05' },
  ]), 28)
  assert.equal(averageCycleLength([
    { start: '2026-06-01', end: '2026-06-05' },
    { start: '2026-06-29', end: '2026-07-03' },
    { start: '2026-07-28', end: '2026-08-01' },
    { start: '2026-09-26', end: '2026-09-30' },
  ]), 29)
})

test('logging a period start fills the usual length and leaves later cycles predicted', () => {
  const episodes = logPeriodStart([], '2026-11-16')
  assert.deepEqual(episodes, [{ start: '2026-11-16', end: '2026-11-20' }])
  const snap = cycleSnapshot(episodes, '2026-11-16')
  assert.equal(snap.periodLength, 5)
  assert.equal(snap.cycleLength, 28)
  assert.equal(snap.next.start, '2026-12-14')
  assert.equal(snap.next.end, '2026-12-18')
  assert.equal(markDay('2026-11-16', snap).logged, true)
  assert.equal(markDay('2026-11-20', snap).logged, true)
  assert.equal(markDay('2026-11-21', snap).logged, false)
  assert.equal(markDay('2026-12-14', snap).predicted, true)
  assert.equal(markDay('2026-12-14', snap).logged, false)
  assert.equal(markDay('2026-12-18', snap).predicted, true)
  assert.equal(markDay('2026-12-19', snap).predicted, false)
})

test('the next period, ovulation, and fertile window follow the logged history', () => {
  const episodes = [
    { start: '2026-09-01', end: '2026-09-05' },
    { start: '2026-09-29', end: '2026-10-02' },
    { start: '2026-10-28', end: '2026-11-02' },
  ]
  const snap = cycleSnapshot(episodes, '2026-11-16', '2026-12-31')
  assert.equal(snap.periodLength, 5)
  assert.equal(snap.cycleLength, 29)
  assert.equal(snap.next.start, '2026-11-26')
  assert.equal(snap.next.end, '2026-11-30')
  assert.deepEqual(snap.prediction.ovulation[0], '2026-11-12')
  assert.deepEqual(snap.prediction.fertile[0], { start: '2026-11-07', end: '2026-11-12' })
  assert.equal(markDay('2026-11-12', snap).ovulation, true)
  assert.equal(markDay('2026-11-07', snap).fertile, true)
  assert.equal(markDay('2026-11-02', snap).fertile, false)
  assert.equal(markDay('2026-11-02', snap).logged, true)
  const later = snap.prediction.periods[1]
  assert.equal(later.start, '2026-12-25')
  assert.equal(later.end, '2026-12-29')
})

test('a fertile window starts the day after a long period instead of overlapping it', () => {
  const episodes = [{ start: '2026-11-01', end: '2026-11-12' }]
  const snap = cycleSnapshot(episodes, '2026-11-13', '2026-12-20')
  assert.equal(snap.next.start, '2026-11-29')
  assert.equal(snap.prediction.ovulation[0], '2026-11-15')
  assert.deepEqual(snap.prediction.fertile[0], { start: '2026-11-13', end: '2026-11-15' })
})

test('start, end, and single-day edits keep one continuous period when the days touch', () => {
  let episodes = logPeriodStart([], '2026-11-16')
  episodes = shiftStart(episodes, -2)
  assert.deepEqual(episodes, [{ start: '2026-11-14', end: '2026-11-18' }])
  episodes = shiftEnd(episodes, 1)
  assert.deepEqual(episodes, [{ start: '2026-11-14', end: '2026-11-19' }])
  episodes = shiftEnd(episodes, -3)
  assert.deepEqual(episodes, [{ start: '2026-11-14', end: '2026-11-16' }])
  episodes = endOn(episodes, '2026-11-15')
  assert.deepEqual(episodes, [{ start: '2026-11-14', end: '2026-11-15' }])
  episodes = applyCalendarTap(episodes, '2026-11-14')
  assert.deepEqual(episodes, [{ start: '2026-11-15', end: '2026-11-15' }])
  episodes = applyCalendarTap(episodes, '2026-11-16')
  assert.deepEqual(episodes, [{ start: '2026-11-15', end: '2026-11-16' }])
  episodes = logPeriodStart(episodes, '2026-11-16')
  assert.deepEqual(episodes, [{ start: '2026-11-15', end: '2026-11-20' }])
})

test('tapping the middle of a period splits it, and tapping a predicted start logs that period', () => {
  const split = applyCalendarTap([{ start: '2026-11-16', end: '2026-11-20' }], '2026-11-18')
  assert.deepEqual(split, [
    { start: '2026-11-16', end: '2026-11-17' },
    { start: '2026-11-19', end: '2026-11-20' },
  ])
  const logged = [{ start: '2026-10-19', end: '2026-10-23' }]
  const snap = cycleSnapshot(logged, '2026-11-16')
  assert.equal(snap.next.start, '2026-11-16')
  const confirmed = applyCalendarTap(logged, '2026-11-16')
  assert.deepEqual(confirmed, [
    { start: '2026-10-19', end: '2026-10-23' },
    { start: '2026-11-16', end: '2026-11-20' },
  ])
  const late = applyCalendarTap(logged, '2026-11-18')
  assert.deepEqual(late, [
    { start: '2026-10-19', end: '2026-10-23' },
    { start: '2026-11-18', end: '2026-11-18' },
  ])
})

test('the end of a period cannot move before its start', () => {
  const episodes = shiftEnd([{ start: '2026-11-16', end: '2026-11-16' }], -3)
  assert.deepEqual(episodes, [{ start: '2026-11-16', end: '2026-11-16' }])
})

test('migration groups consecutive period days and keeps every logged day', () => {
  const episodes = episodesFromPeriodDates([
    '2026-10-22', '2026-09-26', '2026-09-24', '2026-09-25', '2026-09-27',
    '2026-10-23', '2026-11-19', 'not-a-date', '2026-09-25',
  ])
  assert.deepEqual(episodes, [
    { start: '2026-09-24', end: '2026-09-27' },
    { start: '2026-10-22', end: '2026-10-23' },
    { start: '2026-11-19', end: '2026-11-19' },
  ])
})

test('migration unions day flags into a new store and then keeps manual edits', () => {
  const first = migrateCycleStore({
    stored: { version: 1, episodes: [{ start: '2026-08-01', end: '2026-08-04' }] },
    periodDates: ['2026-09-24', '2026-09-25', '2026-09-26'],
    migrated: false,
  })
  assert.deepEqual(first.episodes, [
    { start: '2026-08-01', end: '2026-08-04' },
    { start: '2026-09-24', end: '2026-09-26' },
  ])
  assert.equal(first.migrated, true)

  const edited = [{ start: '2026-09-24', end: '2026-09-25' }]
  const second = migrateCycleStore({
    stored: { version: 1, episodes: edited },
    periodDates: ['2026-09-24', '2026-09-25', '2026-09-26'],
    migrated: true,
  })
  assert.deepEqual(second.episodes, edited)
})

test('an empty history migrates to no episodes and does not invent a period', () => {
  const result = migrateCycleStore({ stored: null, periodDates: [], migrated: false })
  assert.deepEqual(result.episodes, [])
  const snap = cycleSnapshot(result.episodes, '2026-11-16')
  assert.equal(snap.next, null)
  assert.deepEqual(snap.prediction.periods, [])
})

test('projecting episodes updates period flags without dropping a day that has other logs', () => {
  const patches = periodFlagPatches(
    [{ start: '2026-09-24', end: '2026-09-25' }],
    {
      '2026-09-24': { period: true, food: [{ name: 'oats' }] },
      '2026-09-25': { period: false, food: [] },
      '2026-09-26': { period: true, food: [{ name: 'rice' }] },
      '2026-09-27': { period: true, food: [], gym: { session: '', exercises: [] }, waterMl: 0 },
      '2026-09-28': { period: false, food: [{ name: 'eggs' }] },
    },
  )
  assert.deepEqual(patches, [
    { iso: '2026-09-25', op: 'set' },
    { iso: '2026-09-26', op: 'clear' },
    { iso: '2026-09-27', op: 'delete' },
  ])
})

test('a past day can be logged on its own or filled as the start of a period', () => {
  assert.deepEqual(applyCalendarTap([], '2026-08-23'), [{ start: '2026-08-23', end: '2026-08-23' }])
  assert.deepEqual(logPeriodStart([], '2026-08-23'), [{ start: '2026-08-23', end: '2026-08-27' }])
  assert.deepEqual(applyCalendarTap([{ start: '2026-08-23', end: '2026-08-27' }], '2026-08-23'), [
    { start: '2026-08-24', end: '2026-08-27' },
  ])
})

test('the 2026 logs stay separate where a day was skipped, and November 11–15 is kept', () => {
  const dates = [
    '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26',
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    '2026-10-13', '2026-10-16',
    '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
  ]
  const episodes = episodesFromPeriodDates(dates)
  assert.deepEqual(episodes, [
    { start: '2026-08-23', end: '2026-08-26' },
    { start: '2026-09-24', end: '2026-09-27' },
    { start: '2026-10-13', end: '2026-10-13' },
    { start: '2026-10-16', end: '2026-10-16' },
    { start: '2026-11-11', end: '2026-11-15' },
  ])
  const migrated = migrateCycleStore({ stored: null, periodDates: dates, migrated: false })
  assert.deepEqual(migrated.episodes, episodes)
  assert.equal(averagePeriodLength(episodes), 4)
  assert.equal(averageCycleLength(episodes), 29)
  const snap = cycleSnapshot(episodes, '2026-11-16', '2026-12-31')
  assert.equal(snap.next.start, '2026-12-10')
  assert.equal(snap.next.end, '2026-12-13')
  assert.equal(markDay('2026-11-11', snap).logged, true)
  assert.equal(markDay('2026-11-15', snap).logged, true)
  assert.equal(markDay('2026-11-16', snap).logged, false)
  assert.equal(markDay('2026-12-10', snap).predicted, true)
  assert.equal(markDay('2026-10-13', snap).logged, true)
  assert.equal(markDay('2026-10-14', snap).logged, false)
  assert.equal(markDay('2026-10-16', snap).logged, true)
})

test('home status distinguishes a logged period, a prediction, and a late period', () => {
  const none = cycleStatus([], '2026-11-16')
  assert.equal(none.headline, 'No period logged yet')
  assert.equal(none.primary, 'log')

  const logged = cycleStatus([{ start: '2026-11-15', end: '2026-11-19' }], '2026-11-16')
  assert.equal(logged.headline, 'Period · day 2 of 5')
  assert.equal(logged.primary, 'end-today')
  assert.match(logged.detail, /Nov 15–19/)

  const upcoming = cycleStatus([{ start: '2026-10-19', end: '2026-10-23' }], '2026-11-04')
  assert.equal(upcoming.headline, 'Next period in 12 days')
  assert.equal(upcoming.primary, 'log')
  assert.match(upcoming.detail, /Nov 16/)

  const due = cycleStatus([{ start: '2026-10-19', end: '2026-10-23' }], '2026-11-16')
  assert.equal(due.headline, 'Period expected today')
  assert.equal(due.primary, 'log')

  const late = cycleStatus([{ start: '2026-10-19', end: '2026-10-23' }], '2026-11-18')
  assert.equal(late.headline, 'Period · 2 days late')
  assert.equal(late.primary, 'log')

  const finishedToday = cycleStatus([{ start: '2026-11-14', end: '2026-11-16' }], '2026-11-16')
  assert.equal(finishedToday.headline, 'Period · day 3 of 3')
  assert.equal(finishedToday.primary, 'logged')
})
