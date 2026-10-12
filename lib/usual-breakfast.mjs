// Usual Breakfast is one favourite in the star menu: seven items logged as
// a single entry. A logged bundle (source "Usual Breakfast", or any row that
// already has components) is not an ingredient: counting it again doubled a
// 419 kcal breakfast to 838.

export const USUAL_BREAKFAST_KEY = 'alog_usual_breakfast'
export const FAVOURITES_KEY = 'alog_favourites'

// Protein, kcal, and fiber are the household amounts. Fat and carbs for the
// whole foods are USDA FoodData Central, rounded to 1 decimal:
// blueberries 100 g, 0.33 g fat and 14.49 g carb (FDC 171711);
// raspberries 100 g, 0.65 g fat and 11.94 g carb (FDC 167755);
// strawberries 50 g, half of 0.3 g fat and 7.68 g carb (FDC 167762);
// chia seeds 8 g (2 tsp; 1 tbsp is 12 g), from 30.74 g fat and 42.12 g carb per 100 g (FDC 170554);
// 2% milk 50 g, half of 1.98 g fat and 4.8 g carb (FDC 171267).
// Kodiak Protein oats and Trader Joe's Greek yogurt are the package values.
const USUAL_BREAKFAST_SEED = {
  name: 'Usual Breakfast',
  items: [
    { name: 'Blueberries', amount: '100 g', p: 0.7, kcal: 57, fat: 0.3, carbs: 14.5, fiber: 2.4 },
    { name: 'Raspberries', amount: '100 g', p: 1.2, kcal: 52, fat: 0.7, carbs: 11.9, fiber: 6.5 },
    { name: 'Strawberries', amount: '50 g', p: 0.3, kcal: 16, fat: 0.2, carbs: 3.8, fiber: 1 },
    { name: 'Kodiak Protein oats', amount: '1/2 cup dry', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 },
    { name: 'Chia seeds', amount: '2 tsp', p: 1.3, kcal: 39, fat: 2.5, carbs: 3.4, fiber: 2.8 },
    { name: "Trader Joe's Greek yogurt", amount: '150 g', p: 15, kcal: 90, fat: 0, carbs: 6, fiber: 0 },
    { name: '2% milk', amount: '50 ml', p: 1.7, kcal: 26, fat: 1, carbs: 2.4, fiber: 0 },
  ],
}

const PINNED_BREAKFAST_FOODS = new Set(['chia seeds'])

