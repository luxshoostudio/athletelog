// Cloud Backup used to PATCH the whole file from this phone. A Gist edited
// elsewhere — a period typed straight into the backup, a favourite the phone
// has never seen — was replaced. Merge keeps both sides. A day or favourite
// that exists on only one side is kept. The same favourite keeps the phone's
// copy, unless the Gist has the composite version and the phone does not.

export const BACKUP_EXTRA_KEYS = ['alog_favourites', 'alog_usual_breakfast', 'alog_cycles']
const DAY_KEY = /^alog_\d{4}_\d{2}_\d{2}$/

export function isBackupKey(key) {
  return DAY_KEY.test(key) || BACKUP_EXTRA_KEYS.includes(key)
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function payloadData(file) {
  if (!file || typeof file !== 'object') return {}
  if (file.data && typeof file.data === 'object' && !Array.isArray(file.data)) return file.data
  return file
}

function favouriteName(item) {
  return String(item?.name || '').trim().toLocaleLowerCase()
}

function hasComponents(item) {
  return Array.isArray(item?.components) && item.components.length > 0
}

export function mergeFavourites(local, remote) {
  const localList = Array.isArray(local) ? local.filter(item => favouriteName(item)) : []
  const remoteList = Array.isArray(remote) ? remote.filter(item => favouriteName(item)) : []
  const chosen = new Map()
  const added = []
  for (const item of localList) chosen.set(favouriteName(item), item)
  for (const item of remoteList) {
    const name = favouriteName(item)
    const current = chosen.get(name)
    if (!current) {
      chosen.set(name, item)
      added.push(item.name)
      continue
    }
    if (hasComponents(item) && !hasComponents(current)) chosen.set(name, item)
  }
  const list = []
  const seen = new Set()
  for (const item of [...localList, ...remoteList]) {
    const name = favouriteName(item)
    if (seen.has(name)) continue
    seen.add(name)
    list.push(clone(chosen.get(name)))
  }
  return { list, added }
}

function rowKey(item) {
  if (!item || typeof item !== 'object') return ''
  if (item.id) return `id:${item.id}`
  return [
    'row',
    String(item.name || '').trim().toLocaleLowerCase(),
    item.time || '',
    item.kcal ?? '',
    item.sets || '',
    item.reps || '',
    item.weight || '',
  ].join('|')
}

function unionLists(localList, remoteList) {
  const out = []
  const seen = new Set()
  for (const item of [...(localList || []), ...(remoteList || [])]) {
    const key = rowKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(clone(item))
  }
  return out
}

export function mergeDay(local, remote) {
  if (!local) return clone(remote)
  if (!remote) return clone(local)
  const localGym = local.gym && typeof local.gym === 'object' ? local.gym : {}
  const remoteGym = remote.gym && typeof remote.gym === 'object' ? remote.gym : {}
  return {
    ...clone(remote),
    ...clone(local),
    food: unionLists(local.food, remote.food),
    gym: {
      ...clone(remoteGym),
      ...clone(localGym),
      session: localGym.session || remoteGym.session || '',
      exercises: unionLists(localGym.exercises, remoteGym.exercises),
    },
    period: !!(local.period || remote.period),
    waterMl: Math.max(Number(local.waterMl) || 0, Number(remote.waterMl) || 0),
    water: Math.max(Number(local.water) || 0, Number(remote.water) || 0),
  }
}

function dayIso(key) {
  return key.slice(5).replaceAll('_', '-')
}

function mergeCycles(local, remote) {
  const episodes = []
  for (const source of [local, remote]) {
    const list = Array.isArray(source?.episodes) ? source.episodes : []
    for (const episode of list) episodes.push(episode)
  }
  return { version: 1, episodes }
}

export function mergeBackupData(localData, remoteFile) {
  const local = localData && typeof localData === 'object' ? localData : {}
  const remote = payloadData(remoteFile)
  const data = {}
  const adopted = []
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)].filter(isBackupKey))
  for (const key of [...keys].sort()) {
    if (DAY_KEY.test(key)) {
      data[key] = mergeDay(local[key], remote[key])
      const remotePeriod = !!remote[key]?.period
      const localPeriod = !!local[key]?.period
      if (remotePeriod && !localPeriod) adopted.push({ kind: 'period', iso: dayIso(key), key })
      else if (remote[key] && !local[key]) adopted.push({ kind: 'day', iso: dayIso(key), key })
      continue
    }
    if (key === 'alog_favourites') {
      const merged = mergeFavourites(local[key], remote[key])
      data[key] = merged.list
      for (const name of merged.added) adopted.push({ kind: 'favourite', name })
      continue
    }
    if (key === 'alog_cycles') {
      data[key] = mergeCycles(local[key], remote[key])
      continue
    }
    if (local[key] != null) data[key] = clone(local[key])
    else if (remote[key] != null) {
      data[key] = clone(remote[key])
      adopted.push({ kind: 'key', name: key, key })
    }
  }
  adopted.sort((a, b) => {
    const rank = item => item.kind === 'favourite' ? 0 : 1
    return rank(a) - rank(b) || String(a.iso || a.name || '').localeCompare(String(b.iso || b.name || ''))
  })
  return { data, adopted }
}
