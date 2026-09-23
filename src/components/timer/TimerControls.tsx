// TimerControls – kontextabhängige Steuerung je Timer-Zustand (Req 1, 4, 5.4).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht" →
// „TimerControls"):
//   - Ready:     Start (prominenter Ein-Klick-Start, Req 1); Neustart aus.
//   - Running:   Pause, Verlängern (+1/+5/+10, Req 4.7), Abbrechen, Neustart (mit
//                Sicherheitsabfrage, Req 4.4), Überspringen, „Früher abschließen"
//                (nur Focus, mit Abfrage, Req 4.8).
//   - Paused:    Fortsetzen, Neustart (mit Abfrage), Abbrechen, Überspringen.
//   - Completed: „Pause starten" / „Fokus starten" – bewusster Start der nächsten
//                Phase (Req 5.4). Die Beschriftung richtet sich nach der NÄCHSTEN Phase.
//   - Cancelled: Erneut starten (zurück zur selben Phase in Ready).
//
// Der Neustart und „Früher abschließen" öffnen einen ConfirmDialog (Req 4.4/4.8). Die
// Verlängerung nutzt das ExtendMenu (Req 4.7).
//
// Diese Datei stellt zwei Dinge bereit:
//   1. `TimerControls` – rein PRÄSENTATIONAL: erhält `status`, `phaseType`, `nextPhaseType`
//      und Callbacks als Props. Dadurch ohne Provider unit-testbar.
//   2. `ConnectedTimerControls` – dünner Wrapper, der `useTimer()` liest und die
//      präsentationale Komponente verdrahtet (für die TimerView-Komposition).
//
// Alle Buttons erfüllen die Mindest-Touch-Zielgröße (44×44 px, siehe CSS) und tragen
// klare deutsche Beschriftungen (Req 14.4/18).

import { useState } from 'react';
import type { PhaseType, TimerStatus } from '../../types';
import { PHASE_LABELS } from '../../services/documentTitle';
import { useTimer } from '../../timer/TimerProvider';
import ExtendMenu from './ExtendMenu';
import ConfirmDialog from './ConfirmDialog';
import styles from './TimerControls.module.css';

/** Bestätigungstext für „Phase früher abschließen" (spec.md §Phase früher abschließen). */
export const COMPLETE_EARLY_CONFIRM_TITLE = 'Fokusphase als abgeschlossen markieren?';
/** Bestätigungstext für den Neustart (Req 4.4). */
export const RESTART_CONFIRM_TITLE = 'Phase neu starten?';
export const RESTART_CONFIRM_DESCRIPTION =
  'Die aktuelle Phase wird auf ihre konfigurierte Dauer zurückgesetzt.';

export interface TimerControlsProps {
  /** Aktueller Timer-Status. */
  status: TimerStatus;
  /** Aktueller Phasentyp (bestimmt u. a. die Sichtbarkeit von „Früher abschließen"). */
  phaseType: PhaseType;
  /**
   * Phasentyp der nächsten Phase – bestimmt die Beschriftung der Übergangs-Schaltfläche
   * im Zustand Completed („Pause starten" bzw. „Fokus starten", Req 5.4).
   */
  nextPhaseType: PhaseType;

  // Aktions-Callbacks (entsprechen den TimerProvider-Aktionen).
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
  onSkip: () => void;
  onExtend: (ms: number) => void;
  onCompleteEarly: () => void;
  onAdvance: () => void;
}

/** Liefert die Beschriftung des bewussten Starts der nächsten Phase (Req 5.4). */
export function nextPhaseStartLabel(nextPhaseType: PhaseType): string {
  return nextPhaseType === 'Focus' ? 'Fokus starten' : 'Pause starten';
}

/**
 * Bestimmt – nur für die Button-Beschriftung – die Art der nächsten Phase aus der
 * aktuellen (abgeschlossenen) Phase (Req 5.4). Für die Beschriftung genügt die
 * Unterscheidung „Fokus vs. Pause"; ob die Pause kurz oder lang ist, ändert das Label
 * nicht. Daher wird die (settings-abhängige) Zykluslogik hier bewusst NICHT benötigt.
 * - Nach einem Fokus folgt eine Pause.
 * - Nach einer Pause folgt ein Fokus.
 */
export function nextPhaseTypeForLabel(currentPhaseType: PhaseType): PhaseType {
  return currentPhaseType === 'Focus' ? 'ShortBreak' : 'Focus';
}

/**
 * Rein präsentationale, kontextabhängige Steuerung. Rendert je `status` die passenden
 * Schaltflächen und verdrahtet Neustart/„Früher abschließen" mit Bestätigungsdialogen.
 */
