import { describe, expect, it } from 'vitest';
import {
  estimatedOneRepMax, legacyDayToSession, personalRecords,
  progressionSuggestion, sessionStats, sessionToLegacyGym,
} from './core.js';

describe('legacy workout migration', () => {
  it('preserves strength sets, reps, weights and completion', () => {
    const session = legacyDayToSession('alog_2026_10_01', { gym:{ session:'Lower Body', exercises:[{
      id:'squat', name:'Back Squat', sets:'3', reps:'8,7,6', weight:'135,145,155', completed:true, feeling:8,
    }] } });
    expect(session.date).toBe('2026-10-01');
    expect(session.exercises[0].sets).toHaveLength(3);
    expect(session.exercises[0].sets.map(set => set.reps)).toEqual([8,7,6]);
    expect(session.exercises[0].sets.map(set => set.weight)).toEqual([135,145,155]);
    expect(session.exercises[0].sets.every(set => set.completed)).toBe(true);
  });

  it('keeps timed and cardio fields in their own set shapes', () => {
    const session = legacyDayToSession('alog_2026_10_02', { gym:{ session:'Mixed', exercises:[
      { name:'Plank Hold', hold:true, durationMin:'2.5', completed:true },
      { name:'Running', run:true, distance:'6.2', runTime:'59:00', pace:'9:31/mile', completed:true },
    ] } });
    expect(session.exercises[0].sets[0].durationSeconds).toBe(150);
    expect(session.exercises[1].sets[0]).toMatchObject({ distanceMiles:6.2, duration:'59:00', pace:'9:31/mile' });
  });

  it('round trips through the legacy compatibility format', () => {
    const source = { gym:{ session:'Upper', exercises:[{ name:'Row', sets:'2', reps:'10,8', weight:'90,100', completed:true }] } };
    const gym = sessionToLegacyGym(legacyDayToSession('alog_2026_10_03', source));
    expect(gym.session).toBe('Upper');
    expect(gym.exercises[0]).toMatchObject({ sets:'2', reps:'10,8', weight:'90,100', completed:true });
  });
});

describe('training calculations', () => {
  const exercise = { id:'row', name:'Row', kind:'strength', sets:[
    { completed:true, weight:100, reps:10 }, { completed:true, weight:110, reps:8 },
  ] };
  const session = { exercises:[exercise] };

  it('calculates volume and estimated 1RM', () => {
    expect(estimatedOneRepMax(100, 10)).toBe(133.3);
    expect(sessionStats(session)).toMatchObject({ volume:1880, completedSets:2, totalSets:2, complete:true });
  });

  it('excludes warm-up sets from volume and PR calculations', () => {
    const warmup = { exercises:[{ ...exercise, sets:[{ completed:true, setType:'warmup', weight:200, reps:10 }] }] };
    expect(sessionStats(warmup).volume).toBe(0);
    expect(personalRecords(warmup, [])).toHaveLength(0);
  });

  it('detects a PR only above previous history', () => {
    const old = { exercises:[{ ...exercise, sets:[{ completed:true, weight:90, reps:10 }] }] };
    expect(personalRecords(session, [old])).toHaveLength(1);
    expect(personalRecords(old, [session])).toHaveLength(0);
  });

  it('increases after success and deloads after two misses', () => {
    expect(progressionSuggestion(exercise, [])).toMatchObject({ action:'increase', weight:115 });
    const missed = { exercises:[{ ...exercise, sets:[{ completed:false, weight:100, reps:8 }] }] };
    const current = { ...exercise, sets:[{ completed:false, weight:100, reps:8 }] };
    expect(progressionSuggestion(current, [missed, missed])).toMatchObject({ action:'deload', weight:90 });
  });
});