export function roundMacro(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

export function formatMacro(value) {
  const n = roundMacro(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function sumMacros(food) {
  const totals = (Array.isArray(food) ? food : []).reduce((acc, item) => ({
    p: acc.p + (Number(item?.p) || 0),
    kcal: acc.kcal + (Number(item?.kcal) || 0),
    fat: acc.fat + (Number(item?.fat) || 0),
    carbs: acc.carbs + (Number(item?.carbs) || 0),
    fiber: acc.fiber + (Number(item?.fiber) || 0),
  }), { p: 0, kcal: 0, fat: 0, carbs: 0, fiber: 0 })
  return {
    p: roundMacro(totals.p),
    kcal: roundMacro(totals.kcal),
    fat: roundMacro(totals.fat),
    carbs: roundMacro(totals.carbs),
    fiber: roundMacro(totals.fiber),
  }
}

export function makeEntry(name, macros = {}, time = '12:00', id = '') {
  const stamp = /^\d\d:\d\d$/.test(time) ? time : '12:00'
  const [h, m] = stamp.split(':').map(Number)
  return {
    id,
    name,
    p: roundMacro(macros.p),
    kcal: roundMacro(macros.kcal),
    fat: roundMacro(macros.fat),
    carbs: roundMacro(macros.carbs),
    fiber: roundMacro(macros.fiber),
    time: stamp,
    ts: h * 60 + m,
  }
}

export function normalizeUsualBreakfast(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .map(item => ({
      name: String(item?.name || '').trim(),
      amount: String(item?.amount || '').trim(),
      p: roundMacro(item?.p),
      kcal: roundMacro(item?.kcal),
      fat: roundMacro(item?.fat),
      carbs: roundMacro(item?.carbs),
      fiber: roundMacro(item?.fiber),
    }))
    .filter(item => item.name)
  const recipe = { name: 'Usual Breakfast', items }
  if (raw?.customized === true) recipe.customized = true
  return recipe
}

export function seedUsualBreakfast() {
  return normalizeUsualBreakfast(USUAL_BREAKFAST_SEED)
}

// Existing installs often have no key, or an empty value written before the
// recipe existed. A recipe the user saved on purpose (including an empty one
// that should fall back to recent mornings) is left alone.
export function recipeForInstall(stored) {
  const recipe = normalizeUsualBreakfast(stored)
  if (recipe.items.length || stored?.customized === true) return { recipe, seeded: false }
  return { recipe: seedUsualBreakfast(), seeded: true }
}

export function usualBreakfastFavourite() {
  const recipe = seedUsualBreakfast()
  const totals = sumMacros(recipe.items)
  return {
    name: 'Usual Breakfast',
    p: totals.p,
    kcal: totals.kcal,
    fat: totals.fat,
    carbs: totals.carbs,
    fiber: totals.fiber,
    components: recipe.items,
  }
}

function isUsualBreakfastName(name) {
  return String(name || '').trim().toLocaleLowerCase() === 'usual breakfast'
}

// Existing installs get the favourite when it is missing, or when a previous
// copy has the name but no items. A favourite that already has components
// is left as she saved it.
export function favouritesForInstall(stored) {
  const list = (Array.isArray(stored) ? stored : []).filter(item => item && String(item.name || '').trim())
  const current = list.find(item => isUsualBreakfastName(item.name))
  if (current && Array.isArray(current.components) && current.components.length) {
    return { favourites: list, seeded: false }
  }
  const rest = list.filter(item => !isUsualBreakfastName(item.name))
  return { favourites: [usualBreakfastFavourite(), ...rest], seeded: true }
}

export function breakfastItems(saved, learned) {
  const recipe = normalizeUsualBreakfast(saved)
  if (recipe.items.length) return recipe.items
  return (Array.isArray(learned) ? learned : []).map(item => ({
    name: String(item?.name || '').trim(),
    amount: String(item?.amount || '').trim(),
    p: roundMacro(item?.p),
    kcal: roundMacro(item?.kcal),
    fat: roundMacro(item?.fat),
    carbs: roundMacro(item?.carbs),
    fiber: roundMacro(item?.fiber),
  })).filter(item => item.name)
}

export function isBreakfastBundle(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (entry.source === 'Usual Breakfast') return true
  return Array.isArray(entry.components) && entry.components.length > 0
}

function morningMinutes(entry) {
  if (Number.isFinite(+entry?.ts)) return +entry.ts
  return String(entry?.time || '').split(':').reduce((total, part, index) => total + (+part || 0) * (index ? 1 : 60), 0)
}

// Same 3-week, 35% rule as the page used to inline. Bundles are skipped
// before they can become one more ingredient.
export function learnUsualBreakfast(records) {
  const recent = (Array.isArray(records) ? records : [])
    .slice()
    .sort((a, b) => String(b?.key || '').localeCompare(String(a?.key || '')))
    .slice(0, 21)
  const mornings = recent.map(record => ({
    key: record?.key || '',
    food: (record?.food || []).filter(entry => {
      const minutes = morningMinutes(entry)
      return minutes > 0 && minutes < 12 * 60 && !isBreakfastBundle(entry)
    }),
  })).filter(record => record.food.length)
  const threshold = Math.max(3, Math.ceil(mornings.length * 0.35))
  const items = new Map()

  for (const morning of mornings) {
    const seen = new Set()
    for (const entry of morning.food) {
      const id = String(entry.name || '').trim().toLocaleLowerCase()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const current = items.get(id) || { count: 0, key: '', entry: null }
      current.count += 1
      if (morning.key >= current.key) { current.key = morning.key; current.entry = entry }
      items.set(id, current)
    }
  }

  const ranked = [...items.entries()]
    .filter(([, item]) => item.entry)
    .sort(([, a], [, b]) => b.count - a.count || b.key.localeCompare(a.key))
  const pinned = ranked.filter(([id]) => PINNED_BREAKFAST_FOODS.has(id))
  const learned = ranked
    .filter(([id, item]) => !PINNED_BREAKFAST_FOODS.has(id) && item.count >= threshold)
    .slice(0, Math.max(0, 6 - pinned.length))

  return [...learned, ...pinned]
    .slice(0, 6)
    .map(([, item]) => item)
    .map(item => ({
      name: item.entry.name,
      p: roundMacro(item.entry.p),
      kcal: roundMacro(item.entry.kcal),
      fat: roundMacro(item.entry.fat),
      carbs: roundMacro(item.entry.carbs),
      fiber: roundMacro(item.entry.fiber),
      count: item.count,
    }))
}
