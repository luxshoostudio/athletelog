// Changing a logged food's unit does not recompute macros. The catalog unit
// is the basis of a database row (per 100 g, per 1 cup), not a conversion
// from the absolute macros already stored on the entry.
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

const logged = {
  id: 'f1', name: 'greek yogurt', p: 15, kcal: 90, fat: 0, carbs: 5.4, fiber: 0,
  time: '09:15', ts: 555, unit: 'serving', qty: 1,
}

test('the unit picker uses catalog units and keeps a custom unit', () => {
  const foodUnitChoices = pageFunction('foodUnitChoices')
  const choices = foodUnitChoices('serving')
  for (const unit of ['serving', 'g', 'ml', 'cup', 'tbsp', 'piece']) {
    assert.ok(choices.includes(unit), unit)
  }
  assert.ok(!choices.includes('oz'))
  assert.deepEqual(foodUnitChoices('oz').slice(-1), ['oz'])
})

test('editing unit or qty keeps the logged macros', () => {
  const applyEntryAmount = pageFunction('applyEntryAmount')
  const entryAmountLabel = pageFunction('entryAmountLabel')
  const next = applyEntryAmount(logged, 'g', '150')
  assert.equal(next.unit, 'g')
  assert.equal(next.qty, 150)
  assert.equal(next.p, 15)
  assert.equal(next.kcal, 90)
  assert.equal(next.fat, 0)
  assert.equal(next.carbs, 5.4)
  assert.equal(next.fiber, 0)
  assert.equal(next.time, '09:15')
  assert.equal(logged.unit, 'serving')
  assert.equal(entryAmountLabel(next), '150 g')
  const cleared = applyEntryAmount(next, 'cup', '')
  assert.equal(cleared.unit, 'cup')
  assert.equal(Object.hasOwn(cleared, 'qty'), false)
  assert.equal(cleared.p, 15)
  assert.equal(entryAmountLabel(cleared), 'cup')
  assert.equal(entryAmountLabel({ name: 'oats' }), '')
})

test('the time sheet edits unit without recalculating nutrition', () => {
  assert.match(html, /id="time-edit-unit"/)
  assert.match(html, /id="time-edit-qty"/)
  assert.match(html, /id="time-edit-unit-custom"/)
  assert.match(html, /Nutrition stays as logged/)
  const save = extractFunction(html, 'confirmTimeEdit')
  assert.match(save, /applyEntryAmount\(/)
  assert.doesNotMatch(save, /calcQty\(/)
})
