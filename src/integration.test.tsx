// End-to-End-Integrationstests (Task 16).
//
// Diese Tests prüfen den Kern-User-Flow und die Fehlerfälle NICHT isoliert auf
// Unit-Ebene, sondern durch den ECHTEN Provider-Baum
// (SettingsProvider → StatsProvider → TimerProvider). Dabei werden dieselben
// Seams verwendet, die auch die App verdrahtet:
//   - Persistenz des Timerzustands über localStorage (persistence.ts)
//   - Session-Persistenz über createSessionWriter → IndexedDB (stats/db.ts)
//   - Aggregation über StatsProvider (aggregate.ts)
//
// Testinfrastruktur:
//   - In-Memory-localStorage-Shim (wie in TimerProvider.test.tsx / persistence.test.ts)
//   - fake-indexeddb als reales IndexedDB in jsdom (bereits Dev-Dependency)
//   - Injizierbare Zeitquelle (clock) + vi.useFakeTimers für den Anzeige-Ticker
//
// Abgedeckte Anforderungen: 5.1, 5.2, 7.2, 7.3, 7.4, 20.1, 20.2, 20.3.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { TimerProvider, useTimer } from './timer/TimerProvider';
import { SettingsProvider } from './settings/SettingsProvider';
import { StatsProvider, useStats, useStatsRefresh } from './stats/StatsProvider';
import { createSessionWriter, getAllSessions } from './stats/db';
import { TIMER_STORAGE_KEY } from './timer/persistence';
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from './settings/defaults';
import type { Settings, TimerState } from './types';

const MIN = 60_000;

// ---------------------------------------------------------------------------
// Test-Infrastruktur (bewusst identisch zu den bestehenden Provider-Tests, damit
// die Muster – Memory-Storage, injizierbare Uhr – wiederverwendet werden).
// ---------------------------------------------------------------------------

/** Minimaler In-Memory-localStorage-Ersatz. */
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

/** Entfernt localStorage vollständig aus der Umgebung (Fehlerfall "kein Storage"). */
function removeLocalStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

/** Steuerbare, injizierbare Zeitquelle. */
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

/** Schreibt Einstellungen direkt in den (Memory-)Store, bevor der Provider mountet. */
function seedSettings(patch: Partial<Settings>): void {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}

/** Schreibt einen persistierten Timerzustand direkt in den Store (für Reload-Fälle). */
function seedTimerState(state: TimerState): void {
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
}

/** Basiszustand mit sinnvollen Defaults; einzelne Felder überschreibbar. */
function makeTimerState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    phaseType: 'Focus',
    status: 'Ready',
    plannedDurationMs: 25 * MIN,
    endsAt: null,
    remainingMs: 25 * MIN,
    startedAt: null,
    completedFocusInCycle: 0,
    pomodoroNumberInCycle: 1,
    notificationPrompted: false,
    ...overrides,
  };
}

/**
 * Kombiniertes Ergebnis aus Timer- und Statistik-Kontext, damit ein einzelner
 * renderHook beide Sichten liefert (durch den echten Provider-Baum).
 */
interface RealTree {
  timer: ReturnType<typeof useTimer>;
  stats: ReturnType<typeof useStats>;
}

interface TreeOpts {
  now: () => number;
  generateId?: () => string;
  tickIntervalMs?: number;
}

/**
 * Baut den echten Provider-Baum: SettingsProvider → StatsProvider → TimerLayer.
 * Der TimerLayer verdrahtet – wie App.tsx – den Session-Writer (IndexedDB) mit dem
 * StatsProvider-refresh, sodass abgeschlossene Fokus-Sessions real persistiert werden
 * und die Aggregationen sich aktualisieren.
 */
function makeRealWrapper(opts: TreeOpts) {
  function TimerLayer({ children }: { children: ReactNode }) {
    const refreshStats = useStatsRefresh();
    // Writer stabil halten: er hängt nur an refreshStats.
    const writeSession = createSessionWriter(refreshStats);
    return (
      <TimerProvider
        now={opts.now}
        generateId={opts.generateId}
        tickIntervalMs={opts.tickIntervalMs}
        onSessionComplete={writeSession}
      >
        {children}
      </TimerProvider>
    );
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SettingsProvider>
        <StatsProvider now={opts.now}>
          <TimerLayer>{children}</TimerLayer>
        </StatsProvider>
      </SettingsProvider>
    );
  };
}

function renderRealTree(opts: TreeOpts) {
  return renderHook<RealTree, unknown>(
    () => ({ timer: useTimer(), stats: useStats() }),
    { wrapper: makeRealWrapper(opts) },
  );
}

