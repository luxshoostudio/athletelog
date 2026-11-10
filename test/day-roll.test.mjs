// Overnight PWA: state is loaded once, and saveState used to write it under
// whatever todayKey() was at save time. That copied 11/2's entries onto 11/3;
// sync then stored them with 11/3 dates and tombstoned the 11/2 rows.
// rollOpenDay keeps the open object on its original key and opens the new day empty.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `missing function ${name}`)
  let depth = 0
  let started = false
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') { depth++; started = true }
    else if (ch === '}') {
      depth--
      if (started && depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`unterminated function ${name}`)
}

function pageFunction(name) {
  const source = extractFunction(html, name)
  return new Function(`${source}\nreturn ${name};`)()
}

const yesterday = {
  food: [{ id: 'oats', name: 'oats', p: 5, kcal: 100, time: '08:00' }],
  gym: { session: 'Upper', exercises: [] },
  waterMl: 500,
  period: false,
}

test('saveState keeps the open day on the key it was loaded for', () => {
  const save = extractFunction(html, 'saveState')
  assert.match(save, /saveTargetKey\(stateDayKey,\s*todayKey\(\)\)/)
  assert.doesNotMatch(save, /setItem\(todayKey\(\)/)
  const saveTargetKey = pageFunction('saveTargetKey')
  assert.equal(saveTargetKey('alog_2026_11_02', 'alog_2026_11_03'), 'alog_2026_11_02')
  assert.equal(saveTargetKey('', 'alog_2026_11_03'), 'alog_2026_11_03')
})

test('crossing midnight does not copy or delete the previous day', () => {
  const rollOpenDay = pageFunction('rollOpenDay')
  const store = new Map([['alog_2026_11_02', JSON.stringify(yesterday)]])
  let writes = 0
  const rolled = rollOpenDay({
    openKey: 'alog_2026_11_02',
    calendarKey: 'alog_2026_11_03',
    memory: JSON.parse(JSON.stringify(yesterday)),
    read: key => store.get(key) ?? null,
    write: (key, value) => { writes++; store.set(key, value) },
  })
  assert.equal(rolled.rolled, true)
  assert.equal(rolled.openKey, 'alog_2026_11_03')
  assert.equal(rolled.previousKey, 'alog_2026_11_02')
  assert.equal(rolled.nextState, null)
  assert.equal(writes, 0)
  assert.equal(store.has('alog_2026_11_03'), false)
  assert.deepEqual(JSON.parse(store.get('alog_2026_11_02')), yesterday)

  const edited = JSON.parse(JSON.stringify(yesterday))
  edited.food.push({ id: 'eggs', name: 'eggs', p: 12, kcal: 140, time: '09:00' })
  const flushed = rollOpenDay({
    openKey: 'alog_2026_11_02',
    calendarKey: 'alog_2026_11_03',
    memory: edited,
    read: key => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
  })
  assert.equal(flushed.nextState, null)
  assert.equal(store.has('alog_2026_11_03'), false)
  assert.deepEqual(JSON.parse(store.get('alog_2026_11_02')).food.map(entry => entry.id), ['oats', 'eggs'])

  store.set('alog_2026_11_03', JSON.stringify({
    food: [{ id: 'apple', name: 'apple', p: 0, kcal: 80, time: '12:00' }],
    gym: { session: '', exercises: [] },
  }))
  const kept = rollOpenDay({
    openKey: 'alog_2026_11_02',
    calendarKey: 'alog_2026_11_03',
    memory: yesterday,
    read: key => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
  })
  assert.equal(kept.nextState.food[0].id, 'apple')
  assert.equal(JSON.parse(store.get('alog_2026_11_02')).food[0].id, 'oats')
  assert.equal(JSON.parse(store.get('alog_2026_11_03')).food[0].id, 'apple')

  const same = rollOpenDay({
    openKey: 'alog_2026_11_03',
    calendarKey: 'alog_2026_11_03',
    memory: yesterday,
    read: key => store.get(key) ?? null,
    write: () => { throw new Error('same day must not write') },
  })
  assert.equal(same.rolled, false)
  assert.equal(same.openKey, 'alog_2026_11_03')
})

test('an auto-created empty check-in does not create a phantom day record', () => {
  const rollOpenDay = pageFunction('rollOpenDay')
  let writes = 0
  rollOpenDay({
    openKey: 'alog_2026_11_02',
    calendarKey: 'alog_2026_11_03',
    memory: {
      food: [],
      gym: { session: '', exercises: [] },
      checkin: { scores: {}, tasks: {}, firework: '', tomorrow: '', thoughts: '' },
    },
    read: () => null,
    write: () => { writes++ },
  })
  assert.equal(writes, 0)
})

test('the open page rebinds when the calendar day changes', () => {
  assert.match(html, /function onCalendarDayMaybeChanged\(/)
  assert.match(html, /function useStoredToday\(/)
  assert.match(html, /visibilitychange/)
  assert.match(html, /pageshow/)
  assert.match(html, /onCalendarDayMaybeChanged\(\)/)
  const apply = extractFunction(html, 'applyNextSyncDays')
  assert.match(apply, /useStoredToday\(\)/)
  assert.doesNotMatch(apply, /setItem\(todayKey\(\)/)
})

test('pace formatting carries rounded seconds into the next minute', () => {
  const calcPacePerMile = pageFunction('calcPacePerMile')
  assert.equal(calcPacePerMile('1', '5.999'), '6:00/mile')
  assert.equal(calcPacePerMile('3.1', '18:35'), '6:00/mile')

  const pacePerMileFromKm = pageFunction('pacePerMileFromKm')
  assert.equal(pacePerMileFromKm('3:44/km'), '6:00/mile')
  assert.equal(pacePerMileFromKm('not a pace'), 'not a pace')
})

test('date-only reminders use calendar days instead of elapsed hours', () => {
  const calendarDaysSince = new Function(
    `${extractFunction(html, 'localDateFromIso')}\n${extractFunction(html, 'calendarDaysSince')}\nreturn calendarDaysSince;`,
  )()
  const lateToday = new Date(2026, 10, 10, 23, 59)
  assert.equal(calendarDaysSince('2026-11-03', lateToday), 7)
  assert.equal(calendarDaysSince('2026-11-10', lateToday), 0)
  assert.equal(calendarDaysSince('not a date', lateToday), 0)
})

test('a custom session is its own selected chip and does not select a built-in bucket', () => {
  const customSessionNames = new Function(`${extractFunction(html, 'sessionNameKey')}\n${extractFunction(html, 'customSessionNames')}\nreturn customSessionNames;`)()
  const templates = ['Lower Body', 'Upper', 'Running', 'Other']
  const names = customSessionNames('Upper Push', ['Upper Push', 'Easy Spin', 'Upper', ''], templates)
  assert.deepEqual(names, ['Upper Push', 'Easy Spin'])
  assert.equal(customSessionNames('Upper', ['Upper Push'], templates)[0], 'Upper Push')
  assert.ok(!customSessionNames('Upper', ['Upper'], templates).includes('Upper'))
  assert.deepEqual(customSessionNames(' upper ', ['Upper'], templates), [])
  // Newest spelling wins: 11/3 "functioning" then 10/28 "Functioning" is one chip.
  assert.deepEqual(
    customSessionNames('', ['functioning', 'Functioning', '  functioning  '], templates),
    ['functioning'],
  )
  assert.deepEqual(
    customSessionNames('Functioning', ['functioning'], templates),
    ['Functioning'],
  )

  const render = extractFunction(html, 'renderOrganicSessionSegments')
  assert.match(render, /customSessionNames/)
  assert.match(render, /sessionNameKey\(template\.name\) === activeKey/)
  assert.match(render, /sessionNameKey\(name\) === activeKey/)
  assert.doesNotMatch(render, /canonicalSessionType\(state\.gym\.session/)
  const select = extractFunction(html, 'selectOrganicSession')
  assert.doesNotMatch(select, /sel\.value = canonicalSessionType\(session\)/)
})
