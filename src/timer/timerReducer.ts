// Reine Zustandsmaschine des Timers (unit-testbar).
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitt „Kernkomponente: Timer-Engine").
//
// Leitprinzipien:
// - Timestamp-basiert: `endsAt` ist die absolute Endzeit; die verbleibende Zeit wird
//   im laufenden Zustand aus `now` und `endsAt` abgeleitet (Req 6.2).
// - Deterministisch testbar: Aktionen, die die aktuelle Uhrzeit benötigen, tragen ein
//   injizierbares `now` (ms seit Epoch).
// - Pomodoro-Wertung erfolgt ausschließlich bei regulärem Ablauf (EXPIRE) oder beim
//   expliziten „Früher abschließen" (COMPLETE_EARLY) einer Fokusphase – nicht bei
//   CANCEL oder SKIP (Req 2.4, 2.5).

import type { PhaseType, Settings, TimerState } from '../types';
import { nextPhase } from './cycle';

/** Aktionen der Timer-Zustandsmaschine. */
export type TimerAction =
  // Ready -> Running: endsAt = now + remainingMs
  | { type: 'START'; now: number }
  // Running -> Paused: remainingMs einfrieren
  | { type: 'PAUSE'; now: number }
  // Paused -> Running: endsAt neu setzen
  | { type: 'RESUME'; now: number }
  // -> Ready mit der geplanten Dauer der aktuellen Phase (Sicherheitsabfrage in der UI)
  | { type: 'RESTART' }
  // -> Cancelled (keine Pomodoro-Wertung)
  | { type: 'CANCEL' }
  // Aktuelle Phase ohne Wertung beenden -> nächste Phase vorbereiten (Ready)
  | { type: 'SKIP'; settings: Settings }
  // endsAt/plannedDuration verlängern
  | { type: 'EXTEND'; ms: number; now: number }
  // Fokusphase manuell als abgeschlossen werten (nur Focus)
  | { type: 'COMPLETE_EARLY'; now: number }
  // Anzeige neu berechnen; wenn now >= endsAt -> wie EXPIRE behandeln
  | { type: 'TICK'; now: number }
  // Zeit abgelaufen -> Completed (Fokus wird als Pomodoro gewertet)
  | { type: 'EXPIRE'; now: number }
  // Completed -> nächste Phase (Ready)
  | { type: 'ADVANCE'; settings: Settings }
  // Aus Persistenz wiederherstellen
  | { type: 'HYDRATE'; state: TimerState }
  // Zyklus zurücksetzen (completedFocusInCycle=0, pomodoroNumberInCycle=1)
  | { type: 'RESET_CYCLE' };

/** Nicht-negative Restzeit; klemmt negative Werte auf 0 (Req 20.2). */
function clampRemaining(ms: number): number {
  return ms > 0 ? ms : 0;
}

/** Geplante Dauer einer Phase in ms anhand der Einstellungen. */
export function durationForPhase(phaseType: PhaseType, settings: Settings): number {
  switch (phaseType) {
    case 'Focus':
      return settings.focusMinutes * 60_000;
    case 'ShortBreak':
      return settings.shortBreakMinutes * 60_000;
    case 'LongBreak':
      return settings.longBreakMinutes * 60_000;
  }
}

/** Bereitet einen Ready-Zustand für die gegebene Phase vor. */
function prepareReadyPhase(
  phaseType: PhaseType,
  settings: Settings,
  completedFocusInCycle: number,
  pomodoroNumberInCycle: number,
  notificationPrompted: boolean,
): TimerState {
  const plannedDurationMs = durationForPhase(phaseType, settings);
  return {
    phaseType,
    status: 'Ready',
    plannedDurationMs,
    endsAt: null,
    remainingMs: plannedDurationMs,
    startedAt: null,
    completedFocusInCycle,
    pomodoroNumberInCycle,
    notificationPrompted,
  };
}

/**
 * Reine Reducer-Funktion der Timer-Zustandsmaschine.
 * Gibt bei nicht anwendbaren Aktionen den unveränderten Zustand zurück.
 */
