import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TimerProvider, useTimer } from './TimerProvider';
import { SettingsProvider } from '../settings/SettingsProvider';
import type { Session, Settings } from '../types';
import { TIMER_STORAGE_KEY } from './persistence';
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../settings/defaults';

const MIN = 60_000;

/** In-Memory-localStorage-Ersatz (jsdom-localStorage ist hier nicht befüllt). */
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

function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

/** Steuerbare Zeitquelle für deterministische Tests. */
function makeClock(start: number) {
  let current = start;
  return {
    now: () => current,
    set: (t: number) => {
      current = t;
    },
    advance: (delta: number) => {
      current += delta;
    },
  };
}

/** Schreibt Einstellungen direkt in den (Memory-)Store, bevor Provider mountet. */
function seedSettings(patch: Partial<Settings>): void {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}

interface WrapperOpts {
  onSessionComplete?: (s: Session) => void;
  now: () => number;
  generateId?: () => string;
  tickIntervalMs?: number;
}

function makeWrapper(opts: WrapperOpts) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SettingsProvider>
        <TimerProvider
          now={opts.now}
          onSessionComplete={opts.onSessionComplete}
          generateId={opts.generateId}
          tickIntervalMs={opts.tickIntervalMs}
        >
          {children}
        </TimerProvider>
      </SettingsProvider>
    );
  };
}

