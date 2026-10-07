// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

class MemoryStorage {
  constructor(){ this.data = new Map(); }
  getItem(key){ return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key,value){ this.data.set(key,String(value)); }
  removeItem(key){ this.data.delete(key); }
  clear(){ this.data.clear(); }
  key(index){ return [...this.data.keys()][index] ?? null; }
  get length(){ return this.data.size; }
}

describe('Workout 2.0 UI', () => {
  beforeEach(() => {
    cleanup();
    const storage = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', { value:storage, configurable:true });
    vi.stubGlobal('localStorage', storage);
    window.AthleteLogBridge = {
      templates:() => [{ name:'Upper', exercises:['Row'] }],
      loadDay:() => ({ food:[], gym:{ session:'', exercises:[] } }),
      notify:vi.fn(),
    };
  });

  it('loads a routine, edits a set, persists it and starts the rest timer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('WORKOUT 2.0');
    await user.click(screen.getByRole('button', { name:'Upper' }));
    expect(await screen.findByText('Row')).toBeTruthy();

    const weight = screen.getByLabelText('lb');
    const reps = screen.getByLabelText('reps');
    await user.clear(weight); await user.type(weight, '100'); fireEvent.blur(weight);
    await user.clear(reps); await user.type(reps, '8'); fireEvent.blur(reps);
    await user.click(screen.getByRole('button', { name:'Complete set 1' }));

    expect(await screen.findByText('REST')).toBeTruthy();
    await waitFor(() => {
      const sessions = JSON.parse(localStorage.getItem('alog_v2_sessions'));
      const today = new Date().toLocaleDateString('en-CA');
      expect(sessions[today].exercises[0].sets[0]).toMatchObject({ weight:100, reps:8, completed:true });
      const legacy = JSON.parse(localStorage.getItem(`alog_${today.replaceAll('-', '_')}`));
      expect(legacy.gym.exercises[0]).toMatchObject({ weight:'100', reps:'8', completed:true });
    });
  });
});
