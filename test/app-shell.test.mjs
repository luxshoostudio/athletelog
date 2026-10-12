import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seedUsualBreakfast } from '../lib/usual-breakfast.mjs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8')

test('the header goal labels are rendered from GOALS and the two cards have distinct names', () => {
  assert.match(html, /const GOALS = \{ protein: 140, fat: 70, carbs: 220, fiber: 30 \}/)
  assert.match(html, /id="header-protein-goal"/)
  assert.match(html, /id="header-fiber-goal"/)
  assert.match(html, /proteinGoal\.textContent = ` \/ \$\{GOALS\.protein\} g`/)
  assert.match(html, /fiberGoal\.textContent = ` \/ \$\{GOALS\.fiber\} g`/)
  assert.doesNotMatch(html, /\/ 140 g/)
  assert.doesNotMatch(html, /\/ 30 g/)
  assert.match(html, /Today at a glance/)
  assert.match(html, /Today's workout/)
  assert.doesNotMatch(html, /Today's [Pp]lan/)
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
})
