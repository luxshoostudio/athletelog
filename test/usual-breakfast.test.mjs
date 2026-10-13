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
  lifewayKefirFavourite,
  recipeForInstall,
  seedUsualBreakfast,
  sumMacros,
  usualBreakfastFavourite,
} from '../lib/usual-breakfast.mjs'

test('the saved breakfast is the fixed recipe and totals about 30.2 g / 464 kcal / 16.5 g fiber', () => {
  const recipe = seedUsualBreakfast()
  assert.equal(USUAL_BREAKFAST_KEY, 'alog_usual_breakfast')
  assert.deepEqual(recipe.items.map(item => item.name), [
    'Blueberries',
    'Raspberries',
    'Strawberries',
    'Kodiak Protein oats',
    'Chia seeds',
    "Trader Joe's Greek yogurt",
    'whole milk',
  ])
  assert.deepEqual(recipe.items.map(item => item.amount), [
    '80 g', '80 g', '50 g', '1/2 cup dry', '10 g', '150 g', '50 ml',
  ])
  const berries = Object.fromEntries(recipe.items.map(item => [item.name, item]))
  assert.equal(berries.Blueberries.p, 0.6)
  assert.equal(berries.Blueberries.kcal, 46)
  assert.equal(berries.Blueberries.fiber, 1.9)
  assert.equal(berries.Blueberries.fat, 0.3)
  assert.equal(berries.Blueberries.carbs, 11.6)
  assert.equal(berries.Raspberries.p, 1)
  assert.equal(berries.Raspberries.kcal, 42)
  assert.equal(berries.Raspberries.fiber, 5.2)
  assert.equal(berries.Raspberries.fat, 0.5)
  assert.equal(berries.Raspberries.carbs, 9.6)
  assert.equal(berries.Strawberries.fat, 0.2)
  assert.equal(berries.Strawberries.carbs, 3.8)
  assert.equal(berries['Chia seeds'].p, 1.7)
  assert.equal(berries['Chia seeds'].kcal, 49)
  assert.equal(berries['Chia seeds'].fiber, 3.4)
  assert.equal(berries['Chia seeds'].fat, 3.1)
  assert.equal(berries['Chia seeds'].carbs, 4.2)
  assert.equal(berries['whole milk'].p, 1.6)
  assert.equal(berries['whole milk'].kcal, 31)
  assert.equal(berries['whole milk'].fiber, 0)
  assert.equal(berries['whole milk'].fat, 1.6)
  assert.equal(berries['whole milk'].carbs, 2.4)
  assert.equal(berries['Kodiak Protein oats'].fat, 4)
  assert.equal(berries['Kodiak Protein oats'].carbs, 29)
  assert.equal(berries["Trader Joe's Greek yogurt"].fat, 0)
  assert.equal(berries["Trader Joe's Greek yogurt"].carbs, 6)
  const totals = sumMacros(recipe.items)
  assert.equal(totals.p, 30.2)
  assert.equal(totals.kcal, 464)
  assert.equal(totals.fat, 9.7)
  assert.equal(totals.carbs, 66.6)
  assert.equal(totals.fiber, 16.5)
})

test('an existing install gets Usual Breakfast in favourites when it is missing', () => {
  const favourite = usualBreakfastFavourite()
  assert.equal(favourite.name, 'Usual Breakfast')
  assert.deepEqual(favourite.components.map(item => item.name), [
    'Blueberries', 'Raspberries', 'Strawberries', 'Kodiak Protein oats',
    'Chia seeds', "Trader Joe's Greek yogurt", 'whole milk',
  ])
  assert.equal(favourite.p, 30.2)
  assert.equal(favourite.kcal, 464)
  assert.equal(favourite.fat, 9.7)
  assert.equal(favourite.carbs, 66.6)
  assert.equal(favourite.fiber, 16.5)

  const missing = favouritesForInstall(null)
  assert.equal(missing.seeded, true)
  assert.equal(missing.favourites[0].name, 'Usual Breakfast')
  assert.equal(missing.favourites[0].components.length, 7)
  assert.equal(missing.favourites[1].name, 'Lifeway Strawberry Kefir (1 cup)')

  const beside = favouritesForInstall([{ name: 'Protein Shake', p: 30, kcal: 160 }])
  assert.equal(beside.seeded, true)
  assert.deepEqual(beside.favourites.map(item => item.name), [
    'Usual Breakfast', 'Lifeway Strawberry Kefir (1 cup)', 'Protein Shake',
  ])

  const empty = favouritesForInstall([{ name: 'Usual Breakfast', components: [] }])
  assert.equal(empty.seeded, true)
  assert.equal(empty.favourites.length, 2)
  assert.equal(empty.favourites[0].components.length, 7)
  assert.equal(empty.favourites[1].name, 'Lifeway Strawberry Kefir (1 cup)')

  const kept = favouritesForInstall([favourite])
  assert.equal(kept.seeded, true)
  assert.equal(kept.favourites[0], favourite)
  assert.equal(kept.favourites[1].p, 10)
  assert.equal(kept.favourites.length, 2)
})

