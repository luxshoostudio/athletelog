#!/usr/bin/env node
// Repair a backup written before the 2026-08-26 parser fixes.
//
// Rather than hand-patching the rows that are wrong, every imported exercise
// is re-parsed from its own `raw` line using the current parser — the raw
// text was always preserved, which is what makes this possible. Food protein
// is corrected only where the name resolves to the food database and the
// recorded value disagrees with what the calories imply.
//
//   node tools/repair_backup.mjs <backup.json> [-o out.json]
//
// Writes a new file; the input is never modified.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('-'));
if (!input) { console.error('usage: node tools/repair_backup.mjs <backup.json> [-o out.json]'); process.exit(1); }
const outIdx = args.indexOf('-o');
const output = outIdx >= 0 ? args[outIdx + 1]
  : path.join(path.dirname(input), path.basename(input, '.json') + '-repaired.json');

// ── Borrow the app's own parser and food database ──────────────
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const grab = (a, b) => { const i = src.indexOf(a); return src.slice(i, src.indexOf(b, i)); };
let n = 0;
const uid = () => 'r' + (++n);
const app = new Function('uid', [
  grab('const RUN_EXERCISES_LIST', 'function isRunExercise'),
  grab('const HOLD_EXERCISES_LIST', 'function isHoldExercise'),
  grab('function isRunExercise', 'const HOLD_EXERCISES_LIST'),
  grab('function isHoldExercise', '\n// '),
  grab('const DB = {', '\n// Ways the same food gets typed'),
  grab('const FOOD_ALIASES', '\n// ── Name matching'),
  grab('function singularizeWord', 'function searchFoodDb'),
  grab('function searchFoodDb', '\n// ═'),
  grab('function calcQty', 'function uid()'),
  grab('const GYM_SEPARATORS', 'function gymSessionToKey'),
  // searchFoodDb also consults saved recipes, which a backup file does not
  // carry into this context; stub it so only the database is matched.
  'function loadRecipes() { return []; }',
  'function recipeAsFoodItem() { return null; }',
].join('\n') + '\nreturn {parseExerciseLine, searchFoodDb, calcQty, DB};')(uid);

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const changes = [];

for (const [dayKey, day] of Object.entries(data)) {
  const date = dayKey.slice(5).replace(/_/g, '-');

  // ── Exercises: re-parse from raw ─────────────────────────────
  for (const ex of day.gym?.exercises ?? []) {
    if (!ex.raw) continue;
    const fresh = app.parseExerciseLine(`- [${ex.completed ? 'x' : ' '}] ${ex.raw}`);
    if (!fresh) continue;

    for (const field of ['name', 'sets', 'reps', 'weight', 'unit', 'distance', 'runTime', 'feeling', 'run', 'hold']) {
      const before = ex[field];
      const after = fresh[field];
      const bothEmpty = (before === undefined || before === null || before === '' || before === false)
                     && (after === undefined || after === null || after === '' || after === false);
      if (bothEmpty || before === after) continue;
      changes.push({ date, what: `${ex.name} · ${field}`, from: before ?? '—', to: after ?? '—' });
      if (after === undefined) delete ex[field]; else ex[field] = after;
    }
  }

  // ── Malformed run times typed by hand: 1:1348 → 1:13:48 ──────
  for (const ex of day.gym?.exercises ?? []) {
    const t = ex.runTime;
    if (typeof t === 'string' && /^\d+:\d{4}$/.test(t)) {
      const fixed = t.replace(/^(\d+):(\d{2})(\d{2})$/, '$1:$2:$3');
      changes.push({ date, what: `${ex.name} · runTime`, from: t, to: fixed });
      ex.runTime = fixed;
    }
  }

  // ── Food protein the photo estimator inflated ────────────────
  for (const f of day.food ?? []) {
    if (!f.kcal) continue;
    // "Product · Brand" comes from a barcode: it carries the manufacturer's
    // own label, which beats a generic database row. Overwriting those made
    // things worse — a Safe Catch tuna went 24 g → 64 g, and a Trader Joe's
    // kefir matched "strawberries" and came out as 544 g of fruit.
    if (String(f.name).includes(' · ')) continue;
    const bare = String(f.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const match = app.searchFoodDb(bare, 1)[0];
    // 85 missed the worst offenders ("Cooked Rice" scored below it). The
    // disagreement test below is the real filter, so this only has to be
    // confident the name is the same food.
    if (!match || match.score < 65) continue;
    const ref = match.item;
    if (!(ref.unit === 'g' || ref.unit === 'ml') || !ref.kcal) continue;

    const grams = (f.kcal / ref.kcal) * 100;          // portion the calories imply
    if (grams <= 0 || grams > 2000) continue;
    const expect = app.calcQty(ref, grams);
    // Only touch entries that clearly disagree, and only when the gap is
    // worth correcting. Sub-gram differences on celery are noise, not error.
    const gap = Math.abs(f.p - expect.p);
    if (gap < 2 || gap / Math.max(expect.p, 0.5) <= 0.6) continue;

    changes.push({ date, what: `${f.name} · protein`, from: f.p, to: expect.p,
                   note: `${f.kcal} kcal ≈ ${Math.round(grams)} g ${match.key}` });
    f.p = expect.p;
    if (f.fat === 0 || f.fat === undefined) f.fat = expect.fat;
    if (!f.fiber) f.fiber = expect.fiber;
  }

  // ── Dead field from the removed Strava integration ───────────
  if ('stravaKcal' in day) { delete day.stravaKcal; changes.push({ date, what: 'stravaKcal', from: 'removed field', to: '—' }); }
}

fs.writeFileSync(output, JSON.stringify(data, null, 2));

console.log(`${changes.length} changes\n`);
for (const c of changes) {
  console.log(`  ${c.date}  ${c.what}`);
  console.log(`      ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}${c.note ? `   (${c.note})` : ''}`);
}
console.log(`\nwritten: ${output}`);
