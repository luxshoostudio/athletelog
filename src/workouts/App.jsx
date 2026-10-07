import React, { useEffect, useMemo, useState } from 'react';
import { personalRecords, progressionSuggestion, sessionStats } from './core.js';
import { useWorkoutStore } from './store.js';
import './workout.css';

const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];

function NumberField({ label, value, onSave, step = '1' }) {
  return <label className="w2-field"><span>{label}</span><input key={value} type="number" inputMode="decimal" step={step} defaultValue={value || ''} onBlur={event => onSave(Number(event.target.value) || 0)} /></label>;
}

function TextField({ label, value, onSave, placeholder = '' }) {
  return <label className="w2-field"><span>{label}</span><input key={value} defaultValue={value || ''} placeholder={placeholder} onBlur={event => onSave(event.target.value.trim())} /></label>;
}

function SetRow({ exercise, setItem, index }) {
  const { toggleSet, updateSet, copySet, deleteSet } = useWorkoutStore();
  const save = field => value => updateSet(exercise.id, setItem.id, field, value);
  return <div className={`w2-set ${setItem.completed ? 'is-complete' : ''}`}>
    <button className="w2-check" onClick={() => toggleSet(exercise.id, setItem.id)} aria-label={`Complete set ${index + 1}`}>{setItem.completed ? '✓' : index + 1}</button>
    <select className="w2-type" value={setItem.setType} onChange={event => updateSet(exercise.id, setItem.id, 'setType', event.target.value)} aria-label="Set type">
      {SET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
    </select>
    <div className="w2-set-fields">
      {exercise.kind === 'strength' && <>
        <NumberField label="lb" value={setItem.weight} onSave={save('weight')} step="0.5" />
        <NumberField label="reps" value={setItem.reps} onSave={save('reps')} />
      </>}
      {exercise.kind === 'timed' && <NumberField label="seconds" value={setItem.durationSeconds} onSave={save('durationSeconds')} />}
      {exercise.kind === 'cardio' && <>
        <NumberField label="miles" value={setItem.distanceMiles} onSave={save('distanceMiles')} step="0.01" />
        <TextField label="duration" value={setItem.duration} onSave={save('duration')} placeholder="45:00" />
        <TextField label="pace /mi" value={setItem.pace} onSave={save('pace')} placeholder="10:00" />
      </>}
      <NumberField label={exercise.effortMetric || 'RPE'} value={(exercise.effortMetric || 'RPE') === 'RIR' ? setItem.rir : setItem.rpe} onSave={save((exercise.effortMetric || 'RPE') === 'RIR' ? 'rir' : 'rpe')} step="0.5" />
    </div>
    <div className="w2-set-actions">
      <button onClick={() => copySet(exercise.id, setItem.id)} aria-label="Copy set">＋</button>
      <button onClick={() => deleteSet(exercise.id, setItem.id)} aria-label="Delete set">×</button>
    </div>
  </div>;
}

function ExerciseCard({ exercise, history, isPR }) {
  const { addSet, deleteExercise, setExerciseField } = useWorkoutStore();
  const suggestion = progressionSuggestion(exercise, history.filter(item => item.date < useWorkoutStore.getState().date));
  return <section className="w2-exercise">
    <header>
      <div><h3>{exercise.name}{isPR && <span className="w2-pr">PR</span>}</h3><p>{exercise.kind} · {exercise.sets.filter(set => set.completed).length}/{exercise.sets.length} sets</p></div>
      <button className="w2-delete" onClick={() => deleteExercise(exercise.id)} aria-label={`Delete ${exercise.name}`}>×</button>
    </header>
    <div className="w2-exercise-controls">
      <label>Rest <select value={exercise.restSeconds} onChange={event => setExerciseField(exercise.id, 'restSeconds', Number(event.target.value))}>{[30,45,60,90,120,180].map(seconds => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label>
      <label>Effort <select value={exercise.effortMetric || 'RPE'} onChange={event => setExerciseField(exercise.id, 'effortMetric', event.target.value)}><option>RPE</option><option>RIR</option></select></label>
      {suggestion && <span className={`w2-suggestion ${suggestion.action}`}><b>{suggestion.action === 'increase' ? `Next ${suggestion.weight} lb` : suggestion.action === 'deload' ? `Deload ${suggestion.weight} lb` : 'Repeat load'}</b><small>{suggestion.reason}</small></span>}
    </div>
    <div className="w2-sets">{exercise.sets.map((setItem, index) => <SetRow key={setItem.id} exercise={exercise} setItem={setItem} index={index} />)}</div>
    <button className="w2-add-set" onClick={() => addSet(exercise.id)}>＋ Add set</button>
  </section>;
}

function RestTimer() {
  const { timerEnd, cancelTimer, extendTimer } = useWorkoutStore();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timerEnd) return undefined;
    const id = setInterval(() => tick(value => value + 1), 250);
    return () => clearInterval(id);
  }, [timerEnd]);
  if (!timerEnd) return null;
  const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  if (!remaining) setTimeout(cancelTimer, 0);
  return <div className="w2-timer"><div><span>REST</span><strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></div><button onClick={extendTimer}>+30</button><button onClick={cancelTimer}>Skip</button></div>;
}