function dayKey(now, daysBack) {
  const date = new Date(now)
  date.setDate(date.getDate() - daysBack)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `alog_${date.getFullYear()}_${month}_${day}`
}

function food(name, p, kcal, time = '12:00') {
  return { name, p, kcal, fat: 1, carbs: 2, fiber: 0.5, time }
}

test('existing favourites are kept and Usual Breakfast is only added when missing', () => {
  const now = new Date('2026-10-12T15:00:00')
  const stored = [
    { name: 'Tuna', p: 20, kcal: 100, fat: 1, carbs: 0, fiber: 0 },
    { name: 'Rice', p: 4, kcal: 200, fat: 0, carbs: 45, fiber: 1 },
  ]
  const result = favouritesForInstall(stored, {
    now,
    days: { [dayKey(now, 1)]: { food: [food('Banana', 1, 90)] } },
  })
  assert.equal(result.rebuilt, false)
  assert.equal(result.seeded, true)
  assert.deepEqual(result.favourites.map(item => item.name), [
    'Usual Breakfast', 'Lifeway Strawberry Kefir (1 cup)', 'Tuna', 'Rice',
  ])
  assert.equal(result.favourites[0].components.length, 7)
  assert.equal(result.favourites[2].p, 20)
  assert.equal(result.favourites[2].kcal, 100)

  const already = favouritesForInstall([usualBreakfastFavourite(), lifewayKefirFavourite(), ...stored], {
    now,
    days: { [dayKey(now, 1)]: { food: [food('Banana', 1, 90)] } },
  })
  assert.equal(already.seeded, false)
  assert.equal(already.rebuilt, false)
  assert.deepEqual(already.favourites.map(item => item.name), [
    'Usual Breakfast', 'Lifeway Strawberry Kefir (1 cup)', 'Tuna', 'Rice',
  ])
})

test('a missing or breakfast-only list is rebuilt from the last 30 days', () => {
  const now = new Date('2026-10-12T15:00:00')
  const recent = dayKey(now, 2)
  const latest = dayKey(now, 0)
  const tooOld = dayKey(now, 30)
  const days = {
    [tooOld]: { food: [food('Ancient bar', 9, 90, '09:00')] },
    [recent]: {
      food: [
        food('Tuna', 10, 50, '12:00'),
        food('Rice', 4, 200, '13:00'),
        food('Tuna', 10, 50, '18:00'),
        {
          name: 'Usual Breakfast',
          p: 30.2,
          kcal: 470,
          time: '08:00',
          source: 'Usual Breakfast',
          components: [{ name: 'Blueberries', p: 0.7, kcal: 57 }],
        },
      ],
    },
    [latest]: { food: [food('Tuna', 22, 110, '12:30')] },
  }
  const syncedFoods = [
    { name: 'Tuna', protein: 22, calories: 110, date: latest.slice(5).replaceAll('_', '-'), time: '12:30' },
    { name: 'Greek yogurt', protein: 15, calories: 90, fat: 0, carbs: 6, fiber: 0, d: latest.slice(5).replaceAll('_', '-'), time: '15:00' },
  ]
  const history = { now, days, syncedFoods }
  const fromSeed = favouritesForInstall([{ name: 'Usual Breakfast', components: [] }], history)
  assert.equal(fromSeed.rebuilt, true)
  assert.equal(fromSeed.seeded, true)
  assert.equal(fromSeed.favourites[0].name, 'Usual Breakfast')
  assert.equal(fromSeed.favourites[0].components.length, 7)
  assert.deepEqual(fromSeed.favourites.slice(1).map(item => item.name), [
    'Lifeway Strawberry Kefir (1 cup)', 'Tuna', 'Greek yogurt', 'Rice',
  ])
  assert.equal(fromSeed.favourites[1].p, 10)
  assert.equal(fromSeed.favourites[1].carbs, 18)
  assert.equal(fromSeed.favourites[2].p, 22)
  assert.equal(fromSeed.favourites[2].kcal, 110)
  assert.equal(fromSeed.favourites.some(item => item.name === 'Ancient bar'), false)
  assert.equal(fromSeed.favourites.filter(item => item.name === 'Usual Breakfast').length, 1)

  const fromEmpty = favouritesForInstall(null, history)
  assert.equal(fromEmpty.rebuilt, true)
  assert.deepEqual(fromEmpty.favourites.map(item => item.name), fromSeed.favourites.map(item => item.name))

  const many = {}
  for (let index = 0; index < 18; index++) {
    many[dayKey(now, 1)] = many[dayKey(now, 1)] || { food: [] }
    many[dayKey(now, 1)].food.push(food(`Food ${String(index).padStart(2, '0')}`, index + 1, 100 + index, `12:${String(index).padStart(2, '0')}`))
  }
  const capped = favouritesForInstall([], { now, days: many })
  assert.equal(capped.rebuilt, true)
  assert.equal(capped.favourites.length, 18)
  assert.equal(capped.favourites[0].name, 'Usual Breakfast')
  assert.equal(capped.favourites[1].name, 'Lifeway Strawberry Kefir (1 cup)')
})