// ---------------------------------------------------------------------------
// 1) Kern-User-Flow durch den echten Provider-Baum (Req 5.1, 5.2)
// ---------------------------------------------------------------------------
describe('E2E – Kern-User-Flow (Start → Ablauf → Pause → nächster Fokus)', () => {
  beforeEach(() => {
    installMemoryStorage();
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('durchläuft Fokus → Ablauf (Completed/Session) → Pause (Ready) → Start → nächster Fokus', async () => {
    const clock = makeClock(1_000_000);
    const tree = renderRealTree({
      now: clock.now,
      tickIntervalMs: 250,
      generateId: () => 'focus-1',
    });

    // Ausgangspunkt: Fokus, Ready, 25:00.
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    expect(tree.result.current.timer.remainingMs).toBe(25 * MIN);

    // 1) Fokus starten (Ein-Klick-Start).
    act(() => {
      tree.result.current.timer.start();
    });
    expect(tree.result.current.timer.state.status).toBe('Running');
    expect(tree.result.current.timer.state.endsAt).toBe(1_000_000 + 25 * MIN);

    // 2) Zeit läuft ab → EXPIRE über den Ticker. Der abgeschlossene Fokus wird
    //    gewertet (completedFocusInCycle++) und die nächste Phase vorbereitet.
    act(() => {
      clock.advance(25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });

    // Req 5.1/5.2: Nach Ablauf wird die nächste Phase NICHT automatisch gestartet,
    // sondern als Ready vorbereitet (kurze Pause).
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    // Der Fokus wurde als Pomodoro gewertet.
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(1);

    // Die Session wurde real in IndexedDB persistiert (createSessionWriter-Seam).
    // Unter Fake-Timern wird die fire-and-forget-Persistenz über vi.waitFor
    // (das die Timer vorantreibt) abgewartet; Zusicherungen liegen im Callback,
    // damit keine "nackten" awaits auf der Fake-IndexedDB hängen bleiben.
    await vi.waitFor(async () => {
      const all = await getAllSessions();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('focus-1');
      expect(all[0].type).toBe('Focus');
      expect(all[0].completed).toBe(true);
      expect(all[0].startedAt).toBe(1_000_000);
    });

    // Der StatsProvider hat nach dem Schreiben aktualisiert (Aggregation Heute).
    await vi.waitFor(() => {
      expect(tree.result.current.stats.today.pomodoros).toBe(1);
    });

    // 3) Pause bewusst starten (Req 5.4-nahtlos: Start der nächsten Phase).
    act(() => {
      tree.result.current.timer.start();
    });
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Running');

    // 4) Pause ablaufen lassen → nächster Fokus als Ready (Zyklus setzt sich fort).
    act(() => {
      clock.advance(5 * MIN + 500);
      vi.advanceTimersByTime(250);
    });
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    // Der Fokus-Zähler bleibt bei 1 (die Pause zählt nicht als Pomodoro).
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(1);
    // Nur eine Fokus-Session (die Pause erzeugt keine Session).
    await vi.waitFor(async () => {
      const afterBreak = await getAllSessions();
      expect(afterBreak).toHaveLength(1);
    });

    tree.unmount();
  });

  it('setzt den Zyklus fort: 4 Fokusphasen → lange Pause, danach Reset (Req 5.1/5.2, 2.x)', async () => {
    const clock = makeClock(500_000);
    let counter = 0;
    const tree = renderRealTree({
      now: clock.now,
      tickIntervalMs: 250,
      generateId: () => `sess-${counter++}`,
    });

    // Hilfsfunktion: aktuelle Phase starten und vollständig ablaufen lassen.
    const runCurrentPhaseToExpiry = (durationMin: number) => {
      act(() => {
        tree.result.current.timer.start();
      });
      act(() => {
        clock.advance(durationMin * MIN + 500);
        vi.advanceTimersByTime(250);
      });
    };

    // Fokus 1 → kurze Pause
    runCurrentPhaseToExpiry(25);
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    // kurze Pause 1 → Fokus 2
    runCurrentPhaseToExpiry(5);
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    // Fokus 2 → kurze Pause
    runCurrentPhaseToExpiry(25);
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    // kurze Pause 2 → Fokus 3
    runCurrentPhaseToExpiry(5);
    // Fokus 3 → kurze Pause
    runCurrentPhaseToExpiry(25);
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    // kurze Pause 3 → Fokus 4
    runCurrentPhaseToExpiry(5);
    // Fokus 4 → LANGE Pause (nach 4 Fokusphasen)
    runCurrentPhaseToExpiry(25);
    expect(tree.result.current.timer.state.phaseType).toBe('LongBreak');
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(4);

    // Lange Pause → Fokus, Zyklus zurückgesetzt.
    runCurrentPhaseToExpiry(15);
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(0);
    expect(tree.result.current.timer.state.pomodoroNumberInCycle).toBe(1);

    // 4 abgeschlossene Fokus-Sessions wurden persistiert.
    await vi.waitFor(async () => {
      const all = await getAllSessions();
      expect(all.filter((s) => s.type === 'Focus')).toHaveLength(4);
    });

    tree.unmount();
  });

  it('startet Pausen und Fokus automatisch, wenn Auto-Start aktiv ist (Req 5.5/5.6)', () => {
    seedSettings({ autoStartBreaks: true, autoStartFocus: true });
    const clock = makeClock(1_000_000);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });

    act(() => {
      tree.result.current.timer.start();
    });
    // Fokus abgelaufen → Pause startet automatisch (Running).
    act(() => {
      clock.advance(25 * MIN + 1);
      vi.advanceTimersByTime(250);
    });
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Running');

    // Pause abgelaufen → Fokus startet automatisch (Running).
    act(() => {
      clock.advance(5 * MIN + 1);
      vi.advanceTimersByTime(250);
    });
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    expect(tree.result.current.timer.state.status).toBe('Running');

    tree.unmount();
  });
});

// ---------------------------------------------------------------------------
// 2) Reload-/Wiederherstellungs-Fälle durch den echten Provider (Req 7.2/7.3/7.4)
// ---------------------------------------------------------------------------
describe('E2E – Reload/Wiederherstellung (Hydration)', () => {
  beforeEach(() => {
    installMemoryStorage();
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Reload während Running: läuft weiter mit neu berechneter Restzeit (Req 7.2)', () => {
    // Persistierter Zustand: Fokus läuft, Endzeit in 10 min.
    const NOW = 2_000_000;
    seedTimerState(
      makeTimerState({
        status: 'Running',
        endsAt: NOW + 10 * MIN,
        remainingMs: 25 * MIN,
        startedAt: NOW - 15 * MIN,
      }),
    );

    // "Reload": neuer Provider-Baum, Uhr steht bei NOW.
    const clock = makeClock(NOW);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });

    expect(tree.result.current.timer.state.status).toBe('Running');
    expect(tree.result.current.timer.state.phaseType).toBe('Focus');
    // Restzeit aus endsAt - now abgeleitet.
    expect(tree.result.current.timer.remainingMs).toBe(10 * MIN);

    tree.unmount();
  });

  it('Reload während Paused: bleibt pausiert und setzt nicht automatisch fort (Req 7.3)', () => {
    seedTimerState(
      makeTimerState({
        status: 'Paused',
        endsAt: null,
        remainingMs: 12 * MIN,
        startedAt: 1_000_000,
      }),
    );

    // Uhr springt weit nach vorn – Paused muss davon unbeeinflusst bleiben.
    const clock = makeClock(1_000_000 + 120 * MIN);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });

    expect(tree.result.current.timer.state.status).toBe('Paused');
    expect(tree.result.current.timer.remainingMs).toBe(12 * MIN);
    expect(tree.result.current.timer.state.endsAt).toBeNull();

    tree.unmount();
  });

  it('Reload nach Ablauf bei geschlossenem Browser: wertet den Fokus und bereitet die nächste Phase vor (Req 7.4)', async () => {
    const STARTED = 3_000_000;
    seedTimerState(
      makeTimerState({
        status: 'Running',
        // Endzeit liegt in der Vergangenheit relativ zur (späteren) Uhr.
        endsAt: STARTED + 25 * MIN,
        remainingMs: 0,
        startedAt: STARTED,
        completedFocusInCycle: 0,
      }),
    );

    // Browser wird viel später wieder geöffnet.
    const clock = makeClock(STARTED + 90 * MIN);
    const tree = renderRealTree({
      now: clock.now,
      tickIntervalMs: 250,
      generateId: () => 'restored-focus',
    });

    // Hydration rekonstruiert die abgelaufene Fokusphase als Completed und wertet den
    // Pomodoro (Req 7.4). Im ECHTEN Provider-Baum greift danach das Auto-Advance des
    // TimerProvider (Standard: kein Auto-Start), das die nächste Phase als Ready
    // vorbereitet – es wird also unmittelbar der nächste Schritt (kurze Pause)
    // angeboten. Entscheidend für Req 7.4: Der Fokus IST gewertet und die Session
    // wird erfasst; der Zustand ist nicht zurückgesetzt.
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(1);

    // Die rekonstruierte Fokus-Session wird über den Seam persistiert (Req 7.4/11.1).
    await vi.waitFor(async () => {
      const all = await getAllSessions();
      expect(all.map((s) => s.id)).toContain('restored-focus');
    });

    tree.unmount();
  });
});

