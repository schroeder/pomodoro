import { describe, it, expect } from 'vitest';
import type { Session } from '../types';
import {
  addDaysToKey,
  dateKeyFromEpoch,
  history,
  isBreak,
  isCompletedFocus,
  msToMinutes,
  startOfWeekKey,
  streak,
  todayStats,
  weekDayKeys,
  weekStats,
} from './aggregate';

const MIN = 60_000;

let idCounter = 0;

/**
 * Erzeugt eine Session mit sinnvollen Vorgaben. Der `dateKey` wird – sofern nicht
 * explizit gesetzt – aus `startedAt` abgeleitet, damit Tests konsistent bleiben.
 */
function session(overrides: Partial<Session> = {}): Session {
  const startedAt = overrides.startedAt ?? 0;
  const actualDurationMs = overrides.actualDurationMs ?? 25 * MIN;
  return {
    id: overrides.id ?? `s-${idCounter++}`,
    type: overrides.type ?? 'Focus',
    startedAt,
    endedAt: overrides.endedAt ?? startedAt + actualDurationMs,
    plannedDurationMs: overrides.plannedDurationMs ?? 25 * MIN,
    actualDurationMs,
    status: overrides.status ?? 'completed',
    completed: overrides.completed ?? true,
    dateKey: overrides.dateKey ?? dateKeyFromEpochLocal(startedAt),
  };
}

