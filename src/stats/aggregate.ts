// Aggregationen für die Statistik (Heute/Woche/Historie/Streak).
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitte „StatsView", „Teststrategie")
// und den Anforderungen 11.2, 11.3, 11.4, 11.5.
//
// Leitprinzipien:
// - REINE Funktionen: Dieses Modul greift NICHT auf IndexedDB, DOM oder eine globale Uhr
//   zu. Alle Funktionen erhalten die Sessions und – wo nötig – ein injizierbares
//   Referenzdatum (`todayKey`/`referenceEpochMs`), damit sie deterministisch und
//   unit-testbar sind (design.md „Teststrategie": „Zeit wird über injizierbaren
//   `now`-Parameter deterministisch getestet.").
// - Nur ABGESCHLOSSENE Fokus-Sessions zählen für Pomodoro-/Fokuszeit-Metriken (Req 11.2).
//   Pausen werden separat gezählt, falls in den Sessions vorhanden.
// - Der `dateKey` (`YYYY-MM-DD`, lokal) ist die kanonische Tageskennung. Da das Format
//   lexikografisch sortierbar ist, entspricht String-Sortierung der chronologischen.

import type { Session } from '../types';

// ---------------------------------------------------------------------------
// Datums-Helfer (rein, injizierbare Referenz)
// ---------------------------------------------------------------------------

/**
 * Leitet den lokalen Datumsschlüssel `YYYY-MM-DD` aus einem Epoch-Zeitstempel (ms) ab.
 * Verwendet die lokale Zeitzone (identisch zur Erzeugung in `db.ts`/`TimerProvider`).
 */
export function dateKeyFromEpoch(epochMs: number): string {
  const d = new Date(epochMs);
  return dateKeyFromDate(d);
}

/** Leitet den lokalen Datumsschlüssel `YYYY-MM-DD` aus einem `Date` ab. */
export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parst einen `YYYY-MM-DD`-Schlüssel in ein lokales `Date` (Mitternacht lokal).
 * Wird für die Streak-/Wochenberechnung genutzt (Tagesarithmetik ohne UTC-Drift).
 */
export function dateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((s) => Number(s));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Addiert `days` (kann negativ sein) zu einem Datumsschlüssel und liefert den neuen Schlüssel. */
export function addDaysToKey(dateKey: string, days: number): string {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + days);
  return dateKeyFromDate(d);
}

/**
 * Liefert den Datumsschlüssel des Wochenstarts (Montag) für den gegebenen Schlüssel.
 * Wochen beginnen am Montag (ISO-Konvention), passend zur deutschsprachigen UI.
 */
export function startOfWeekKey(dateKey: string): string {
  const d = dateFromKey(dateKey);
  // getDay(): 0=So..6=Sa. Montag als Wochenstart → Offset berechnen.
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7; // So(0)->6, Mo(1)->0, ..., Sa(6)->5
  return addDaysToKey(dateKey, -diffToMonday);
}

/**
 * Liefert die sieben Datumsschlüssel (Mo..So) der Woche, die `dateKey` enthält.
 * Der Rückgabe-Array ist chronologisch sortiert (Index 0 = Montag).
 */
