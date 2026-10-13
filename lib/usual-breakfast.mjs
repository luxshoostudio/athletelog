// Usual Breakfast is one favourite in the star menu: seven items logged as
// a single entry. A logged bundle (source "Usual Breakfast", or any row that
// already has components) is not an ingredient: counting it again doubled a
// 419 kcal breakfast to 838.

export const USUAL_BREAKFAST_KEY = 'alog_usual_breakfast'
export const FAVOURITES_KEY = 'alog_favourites'
export const LIFEWAY_KEFIR_NAME = 'Lifeway Strawberry Kefir (1 cup)'

// Lifeway lowfat strawberry kefir, current label, 1 cup (240 ml / 8 fl oz):
// 140 kcal, 2 g fat, 18 g carb, 0 g fiber, 10 g protein.
// https://lifewaykefir.com/products/strawberry-lowfat-kefir/
// An older sell sheet listed 20 g carb; the product page and 2023 sheet say 18 g.
export function lifewayKefirFavourite() {
  return {
    name: LIFEWAY_KEFIR_NAME,
    p: 10,
    kcal: 140,
    fat: 2,
    carbs: 18,
    fiber: 0,
  }
}

// Protein, kcal, and fiber are the household amounts. Fat and carbs for the
// whole foods are USDA FoodData Central, rounded to 1 decimal:
// blueberries 80 g, 0.8 × 0.33 g fat and 14.49 g carb (FDC 171711);
// raspberries 80 g, 0.8 × 0.65 g fat and 11.94 g carb (FDC 167755);
// strawberries 50 g, half of 0.3 g fat and 7.68 g carb (FDC 167762);
// chia seeds 10 g, 0.1 × 30.74 g fat and 42.12 g carb (FDC 170554);
// whole milk 50 ml counted as 50 g, half of 3.25 g fat and 4.80 g carb (NDB 01077).
// Kodiak Protein oats and Trader Joe's Greek yogurt are the package values.
const USUAL_BREAKFAST_SEED = {
  name: 'Usual Breakfast',
  items: [
    { name: 'Blueberries', amount: '80 g', p: 0.6, kcal: 46, fat: 0.3, carbs: 11.6, fiber: 1.9 },
    { name: 'Raspberries', amount: '80 g', p: 1, kcal: 42, fat: 0.5, carbs: 9.6, fiber: 5.2 },
    { name: 'Strawberries', amount: '50 g', p: 0.3, kcal: 16, fat: 0.2, carbs: 3.8, fiber: 1 },
    { name: 'Kodiak Protein oats', amount: '1/2 cup dry', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 },
    { name: 'Chia seeds', amount: '10 g', p: 1.7, kcal: 49, fat: 3.1, carbs: 4.2, fiber: 3.4 },
    { name: "Trader Joe's Greek yogurt", amount: '150 g', p: 15, kcal: 90, fat: 0, carbs: 6, fiber: 0 },
    { name: 'whole milk', amount: '50 ml', p: 1.6, kcal: 31, fat: 1.6, carbs: 2.4, fiber: 0 },
  ],
}

// The favourite written before these amounts. An install that still has this
// exact list is updated. Any other Usual Breakfast is one she edited.
const OLD_USUAL_BREAKFAST_ITEMS = [
  { name: 'Blueberries', amount: '100 g', p: 0.7, kcal: 57, fat: 0.3, carbs: 14.5, fiber: 2.4 },
  { name: 'Raspberries', amount: '100 g', p: 1.2, kcal: 52, fat: 0.7, carbs: 11.9, fiber: 6.5 },
  { name: 'Strawberries', amount: '50 g', p: 0.3, kcal: 16, fat: 0.2, carbs: 3.8, fiber: 1 },
  { name: 'Kodiak Protein oats', amount: '1/2 cup dry', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 },
  { name: 'Chia seeds', amount: '2 tsp', p: 1.3, kcal: 39, fat: 2.5, carbs: 3.4, fiber: 2.8 },
  { name: "Trader Joe's Greek yogurt", amount: '150 g', p: 15, kcal: 90, fat: 0, carbs: 6, fiber: 0 },
  { name: '2% milk', amount: '50 ml', p: 1.7, kcal: 26, fat: 1, carbs: 2.4, fiber: 0 },
]

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

function isKefirName(name) {
  return String(name || '').trim().toLocaleLowerCase() === LIFEWAY_KEFIR_NAME.toLocaleLowerCase()
}

function isPinnedName(name) {
  return isUsualBreakfastName(name) || isKefirName(name)
}

function breakfastSignature(item) {
  return [
    String(item?.name || '').trim().toLocaleLowerCase(),
    String(item?.amount || '').trim(),
    roundMacro(item?.p),
    roundMacro(item?.kcal),
    roundMacro(item?.fat),
    roundMacro(item?.carbs),
    roundMacro(item?.fiber),
  ].join('|')
}

function sameBreakfastItems(components, seedItems) {
  const list = Array.isArray(components) ? components : []
  if (list.length !== seedItems.length) return false
  const have = list.map(breakfastSignature).sort()
  const want = seedItems.map(breakfastSignature).sort()
  return have.every((value, index) => value === want[index])
}