// ---------------------------------------------------------------------------
// 3) Standby / Systemzeit-Sprung (Req 20.2/20.3, 6.3/6.4)
// ---------------------------------------------------------------------------
describe('E2E – Standby / Systemzeit-Sprung', () => {
  beforeEach(() => {
    installMemoryStorage();
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('springt die Uhr im Standby über die Endzeit und wird bei visibilitychange als abgelaufen bewertet (Req 20.2)', () => {
    const clock = makeClock(1_000_000);
    // Ticker praktisch deaktiviert (sehr großes Intervall), damit nur das
    // visibilitychange-Event die Neuberechnung auslöst.
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 10_000_000 });

    act(() => {
      tree.result.current.timer.start();
    });
    expect(tree.result.current.timer.state.status).toBe('Running');

    // Standby: Uhr springt weit über die Endzeit hinaus, ohne dass der Ticker feuert.
    act(() => {
      clock.advance(25 * MIN + 40 * MIN);
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Sofortige Neubewertung über endsAt → abgelaufen → nächste Phase (Ready).
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(1);

    tree.unmount();
  });

  it('klemmt negative Restzeit auf 0 und bewertet über window focus (Req 20.2/20.3)', () => {
    const clock = makeClock(1_000_000);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 10_000_000 });

    act(() => {
      tree.result.current.timer.start();
    });
    // Uhr springt über die Endzeit hinaus (Systemzeit-Sprung / Standby).
    act(() => {
      clock.advance(25 * MIN + MIN);
      window.dispatchEvent(new Event('focus'));
    });
    // Die abgelaufene Fokusphase wurde bewertet und die nächste Phase (kurze Pause)
    // als Ready vorbereitet. Wichtig für Req 20.2/20.3: Es gibt KEINE negative
    // Restzeit – der abgeleitete Wert ist nie < 0. Die neu vorbereitete Phase startet
    // mit ihrer vollen (nicht-negativen) Dauer.
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    expect(tree.result.current.timer.remainingMs).toBeGreaterThanOrEqual(0);
    expect(tree.result.current.timer.remainingMs).toBe(5 * MIN);

    tree.unmount();
  });
});

