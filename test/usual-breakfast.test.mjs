import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  USUAL_BREAKFAST_KEY,
  breakfastItems,
  formatMacro,
  isBreakfastBundle,
  learnUsualBreakfast,
  makeEntry,
  favouritesForInstall,
  recipeForInstall,
  seedUsualBreakfast,
  sumMacros,
  usualBreakfastFavourite,
} from '../lib/usual-breakfast.mjs'

test('the saved breakfast is the fixed recipe and totals about 30 g / 470 kcal / 18 g fiber', () => {
  const recipe = seedUsualBreakfast()
  assert.equal(USUAL_BREAKFAST_KEY, 'alog_usual_breakfast')
  assert.deepEqual(recipe.items.map(item => item.name), [
    'Blueberries',
    'Raspberries',
    'Strawberries',
    'Kodiak Protein oats',
    'Chia seeds',
    "Trader Joe's Greek yogurt",
    '2% milk',
  ])
  assert.deepEqual(recipe.items.map(item => item.amount), [
    '100 g', '100 g', '50 g', '1/2 cup dry', '2 tsp', '150 g', '50 ml',
  ])
  const berries = Object.fromEntries(recipe.items.map(item => [item.name, item]))
  assert.equal(berries.Blueberries.fat, 0.3)
  assert.equal(berries.Blueberries.carbs, 14.5)
  assert.equal(berries.Raspberries.fat, 0.7)
  assert.equal(berries.Raspberries.carbs, 11.9)
  assert.equal(berries.Strawberries.fat, 0.2)
  assert.equal(berries.Strawberries.carbs, 3.8)
  assert.equal(berries['Chia seeds'].fat, 2.5)
  assert.equal(berries['Chia seeds'].carbs, 3.4)
  assert.equal(berries['2% milk'].fat, 1)
  assert.equal(berries['2% milk'].carbs, 2.4)
  assert.equal(berries['Kodiak Protein oats'].fat, 4)
  assert.equal(berries['Kodiak Protein oats'].carbs, 29)
  assert.equal(berries["Trader Joe's Greek yogurt"].fat, 0)
  assert.equal(berries["Trader Joe's Greek yogurt"].carbs, 6)
  const totals = sumMacros(recipe.items)
  assert.equal(totals.p, 30.2)
  assert.equal(totals.kcal, 470)
  assert.equal(totals.fat, 8.7)
  assert.equal(totals.carbs, 71)
  assert.equal(totals.fiber, 17.7)
})

test('an existing install gets Usual Breakfast in favourites when it is missing', () => {
  const favourite = usualBreakfastFavourite()
  assert.equal(favourite.name, 'Usual Breakfast')
  assert.deepEqual(favourite.components.map(item => item.name), [
    'Blueberries', 'Raspberries', 'Strawberries', 'Kodiak Protein oats',
    'Chia seeds', "Trader Joe's Greek yogurt", '2% milk',
  ])
  assert.equal(favourite.p, 30.2)
  assert.equal(favourite.kcal, 470)
  assert.equal(favourite.fat, 8.7)
  assert.equal(favourite.carbs, 71)
  assert.equal(favourite.fiber, 17.7)

  const missing = favouritesForInstall(null)
  assert.equal(missing.seeded, true)
  assert.equal(missing.favourites[0].name, 'Usual Breakfast')
  assert.equal(missing.favourites[0].components.length, 7)

  const beside = favouritesForInstall([{ name: 'Protein Shake', p: 30, kcal: 160 }])
  assert.equal(beside.seeded, true)
  assert.deepEqual(beside.favourites.map(item => item.name), ['Usual Breakfast', 'Protein Shake'])

  const empty = favouritesForInstall([{ name: 'Usual Breakfast', components: [] }])
  assert.equal(empty.seeded, true)
  assert.equal(empty.favourites.length, 1)
  assert.equal(empty.favourites[0].components.length, 7)

  const kept = favouritesForInstall([favourite])
  assert.equal(kept.seeded, false)
  assert.equal(kept.favourites.length, 1)
})

