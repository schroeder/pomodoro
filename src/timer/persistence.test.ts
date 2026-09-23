import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TIMER_STORAGE_KEY,
  hydrateTimerState,
  loadTimerState,
  saveTimerState,
  clearTimerState,
} from './persistence';
import { durationForPhase } from './timerReducer';
import type { PhaseType, Settings, TimerState } from '../types';

// Feste Basis-Zeit für deterministische Tests.
const NOW = 1_000_000;
const MIN = 60_000;

/**
 * Minimaler In-Memory-localStorage-Ersatz für die Tests. In dieser Testumgebung ist
 * das jsdom-`localStorage` nicht befüllt; wir installieren daher einen deterministischen
 * Store, der exakt die vom Wrapper genutzten Methoden bereitstellt.
 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as Storage;
}

/** Installiert einen frischen In-Memory-Store als globales localStorage. */
function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

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

// ---------------------------------------------------------------------------
// Reine Hydration-Logik (Req 7.2, 7.3, 7.4)
// ---------------------------------------------------------------------------
describe('hydrateTimerState', () => {
  it('lässt einen laufenden Timer mit Restzeit weiterlaufen und aktualisiert remainingMs (Req 7.2)', () => {
    const state = makeState({
      status: 'Running',
      endsAt: NOW + 10 * MIN,
      remainingMs: 25 * MIN,
      startedAt: NOW - 15 * MIN,
    });
    const hydrated = hydrateTimerState(state, NOW);
    expect(hydrated.status).toBe('Running');
    expect(hydrated.endsAt).toBe(NOW + 10 * MIN);
    // Anzeige-Restzeit wird aus endsAt - now abgeleitet.
    expect(hydrated.remainingMs).toBe(10 * MIN);
  });

  it('rekonstruiert einen abgelaufenen laufenden Fokus als Completed und wertet den Pomodoro (Req 7.4)', () => {
    const state = makeState({
      phaseType: 'Focus',
      status: 'Running',
      endsAt: NOW - 5 * MIN, // bereits verstrichen
      remainingMs: 0,
      startedAt: NOW - 30 * MIN,
      completedFocusInCycle: 1,
    });
    const hydrated = hydrateTimerState(state, NOW);
    expect(hydrated.status).toBe('Completed');
    expect(hydrated.endsAt).toBeNull();
    expect(hydrated.remainingMs).toBe(0);
    // Fokusphase wird als abgeschlossener Pomodoro gewertet.
    expect(hydrated.completedFocusInCycle).toBe(2);
  });

  it('behandelt exakt abgelaufene Zeit (now === endsAt) als Completed (Req 7.4)', () => {
    const state = makeState({
      phaseType: 'Focus',
      status: 'Running',
      endsAt: NOW,
      remainingMs: 0,
      completedFocusInCycle: 0,
    });
    const hydrated = hydrateTimerState(state, NOW);
    expect(hydrated.status).toBe('Completed');
    expect(hydrated.completedFocusInCycle).toBe(1);
  });

  it('rekonstruiert eine abgelaufene laufende Pause als Completed OHNE Pomodoro-Wertung', () => {
    const state = makeState({
      phaseType: 'ShortBreak',
      status: 'Running',
      endsAt: NOW - MIN,
      remainingMs: 0,
      completedFocusInCycle: 2,
    });
    const hydrated = hydrateTimerState(state, NOW);
    expect(hydrated.status).toBe('Completed');
    // Eine Pause zählt nicht als Pomodoro.
    expect(hydrated.completedFocusInCycle).toBe(2);
  });

  it('lässt eine pausierte Phase pausiert und setzt sie nicht fort (Req 7.3)', () => {
    const state = makeState({
      status: 'Paused',
      endsAt: null,
      remainingMs: 12 * MIN,
    });
    const hydrated = hydrateTimerState(state, NOW + 60 * MIN);
    expect(hydrated.status).toBe('Paused');
    expect(hydrated.endsAt).toBeNull();
    // Restzeit bleibt eingefroren, unabhängig von der verstrichenen Realzeit.
    expect(hydrated.remainingMs).toBe(12 * MIN);
  });

  it('übernimmt Ready/Completed/Cancelled unverändert', () => {
    const ready = makeState({ status: 'Ready' });
    expect(hydrateTimerState(ready, NOW)).toEqual(ready);

    const completed = makeState({ status: 'Completed', remainingMs: 0 });
    expect(hydrateTimerState(completed, NOW)).toEqual(completed);

    const cancelled = makeState({ status: 'Cancelled', remainingMs: 0 });
    expect(hydrateTimerState(cancelled, NOW)).toEqual(cancelled);
  });

  it('mutiert den Eingabezustand nicht', () => {
    const state = makeState({
      status: 'Running',
      endsAt: NOW + 5 * MIN,
      remainingMs: 25 * MIN,
    });
    const snapshot = { ...state };
    hydrateTimerState(state, NOW);
    expect(state).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// load/save-Wrapper mit echtem localStorage (jsdom) und Fehlerfällen (Req 7.1, 7.5, 20.1)
// ---------------------------------------------------------------------------
describe('loadTimerState / saveTimerState (localStorage-Wrapper)', () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('meldet available=true und state=null, wenn kein Zustand gespeichert ist', () => {
    const result = loadTimerState(NOW);
    expect(result.available).toBe(true);
    expect(result.state).toBeNull();
  });

  it('persistiert und lädt einen laufenden Zustand wieder (Reload während Running, Req 7.1/7.2)', () => {
    const state = makeState({
      status: 'Running',
      endsAt: NOW + 8 * MIN,
      remainingMs: 25 * MIN,
      startedAt: NOW - 17 * MIN,
    });
    expect(saveTimerState(state)).toBe(true);

    const result = loadTimerState(NOW);
    expect(result.available).toBe(true);
    expect(result.state?.status).toBe('Running');
    expect(result.state?.remainingMs).toBe(8 * MIN);
  });

  it('lädt einen pausierten Zustand als Paused (Reload während Paused, Req 7.3)', () => {
    const state = makeState({
      status: 'Paused',
      endsAt: null,
      remainingMs: 9 * MIN,
    });
    saveTimerState(state);

    const result = loadTimerState(NOW + 120 * MIN);
    expect(result.state?.status).toBe('Paused');
    expect(result.state?.remainingMs).toBe(9 * MIN);
  });

  it('lädt einen abgelaufenen laufenden Fokus als Completed (Browser geschlossen, Req 7.4)', () => {
    const state = makeState({
      phaseType: 'Focus',
      status: 'Running',
      endsAt: NOW,
      remainingMs: 0,
      completedFocusInCycle: 0,
    });
    saveTimerState(state);

    // Beim späteren Öffnen ist die Endzeit längst verstrichen.
    const result = loadTimerState(NOW + 90 * MIN);
    expect(result.state?.status).toBe('Completed');
    expect(result.state?.completedFocusInCycle).toBe(1);
  });

  it('ignoriert defekte JSON-Daten, meldet Speicher aber als verfügbar', () => {
    localStorage.setItem(TIMER_STORAGE_KEY, '{ not valid json');
    const result = loadTimerState(NOW);
    expect(result.available).toBe(true);
    expect(result.state).toBeNull();
  });

  it('ignoriert strukturell ungültige Zustände', () => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    const result = loadTimerState(NOW);
    expect(result.available).toBe(true);
    expect(result.state).toBeNull();
  });

  it('meldet available=false, wenn Lesen eine Ausnahme wirft (kein Storage, Req 7.5/20.1)', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage nicht verfügbar');
    });
    const result = loadTimerState(NOW);
    expect(result.available).toBe(false);
    expect(result.state).toBeNull();
  });

  it('meldet false beim Speichern, wenn setItem eine Ausnahme wirft (Quota/Privatmodus)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveTimerState(makeState())).toBe(false);
  });

  it('macht einen vollständigen Speicher-/Lade-Roundtrip verlustfrei', () => {
    const state = makeState({
      status: 'Paused',
      endsAt: null,
      remainingMs: 3 * MIN,
      completedFocusInCycle: 3,
      pomodoroNumberInCycle: 4,
      notificationPrompted: true,
    });
    saveTimerState(state);
    const result = loadTimerState(NOW);
    expect(result.state).toEqual(state);
  });
});

describe('clearTimerState', () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.restoreAllMocks();
  });

  it('entfernt den gespeicherten Zustand', () => {
    saveTimerState(makeState());
    expect(clearTimerState()).toBe(true);
    expect(loadTimerState(NOW).state).toBeNull();
  });

  it('meldet false bei einer Ausnahme, ohne zu werfen', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(clearTimerState()).toBe(false);
  });
});