function AddExercise() {
  const addExercise = useWorkoutStore(state => state.addExercise);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('strength');
  const submit = event => {
    event.preventDefault();
    if (!name.trim()) return;
    addExercise(name.trim(), kind);
    setName('');
  };
  return <form className="w2-add" onSubmit={submit}>
    <input value={name} onChange={event => setName(event.target.value)} placeholder="Add exercise…" aria-label="Exercise name" />
    <select value={kind} onChange={event => setKind(event.target.value)} aria-label="Exercise type"><option value="strength">Strength</option><option value="timed">Timed</option><option value="cardio">Cardio</option></select>
    <button>Add</button>
  </form>;
}

export default function App() {
  const store = useWorkoutStore();
  useEffect(() => { store.init(); }, []);
  const templates = window.AthleteLogBridge?.templates?.() || [];
  const stats = useMemo(() => sessionStats(store.session), [store.session]);
  const previous = store.history.filter(item => item.date < store.date);
  const prs = useMemo(() => personalRecords(store.session, previous), [store.session, store.history, store.date]);
  const prIds = new Set(prs.map(item => item.exerciseId));
  if (store.loading) return <div className="w2-loading">Upgrading workout history…</div>;
  return <div className="w2-app">
    <div className="w2-hero">
      <div><span>WORKOUT 2.0</span><h2>{store.session.routineName}</h2><p>{stats.completedSets}/{stats.totalSets} sets · {stats.volume.toLocaleString()} lb volume{stats.bestE1rm ? ` · ${stats.bestE1rm} lb e1RM` : ''}</p></div>
      <input type="date" value={store.date} max={new Date().toLocaleDateString('en-CA')} onChange={event => store.openDate(event.target.value)} aria-label="Workout date" />
    </div>
    <div className="w2-routines" aria-label="Routine templates">{templates.map(template => <button key={template.name} className={store.session.routineName === template.name ? 'active' : ''} onClick={() => store.loadRoutine(template.name, template.exercises)}>{template.name}</button>)}</div>
    {prs.length > 0 && <div className="w2-pr-banner">New PR · {prs.map(pr => `${pr.name} ${pr.e1rm} lb e1RM`).join(' · ')}</div>}
    <AddExercise />
    <div className="w2-list">{store.session.exercises.length ? store.session.exercises.map(exercise => <ExerciseCard key={exercise.id} exercise={exercise} history={store.history} isPR={prIds.has(exercise.id)} />) : <div className="w2-empty">Choose a routine or add an exercise to start.</div>}</div>
    <div className="w2-history"><h3>Recent sessions</h3>{store.history.filter(item => item.date !== store.date).slice(-6).reverse().map(item => { const itemStats=sessionStats(item); return <button key={item.date} onClick={() => store.openDate(item.date)}><span>{item.date}<strong>{item.routineName}</strong></span><span>{itemStats.completedSets}/{itemStats.totalSets}<small>{itemStats.volume.toLocaleString()} lb</small></span></button>; })}</div>
    <RestTimer />
  </div>;
}
