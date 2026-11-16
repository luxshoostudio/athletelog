import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeBackupData } from '../lib/gist-backup.mjs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}(`)
  const fallback = start >= 0 ? start : source.indexOf(`function ${name}(`)
  assert.ok(fallback >= 0, `missing function ${name}`)
  let depth = 0
  let started = false
  for (let i = source.indexOf('{', fallback); i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') { depth++; started = true }
    else if (ch === '}') {
      depth--
      if (started && depth === 0) return source.slice(fallback, i + 1)
    }
  }
  throw new Error(`unterminated function ${name}`)
}

test('cloud backup merges a newer Gist instead of replacing it', () => {
  const local = {
    alog_favourites: [{ name: 'Protein Shake', p: 30, kcal: 160 }],
    alog_2026_11_09: { food: [{ id: 'eggs', name: 'eggs', kcal: 140 }], period: false, gym: { session: '', exercises: [] }, waterMl: 0 },
    alog_2026_11_10: { food: [{ id: 'oats', name: 'oats', kcal: 100 }], period: false, gym: { session: '', exercises: [] }, waterMl: 250 },
  }
  const remote = {
    exportedAt: '2026-11-16T18:00:00.000Z',
    data: {
      alog_favourites: [
        { name: 'Protein Shake', p: 24, kcal: 140 },
        {
          name: 'Green Drink',
          p: 8,
          kcal: 120,
          components: [{ name: 'Spinach', p: 2, kcal: 20 }, { name: 'Apple', p: 0, kcal: 80 }],
        },
      ],
      alog_2026_11_10: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
      alog_2026_11_11: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
      alog_2026_11_12: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
      alog_2026_11_13: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
      alog_2026_11_14: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
      alog_2026_11_15: { food: [], period: true, gym: { session: '', exercises: [] }, waterMl: 0 },
    },
  }

  const merged = mergeBackupData(local, remote)
  const names = merged.data.alog_favourites.map(item => item.name)
  assert.deepEqual(names, ['Protein Shake', 'Green Drink'])
  assert.equal(merged.data.alog_favourites[0].kcal, 160)
  assert.deepEqual(merged.data.alog_favourites[1].components.map(item => item.name), ['Spinach', 'Apple'])
  assert.equal(merged.data.alog_2026_11_09.food[0].name, 'eggs')
  assert.equal(merged.data.alog_2026_11_10.food[0].name, 'oats')
  assert.equal(merged.data.alog_2026_11_10.period, true)
  assert.equal(merged.data.alog_2026_11_10.waterMl, 250)
  for (const day of ['11', '12', '13', '14', '15']) {
    assert.equal(merged.data[`alog_2026_11_${day}`].period, true)
  }
  assert.deepEqual(merged.adopted.map(item => item.name || item.iso), [
    'Green Drink',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
    '2026-11-14',
    '2026-11-15',
  ])
})

test('a failed Gist read never reaches the write, and the read happens first', () => {
  const sync = extractFunction(html, 'syncToGist')
  const readAt = sync.indexOf('readBackupGist')
  const mergeAt = sync.indexOf('mergeBackupData')
  const writeAt = sync.indexOf("method = 'PATCH'")
  assert.ok(readAt >= 0 && mergeAt > readAt && writeAt > mergeAt)
  assert.match(sync, /Could not read the current Gist/)
  assert.match(sync, /left unchanged/)
  assert.match(html, /const BACKUP_EXTRA_KEYS = \['alog_favourites', 'alog_usual_breakfast', 'alog_cycles'\]/)
})
