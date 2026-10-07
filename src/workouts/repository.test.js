import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  constructor(){ this.data = new Map(); }
  getItem(key){ return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key,value){ this.data.set(key,String(value)); }
  removeItem(key){ this.data.delete(key); }
  key(index){ return [...this.data.keys()][index] ?? null; }
  get length(){ return this.data.size; }
}

describe('workout repository migration', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = new MemoryStorage();
    globalThis.window = { dispatchEvent:vi.fn() };
    globalThis.CustomEvent = class { constructor(type, init){ this.type=type; this.detail=init?.detail; } };
  });

  it('creates a retained snapshot and is idempotent', async () => {
    localStorage.setItem('alog_2026_10_01', JSON.stringify({ food:[{name:'banana'}], gym:{ session:'Upper', exercises:[{ name:'Row', sets:'2', reps:'8', weight:'100', completed:true }] } }));
    const repository = await import('./repository.js');
    expect(await repository.migrateLegacyWorkouts()).toMatchObject({ migrated:1, skipped:false });
    expect(await repository.migrateLegacyWorkouts()).toMatchObject({ migrated:0, skipped:true });
    const snapshot = JSON.parse(localStorage.getItem(repository.storageKeys.SNAPSHOT_KEY));
    expect(snapshot.gyms.alog_2026_10_01.session).toBe('Upper');
    const mirror = JSON.parse(localStorage.getItem(repository.storageKeys.MIRROR_KEY));
    expect(mirror['2026-10-01'].exercises[0].sets).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('alog_2026_10_01')).food).toEqual([{name:'banana'}]);
  });

  it('dual writes v2 and legacy while preserving non-workout fields', async () => {
    localStorage.setItem('alog_2026_10_04', JSON.stringify({ period:true, food:[{name:'oats'}] }));
    const { saveSession } = await import('./repository.js');
    await saveSession({ date:'2026-10-04', routineName:'Lower', exercises:[{ id:'squat', name:'Squat', kind:'strength', sets:[{ id:'a', setType:'working', completed:true, weight:135, reps:5, rpe:8 }] }] });
    const day = JSON.parse(localStorage.getItem('alog_2026_10_04'));
    expect(day.period).toBe(true);
    expect(day.food).toEqual([{name:'oats'}]);
    expect(day.gym.exercises[0]).toMatchObject({ name:'Squat', sets:'1', reps:'5', weight:'135' });
  });

  it('does not overwrite a restored v2 session with its legacy projection', async () => {
    const restored = { date:'2026-10-05', routineName:'Upper', exercises:[{ id:'row', name:'Row', kind:'strength', sets:[{ id:'set', completed:true, weight:102.5, reps:7, rpe:8.5 }] }] };
    localStorage.setItem('alog_v2_sessions', JSON.stringify({ '2026-10-05':restored }));
    localStorage.setItem('alog_2026_10_05', JSON.stringify({ gym:{ session:'Upper', exercises:[{ name:'Row', sets:'1', reps:'7', weight:'100', completed:true }] } }));
    const repository = await import('./repository.js');
    await repository.migrateLegacyWorkouts();
    expect(JSON.parse(localStorage.getItem('alog_v2_sessions'))['2026-10-05'].exercises[0].sets[0].weight).toBe(102.5);
  });
});
