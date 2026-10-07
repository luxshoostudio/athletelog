export const WORKOUT_SCHEMA_VERSION = 2;

export function uid(prefix = 'w') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function exerciseKind(exercise = {}) {
  if (exercise.run || /run|jog|sprint|marathon|treadmill|walking|hiking/i.test(exercise.name || '')) return 'cardio';
  if (exercise.hold || /stretch|balance|mobility|hold|plank|hang|wall sit/i.test(exercise.name || '')) return 'timed';
  return 'strength';
}

const values = value => String(value ?? '').split(',').map(item => item.trim()).filter(Boolean);
const at = (items, index) => items[index] ?? items.at(-1) ?? '';

export function legacyExerciseToV2(exercise = {}) {
  const kind = exerciseKind(exercise);
  const base = {
    id:exercise.id || uid('ex'), name:exercise.name || 'Exercise', kind,
    restSeconds:Number(exercise.restSeconds) || 90, effortMetric:'RPE', notes:exercise.notes || '', sets:[],
  };
  if (kind === 'cardio') {
    base.sets.push({
      id:uid('set'), setType:'working', completed:exercise.completed !== false,
      distanceMiles:Number.parseFloat(exercise.distance) || 0, duration:exercise.runTime || '',
      pace:exercise.pace || '', rpe:Number(exercise.feeling) || null,
    });
  } else if (kind === 'timed') {
    base.sets.push({
      id:uid('set'), setType:'working', completed:exercise.completed !== false,
      durationSeconds:Math.round((Number.parseFloat(exercise.durationMin) || 0) * 60),
      rpe:Number(exercise.feeling) || null,
    });
  } else {
    const reps = values(exercise.reps), weights = values(exercise.weight);
    const count = Math.max(1, Number.parseInt(exercise.sets, 10) || reps.length || weights.length);
    for (let i = 0; i < count; i++) {
      base.sets.push({
        id:uid('set'), setType:'working', completed:exercise.completed !== false,
        reps:Number.parseFloat(at(reps, i)) || 0, weight:Number.parseFloat(at(weights, i)) || 0,
        rpe:Number(exercise.feeling) || null,
      });
    }
  }
  return base;
}

export function legacyDayToSession(dayKey, day = {}) {
  const date = dayKey.replace(/^alog_/, '').replaceAll('_', '-');
  const gym = day.gym || { session:'', exercises:[] };
  return {
    schemaVersion:WORKOUT_SCHEMA_VERSION, id:`session_${date}`, date,
    routineName:gym.session || 'Workout', status:'active',
    exercises:(gym.exercises || []).map(legacyExerciseToV2),
    createdAt:new Date(`${date}T12:00:00`).toISOString(), updatedAt:new Date().toISOString(),
  };
}

export function sessionToLegacyGym(session) {
  return {
    session:session.routineName || 'Workout',
    exercises:session.exercises.map(exercise => {
      const completed = exercise.sets.length > 0 && exercise.sets.every(set => set.completed);
      const common = { id:exercise.id, name:exercise.name, completed };
      if (exercise.kind === 'cardio') {
        const set = exercise.sets[0] || {};
        return { ...common, run:true, distance:String(set.distanceMiles || ''), runTime:set.duration || '', pace:set.pace || '', feeling:set.rpe || null };
      }
      if (exercise.kind === 'timed') {
        const set = exercise.sets[0] || {};
        return { ...common, hold:true, durationMin:String(+((set.durationSeconds || 0) / 60).toFixed(2)), feeling:set.rpe || null };
      }
      return {
        ...common, sets:String(exercise.sets.length),
        reps:exercise.sets.map(set => set.reps || 0).join(','),
        weight:exercise.sets.map(set => set.weight || 0).join(','),
        feeling:exercise.sets.filter(set => set.rpe).at(-1)?.rpe || null,
      };
    }),
  };
}

export function estimatedOneRepMax(weight, reps) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  return w > 0 && r > 0 ? +(w * (1 + r / 30)).toFixed(1) : 0;
}

export function sessionStats(session) {
  let volume = 0, completedSets = 0, totalSets = 0, bestE1rm = 0;
  for (const exercise of session?.exercises || []) for (const set of exercise.sets || []) {
    totalSets++;
    if (set.completed) completedSets++;
    if (exercise.kind === 'strength' && set.completed && set.setType !== 'warmup') {
      volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
      bestE1rm = Math.max(bestE1rm, estimatedOneRepMax(set.weight, set.reps));
    }
  }
  return { volume:Math.round(volume), completedSets, totalSets, bestE1rm, complete:totalSets > 0 && completedSets === totalSets };
}

export function personalRecords(session, history = []) {
  const previous = new Map();
  for (const old of history) for (const exercise of old.exercises || []) {
    const key = exercise.name.trim().toLowerCase();
    const best = Math.max(0, ...(exercise.sets || []).filter(set => set.setType !== 'warmup').map(set => estimatedOneRepMax(set.weight, set.reps)));
    previous.set(key, Math.max(previous.get(key) || 0, best));
  }
  const prs = [];
  for (const exercise of session?.exercises || []) {
    if (exercise.kind !== 'strength') continue;
    const best = Math.max(0, ...exercise.sets.filter(set => set.completed && set.setType !== 'warmup').map(set => estimatedOneRepMax(set.weight, set.reps)));
    if (best > (previous.get(exercise.name.trim().toLowerCase()) || 0) && best > 0) prs.push({ exerciseId:exercise.id, name:exercise.name, e1rm:best });
  }
  return prs;
}

export function progressionSuggestion(exercise, history = []) {
  if (!exercise || exercise.kind !== 'strength' || !exercise.sets.length) return null;
  const targetSets = exercise.sets.filter(set => set.setType !== 'warmup');
  const complete = targetSets.length > 0 && targetSets.every(set => set.completed && Number(set.reps) > 0);
  const latestWeight = Math.max(0, ...targetSets.map(set => Number(set.weight) || 0));
  if (complete) return { action:'increase', weight:latestWeight ? latestWeight + 5 : 5, reason:'All target sets completed' };
  const key = exercise.name.trim().toLowerCase();
  const recent = history.filter(session => session.exercises?.some(item => item.name.trim().toLowerCase() === key)).slice(-2);
  const twoMisses = recent.length === 2 && recent.every(session => {
    const item = session.exercises.find(entry => entry.name.trim().toLowerCase() === key);
    return item?.sets?.some(set => !set.completed);
  });
  if (twoMisses && latestWeight) return { action:'deload', weight:Math.round(latestWeight * .9), reason:'Two sessions missed; reduce 10%' };
  return { action:'hold', weight:latestWeight, reason:'Repeat until all target sets are complete' };
}

export function createSet(kind = 'strength', previous = {}) {
  const common = { id:uid('set'), setType:previous.setType || 'working', completed:false, rpe:null, rir:null };
  if (kind === 'cardio') return { ...common, distanceMiles:previous.distanceMiles || 0, duration:previous.duration || '', pace:previous.pace || '' };
  if (kind === 'timed') return { ...common, durationSeconds:previous.durationSeconds || 60 };
  return { ...common, reps:previous.reps || 0, weight:previous.weight || 0 };
}
