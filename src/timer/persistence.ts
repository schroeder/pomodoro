// Persistenz und Wiederherstellung des Timerzustands.
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitt „Persistenz") und
// den Anforderungen 7.1–7.5, 20.1.
//
// Leitprinzipien:
// - Timestamp-basiert: Die Wiederherstellung bewertet ausschließlich `endsAt` gegen
//   die aktuelle Uhrzeit (`now`), nicht ein heruntergezähltes Intervall (Req 6/7).
// - Deterministisch testbar: Die reine Hydration-Logik akzeptiert ein injizierbares
//   `now` (ms seit Epoch), sodass sie ohne echte Uhr geprüft werden kann.
// - Robustheit: Alle localStorage-Zugriffe sind mit try/catch abgesichert; bei
//   fehlendem/kaputtem Speicher wird ein In-Memory-Fallback genutzt (Req 7.5 / 20.1).
//
// Diese Datei enthält bewusst KEINE React-/Provider-Logik. Das Verdrahten mit dem
// TimerProvider erfolgt in einem separaten Schritt (Task 5).

import type { TimerState } from '../types';
import { timerReducer } from './timerReducer';

/** localStorage-Schlüssel für den serialisierten Timerzustand (design.md). */
export const TIMER_STORAGE_KEY = 'pomodoro.timer.v1';

/**
 * Prüft strukturell, ob ein beliebiger Wert einem persistierten {@link TimerState}
 * entspricht. Dient als Schutz gegen defekte/fremde Daten im Speicher.
 */
function isTimerState(value: unknown): value is TimerState {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;

  const phaseOk =
    v.phaseType === 'Focus' || v.phaseType === 'ShortBreak' || v.phaseType === 'LongBreak';
  const statusOk =
    v.status === 'Ready' ||
    v.status === 'Running' ||
    v.status === 'Paused' ||
    v.status === 'Completed' ||
    v.status === 'Cancelled';
  const endsAtOk = v.endsAt === null || typeof v.endsAt === 'number';
  const startedAtOk = v.startedAt === null || typeof v.startedAt === 'number';

  return (
    phaseOk &&
    statusOk &&
    endsAtOk &&
    startedAtOk &&
    typeof v.plannedDurationMs === 'number' &&
    typeof v.remainingMs === 'number' &&
    typeof v.completedFocusInCycle === 'number' &&
    typeof v.pomodoroNumberInCycle === 'number' &&
    typeof v.notificationPrompted === 'boolean'
  );
}

/**
 * Wendet die Wiederherstellungsregeln auf einen persistierten Timerzustand an (rein).
 *
 * Regeln (design.md „Hydration beim Start", Req 7.2–7.4):
 * - `Running` und `endsAt` liegt in der Vergangenheit (`now >= endsAt`) →
 *   als `Completed` rekonstruieren. Für eine Fokusphase wird die reguläre
 *   Ablauf-Wertung des Reducers (EXPIRE) angewandt, sodass der Pomodoro zählt (Req 7.4).
 * - `Running` mit verbleibender Zeit → weiterlaufen lassen; `remainingMs` wird aus
 *   `endsAt - now` aktualisiert (Anzeige bleibt korrekt, Req 7.2).
 * - `Paused` → pausiert lassen, NICHT automatisch fortsetzen (Req 7.3).
 * - Alle anderen Zustände (Ready/Completed/Cancelled) → unverändert übernehmen.
 *
 * @param persisted Der aus dem Speicher gelesene Zustand.
 * @param now Aktuelle Zeit in ms seit Epoch (injizierbar für Tests).
 * @returns Der wiederhergestellte Zustand (neues Objekt, mutiert die Eingabe nicht).
 */
export function hydrateTimerState(persisted: TimerState, now: number): TimerState {
  if (persisted.status === 'Running' && persisted.endsAt !== null) {
    if (now >= persisted.endsAt) {
      // Endzeit bereits verstrichen → als abgelaufen behandeln (Req 7.4).
      // Reducer-EXPIRE-Logik wiederverwenden: setzt Completed und wertet einen
      // Fokus als abgeschlossenen Pomodoro.
      return timerReducer(persisted, { type: 'EXPIRE', now });
    }
    // Noch Zeit übrig → weiterlaufen lassen, Anzeige-Restzeit aktualisieren (Req 7.2).
    return {
      ...persisted,
      remainingMs: persisted.endsAt - now,
    };
  }

  // Paused/Ready/Completed/Cancelled unverändert übernehmen (u. a. Req 7.3).
  return { ...persisted };
}

/**
 * Ergebnis des Ladens: der (ggf. hydrierte) Zustand – oder `null`, wenn kein gültiger
 * Zustand vorlag – plus die Info, ob persistenter Speicher verfügbar ist.
 */
export interface LoadResult {
  /** Der wiederhergestellte Timerzustand oder `null`, wenn keiner vorlag/gültig war. */
  state: TimerState | null;
  /** True, wenn localStorage lesbar war (kein In-Memory-Fallback nötig, Req 7.5/20.1). */
  available: boolean;
}

/**
 * Lädt den persistierten Timerzustand aus localStorage und wendet die
 * Wiederherstellungsregeln an (Req 7.1–7.5).
 *
 * Ist der Speicher nicht zugreifbar (Privatmodus, Quota, SecurityError), wird
 * `available: false` gemeldet und die App läuft in-memory weiter (Req 7.5 / 20.1).
 * Ein lesbarer, aber defekter/fremder Inhalt (kaputtes JSON, ungültige Struktur) wird
 * verworfen (`state: null`), gilt aber weiterhin als verfügbarer Speicher.
 *
 * @param now Aktuelle Zeit in ms seit Epoch (injizierbar für deterministische Tests).
 */
export function loadTimerState(now: number = Date.now()): LoadResult {
  try {
    if (typeof localStorage === 'undefined') {
      return { state: null, available: false };
    }
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (raw == null) {
      // Speicher ist verfügbar, es existiert nur (noch) kein Timerzustand.
      return { state: null, available: true };
    }
    // Der Lesezugriff war erfolgreich → Speicher ist verfügbar. Defektes JSON oder
    // strukturell ungültige Daten führen NICHT zum In-Memory-Fallback, sondern werden
    // lediglich verworfen (available bleibt true).
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { state: null, available: true };
    }
    if (!isTimerState(parsed)) {
      // Defekte/fremde Daten ignorieren, aber Speicher gilt als verfügbar.
      return { state: null, available: true };
    }
    return { state: hydrateTimerState(parsed, now), available: true };
  } catch {
    // Kein Zugriff möglich (Privatmodus, Quota, SecurityError) → In-Memory-Fallback.
    return { state: null, available: false };
  }
}

/**
 * Versucht, den Timerzustand zu persistieren; meldet den Erfolg (Req 7.1, 20.1).
 * Der aufrufende TimerProvider kann bei `false` auf In-Memory-Betrieb umschalten.
 *
 * @returns `true`, wenn geschrieben werden konnte, sonst `false`.
 */
export function saveTimerState(state: TimerState): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Privatmodus/Quota → kein persistenter Speicher verfügbar.
    return false;
  }
}

/**
 * Entfernt den persistierten Timerzustand (z. B. beim Zurücksetzen). Fehlerfrei bei
 * fehlendem Speicher.
 *
 * @returns `true`, wenn der Aufruf ohne Ausnahme durchlief.
 */
export function clearTimerState(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(TIMER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
