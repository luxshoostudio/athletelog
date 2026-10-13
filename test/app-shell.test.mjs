import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seedUsualBreakfast } from '../lib/usual-breakfast.mjs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
const boot = readFileSync(new URL('../lib/next-sync-boot.js', import.meta.url), 'utf8')

test('the header goal labels are rendered from GOALS and the Food tab has no glance card', () => {
  assert.match(html, /const GOALS = \{ protein: 140, fat: 70, carbs: 220, fiber: 30 \}/)
  assert.match(html, /id="header-protein-goal"/)
  assert.match(html, /id="header-fiber-goal"/)
  assert.match(html, /proteinGoal\.textContent = ` \/ \$\{GOALS\.protein\} g`/)
  assert.match(html, /fiberGoal\.textContent = ` \/ \$\{GOALS\.fiber\} g`/)
  assert.doesNotMatch(html, /\/ 140 g/)
  assert.doesNotMatch(html, /\/ 30 g/)
  assert.doesNotMatch(html, /id="today-plan-card"/)
  assert.doesNotMatch(html, /Today at a glance/)
  assert.doesNotMatch(html, /id="plan-panel"/)
  assert.doesNotMatch(html, /id="plan-days"/)
  assert.doesNotMatch(html, /data-tab="plan"/)
  assert.match(html, /data-tab="food"/)
  assert.match(html, /data-tab="gym"/)
  assert.match(html, /data-tab="log"/)
  assert.match(html, /function readWeekPlan/)
  assert.match(html, /Lifeway Strawberry Kefir \(1 cup\)/)
  assert.match(html, /Today's workout/)
  assert.doesNotMatch(html, /Today's [Pp]lan/)
  assert.match(html, /getDate\(\) - 29/)
  assert.match(html, /function targetsFromPlan/)
  assert.match(html, /const fromPlan = targetsFromPlan\(plan\)/)
  assert.match(html, /function applySyncedGoals/)
  assert.match(html, /function preloadTodayWorkout/)
  assert.match(html, /alog_favourites/)
  assert.match(html, /nutritionTargets\.calories \(1300\) is not used/)
  assert.match(html, /header-date'\)\.textContent = d\.toLocaleDateString\('en-GB'/)
})

test('startup does not wait on the module, and Usual Breakfast is a star favourite', () => {
  assert.doesNotMatch(html, /if \(!window\.AthleteLogPlan \|\| !window\.AthleteLogBreakfast\) return/)
  assert.match(html, /function startApp\(\) \{\s*if \(!window\.__alogAppStarted\) \{\s*window\.__alogAppStarted = true;\s*init\(\);/)
  assert.match(html, /ensureFavourites\(\)/)
  assert.match(html, /alog_week_plan/)
  assert.match(html, /id="home-quick-select"/)
  assert.match(html, /function addFavouriteFood\(fav, fromHome\)/)
  assert.match(html, /favouriteByName\(chip\)/)
  assert.doesNotMatch(html, /id="breakfast-modal"/)
  assert.doesNotMatch(html, /id="add-usual-breakfast"/)
  assert.doesNotMatch(html, /id="edit-usual-breakfast"/)
  assert.doesNotMatch(html, /Edit usual breakfast/)
  const fallback = html.match(/const USUAL_BREAKFAST_FALLBACK = (\{[\s\S]*?\n\});/)
  assert.ok(fallback, 'page keeps a breakfast seed for installs whose module has not loaded')
  assert.deepEqual(Function(`return (${fallback[1]})`)(), seedUsualBreakfast())
  assert.match(sw, /usual-breakfast\.mjs/)
  assert.match(sw, /athletelog-v42/)
  assert.match(sw, /network for lib scripts/)
  assert.match(boot, /window\.AthleteLogPlan = WeekPlan/)
  assert.match(boot, /alog_week_plan|PLAN_STORAGE_KEY/)
  assert.doesNotMatch(boot, /plan-panel/)
  assert.match(boot, /renderHeader/)
  assert.match(html, /function isOldUsualBreakfast/)
  assert.match(html, /!isOldUsualBreakfast\(breakfastCurrent\)/)
})

test('the page replaces a stored Usual Breakfast that still matches the old seed', () => {
  const start = html.indexOf('const USUAL_BREAKFAST_FALLBACK')
  const end = html.indexOf('function saveFavourites')
  const sumStart = html.indexOf('function sumMacros(food)')
  const sumEnd = html.indexOf('function renderHeader()')
  assert.ok(start > 0 && end > start && sumStart > end && sumEnd > sumStart)
  const page = new Function('window', `${html.slice(start, end)}\n${html.slice(sumStart, sumEnd)}\nreturn pinPageFavourites;`)
  const pinPageFavourites = page({ AthleteLogBreakfast: null })
  const old = {
    name: 'Usual Breakfast',
    p: 30.2, kcal: 470, fat: 8.7, carbs: 71, fiber: 17.7,
    components: [
      { name: 'Blueberries', amount: '100 g', p: 0.7, kcal: 57, fat: 0.3, carbs: 14.5, fiber: 2.4 },
      { name: 'Raspberries', amount: '100 g', p: 1.2, kcal: 52, fat: 0.7, carbs: 11.9, fiber: 6.5 },
      { name: 'Strawberries', amount: '50 g', p: 0.3, kcal: 16, fat: 0.2, carbs: 3.8, fiber: 1 },
      { name: 'Kodiak Protein oats', amount: '1/2 cup dry', p: 10, kcal: 190, fat: 4, carbs: 29, fiber: 5 },
      { name: 'Chia seeds', amount: '2 tsp', p: 1.3, kcal: 39, fat: 2.5, carbs: 3.4, fiber: 2.8 },
      { name: "Trader Joe's Greek yogurt", amount: '150 g', p: 15, kcal: 90, fat: 0, carbs: 6, fiber: 0 },
      { name: '2% milk', amount: '50 ml', p: 1.7, kcal: 26, fat: 1, carbs: 2.4, fiber: 0 },
    ],
  }
  const tuna = { name: 'Tuna', p: 20, kcal: 100 }
  const migrated = pinPageFavourites([old, tuna])
  assert.equal(migrated[0].kcal, 464)
  assert.equal(migrated[0].fiber, 16.5)
  assert.equal(migrated[0].components.find(item => item.name === 'whole milk').p, 1.6)
  assert.equal(migrated[1].name, 'Lifeway Strawberry Kefir (1 cup)')
  assert.equal(migrated[2], tuna)
  assert.equal(old.components.find(item => item.name === '2% milk').name, '2% milk')

  const edited = {
    ...old,
    components: old.components.map(item => item.name === 'Blueberries' ? { ...item, amount: '90 g' } : item),
  }
  const kept = pinPageFavourites([edited, tuna])
  assert.equal(kept[0], edited)
  assert.equal(kept[2], tuna)
})