export default function TimerControls({
  status,
  phaseType,
  nextPhaseType,
  onStart,
  onPause,
  onResume,
  onRestart,
  onCancel,
  onSkip,
  onExtend,
  onCompleteEarly,
  onAdvance,
}: TimerControlsProps) {
  const [restartOpen, setRestartOpen] = useState(false);
  const [completeEarlyOpen, setCompleteEarlyOpen] = useState(false);

  const isFocus = phaseType === 'Focus';

  // Gemeinsame Neustart-Schaltfläche (Running/Paused) mit Sicherheitsabfrage (Req 4.4).
  const restartButton = (
    <button
      type="button"
      className={styles.secondary}
      onClick={() => setRestartOpen(true)}
    >
      Neustart
    </button>
  );

  const cancelButton = (
    <button type="button" className={styles.secondary} onClick={onCancel}>
      Abbrechen
    </button>
  );

  const skipButton = (
    <button type="button" className={styles.secondary} onClick={onSkip}>
      Überspringen
    </button>
  );

  return (
    <div className={styles.controls} data-status={status}>
      {status === 'Ready' && (
        <button
          type="button"
          className={styles.primary}
          onClick={onStart}
          data-testid="control-start"
        >
          {nextPhaseStartLabel(phaseType)}
        </button>
      )}

      {status === 'Running' && (
        <>
          <button
            type="button"
            className={styles.primary}
            onClick={onPause}
            data-testid="control-pause"
          >
            Pause
          </button>
          <ExtendMenu onExtend={onExtend} />
          {skipButton}
          {restartButton}
          {cancelButton}
          {isFocus && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setCompleteEarlyOpen(true)}
              data-testid="control-complete-early"
            >
              Früher abschließen
            </button>
          )}
        </>
      )}

      {status === 'Paused' && (
        <>
          <button
            type="button"
            className={styles.primary}
            onClick={onResume}
            data-testid="control-resume"
          >
            Fortsetzen
          </button>
          {restartButton}
          {skipButton}
          {cancelButton}
          {isFocus && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setCompleteEarlyOpen(true)}
              data-testid="control-complete-early"
            >
              Früher abschließen
            </button>
          )}
        </>
      )}

      {status === 'Completed' && (
        <button
          type="button"
          className={styles.primary}
          onClick={onAdvance}
          data-testid="control-advance"
        >
          {nextPhaseStartLabel(nextPhaseType)}
        </button>
      )}

      {status === 'Cancelled' && (
        <button
          type="button"
          className={styles.primary}
          onClick={onStart}
          data-testid="control-start"
        >
          {nextPhaseStartLabel(phaseType)}
        </button>
      )}

      {/* Bestätigungsdialog für den Neustart (Req 4.4). */}
      <ConfirmDialog
        open={restartOpen}
        title={RESTART_CONFIRM_TITLE}
        description={RESTART_CONFIRM_DESCRIPTION}
        confirmLabel="Neustart"
        onConfirm={() => {
          setRestartOpen(false);
          onRestart();
        }}
        onCancel={() => setRestartOpen(false)}
      />

      {/* Bestätigungsdialog für „Phase früher abschließen" (Req 4.8). */}
      <ConfirmDialog
        open={completeEarlyOpen}
        title={COMPLETE_EARLY_CONFIRM_TITLE}
        confirmLabel="Als abgeschlossen markieren"
        onConfirm={() => {
          setCompleteEarlyOpen(false);
          onCompleteEarly();
        }}
        onCancel={() => setCompleteEarlyOpen(false)}
      />
    </div>
  );
}

/**
 * Verbindet {@link TimerControls} mit dem TimerProvider. Für den Completed-Zustand wird
 * die nächste Phase über `nextPhaseType` bestimmt, damit die Übergangs-Schaltfläche
 * korrekt beschriftet ist (Req 5.4).
 */
export function ConnectedTimerControls() {
  const {
    state,
    start,
    pause,
    resume,
    restart,
    cancel,
    skip,
    extend,
    completeEarly,
    advance,
  } = useTimer();

  const next = nextPhaseTypeForLabel(state.phaseType);

  return (
    <TimerControls
      status={state.status}
      phaseType={state.phaseType}
      nextPhaseType={next}
      onStart={start}
      onPause={pause}
      onResume={resume}
      onRestart={restart}
      onCancel={cancel}
      onSkip={skip}
      onExtend={extend}
      onCompleteEarly={completeEarly}
      onAdvance={advance}
    />
  );
}

/** Anzeigename der nächsten Phase (für optionale UI-Zwecke/Konsistenz). */
export function nextPhaseDisplayName(nextPhaseType: PhaseType): string {
  return PHASE_LABELS[nextPhaseType];
}