// Lokale Kopie zur Ableitung des dateKey im Test-Helper (identisch zur Implementierung).
function dateKeyFromEpochLocal(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Bequemer Fokus-Pomodoro an einem bestimmten Tag mit gegebener Dauer (Minuten). */
function focusOn(dateKey: string, minutes = 25): Session {
  return session({ type: 'Focus', dateKey, actualDurationMs: minutes * MIN });
}

// ---------------------------------------------------------------------------
// Datums-Helfer
// ---------------------------------------------------------------------------

describe('Datums-Helfer', () => {
  it('addDaysToKey rechnet Tage korrekt vor und zurück (inkl. Monatsgrenze)', () => {
    expect(addDaysToKey('2024-03-10', 1)).toBe('2024-03-11');
    expect(addDaysToKey('2024-03-01', -1)).toBe('2024-02-29'); // Schaltjahr
    expect(addDaysToKey('2024-12-31', 1)).toBe('2025-01-01');
  });

  it('startOfWeekKey liefert den Montag der Woche', () => {
    // 2024-03-13 ist ein Mittwoch → Montag ist 2024-03-11.
    expect(startOfWeekKey('2024-03-13')).toBe('2024-03-11');
    // Ein Montag bleibt unverändert.
    expect(startOfWeekKey('2024-03-11')).toBe('2024-03-11');
    // Ein Sonntag (2024-03-17) gehört noch zur Woche ab 2024-03-11.
    expect(startOfWeekKey('2024-03-17')).toBe('2024-03-11');
  });

  it('weekDayKeys liefert sieben chronologische Tage (Mo..So)', () => {
    const keys = weekDayKeys('2024-03-13');
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2024-03-11');
    expect(keys[6]).toBe('2024-03-17');
  });

  it('msToMinutes rundet Millisekunden auf ganze Minuten', () => {
    expect(msToMinutes(0)).toBe(0);
    expect(msToMinutes(25 * MIN)).toBe(25);
    expect(msToMinutes(90_000)).toBe(2); // 1,5 min → 2
  });
});

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

describe('Session-Filter', () => {
  it('isCompletedFocus akzeptiert nur abgeschlossene Fokus-Sessions', () => {
    expect(isCompletedFocus(session({ type: 'Focus', completed: true, status: 'completed' }))).toBe(true);
    expect(isCompletedFocus(session({ type: 'Focus', completed: false }))).toBe(false);
    expect(isCompletedFocus(session({ type: 'Focus', status: 'cancelled', completed: false }))).toBe(false);
    expect(isCompletedFocus(session({ type: 'ShortBreak' }))).toBe(false);
  });

  it('isBreak erkennt kurze und lange Pausen', () => {
    expect(isBreak(session({ type: 'ShortBreak' }))).toBe(true);
    expect(isBreak(session({ type: 'LongBreak' }))).toBe(true);
    expect(isBreak(session({ type: 'Focus' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Heute (Req 11.2)
// ---------------------------------------------------------------------------

describe('todayStats (Req 11.2)', () => {
  const today = '2024-03-13';

  it('liefert Nullwerte, wenn keine Sessions vorhanden sind', () => {
    const stats = todayStats([], today);
    expect(stats).toMatchObject({
      dateKey: today,
      pomodoros: 0,
      focusMs: 0,
      focusMinutes: 0,
      averageFocusMs: 0,
      averageFocusMinutes: 0,
      breaks: 0,
    });
  });

  it('zählt Pomodoros, summiert Fokuszeit und berechnet die Ø-Dauer', () => {
    const sessions = [
      focusOn(today, 25),
      focusOn(today, 15),
      focusOn(today, 20),
      focusOn('2024-03-12', 25), // anderer Tag → ignoriert
    ];
    const stats = todayStats(sessions, today);
    expect(stats.pomodoros).toBe(3);
    expect(stats.focusMs).toBe((25 + 15 + 20) * MIN);
    expect(stats.focusMinutes).toBe(60);
    expect(stats.averageFocusMs).toBe(((25 + 15 + 20) * MIN) / 3);
    expect(stats.averageFocusMinutes).toBe(20);
  });

  it('zählt Pausen separat und wertet sie nicht als Pomodoros', () => {
    const sessions = [
      focusOn(today, 25),
      session({ type: 'ShortBreak', dateKey: today }),
      session({ type: 'LongBreak', dateKey: today }),
    ];
    const stats = todayStats(sessions, today);
    expect(stats.pomodoros).toBe(1);
    expect(stats.breaks).toBe(2);
  });

  it('ignoriert abgebrochene Fokus-Sessions', () => {
    const sessions = [
      focusOn(today, 25),
      session({ type: 'Focus', dateKey: today, status: 'cancelled', completed: false }),
    ];
    const stats = todayStats(sessions, today);
    expect(stats.pomodoros).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Woche (Req 11.3)
// ---------------------------------------------------------------------------

describe('weekStats (Req 11.3)', () => {
  const reference = '2024-03-13'; // Mittwoch; Woche Mo 2024-03-11 .. So 2024-03-17

  it('liefert stets sieben Tage (Mo..So), auch ohne Sessions', () => {
    const stats = weekStats([], reference);
    expect(stats.weekStartKey).toBe('2024-03-11');
    expect(stats.days).toHaveLength(7);
    expect(stats.days.map((d) => d.dateKey)).toEqual([
      '2024-03-11',
      '2024-03-12',
      '2024-03-13',
      '2024-03-14',
      '2024-03-15',
      '2024-03-16',
      '2024-03-17',
    ]);
    expect(stats.totalPomodoros).toBe(0);
    expect(stats.totalFocusMs).toBe(0);
  });

  it('aggregiert Fokuszeit pro Tag und die Wochensummen', () => {
    const sessions = [
      focusOn('2024-03-11', 25),
      focusOn('2024-03-11', 25),
      focusOn('2024-03-13', 50),
      focusOn('2024-03-17', 10),
      focusOn('2024-03-18', 25), // nächste Woche → ignoriert
      focusOn('2024-03-10', 25), // vorige Woche (Sonntag davor) → ignoriert
    ];
    const stats = weekStats(sessions, reference);

    const byKey = Object.fromEntries(stats.days.map((d) => [d.dateKey, d]));
    expect(byKey['2024-03-11'].pomodoros).toBe(2);
    expect(byKey['2024-03-11'].focusMinutes).toBe(50);
    expect(byKey['2024-03-13'].pomodoros).toBe(1);
    expect(byKey['2024-03-13'].focusMinutes).toBe(50);
    expect(byKey['2024-03-17'].pomodoros).toBe(1);
    expect(byKey['2024-03-12'].pomodoros).toBe(0);

    expect(stats.totalPomodoros).toBe(4);
    expect(stats.totalFocusMs).toBe((25 + 25 + 50 + 10) * MIN);
    expect(stats.totalFocusMinutes).toBe(110);
  });

  it('ignoriert Pausen und abgebrochene Fokus-Sessions in der Wochensumme', () => {
    const sessions = [
      focusOn('2024-03-13', 25),
      session({ type: 'ShortBreak', dateKey: '2024-03-13' }),
      session({ type: 'Focus', dateKey: '2024-03-13', status: 'cancelled', completed: false }),
    ];
    const stats = weekStats(sessions, reference);
    expect(stats.totalPomodoros).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Historie (Req 11.4)
// ---------------------------------------------------------------------------

describe('history (Req 11.4)', () => {
  it('liefert ein leeres Array ohne Sessions', () => {
    expect(history([])).toEqual([]);
  });

  it('fasst Pomodoros und Fokuszeit pro Tag zusammen, neueste zuerst (Standard)', () => {
    const sessions = [
      focusOn('2024-03-10', 25),
      focusOn('2024-03-12', 25),
      focusOn('2024-03-12', 15),
      focusOn('2024-03-11', 20),
    ];
    const days = history(sessions);
    expect(days.map((d) => d.dateKey)).toEqual(['2024-03-12', '2024-03-11', '2024-03-10']);
    const march12 = days.find((d) => d.dateKey === '2024-03-12')!;
    expect(march12.pomodoros).toBe(2);
    expect(march12.focusMinutes).toBe(40);
  });

  it('kann chronologisch aufsteigend sortieren', () => {
    const sessions = [focusOn('2024-03-12'), focusOn('2024-03-10'), focusOn('2024-03-11')];
    const days = history(sessions, { descending: false });
    expect(days.map((d) => d.dateKey)).toEqual(['2024-03-10', '2024-03-11', '2024-03-12']);
  });

  it('nimmt nur Tage mit abgeschlossenen Pomodoros auf', () => {
    const sessions = [
      focusOn('2024-03-12'),
      session({ type: 'ShortBreak', dateKey: '2024-03-11' }),
      session({ type: 'Focus', dateKey: '2024-03-10', status: 'cancelled', completed: false }),
    ];
    const days = history(sessions);
    expect(days.map((d) => d.dateKey)).toEqual(['2024-03-12']);
  });
});

// ---------------------------------------------------------------------------
// Streak (Req 11.5)
// ---------------------------------------------------------------------------

describe('streak (Req 11.5)', () => {
  const today = '2024-03-13';

  it('ist 0 ohne Sessions', () => {
    expect(streak([], today)).toBe(0);
  });

  it('zählt aufeinanderfolgende Tage, die HEUTE enden', () => {
    const sessions = [
      focusOn('2024-03-13'),
      focusOn('2024-03-12'),
      focusOn('2024-03-11'),
    ];
    expect(streak(sessions, today)).toBe(3);
  });

  it('zählt mehrere Pomodoros pro Tag als einen Serientag', () => {
    const sessions = [
      focusOn('2024-03-13'),
      focusOn('2024-03-13'),
      focusOn('2024-03-12'),
    ];
    expect(streak(sessions, today)).toBe(2);
  });

  it('betrachtet die Serie als aktiv, wenn heute noch kein Pomodoro, aber gestern einer war', () => {
    const sessions = [
      focusOn('2024-03-12'),
      focusOn('2024-03-11'),
      focusOn('2024-03-10'),
    ];
    // Heute (13.) noch nichts, aber gestern (12.) → Serie zählt ab gestern rückwärts = 3.
    expect(streak(sessions, today)).toBe(3);
  });

  it('ist 0, wenn weder heute noch gestern ein Pomodoro vorliegt', () => {
    const sessions = [focusOn('2024-03-10'), focusOn('2024-03-09')];
    // Letzter Pomodoro am 10., heute ist der 13. → Serie unterbrochen.
    expect(streak(sessions, today)).toBe(0);
  });

  it('bricht die Serie bei einer Lücke ab', () => {
    const sessions = [
      focusOn('2024-03-13'),
      focusOn('2024-03-12'),
      // Lücke am 11.
      focusOn('2024-03-10'),
      focusOn('2024-03-09'),
    ];
    expect(streak(sessions, today)).toBe(2);
  });

  it('zählt eine lange, monatsübergreifende Serie korrekt', () => {
    // 2024-03-01 zurück bis 2024-02-28 (Schaltjahr) → durchgehende Serie.
    const keys = ['2024-03-02', '2024-03-01', '2024-02-29', '2024-02-28'];
    const sessions = keys.map((k) => focusOn(k));
    expect(streak(sessions, '2024-03-02')).toBe(4);
  });

  it('ignoriert abgebrochene Fokus-Sessions und Pausen für die Serie', () => {
    const sessions = [
      focusOn('2024-03-13'),
      session({ type: 'Focus', dateKey: '2024-03-12', status: 'cancelled', completed: false }),
      session({ type: 'ShortBreak', dateKey: '2024-03-12' }),
    ];
    // Der 12. hat keinen gültigen Pomodoro → Serie ist nur der heutige Tag.
    expect(streak(sessions, today)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dateKeyFromEpoch
// ---------------------------------------------------------------------------

describe('dateKeyFromEpoch', () => {
  it('leitet einen lokalen YYYY-MM-DD-Schlüssel ab', () => {
    // Lokale Mitternacht eines bekannten Datums.
    const local = new Date(2024, 2, 13, 0, 0, 0).getTime(); // 2024-03-13 lokal
    expect(dateKeyFromEpoch(local)).toBe('2024-03-13');
  });
});
