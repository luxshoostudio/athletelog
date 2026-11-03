// Quantity rescales a logged entry from its original macros. Missing qty
// counts as 1, so 1 → 1.5 multiplies by 1.5. The unit is only a label.
// Repeated edits scale from the first basis, so rounding does not compound.
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
  const helpers = ['entryMacroKeys', 'entryQty', 'scaleMacroExact', 'qtyBasisOf', 'applyEntryAmount', 'entryAmountLabel', 'foodUnitChoices']
    .filter(item => item === name || html.includes(`function ${item}(`))
    .map(item => extractFunction(html, item))
  return new Function(`${helpers.join('\n')}\nreturn ${name};`)()
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

test('quantity rescales macros from the current qty, and unit does not', () => {
  const applyEntryAmount = pageFunction('applyEntryAmount')
  const entryAmountLabel = pageFunction('entryAmountLabel')
  const more = applyEntryAmount(logged, 'serving', '1.5')
  assert.equal(more.qty, 1.5)
  assert.equal(more.p, 22.5)
  assert.equal(more.kcal, 135)
  assert.equal(more.fat, 0)
  assert.equal(more.carbs, 8.1)
  assert.equal(more.fiber, 0)
  assert.equal(more.time, '09:15')
  assert.equal(logged.p, 15)
  assert.equal(entryAmountLabel(more), '1.5 serving')

  const relabeled = applyEntryAmount(more, 'g', '1.5')
  assert.equal(relabeled.unit, 'g')
  assert.equal(relabeled.p, 22.5)
  assert.equal(relabeled.kcal, 135)

  const bare = { name: 'oats', p: 10, kcal: 100, fat: 1, carbs: 2, fiber: 0.5 }
  const fromOne = applyEntryAmount(bare, '', '1.5')
  assert.equal(fromOne.qty, 1.5)
  assert.equal(fromOne.p, 15)
  assert.equal(fromOne.kcal, 150)
  assert.equal(fromOne.fat, 1.5)
  assert.equal(fromOne.carbs, 3)
  assert.equal(fromOne.fiber, 0.75)
})

test('repeated quantity edits scale from the original basis', () => {
  const applyEntryAmount = pageFunction('applyEntryAmount')
  const odd = {
    name: 'yogurt', p: 10.1, kcal: 33, fat: 0.3, carbs: 1.7, fiber: 0.4, qty: 1,
    components: [{ name: 'milk', amount: '50 g', p: 1.6, kcal: 31, fat: 1.6, carbs: 2.4, fiber: 0 }],
  }
  let cur = odd
  for (const qty of ['1.5', '2', '0.5', '1.5', '1']) cur = applyEntryAmount(cur, '', qty)
  assert.equal(cur.qty, 1)
  assert.equal(cur.p, 10.1)
  assert.equal(cur.kcal, 33)
  assert.equal(cur.fat, 0.3)
  assert.equal(cur.carbs, 1.7)
  assert.equal(cur.fiber, 0.4)
  assert.equal(cur.components[0].p, 1.6)
  assert.equal(cur.components[0].kcal, 31)
  assert.equal(cur.components[0].amount, '50 g')

  const halfway = applyEntryAmount(odd, '', '2')
  assert.equal(halfway.p, 20.2)
  assert.equal(halfway.components[0].p, 3.2)
  assert.equal(halfway.components[0].kcal, 62)
  assert.equal(halfway.components[0].amount, '50 g')
})

test('the entry sheet leads with quantity steps and still has a unit field', () => {
  assert.match(html, /id="time-edit-qty"/)
  assert.match(html, /stepEntryQty\(-0\.5\)/)
  assert.match(html, /stepEntryQty\(0\.5\)/)
  assert.match(html, /id="time-edit-unit"/)
  assert.doesNotMatch(html, /Nutrition stays as logged/)
  const save = extractFunction(html, 'confirmTimeEdit')
  assert.match(save, /applyEntryAmount\(/)
  assert.doesNotMatch(save, /calcQty\(/)
  const qtyAt = html.indexOf('id="time-edit-qty"')
  const unitAt = html.indexOf('id="time-edit-unit"')
  assert.ok(qtyAt > 0 && qtyAt < unitAt)
})
