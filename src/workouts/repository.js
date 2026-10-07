import { openDB } from 'idb';
import { legacyDayToSession, sessionToLegacyGym } from './core.js';

const DB_NAME = 'athletelog-v2';
const MIRROR_KEY = 'alog_v2_sessions';
const SNAPSHOT_KEY = 'alog_v2_migration_backup';
const MIGRATION_KEY = 'alog_v2_migrated';

const dbPromise = typeof indexedDB === 'undefined' ? null : openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath:'date' });
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
  },
});

function mirror() {
  try { return JSON.parse(localStorage.getItem(MIRROR_KEY) || '{}'); } catch { return {}; }
}

export async function saveSession(session, { writeLegacy = true } = {}) {
  const saved = { ...session, schemaVersion:2, updatedAt:new Date().toISOString() };
  if (dbPromise) await (await dbPromise).put('sessions', saved);
  const sessions = mirror();
  sessions[saved.date] = saved;
  localStorage.setItem(MIRROR_KEY, JSON.stringify(sessions));
  if (writeLegacy) {
    const key = `alog_${saved.date.replaceAll('-', '_')}`;
    let day;
    try { day = JSON.parse(localStorage.getItem(key) || '{}'); } catch { day = {}; }
    day.gym = sessionToLegacyGym(saved);
    localStorage.setItem(key, JSON.stringify(day));
  }
  window.dispatchEvent(new CustomEvent('athletelog:workout-updated', { detail:{ date:saved.date } }));
  return saved;
}

export async function getSession(date) {
  const cached = mirror()[date];
  if (cached) return cached;
  return dbPromise ? (await dbPromise).get('sessions', date) : undefined;
}

export async function getAllSessions() {
  const sessions = Object.values(mirror());
  if (sessions.length) return sessions.sort((a,b) => a.date.localeCompare(b.date));
  return dbPromise ? (await dbPromise).getAll('sessions') : [];
}

export async function migrateLegacyWorkouts() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return { migrated:0, skipped:true };
  const snapshot = {}, sessions = [];
  const existing = mirror();
  const keys = Array.from({ length:localStorage.length }, (_, index) => localStorage.key(index))
    .filter(key => /^alog_\d{4}_\d{2}_\d{2}$/.test(key || '')).sort();
  for (const key of keys) {
    let day;
    try { day = JSON.parse(localStorage.getItem(key)); } catch { continue; }
    if (!day?.gym?.session && !day?.gym?.exercises?.length) continue;
    snapshot[key] = day.gym;
    const date = key.replace(/^alog_/, '').replaceAll('_', '-');
    if (!existing[date]) sessions.push(legacyDayToSession(key, day));
  }
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ createdAt:new Date().toISOString(), gyms:snapshot }));
  for (const session of sessions) await saveSession(session, { writeLegacy:false });
  localStorage.setItem(MIGRATION_KEY, '1');
  if (dbPromise) await (await dbPromise).put('meta', { completedAt:new Date().toISOString(), count:sessions.length }, 'legacyMigration');
  return { migrated:sessions.length, skipped:false };
}

export const storageKeys = { MIRROR_KEY, SNAPSHOT_KEY, MIGRATION_KEY };
