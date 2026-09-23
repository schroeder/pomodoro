// Zyklus-Logik der Pomodoro-Zustandsmaschine (reine, unit-testbare Funktion).
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitt „ADVANCE / Nächste Phase
// bestimmen") und Requirement 2.
//
// Kernalgorithmus (design.md):
//   nextPhase(state, settings):
//     wenn aktuelle Phase == Focus (und als abgeschlossen gewertet):
//        wenn completedFocusInCycle >= settings.focusPerCycle:  -> LongBreak
//        sonst:                                                 -> ShortBreak
//     wenn aktuelle Phase == ShortBreak:                        -> Focus (pomodoroNumberInCycle++)
//     wenn aktuelle Phase == LongBreak:                         -> Focus, RESET_CYCLE
//
// Wichtig zur Zählweise (Req 2.4, 2.5):
// - Die Wertung einer Fokusphase als abgeschlossener Pomodoro erfolgt bereits beim
//   Abschluss (EXPIRE/COMPLETE_EARLY erhöhen `completedFocusInCycle`).
// - Beim ADVANCE aus einem abgeschlossenen Fokus ist der Zähler daher schon erhöht,
//   sodass hier nicht erneut gezählt wird (`countFocus = false`).
// - Beim SKIP eines Fokus zählt dieser NICHT als Pomodoro (`countFocus = false`).
//
// Die Funktion ist rein: Sie liest ausschließlich die zyklusrelevanten Felder des
// Zustands und die Einstellungen und liefert die zyklusrelevanten Felder der nächsten
// Phase zurück. Sie mutiert nichts.

import type { PhaseType, Settings, TimerState } from '../types';

/** Zyklusrelevanter Ausschnitt des Timerzustands, den `nextPhase` benötigt. */
export type CycleState = Pick<
  TimerState,
  'phaseType' | 'completedFocusInCycle' | 'pomodoroNumberInCycle'
>;

/** Ergebnis von `nextPhase`: die zyklusrelevanten Felder der nächsten Phase. */
export interface NextPhaseResult {
  /** Typ der nächsten Phase. */
  phaseType: PhaseType;
  /** Anzahl abgeschlossener Fokusphasen im (ggf. zurückgesetzten) Zyklus. */
  completedFocusInCycle: number;
  /** 1-basierte Nummer der aktuellen/nächsten Fokusphase im Zyklus. */
  pomodoroNumberInCycle: number;
}

/**
 * Bestimmt die nächste Phase im Pomodoro-Zyklus.
 *
 * @param state Zyklusrelevanter Zustand der aktuellen Phase.
 * @param settings Einstellungen (u. a. `focusPerCycle`).
 * @param options.countFocus
 *   Ob die aktuelle Fokusphase im Rahmen dieses Übergangs als abgeschlossener Pomodoro
 *   gezählt werden soll. Standard: `false`, weil die Wertung normalerweise bereits beim
 *   Abschluss (EXPIRE/COMPLETE_EARLY) erfolgt ist. Für Aufrufer, die den Fokus erst hier
 *   werten wollen, kann `true` übergeben werden. Bei SKIP eines Fokus bleibt es `false`.
 *
 * @returns Die zyklusrelevanten Felder der nächsten Phase.
 *
 * Verhalten:
 * - Focus  → LongBreak, wenn (ggf. erhöhter) `completedFocusInCycle` ≥ `focusPerCycle`,
 *            sonst ShortBreak. `pomodoroNumberInCycle` bleibt unverändert.
 * - ShortBreak → Focus; `pomodoroNumberInCycle` wird erhöht.
 * - LongBreak  → Focus; der Zyklus wird zurückgesetzt
 *                (`completedFocusInCycle = 0`, `pomodoroNumberInCycle = 1`).
 */
export function nextPhase(
  state: CycleState,
  settings: Settings,
  options: { countFocus?: boolean } = {},
): NextPhaseResult {
  const { phaseType, completedFocusInCycle, pomodoroNumberInCycle } = state;
  const countFocus = options.countFocus ?? false;

  switch (phaseType) {
    case 'Focus': {
      // Zähler nur erhöhen, wenn der Fokus im Rahmen dieses Übergangs gewertet werden soll.
      const completed = countFocus ? completedFocusInCycle + 1 : completedFocusInCycle;
      const nextIsLong = completed >= settings.focusPerCycle;
      return {
        phaseType: nextIsLong ? 'LongBreak' : 'ShortBreak',
        completedFocusInCycle: completed,
        pomodoroNumberInCycle,
      };
    }

    case 'ShortBreak':
      return {
        phaseType: 'Focus',
        completedFocusInCycle,
        pomodoroNumberInCycle: pomodoroNumberInCycle + 1,
      };

    case 'LongBreak':
      // Nach der langen Pause beginnt der Zyklus erneut mit einer Fokusphase.
      return {
        phaseType: 'Focus',
        completedFocusInCycle: 0,
        pomodoroNumberInCycle: 1,
      };
  }
}
