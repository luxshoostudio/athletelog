import { create } from 'zustand';
import { createSet, exerciseKind, legacyDayToSession, uid } from './core.js';
import { getAllSessions, getSession, migrateLegacyWorkouts, saveSession } from './repository.js';

const isoToday = () => new Date().toLocaleDateString('en-CA');
const blankSession = (date = isoToday()) => ({ schemaVersion:2, id:`session_${date}`, date, routineName:'Workout', status:'active', exercises:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });

export const useWorkoutStore = create((set, get) => ({
  loading:true, date:isoToday(), session:blankSession(), history:[], timerEnd:0,
  async init() {
    await migrateLegacyWorkouts();
    const history = await getAllSessions();
    const date = isoToday();
    const legacy = window.AthleteLogBridge?.loadDay?.(date);
    const session = await getSession(date) || (legacy?.gym?.session || legacy?.gym?.exercises?.length ? legacyDayToSession(`alog_${date.replaceAll('-', '_')}`, legacy) : blankSession(date));
    set({ loading:false, date, session, history });
  },
  async openDate(date) {
    const legacy = window.AthleteLogBridge?.loadDay?.(date);
    const session = await getSession(date) || (legacy?.gym?.session || legacy?.gym?.exercises?.length ? legacyDayToSession(`alog_${date.replaceAll('-', '_')}`, legacy) : blankSession(date));
    set({ date, session });
  },
  async commit(mutator) {
    const session = structuredClone(get().session);
    mutator(session);
    const sets = session.exercises.flatMap(exercise => exercise.sets || []);
    session.status = sets.length > 0 && sets.every(setItem => setItem.completed) ? 'complete' : 'active';
    // Update memory before IndexedDB completes so two quick field edits build
    // on each other instead of racing from the same stale session snapshot.
    set({ session });
    const saved = await saveSession(session);
    const history = await getAllSessions();
    set({ session:saved, history });
  },
  loadRoutine(name, exerciseNames = []) { return get().commit(session => {
    session.routineName = name;
    if (!session.exercises.length) session.exercises = exerciseNames.map(exerciseName => {
      const kind = exerciseKind({ name:exerciseName, run:name === 'Running', hold:false });
      const previous = [...get().history].reverse().flatMap(item => item.exercises || []).find(item => item.kind === kind && item.name.trim().toLowerCase() === exerciseName.trim().toLowerCase());
      return { id:uid('ex'), name:exerciseName, kind, effortMetric:previous?.effortMetric || 'RPE', restSeconds:previous?.restSeconds || (kind === 'strength' ? 90 : 60), notes:'', sets:(previous?.sets?.length ? previous.sets : [createSet(kind)]).map(item => createSet(kind, item)) };
    });
  }); },
  addExercise(name, kind) { return get().commit(session => {
    const previous = [...get().history].reverse().flatMap(item => item.exercises || []).find(item => item.kind === kind && item.name.trim().toLowerCase() === name.trim().toLowerCase());
    session.exercises.push({ id:uid('ex'), name, kind, effortMetric:previous?.effortMetric || 'RPE', restSeconds:previous?.restSeconds || (kind === 'strength' ? 90 : 60), notes:'', sets:(previous?.sets?.length ? previous.sets : [createSet(kind)]).map(item => createSet(kind, item)) });
  }); },
  deleteExercise(id) { return get().commit(session => { session.exercises = session.exercises.filter(item => item.id !== id); }); },
  addSet(exerciseId, source) { return get().commit(session => { const exercise=session.exercises.find(item=>item.id===exerciseId); exercise.sets.push(createSet(exercise.kind, source || exercise.sets.at(-1))); }); },
  copySet(exerciseId, setId) { return get().commit(session => { const exercise=session.exercises.find(item=>item.id===exerciseId); const source=exercise.sets.find(item=>item.id===setId); exercise.sets.push(createSet(exercise.kind, source)); }); },
  deleteSet(exerciseId, setId) { return get().commit(session => { const exercise=session.exercises.find(item=>item.id===exerciseId); exercise.sets=exercise.sets.filter(item=>item.id!==setId); }); },
  updateSet(exerciseId, setId, field, value) { return get().commit(session => { const target=session.exercises.find(item=>item.id===exerciseId)?.sets.find(item=>item.id===setId); if (target) target[field]=value; }); },
  toggleSet(exerciseId, setId) { const session=get().session; const exercise=session.exercises.find(item=>item.id===exerciseId); const target=exercise?.sets.find(item=>item.id===setId); const completing=target && !target.completed; const result=get().commit(draft => { const setItem=draft.exercises.find(item=>item.id===exerciseId)?.sets.find(item=>item.id===setId); if(setItem)setItem.completed=!setItem.completed; }); if(completing){const seconds=exercise.restSeconds||90;set({timerEnd:Date.now()+seconds*1000});window.AthleteLogBridge?.startRestTimer?.(seconds);} return result; },
  setExerciseField(exerciseId, field, value) { return get().commit(session => { const exercise=session.exercises.find(item=>item.id===exerciseId); if(exercise)exercise[field]=value; }); },
  cancelTimer(){set({timerEnd:0});window.AthleteLogBridge?.cancelRestTimer?.();},
  extendTimer(){set(state=>{const timerEnd=state.timerEnd+30000;window.AthleteLogBridge?.startRestTimer?.(Math.ceil((timerEnd-Date.now())/1000));return {timerEnd};});},
}));