const OLD_USUAL_BREAKFAST_ITEMS = [
  { name: 'Blueberries', amount: '100 g', p: 0.7, kcal: 57, fat: 0.3, carbs: 14.5, fiber: 2.4 },
  { name: 'Raspberries', amount: '100 g', p: 1.2, kcal: 52, fat: 0.7, carbs: 11.9, fiber: 6.5 },
  { name: 'Strawberries', amount: '50 g', p: 0.3, kcal: 16, fat: 0.2, carbs: 3.8, fiber: 1 },
  { name: 'Kodiak Protein oats', amount: '1/2 cup dry', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 },
  { name: 'Chia seeds', amount: '2 tsp', p: 1.3, kcal: 39, fat: 2.5, carbs: 3.4, fiber: 2.8 },
  { name: "Trader Joe's Greek yogurt", amount: '150 g', p: 15, kcal: 90, fat: 0, carbs: 6, fiber: 0 },
  { name: '2% milk', amount: '50 ml', p: 1.7, kcal: 26, fat: 1, carbs: 2.4, fiber: 0 },
]

function oldBreakfastFavourite(components = OLD_USUAL_BREAKFAST_ITEMS) {
  return {
    name: 'Usual Breakfast',
    p: 30.2,
    kcal: 470,
    fat: 8.7,
    carbs: 71,
    fiber: 17.7,
    components,
  }
}