describe('TimerProvider / useTimer', () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initialisiert Fokus im Zustand Ready mit geplanter Dauer aus den Einstellungen', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now }),
    });
    expect(result.current.state.phaseType).toBe('Focus');
    expect(result.current.state.status).toBe('Ready');
    // Standard-Fokus = 25 min.
    expect(result.current.state.plannedDurationMs).toBe(25 * MIN);
    expect(result.current.remainingMs).toBe(25 * MIN);
  });

  it('setzt beim START endsAt und wechselt in Running (timestamp-basiert, Req 6.1)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now }),
    });
    act(() => {
      result.current.start();
    });
    expect(result.current.state.status).toBe('Running');
    expect(result.current.state.endsAt).toBe(1_000_000 + 25 * MIN);
  });

  it('leitet die Anzeige-Restzeit aus endsAt und now ab, statt herunterzuzählen (Req 6.2)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    // 3 Minuten vergehen realistisch (Uhr springt), dann ein Ticker-Intervall.
    act(() => {
      clock.advance(3 * MIN);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.state.status).toBe('Running');
    expect(result.current.remainingMs).toBe(22 * MIN);
  });

  it('läuft bei Ablauf über den Ticker in Completed (Req 6.2)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    // Über die geplante Dauer hinaus springen, dann ticken lassen.
    act(() => {
      clock.advance(25 * MIN + 1000);
      vi.advanceTimersByTime(250);
    });
    // Nach EXPIRE wird ohne Auto-Start die nächste Phase (ShortBreak) als Ready vorbereitet.
    expect(result.current.state.status).toBe('Ready');
    expect(result.current.state.phaseType).toBe('ShortBreak');
  });

  it('erfasst bei abgeschlossenem Fokus genau eine Session über den Callback (Seam für Task 6)', () => {
    const clock = makeClock(2_000_000);
    const sessions: Session[] = [];
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        onSessionComplete: (s) => sessions.push(s),
        generateId: () => 'fixed-id',
      }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });
    // Weitere Ticks dürfen keine Doppel-Session erzeugen.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.type).toBe('Focus');
    expect(s.completed).toBe(true);
    expect(s.status).toBe('completed');
    expect(s.startedAt).toBe(2_000_000);
    expect(s.plannedDurationMs).toBe(25 * MIN);
    expect(s.actualDurationMs).toBeGreaterThanOrEqual(25 * MIN);
  });

  it('startet ohne Auto-Start die nächste Phase NICHT automatisch (Standard, Req 5.3)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(25 * MIN + 1);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.state.phaseType).toBe('ShortBreak');
    expect(result.current.state.status).toBe('Ready');
  });

  it('startet die Pause automatisch, wenn autoStartBreaks aktiv ist (Req 5.5)', () => {
    seedSettings({ autoStartBreaks: true });
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(25 * MIN + 1);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.state.phaseType).toBe('ShortBreak');
    expect(result.current.state.status).toBe('Running');
    expect(result.current.state.endsAt).not.toBeNull();
  });

  it('startet den Fokus automatisch nach einer Pause, wenn autoStartFocus aktiv ist (Req 5.6)', () => {
    seedSettings({ autoStartFocus: true });
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    // Direkt in eine Pause versetzen: Fokus abschließen (COMPLETE_EARLY) und advancen.
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.completeEarly();
    });
    // Fokus abgeschlossen → ohne autoStartBreaks bleibt die Pause Ready.
    expect(result.current.state.phaseType).toBe('ShortBreak');
    expect(result.current.state.status).toBe('Ready');
    // Pause starten und ablaufen lassen → Fokus soll automatisch starten.
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(5 * MIN + 1);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.state.phaseType).toBe('Focus');
    expect(result.current.state.status).toBe('Running');
  });

  it('pausiert und friert die Restzeit ein, setzt danach korrekt fort (Req 6.2)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(10 * MIN);
      result.current.pause();
    });
    expect(result.current.state.status).toBe('Paused');
    expect(result.current.remainingMs).toBe(15 * MIN);
    // Während Paused vergeht Zeit; Restzeit bleibt eingefroren.
    act(() => {
      clock.advance(30 * MIN);
      result.current.resume();
    });
    expect(result.current.state.status).toBe('Running');
    expect(result.current.state.endsAt).toBe(clock.now() + 15 * MIN);
  });

  it('rechnet bei visibilitychange sofort neu und läuft bei überschrittener Endzeit ab (Req 6.3/6.4)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 100_000 }),
    });
    act(() => {
      result.current.start();
    });
    // Uhr springt über die Endzeit (Standby), OHNE dass der Ticker feuert.
    act(() => {
      clock.advance(25 * MIN + 5 * MIN);
      // visibilitychange → sichtbar
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Sofortige Neubewertung: Fokus abgelaufen → nächste Phase (ShortBreak, Ready).
    expect(result.current.state.phaseType).toBe('ShortBreak');
    expect(result.current.state.status).toBe('Ready');
  });

  it('rechnet bei window focus sofort neu (Req 6.3/6.4, 20.2)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 100_000 }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      clock.advance(25 * MIN + MIN);
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.state.phaseType).toBe('ShortBreak');
    expect(result.current.state.status).toBe('Ready');
  });

  it('persistiert den Zustand und hydriert einen laufenden Timer beim Remount (Req 7.1/7.2)', () => {
    const clock = makeClock(1_000_000);
    const wrapper = makeWrapper({ now: clock.now, tickIntervalMs: 250 });
    const first = renderHook(() => useTimer(), { wrapper });
    act(() => {
      first.result.current.start();
    });
    expect(localStorage.getItem(TIMER_STORAGE_KEY)).not.toBeNull();
    first.unmount();

    // Etwas Zeit vergeht, dann neuer Provider (wie ein Reload).
    clock.advance(5 * MIN);
    let second!: ReturnType<typeof renderHook<ReturnType<typeof useTimer>, unknown>>;
    act(() => {
      second = renderHook(() => useTimer(), { wrapper });
    });
    expect(second.result.current.state.status).toBe('Running');
    expect(second.result.current.remainingMs).toBe(20 * MIN);
    second.unmount();
  });

  it('verlängert die laufende Phase über extend (Req 4.7)', () => {
    const clock = makeClock(1_000_000);
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({ now: clock.now, tickIntervalMs: 250 }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.extend(5 * MIN);
    });
    expect(result.current.state.endsAt).toBe(1_000_000 + 30 * MIN);
    expect(result.current.state.plannedDurationMs).toBe(30 * MIN);
  });

  it('bricht ab (cancel) ohne Pomodoro-Wertung', () => {
    const clock = makeClock(1_000_000);
    const sessions: Session[] = [];
    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        onSessionComplete: (s) => sessions.push(s),
      }),
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.status).toBe('Cancelled');
    expect(sessions).toHaveLength(0);
  });

  it('wirft, wenn useTimer außerhalb des Providers verwendet wird', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<UsesTimer />)).toThrow(/innerhalb von <TimerProvider>/);
    spy.mockRestore();
  });
});

function UsesTimer() {
  useTimer();
  return null;
}
