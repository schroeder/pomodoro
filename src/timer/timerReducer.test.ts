import { describe, it, expect } from 'vitest';
import { timerReducer, durationForPhase } from './timerReducer';
import type { TimerAction } from './timerReducer';
import type { PhaseType, Settings, TimerState } from '../types';

// Feste Basis-Zeit für deterministische Tests.
const NOW = 1_000_000;
const MIN = 60_000;

const settings: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  focusPerCycle: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundId: 'soft',
  volume: 0.6,
  notificationsEnabled: false,
  notifyFocusEnd: true,
  notifyBreakEnd: true,
  theme: 'system',
};

/** Erzeugt einen Basiszustand für eine Phase im gewünschten Status. */
function makeState(overrides: Partial<TimerState> = {}): TimerState {
  const phaseType: PhaseType = overrides.phaseType ?? 'Focus';
  const planned = durationForPhase(phaseType, settings);
  return {
    phaseType,
    status: 'Ready',
    plannedDurationMs: planned,
    endsAt: null,
    remainingMs: planned,
    startedAt: null,
    completedFocusInCycle: 0,
    pomodoroNumberInCycle: 1,
    notificationPrompted: false,
    ...overrides,
  };
}

describe('durationForPhase', () => {
  it('berechnet Dauern aus den Einstellungen', () => {
    expect(durationForPhase('Focus', settings)).toBe(25 * MIN);
    expect(durationForPhase('ShortBreak', settings)).toBe(5 * MIN);
    expect(durationForPhase('LongBreak', settings)).toBe(15 * MIN);
  });
});

describe('START (Req 4.1, 6.1)', () => {
  it('wechselt Ready -> Running und setzt endsAt = now + remainingMs', () => {
    const state = makeState();
    const next = timerReducer(state, { type: 'START', now: NOW });
    expect(next.status).toBe('Running');
    expect(next.endsAt).toBe(NOW + 25 * MIN);
    expect(next.startedAt).toBe(NOW);
  });

  it('ignoriert START, wenn nicht Ready', () => {
    const state = makeState({ status: 'Running', endsAt: NOW + MIN });
    expect(timerReducer(state, { type: 'START', now: NOW })).toBe(state);
  });
});

describe('PAUSE (Req 4.2)', () => {
  it('friert die verbleibende Zeit ein und leert endsAt', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 10 * MIN });
    const paused = timerReducer(running, { type: 'PAUSE', now: NOW + 4 * MIN });
    expect(paused.status).toBe('Paused');
    expect(paused.remainingMs).toBe(6 * MIN);
    expect(paused.endsAt).toBeNull();
  });

  it('klemmt negative Restzeit auf 0 (Req 20.2)', () => {
    const running = makeState({ status: 'Running', endsAt: NOW });
    const paused = timerReducer(running, { type: 'PAUSE', now: NOW + 5 * MIN });
    expect(paused.remainingMs).toBe(0);
  });

  it('ignoriert PAUSE, wenn nicht Running', () => {
    const state = makeState();
    expect(timerReducer(state, { type: 'PAUSE', now: NOW })).toBe(state);
  });
});

describe('RESUME (Req 4.3)', () => {
  it('wechselt Paused -> Running und setzt endsAt aus erhaltener Restzeit neu', () => {
    const paused = makeState({ status: 'Paused', remainingMs: 6 * MIN, endsAt: null });
    const resumed = timerReducer(paused, { type: 'RESUME', now: NOW });
    expect(resumed.status).toBe('Running');
    expect(resumed.endsAt).toBe(NOW + 6 * MIN);
    expect(resumed.remainingMs).toBe(6 * MIN);
  });

  it('ignoriert RESUME, wenn nicht Paused', () => {
    const state = makeState();
    expect(timerReducer(state, { type: 'RESUME', now: NOW })).toBe(state);
  });
});

describe('RESTART (Req 4.4)', () => {
  it('setzt die Phase auf die geplante Dauer zurück und in Ready', () => {
    const running = makeState({
      status: 'Running',
      endsAt: NOW + 3 * MIN,
      remainingMs: 3 * MIN,
      startedAt: NOW,
    });
    const restarted = timerReducer(running, { type: 'RESTART' });
    expect(restarted.status).toBe('Ready');
    expect(restarted.remainingMs).toBe(25 * MIN);
    expect(restarted.endsAt).toBeNull();
    expect(restarted.startedAt).toBeNull();
  });

  it('behält verlängerte plannedDuration beim Neustart bei', () => {
    const extended = makeState({ plannedDurationMs: 30 * MIN, remainingMs: 5 * MIN });
    const restarted = timerReducer(extended, { type: 'RESTART' });
    expect(restarted.remainingMs).toBe(30 * MIN);
  });
});