export function weekDayKeys(dateKey: string): string[] {
  const start = startOfWeekKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

// ---------------------------------------------------------------------------
// Session-Filter
// ---------------------------------------------------------------------------

/**
 * True, wenn die Session ein abgeschlossener Fokus-Pomodoro ist – die Grundlage
 * aller Pomodoro-/Fokuszeit-Metriken (Req 11.1/11.2).
 */
export function isCompletedFocus(session: Session): boolean {
  return (
    session.type === 'Focus' &&
    session.completed === true &&
    session.status === 'completed'
  );
}

/** True, wenn die Session eine Pause (kurz oder lang) ist. */
export function isBreak(session: Session): boolean {
  return session.type === 'ShortBreak' || session.type === 'LongBreak';
}

// ---------------------------------------------------------------------------
// Heute (Req 11.2)
// ---------------------------------------------------------------------------

/** Aggregierte Kennzahlen für „Heute" (Req 11.2). */
export interface TodayStats {
  /** Der zugrunde liegende Tagesschlüssel (`YYYY-MM-DD`). */
  dateKey: string;
  /** Anzahl abgeschlossener Fokus-Pomodoros heute. */
  pomodoros: number;
  /** Gesamte Fokuszeit heute in ms (Summe der tatsächlichen Fokusdauern). */
  focusMs: number;
  /** Gesamte Fokuszeit heute in Minuten (gerundet auf ganze Minuten). */
  focusMinutes: number;
  /** Durchschnittliche Fokusdauer heute in ms (0, wenn keine Pomodoros). */
  averageFocusMs: number;
  /** Durchschnittliche Fokusdauer heute in Minuten (gerundet, 0 ohne Pomodoros). */
  averageFocusMinutes: number;
  /** Anzahl der heute erfassten Pausen (falls Pausen dokumentiert werden). */
  breaks: number;
}

/**
 * Berechnet die „Heute"-Kennzahlen aus allen Sessions.
 *
 * @param sessions Alle bekannten Sessions (Filterung auf heute erfolgt intern).
 * @param todayKey Referenz-Tagesschlüssel `YYYY-MM-DD` (injizierbar für Tests).
 */
export function todayStats(sessions: Session[], todayKey: string): TodayStats {
  const todays = sessions.filter((s) => s.dateKey === todayKey);
  const focus = todays.filter(isCompletedFocus);
  const pomodoros = focus.length;
  const focusMs = focus.reduce((sum, s) => sum + Math.max(0, s.actualDurationMs), 0);
  const averageFocusMs = pomodoros > 0 ? focusMs / pomodoros : 0;
  const breaks = todays.filter(isBreak).length;

  return {
    dateKey: todayKey,
    pomodoros,
    focusMs,
    focusMinutes: msToMinutes(focusMs),
    averageFocusMs,
    averageFocusMinutes: msToMinutes(averageFocusMs),
    breaks,
  };
}

// ---------------------------------------------------------------------------
// Woche (Req 11.3)
// ---------------------------------------------------------------------------

/** Fokuszeit/Pomodoros eines einzelnen Wochentags. */
export interface WeekDayStat {
  /** Tagesschlüssel `YYYY-MM-DD`. */
  dateKey: string;
  /** Abgeschlossene Pomodoros an diesem Tag. */
  pomodoros: number;
  /** Fokuszeit an diesem Tag in ms. */
  focusMs: number;
  /** Fokuszeit an diesem Tag in Minuten (gerundet). */
  focusMinutes: number;
}

/** Aggregierte Kennzahlen für „Diese Woche" (Req 11.3). */
export interface WeekStats {
  /** Tagesschlüssel des Wochenstarts (Montag). */
  weekStartKey: string;
  /** Die sieben Tage der Woche (Mo..So), stets vollständig und chronologisch. */
  days: WeekDayStat[];
  /** Gesamtzahl der Pomodoros in der Woche. */
  totalPomodoros: number;
  /** Gesamte Fokuszeit der Woche in ms. */
  totalFocusMs: number;
  /** Gesamte Fokuszeit der Woche in Minuten (gerundet). */
  totalFocusMinutes: number;
}

/**
 * Berechnet die „Diese Woche"-Kennzahlen inklusive Fokuszeit pro Tag (Req 11.3).
 *
 * Die zurückgegebenen `days` sind IMMER genau sieben Einträge (Mo..So), auch für Tage
 * ohne Sessions (Werte 0) – so lässt sich das Balkendiagramm direkt darauf abbilden.
 *
 * @param sessions Alle bekannten Sessions.
 * @param referenceKey Ein Tagesschlüssel innerhalb der gewünschten Woche (z. B. heute).
 */
export function weekStats(sessions: Session[], referenceKey: string): WeekStats {
  const keys = weekDayKeys(referenceKey);
  const weekStartKey = keys[0];
  const keySet = new Set(keys);

  // Nur abgeschlossene Fokus-Sessions dieser Woche berücksichtigen.
  const focus = sessions.filter((s) => isCompletedFocus(s) && keySet.has(s.dateKey));

  // Pro-Tag-Aggregation vorbereiten (alle sieben Tage mit Nullwerten).
  const perDay = new Map<string, { pomodoros: number; focusMs: number }>();
  for (const key of keys) {
    perDay.set(key, { pomodoros: 0, focusMs: 0 });
  }
  for (const s of focus) {
    const entry = perDay.get(s.dateKey);
    if (entry) {
      entry.pomodoros += 1;
      entry.focusMs += Math.max(0, s.actualDurationMs);
    }
  }

  const days: WeekDayStat[] = keys.map((key) => {
    const entry = perDay.get(key) ?? { pomodoros: 0, focusMs: 0 };
    return {
      dateKey: key,
      pomodoros: entry.pomodoros,
      focusMs: entry.focusMs,
      focusMinutes: msToMinutes(entry.focusMs),
    };
  });

  const totalPomodoros = days.reduce((sum, d) => sum + d.pomodoros, 0);
  const totalFocusMs = days.reduce((sum, d) => sum + d.focusMs, 0);

  return {
    weekStartKey,
    days,
    totalPomodoros,
    totalFocusMs,
    totalFocusMinutes: msToMinutes(totalFocusMs),
  };
}

// ---------------------------------------------------------------------------
// Historie (Req 11.4)
// ---------------------------------------------------------------------------

/** Zusammenfassung eines vergangenen Tages für die Historienliste (Req 11.4). */
export interface HistoryDay {
  /** Tagesschlüssel `YYYY-MM-DD`. */
  dateKey: string;
  /** Abgeschlossene Pomodoros an diesem Tag. */
  pomodoros: number;
  /** Fokuszeit an diesem Tag in ms. */
  focusMs: number;
  /** Fokuszeit an diesem Tag in Minuten (gerundet). */
  focusMinutes: number;
}

/**
 * Erzeugt eine Tages-Historie (Pomodoros + Fokuszeit pro Tag) aus allen Sessions (Req 11.4).
 *
 * Es werden nur Tage aufgenommen, an denen mindestens ein abgeschlossener Fokus-Pomodoro
 * vorliegt. Standardmäßig absteigend nach Datum sortiert (neueste zuerst), was der
 * typischen Darstellung „vergangene Tage" entspricht.
 *
 * @param sessions Alle bekannten Sessions.
 * @param options.descending `true` (Standard) sortiert neueste zuerst; `false` chronologisch.
 */
export function history(
  sessions: Session[],
  options: { descending?: boolean } = {},
): HistoryDay[] {
  const descending = options.descending ?? true;
  const perDay = new Map<string, { pomodoros: number; focusMs: number }>();

  for (const s of sessions) {
    if (!isCompletedFocus(s)) continue;
    const entry = perDay.get(s.dateKey) ?? { pomodoros: 0, focusMs: 0 };
    entry.pomodoros += 1;
    entry.focusMs += Math.max(0, s.actualDurationMs);
    perDay.set(s.dateKey, entry);
  }

  const days: HistoryDay[] = Array.from(perDay.entries()).map(([dateKey, entry]) => ({
    dateKey,
    pomodoros: entry.pomodoros,
    focusMs: entry.focusMs,
    focusMinutes: msToMinutes(entry.focusMs),
  }));

  // `dateKey` (YYYY-MM-DD) ist lexikografisch = chronologisch sortierbar.
  days.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
  if (descending) days.reverse();
  return days;
}

// ---------------------------------------------------------------------------
// Streak (Req 11.5)
// ---------------------------------------------------------------------------

/**
 * Berechnet die Fokus-Serie (Streak): die Anzahl aufeinanderfolgender Tage mit
 * mindestens einem abgeschlossenen Fokus-Pomodoro (Req 11.5).
 *
 * Regel für den Endpunkt der Serie (dokumentiert):
 * - Hat HEUTE bereits mindestens einen Pomodoro, endet die Serie heute und wird ab heute
 *   rückwärts gezählt.
 * - Hat heute NOCH keinen Pomodoro, aber GESTERN gab es einen, gilt die Serie als weiterhin
 *   aktiv (der Tag ist noch nicht vorbei). Es wird dann ab gestern rückwärts gezählt.
 *   So „bricht" ein noch laufender Tag ohne Pomodoro die bestehende Serie nicht.
 * - Gibt es weder heute noch gestern einen Pomodoro, ist die aktuelle Serie 0.
 * - Eine Lücke (ein Tag ohne Pomodoro innerhalb der Kette) beendet die Serie.
 * - Ohne Sessions ist die Serie 0.
 *
 * @param sessions Alle bekannten Sessions.
 * @param todayKey Referenz-Tagesschlüssel `YYYY-MM-DD` (injizierbar für Tests).
 */
export function streak(sessions: Session[], todayKey: string): number {
  // Menge der Tage mit mindestens einem abgeschlossenen Fokus-Pomodoro.
  const daysWithPomodoro = new Set<string>();
  for (const s of sessions) {
    if (isCompletedFocus(s)) {
      daysWithPomodoro.add(s.dateKey);
    }
  }
  if (daysWithPomodoro.size === 0) return 0;

  const yesterdayKey = addDaysToKey(todayKey, -1);

  // Startpunkt bestimmen: heute (falls Pomodoro vorhanden), sonst gestern (falls dort
  // einer vorhanden ist). Andernfalls ist die aktuelle Serie unterbrochen → 0.
  let cursor: string;
  if (daysWithPomodoro.has(todayKey)) {
    cursor = todayKey;
  } else if (daysWithPomodoro.has(yesterdayKey)) {
    cursor = yesterdayKey;
  } else {
    return 0;
  }

  // Rückwärts zählen, solange jeder Tag einen Pomodoro hat.
  let count = 0;
  while (daysWithPomodoro.has(cursor)) {
    count += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Rechnet Millisekunden in ganze Minuten um (kaufmännisch gerundet). */
export function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}