export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START': {
      // Nur aus Ready starten. endsAt aus der geplanten/erhaltenen Restzeit ableiten.
      if (state.status !== 'Ready') return state;
      return {
        ...state,
        status: 'Running',
        endsAt: action.now + state.remainingMs,
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'RESUME': {
      // Nur aus Paused fortsetzen; endsAt neu auf Basis der erhaltenen Restzeit setzen.
      if (state.status !== 'Paused') return state;
      return {
        ...state,
        status: 'Running',
        endsAt: action.now + state.remainingMs,
      };
    }

    case 'PAUSE': {
      // Nur aus Running pausieren; Restzeit aus endsAt einfrieren und klemmen.
      if (state.status !== 'Running' || state.endsAt === null) return state;
      return {
        ...state,
        status: 'Paused',
        remainingMs: clampRemaining(state.endsAt - action.now),
        endsAt: null,
      };
    }

    case 'EXTEND': {
      // Geplante Dauer und – falls laufend – endsAt/erhaltene Restzeit verlängern.
      const plannedDurationMs = state.plannedDurationMs + action.ms;
      if (state.status === 'Running' && state.endsAt !== null) {
        return {
          ...state,
          plannedDurationMs,
          endsAt: state.endsAt + action.ms,
        };
      }
      // In Ready/Paused: Restzeit direkt anheben.
      return {
        ...state,
        plannedDurationMs,
        remainingMs: state.remainingMs + action.ms,
      };
    }

    case 'RESTART': {
      // Aktuelle Phase auf ihre geplante Dauer zurücksetzen und in Ready versetzen.
      // plannedDurationMs bleibt als „konfigurierte Dauer der aktuellen Phase" erhalten.
      return {
        ...state,
        status: 'Ready',
        endsAt: null,
        remainingMs: state.plannedDurationMs,
        startedAt: null,
      };
    }

    case 'CANCEL': {
      // Phase abbrechen: keine Pomodoro-Wertung, keine Zählerveränderung.
      return {
        ...state,
        status: 'Cancelled',
        endsAt: null,
        remainingMs: 0,
      };
    }

    case 'TICK': {
      // Nur im laufenden Zustand relevant; bei Ablauf wie EXPIRE behandeln.
      if (state.status !== 'Running' || state.endsAt === null) return state;
      if (action.now >= state.endsAt) {
        return timerReducer(state, { type: 'EXPIRE', now: action.now });
      }
      return state;
    }

    case 'EXPIRE': {
      // Zeit abgelaufen -> Completed. Fokusphase wird als Pomodoro gewertet.
      // Idempotent: bereits abgeschlossene Phasen erneut zu „expiren" ändert nichts.
      if (state.status === 'Completed' || state.status === 'Cancelled') return state;
      const wasFocus = state.phaseType === 'Focus';
      return {
        ...state,
        status: 'Completed',
        endsAt: null,
        remainingMs: 0,
        completedFocusInCycle: wasFocus
          ? state.completedFocusInCycle + 1
          : state.completedFocusInCycle,
      };
    }

    case 'COMPLETE_EARLY': {
      // Nur bei Fokus möglich: manuell als abgeschlossen werten (wie regulärer Abschluss).
      if (state.phaseType !== 'Focus') return state;
      if (state.status !== 'Running' && state.status !== 'Paused') return state;
      return {
        ...state,
        status: 'Completed',
        endsAt: null,
        remainingMs: 0,
        completedFocusInCycle: state.completedFocusInCycle + 1,
      };
    }

    case 'SKIP': {
      // Aktuelle Phase ohne Wertung beenden -> nächste Phase vorbereiten (Ready).
      // Ein übersprungener Fokus zählt NICHT als Pomodoro (countFocus = false).
      const next = nextPhase(state, action.settings, { countFocus: false });
      return prepareReadyPhase(
        next.phaseType,
        action.settings,
        next.completedFocusInCycle,
        next.pomodoroNumberInCycle,
        state.notificationPrompted,
      );
    }

    case 'ADVANCE': {
      // Aus Completed in die nächste Phase (Ready). Ob der Fokus gewertet wurde, ist
      // bereits in completedFocusInCycle reflektiert (EXPIRE/COMPLETE_EARLY haben erhöht),
      // daher hier countFocus = false, um nicht doppelt zu zählen.
      const next = nextPhase(state, action.settings, { countFocus: false });
      return prepareReadyPhase(
        next.phaseType,
        action.settings,
        next.completedFocusInCycle,
        next.pomodoroNumberInCycle,
        state.notificationPrompted,
      );
    }

    case 'HYDRATE': {
      // Zustand aus Persistenz übernehmen.
      return action.state;
    }

    case 'RESET_CYCLE': {
      // Zyklus-Zähler zurücksetzen; Phase/Status unverändert.
      return {
        ...state,
        completedFocusInCycle: 0,
        pomodoroNumberInCycle: 1,
      };
    }

    default:
      return state;
  }
}