// Replace only an untouched copy of the previous seed. Edited components,
// and every other favourite, stay as they were stored.
function migrateBreakfastList(list) {
  let changed = false
  const next = list.map(item => {
    if (!isUsualBreakfastName(item?.name) || !sameBreakfastItems(item.components, OLD_USUAL_BREAKFAST_ITEMS)) return item
    changed = true
    return usualBreakfastFavourite()
  })
  return changed ? next : list
}

const DAY_KEY = /^alog_(\d{4})_(\d{2})_(\d{2})$/
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/

function localDayKey(date) {
  return `alog_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}`
}

function asDayKey(value) {
  const raw = String(value || '')
  if (DAY_KEY.test(raw)) return raw
  const iso = raw.match(ISO_DAY)
  if (iso) return `alog_${iso[1]}_${iso[2]}_${iso[3]}`
  return ''
}

function macrosOf(entry) {
  return {
    p: roundMacro(entry?.p ?? entry?.protein),
    kcal: roundMacro(entry?.kcal ?? entry?.calories),
    fat: roundMacro(entry?.fat),
    carbs: roundMacro(entry?.carbs),
    fiber: roundMacro(entry?.fiber),
  }
}

// Foods from the last 30 days. A meal that is both on the device and in the
// synced profile is counted once. Usual Breakfast bundles are not ingredients.
export function foodsFromHistory({ days, syncedFoods, now = Date.now() } = {}) {
  const today = new Date(now)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
  const first = localDayKey(start)
  const last = localDayKey(today)
  const rows = []
  const seen = new Set()
  const push = (dayKey, entry) => {
    const key = asDayKey(dayKey)
    if (!key || key < first || key > last) return
    const name = String(entry?.name || '').trim()
    if (!name || isPinnedName(name) || isBreakfastBundle(entry)) return
    const macros = macrosOf(entry)
    const dedupe = `${key}|${name.toLocaleLowerCase()}|${entry?.time || ''}|${macros.kcal}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    rows.push({ name, key, ...macros })
  }
  for (const [key, day] of Object.entries(days && typeof days === 'object' ? days : {})) {
    for (const entry of day?.food || []) push(key, entry)
  }
  for (const entry of Array.isArray(syncedFoods) ? syncedFoods : []) {
    push(entry?.date || entry?.d, entry)
  }
  return rows
}

// The most frequent foods, most recent macros, capped at 16.
export function frequentFavourites(rows, { limit = 16 } = {}) {
  const byName = new Map()
  for (const row of rows) {
    const id = row.name.toLocaleLowerCase()
    const current = byName.get(id) || { name: row.name, count: 0, key: '', p: 0, kcal: 0, fat: 0, carbs: 0, fiber: 0 }
    current.count += 1
    if (row.key >= current.key) {
      current.key = row.key
      current.name = row.name
      current.p = row.p
      current.kcal = row.kcal
      current.fat = row.fat
      current.carbs = row.carbs
      current.fiber = row.fiber
    }
    byName.set(id, current)
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count || b.key.localeCompare(a.key) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, p, kcal, fat, carbs, fiber }) => ({ name, p, kcal, fat, carbs, fiber }))
}

function savedFavourites(list) {
  return list.filter(item => !isPinnedName(item.name))
}

// Usual Breakfast, then the kefir cup, then everything she already saved.
// An existing kefir row keeps its own macros. The same list comes back when
// both pins are already in place, so a later launch does not rewrite storage.
function placePinned(list) {
  const breakfastCurrent = list.find(item => isUsualBreakfastName(item.name))
  const breakfast = breakfastCurrent && Array.isArray(breakfastCurrent.components) && breakfastCurrent.components.length
    ? breakfastCurrent
    : usualBreakfastFavourite()
  const kefir = list.find(item => isKefirName(item.name)) || lifewayKefirFavourite()
  const rest = list.filter(item => !isPinnedName(item.name))
  const next = [breakfast, kefir, ...rest]
  if (next.length === list.length && next.every((item, index) => item === list[index])) return list
  return next
}

// A list that already has her foods is kept. Usual Breakfast and the kefir
// cup are inserted when missing, and neither one counts as her list. An empty
// list, or one that is only those pins, is rebuilt from the last 30 days.
export function favouritesForInstall(stored, history) {
  const raw = (Array.isArray(stored) ? stored : []).filter(item => item && String(item.name || '').trim())
  const list = migrateBreakfastList(raw)
  const migrated = list !== raw
  if (savedFavourites(list).length) {
    const next = placePinned(list)
    return { favourites: next, seeded: migrated || next !== raw, rebuilt: false }
  }
  const rebuilt = frequentFavourites(foodsFromHistory(history || {}))
  if (rebuilt.length) {
    const next = placePinned([...list, ...rebuilt])
    return { favourites: next, seeded: true, rebuilt: true }
  }
  const next = placePinned(list)
  return { favourites: next, seeded: migrated || next !== raw || !raw.length, rebuilt: false }
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