describe('CANCEL (Req 4.5, 2.5)', () => {
  it('versetzt in Cancelled ohne Pomodoro-Wertung', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 10 * MIN });
    const cancelled = timerReducer(running, { type: 'CANCEL' });
    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.completedFocusInCycle).toBe(0);
    expect(cancelled.endsAt).toBeNull();
  });
});

describe('EXTEND (Req 4.7)', () => {
  it('verlängert endsAt und plannedDuration im laufenden Zustand', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 10 * MIN });
    const extended = timerReducer(running, { type: 'EXTEND', ms: 5 * MIN, now: NOW });
    expect(extended.endsAt).toBe(NOW + 15 * MIN);
    expect(extended.plannedDurationMs).toBe(30 * MIN);
  });

  it('erhöht remainingMs und plannedDuration im pausierten Zustand', () => {
    const paused = makeState({ status: 'Paused', remainingMs: 4 * MIN, endsAt: null });
    const extended = timerReducer(paused, { type: 'EXTEND', ms: MIN, now: NOW });
    expect(extended.remainingMs).toBe(5 * MIN);
    expect(extended.plannedDurationMs).toBe(26 * MIN);
    expect(extended.endsAt).toBeNull();
  });
});

describe('EXPIRE (Req 2.4, 5)', () => {
  it('wertet eine Fokusphase als abgeschlossenen Pomodoro', () => {
    const running = makeState({ status: 'Running', endsAt: NOW });
    const expired = timerReducer(running, { type: 'EXPIRE', now: NOW });
    expect(expired.status).toBe('Completed');
    expect(expired.completedFocusInCycle).toBe(1);
    expect(expired.remainingMs).toBe(0);
  });

  it('wertet eine Pause NICHT als Pomodoro', () => {
    const running = makeState({ phaseType: 'ShortBreak', status: 'Running', endsAt: NOW });
    const expired = timerReducer(running, { type: 'EXPIRE', now: NOW });
    expect(expired.status).toBe('Completed');
    expect(expired.completedFocusInCycle).toBe(0);
  });

  it('ist idempotent für bereits abgeschlossene Phasen', () => {
    const completed = makeState({ status: 'Completed', completedFocusInCycle: 1 });
    expect(timerReducer(completed, { type: 'EXPIRE', now: NOW })).toBe(completed);
  });
});

describe('TICK (Req 6.2, 6.4, 20.2)', () => {
  it('löst EXPIRE aus, wenn now >= endsAt', () => {
    const running = makeState({ status: 'Running', endsAt: NOW });
    const ticked = timerReducer(running, { type: 'TICK', now: NOW + MIN });
    expect(ticked.status).toBe('Completed');
    expect(ticked.completedFocusInCycle).toBe(1);
  });

  it('ändert nichts, solange Zeit übrig ist', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 5 * MIN });
    const ticked = timerReducer(running, { type: 'TICK', now: NOW + MIN });
    expect(ticked).toBe(running);
  });

  it('ignoriert TICK, wenn nicht Running', () => {
    const state = makeState();
    expect(timerReducer(state, { type: 'TICK', now: NOW })).toBe(state);
  });
});

describe('COMPLETE_EARLY (Req 4.8, 2.4)', () => {
  it('wertet eine laufende Fokusphase als abgeschlossenen Pomodoro', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 10 * MIN });
    const done = timerReducer(running, { type: 'COMPLETE_EARLY', now: NOW });
    expect(done.status).toBe('Completed');
    expect(done.completedFocusInCycle).toBe(1);
  });

  it('ignoriert COMPLETE_EARLY außerhalb einer Fokusphase', () => {
    const running = makeState({ phaseType: 'ShortBreak', status: 'Running', endsAt: NOW });
    expect(timerReducer(running, { type: 'COMPLETE_EARLY', now: NOW })).toBe(running);
  });
});

describe('SKIP (Req 4.6, 2.5)', () => {
  it('beendet Fokus ohne Wertung und bereitet die kurze Pause vor', () => {
    const running = makeState({ status: 'Running', endsAt: NOW + 10 * MIN });
    const skipped = timerReducer(running, { type: 'SKIP', settings });
    expect(skipped.phaseType).toBe('ShortBreak');
    expect(skipped.status).toBe('Ready');
    expect(skipped.completedFocusInCycle).toBe(0);
    expect(skipped.remainingMs).toBe(5 * MIN);
  });

  it('von ShortBreak zurück zu Focus und erhöht die Pomodoro-Nummer', () => {
    const brk = makeState({ phaseType: 'ShortBreak', status: 'Running', pomodoroNumberInCycle: 1 });
    const skipped = timerReducer(brk, { type: 'SKIP', settings });
    expect(skipped.phaseType).toBe('Focus');
    expect(skipped.pomodoroNumberInCycle).toBe(2);
  });
});