test('an existing install with no recipe, or an empty one, gets the seven-item seed', () => {
  const priorDays = {
    alog_2026_10_11: { food: [{ name: 'Banana', p: 1, kcal: 90 }] },
  }
  assert.equal(Object.hasOwn(priorDays, 'alog_usual_breakfast'), false)
  const missing = recipeForInstall(null)
  assert.equal(missing.seeded, true)
  assert.equal(missing.recipe.items.length, 7)
  assert.equal(missing.recipe.items[0].name, 'Blueberries')

  const empty = recipeForInstall({ name: 'Usual Breakfast', items: [] })
  assert.equal(empty.seeded, true)
  assert.equal(empty.recipe.items.length, 7)

  const blank = recipeForInstall({})
  assert.equal(blank.seeded, true)

  const kept = recipeForInstall(seedUsualBreakfast())
  assert.equal(kept.seeded, false)
  assert.equal(kept.recipe.items.length, 7)

  const clearedOnPurpose = recipeForInstall({ items: [], customized: true })
  assert.equal(clearedOnPurpose.seeded, false)
  assert.deepEqual(clearedOnPurpose.recipe.items, [])
})

test('add uses the saved recipe when it is present and learned mornings otherwise', () => {
  const saved = seedUsualBreakfast()
  const learned = [{ name: 'Oats', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 }]
  assert.equal(breakfastItems(saved, learned).length, 7)
  assert.equal(breakfastItems(saved, learned)[0].name, 'Blueberries')
  assert.deepEqual(breakfastItems({ items: [] }, learned).map(item => item.name), ['Oats'])
  assert.deepEqual(breakfastItems(null, learned).map(item => item.name), ['Oats'])
})

test('a Usual Breakfast bundle is not learned again on top of its items', () => {
  const parts = [
    { name: 'Blueberries', p: 0.7, kcal: 57, fat: 0.3, carbs: 14.5, fiber: 2.4, ts: 8 * 60 },
    { name: 'Yogurt', p: 15, kcal: 362, fat: 0, carbs: 6, fiber: 0, ts: 8 * 60 },
  ]
  const bundle = {
    name: 'Usual Breakfast',
    p: 15.7,
    kcal: 419,
    fat: 0.3,
    carbs: 20.5,
    fiber: 2.4,
    ts: 8 * 60,
    source: 'Usual Breakfast',
    components: parts,
  }
  assert.equal(isBreakfastBundle(bundle), true)
  assert.equal(isBreakfastBundle({ name: 'Usual Breakfast', kcal: 419, components: parts }), true)
  const records = Array.from({ length: 6 }, (_, index) => ({
    key: `alog_2026_10_${String(index + 1).padStart(2, '0')}`,
    food: [...parts, bundle],
  }))
  const learned = learnUsualBreakfast(records)
  assert.equal(learned.some(item => item.name === 'Usual Breakfast'), false)
  assert.equal(sumMacros(learned).kcal, 419)
  assert.notEqual(sumMacros(learned).kcal, 838)

  const onlyBundle = learnUsualBreakfast(records.map(record => ({ ...record, food: [bundle] })))
  assert.deepEqual(onlyBundle, [])
})

test('macros round to 1 decimal when stored and when shown', () => {
  const noisy = 0.1 + 0.2
  assert.notEqual(String(noisy), '0.3')
  assert.equal(sumMacros([
    { p: 0.1, kcal: 0.1, fat: 0.1, carbs: 0.1, fiber: 0.1 },
    { p: 0.2, kcal: 0.2, fat: 0.2, carbs: 0.2, fiber: 0.2 },
  ]).p, 0.3)
  const entry = makeEntry('Oats', { p: noisy, kcal: 41.60000000000001, fat: 4.04, carbs: 29.05, fiber: 5 }, '08:15', 'a')
  assert.equal(entry.p, 0.3)
  assert.equal(entry.kcal, 41.6)
  assert.equal(entry.fat, 4)
  assert.equal(entry.carbs, 29.1)
  assert.equal(entry.fiber, 5)
  assert.equal(formatMacro(41.60000000000001), '41.6')
  assert.equal(formatMacro(30), '30')
  assert.equal(formatMacro(30.2), '30.2')
})
