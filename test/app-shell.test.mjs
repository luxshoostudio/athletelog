import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

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
  assert.match(html, /alog_usual_breakfast/)
  assert.match(html, /nutritionTargets\.calories \(1300\) is not used/)
})