describe('ADVANCE (Req 2.1, 2.2, 2.3, 5.3, 5.4)', () => {
  it('führt von abgeschlossenem Fokus zur kurzen Pause', () => {
    const completed = makeState({ status: 'Completed', completedFocusInCycle: 1, remainingMs: 0 });
    const next = timerReducer(completed, { type: 'ADVANCE', settings });
    expect(next.phaseType).toBe('ShortBreak');
    expect(next.status).toBe('Ready');
    expect(next.completedFocusInCycle).toBe(1);
  });

  it('führt nach der 4. Fokusphase zur langen Pause', () => {
    const completed = makeState({
      phaseType: 'Focus',
      status: 'Completed',
      completedFocusInCycle: 4,
    });
    const next = timerReducer(completed, { type: 'ADVANCE', settings });
    expect(next.phaseType).toBe('LongBreak');
  });

  it('setzt nach der langen Pause den Zyklus zurück', () => {
    const completed = makeState({
      phaseType: 'LongBreak',
      status: 'Completed',
      completedFocusInCycle: 4,
      pomodoroNumberInCycle: 4,
    });
    const next = timerReducer(completed, { type: 'ADVANCE', settings });
    expect(next.phaseType).toBe('Focus');
    expect(next.completedFocusInCycle).toBe(0);
    expect(next.pomodoroNumberInCycle).toBe(1);
  });

  it('erhöht beim Übergang von ShortBreak zu Focus die Pomodoro-Nummer', () => {
    const completed = makeState({
      phaseType: 'ShortBreak',
      status: 'Completed',
      completedFocusInCycle: 1,
      pomodoroNumberInCycle: 1,
    });
    const next = timerReducer(completed, { type: 'ADVANCE', settings });
    expect(next.phaseType).toBe('Focus');
    expect(next.pomodoroNumberInCycle).toBe(2);
  });
});

describe('vollständiger Zyklus über EXPIRE/ADVANCE (Req 2.1–2.4)', () => {
  it('4× Fokus mündet in eine lange Pause und setzt danach zurück', () => {
    let state = makeState();
    const advance = (a: TimerAction) => {
      state = timerReducer(state, a);
    };

    for (let i = 1; i <= 4; i++) {
      advance({ type: 'START', now: NOW });
      advance({ type: 'EXPIRE', now: NOW });
      expect(state.completedFocusInCycle).toBe(i);
      advance({ type: 'ADVANCE', settings });
      if (i < 4) {
        expect(state.phaseType).toBe('ShortBreak');
        advance({ type: 'START', now: NOW });
        advance({ type: 'EXPIRE', now: NOW });
        advance({ type: 'ADVANCE', settings });
        expect(state.phaseType).toBe('Focus');
      } else {
        expect(state.phaseType).toBe('LongBreak');
      }
    }

    // Lange Pause abschließen -> Zyklus zurückgesetzt.
    advance({ type: 'START', now: NOW });
    advance({ type: 'EXPIRE', now: NOW });
    advance({ type: 'ADVANCE', settings });
    expect(state.phaseType).toBe('Focus');
    expect(state.completedFocusInCycle).toBe(0);
    expect(state.pomodoroNumberInCycle).toBe(1);
  });
});

describe('HYDRATE und RESET_CYCLE', () => {
  it('übernimmt einen persistierten Zustand unverändert', () => {
    const persisted = makeState({ status: 'Paused', remainingMs: 3 * MIN });
    const current = makeState({ status: 'Ready' });
    expect(timerReducer(current, { type: 'HYDRATE', state: persisted })).toBe(persisted);
  });

  it('setzt die Zyklus-Zähler zurück', () => {
    const state = makeState({ completedFocusInCycle: 3, pomodoroNumberInCycle: 4 });
    const reset = timerReducer(state, { type: 'RESET_CYCLE' });
    expect(reset.completedFocusInCycle).toBe(0);
    expect(reset.pomodoroNumberInCycle).toBe(1);
  });
});

describe('START/RESUME/EXTEND – endsAt-Berechnung ist konsistent (Req 6.1, 6.2)', () => {
  it('Start -> Pause -> Resume erhält die verbleibende Zeit korrekt', () => {
    let state = makeState({ remainingMs: 10 * MIN, plannedDurationMs: 10 * MIN });
    state = timerReducer(state, { type: 'START', now: NOW });
    expect(state.endsAt).toBe(NOW + 10 * MIN);
    state = timerReducer(state, { type: 'PAUSE', now: NOW + 3 * MIN });
    expect(state.remainingMs).toBe(7 * MIN);
    state = timerReducer(state, { type: 'RESUME', now: NOW + 100 * MIN });
    expect(state.endsAt).toBe(NOW + 100 * MIN + 7 * MIN);
  });
});