test('an untouched Usual Breakfast seed is replaced; an edit and every other favourite stay', () => {
  const tuna = { name: 'Tuna', p: 20, kcal: 100, fat: 1, carbs: 0, fiber: 0 }
  const kefir = { name: 'Lifeway Strawberry Kefir (1 cup)', p: 11, kcal: 150, fat: 2, carbs: 20, fiber: 0 }
  const old = oldBreakfastFavourite()
  const migrated = favouritesForInstall([old, kefir, tuna])
  assert.equal(migrated.seeded, true)
  assert.equal(migrated.rebuilt, false)
  assert.equal(migrated.favourites[0].p, 30.2)
  assert.equal(migrated.favourites[0].kcal, 464)
  assert.equal(migrated.favourites[0].fat, 9.7)
  assert.equal(migrated.favourites[0].carbs, 66.6)
  assert.equal(migrated.favourites[0].fiber, 16.5)
  const milk = migrated.favourites[0].components.find(item => item.name === 'whole milk')
  assert.equal(milk.amount, '50 ml')
  assert.equal(milk.p, 1.6)
  assert.equal(milk.kcal, 31)
  assert.equal(migrated.favourites[0].components.find(item => item.name === 'Blueberries').amount, '80 g')
  assert.equal(migrated.favourites[0].components.some(item => item.name === '2% milk'), false)
  assert.equal(migrated.favourites[1], kefir)
  assert.equal(migrated.favourites[2], tuna)
  assert.equal(migrated.favourites.length, 3)
  assert.equal(old.kcal, 470)
  assert.equal(old.components.find(item => item.name === '2% milk').amount, '50 ml')

  const shuffled = oldBreakfastFavourite([...OLD_USUAL_BREAKFAST_ITEMS].reverse().map(item => (
    item.name === 'Raspberries' ? { ...item, fiber: 6.5 + 1e-12 } : item
  )))
  const order = favouritesForInstall([{ ...shuffled, name: ' usual breakfast ' }, tuna])
  assert.equal(order.seeded, true)
  assert.equal(order.rebuilt, false)
  assert.equal(order.favourites[0].kcal, 464)
  assert.equal(order.favourites[0].components.find(item => item.name === 'Chia seeds').amount, '10 g')
  assert.equal(order.favourites[2], tuna)

  const edited = oldBreakfastFavourite(OLD_USUAL_BREAKFAST_ITEMS.map(item => (
    item.name === 'Blueberries' ? { ...item, amount: '90 g' } : item
  )))
  const kept = favouritesForInstall([edited, tuna])
  assert.equal(kept.rebuilt, false)
  assert.equal(kept.favourites[0], edited)
  assert.equal(kept.favourites[0].kcal, 470)
  assert.equal(kept.favourites[0].components.find(item => item.name === 'Blueberries').amount, '90 g')
  assert.equal(kept.favourites[2], tuna)

  const macroEdit = oldBreakfastFavourite(OLD_USUAL_BREAKFAST_ITEMS.map(item => (
    item.name === 'Chia seeds' ? { ...item, fiber: 3 } : item
  )))
  const keptMacro = favouritesForInstall([macroEdit, kefir, tuna])
  assert.equal(keptMacro.seeded, false)
  assert.equal(keptMacro.rebuilt, false)
  assert.equal(keptMacro.favourites[0], macroEdit)
  assert.equal(keptMacro.favourites[1], kefir)
  assert.equal(keptMacro.favourites[2], tuna)

  const fresh = usualBreakfastFavourite()
  const alreadyNew = favouritesForInstall([fresh, kefir, tuna])
  assert.equal(alreadyNew.seeded, false)
  assert.equal(alreadyNew.favourites[0], fresh)

  const now = new Date('2026-10-12T15:00:00')
  const logged = {
    name: 'Usual Breakfast',
    p: 30.2,
    kcal: 470,
    time: '08:00',
    source: 'Usual Breakfast',
    components: OLD_USUAL_BREAKFAST_ITEMS.map(item => ({ ...item })),
  }
  const day = dayKey(now, 1)
  const days = { [day]: { food: [logged, food('Chicken', 40, 220)] } }
  const rebuilt = favouritesForInstall([oldBreakfastFavourite()], { now, days })
  assert.equal(rebuilt.rebuilt, true)
  assert.equal(rebuilt.favourites.filter(item => item.name === 'Usual Breakfast').length, 1)
  assert.equal(rebuilt.favourites[0].kcal, 464)
  assert.equal(rebuilt.favourites[0].fiber, 16.5)
  assert.deepEqual(rebuilt.favourites.slice(1).map(item => item.name), [
    'Lifeway Strawberry Kefir (1 cup)', 'Chicken',
  ])
  assert.equal(days[day].food[0], logged)
  assert.equal(logged.kcal, 470)
  assert.equal(logged.components.find(item => item.name === '2% milk').amount, '50 ml')
})

test('Lifeway strawberry kefir stays after breakfast and is not overwritten or rebuilt away', () => {
  const kefir = lifewayKefirFavourite()
  assert.equal(kefir.name, 'Lifeway Strawberry Kefir (1 cup)')
  assert.equal(kefir.p, 10)
  assert.equal(kefir.kcal, 140)
  assert.equal(kefir.fat, 2)
  assert.equal(kefir.carbs, 18)
  assert.equal(kefir.fiber, 0)

  const custom = { name: kefir.name, p: 11, kcal: 150, fat: 2, carbs: 20, fiber: 0 }
  const kept = favouritesForInstall([
    { name: 'Tuna', p: 20, kcal: 100, fat: 1, carbs: 0, fiber: 0 },
    custom,
  ])
  assert.equal(kept.rebuilt, false)
  assert.deepEqual(kept.favourites.map(item => item.name), [
    'Usual Breakfast', 'Lifeway Strawberry Kefir (1 cup)', 'Tuna',
  ])
  assert.equal(kept.favourites[1], custom)
  assert.equal(kept.favourites[2].p, 20)

  const now = new Date('2026-10-12T15:00:00')
  const rebuilt = favouritesForInstall(
    [{ name: 'Usual Breakfast', components: [] }, kefir],
    {
      now,
      days: {
        [dayKey(now, 1)]: {
          food: [
            food('Chicken', 40, 220),
            food('Lifeway Strawberry Kefir (1 cup)', 8, 100, '09:00'),
          ],
        },
      },
    },
  )
  assert.equal(rebuilt.rebuilt, true)
  assert.deepEqual(rebuilt.favourites.map(item => item.name), [
    'Usual Breakfast', 'Lifeway Strawberry Kefir (1 cup)', 'Chicken',
  ])
  assert.equal(rebuilt.favourites[1], kefir)
  assert.equal(rebuilt.favourites.filter(item => item.name === kefir.name).length, 1)
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