// ---------------------------------------------------------------------------
// 4) Fehlerfall "kein Storage": localStorage UND IndexedDB nicht verfügbar (Req 20.1)
// ---------------------------------------------------------------------------
describe('E2E – kein persistenter Speicher (Req 20.1)', () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    vi.useFakeTimers();
    // Weder localStorage noch IndexedDB verfügbar.
    removeLocalStorage();
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.indexedDB = originalIndexedDb;
    installMemoryStorage();
  });

  it('mountet ohne Speicher fehlerfrei und bleibt bedienbar (In-Memory-Betrieb)', () => {
    const clock = makeClock(1_000_000);
    expect(() => {
      const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });
      tree.unmount();
    }).not.toThrow();
  });

  it('meldet storageAvailable=false und lässt den Timer trotzdem laufen und ablaufen', async () => {
    const clock = makeClock(1_000_000);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });

    // In-Memory-Betrieb signalisiert (Req 20.1).
    expect(tree.result.current.timer.storageAvailable).toBe(false);

    // Der Kern-Flow funktioniert weiterhin (keine Persistenz nötig).
    act(() => {
      tree.result.current.timer.start();
    });
    expect(tree.result.current.timer.state.status).toBe('Running');

    act(() => {
      clock.advance(25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');
    // Fokus wurde trotz fehlender Persistenz gewertet.
    expect(tree.result.current.timer.state.completedFocusInCycle).toBe(1);

    // Statistik bleibt leer (kein IndexedDB), aber ohne Fehler.
    expect(tree.result.current.stats.today.pomodoros).toBe(0);

    tree.unmount();
  });
});

// ---------------------------------------------------------------------------
// 5) Verweigerte Notifications: Settings halten notificationsEnabled=false (Req 8.7/20.1)
// ---------------------------------------------------------------------------
describe('E2E – verweigerte Benachrichtigungen (Req 8.7/20.1)', () => {
  beforeEach(() => {
    installMemoryStorage();
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bleibt bei verweigerter Berechtigung nutzbar: notificationsEnabled bleibt false, Flow läuft', async () => {
    // Simuliert einen persistierten Zustand, in dem die Berechtigung nie erteilt wurde.
    seedSettings({ notificationsEnabled: false });
    const clock = makeClock(1_000_000);
    const tree = renderRealTree({ now: clock.now, tickIntervalMs: 250 });

    // Der Kern-Flow läuft unabhängig von Notifications (nur In-App + Ton).
    act(() => {
      tree.result.current.timer.start();
    });
    act(() => {
      clock.advance(25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });
    expect(tree.result.current.timer.state.phaseType).toBe('ShortBreak');
    expect(tree.result.current.timer.state.status).toBe('Ready');

    // Session dennoch erfasst (Ton/Notification sind reine Nebenwirkungen).
    await vi.waitFor(async () => {
      const all = await getAllSessions();
      expect(all).toHaveLength(1);
    });

    tree.unmount();
  });
});
