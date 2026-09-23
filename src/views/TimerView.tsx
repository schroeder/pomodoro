// Timer-Hauptansicht (Route "/").
//
// Komposition der Anzeige- und Steuerkomponenten aus Task 9 (Req 3, 4, 5):
//   PhaseLabel · ProgressRing (mit CountdownDisplay in der Mitte) · CycleProgress ·
//   TodayProgress · TimerControls.
//
// Die Ansicht liest den Timer-Zustand über `useTimer()` und den Tagesfortschritt über
// `useStats()` (beide Provider werden in App.tsx bereitgestellt). Die einzelnen
// Anzeigekomponenten bleiben rein präsentational; hier findet nur die Verdrahtung statt.
//
// Der stabile Test-Marker `TIMER_VIEW_MARKER` bleibt erhalten, damit Routing-/Navigations-
// Tests (Task 8, Req 14.1) unverändert funktionieren.

import { useState } from 'react';
import { useTimer } from '../timer/TimerProvider';
import { useStats } from '../stats/StatsProvider';
import { PHASE_LABELS } from '../services/documentTitle';
import PhaseLabel from '../components/timer/PhaseLabel';
import ProgressRing from '../components/timer/ProgressRing';
import CountdownDisplay from '../components/timer/CountdownDisplay';
import CycleProgress from '../components/timer/CycleProgress';
import TodayProgress from '../components/timer/TodayProgress';
import { ConnectedTimerControls } from '../components/timer/TimerControls';
import ConfirmDialog from '../components/timer/ConfirmDialog';
import {
  RESTART_CONFIRM_TITLE,
  RESTART_CONFIRM_DESCRIPTION,
} from '../components/timer/TimerControls';
import FocusMode from '../components/FocusMode';
import { useSettings } from '../settings/SettingsProvider';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import styles from './TimerView.module.css';

/** Stabiler Test-Marker der Timer-Ansicht. */
export const TIMER_VIEW_MARKER = 'timer-view';

export default function TimerView() {
  const { state, remainingMs, start, pause, resume, restart, skip } = useTimer();
  const { settings } = useSettings();
  const { today } = useStats();

  // Fokusmodus ist ein reiner UI-Zustand (kein Routing, Req 10). Ist er aktiv, wird die
  // übrige Ansicht ausgeblendet und nur die reduzierte FocusMode-Overlay angezeigt
  // (Req 10.2). Das Verlassen ändert NICHT den Timerzustand (Req 10.4).
  const [focusMode, setFocusMode] = useState(false);

  // Bestätigungsdialog für den per Tastatur (R) ausgelösten Neustart (Req 4.4/16.1).
  // Die TimerControls besitzen ihren eigenen Neustart-Dialog; für den Shortcut wird hier
  // ein separater Dialog gesteuert, damit die Sicherheitsabfrage auch per Tastatur greift.
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  // Tastatursteuerung (Req 16.1–16.3). Der Hook ist bewusst timer-unabhängig und erhält
  // hier die verdrahteten Aktionen:
  //   Space → Start/Pause/Fortsetzen kontextabhängig vom Status.
  //   R     → Neustart mit Sicherheitsabfrage (öffnet den Bestätigungsdialog).
  //   S     → aktuelle Phase überspringen.
  //   F     → Fokusmodus aktivieren.
  //   Esc   → (im normalen View ungenutzt; der Fokusmodus behandelt sein eigenes Esc.)
  //
  // Deaktiviert, solange der Fokusmodus aktiv ist (dieser hat eigene Esc-Behandlung) oder
  // der Neustart-Dialog offen ist (der ConfirmDialog behandelt Esc dann selbst).
  useKeyboardShortcuts(
    {
      onToggleStartPause: () => {
        if (state.status === 'Running') {
          pause();
        } else if (state.status === 'Paused') {
          resume();
        } else if (state.status === 'Ready' || state.status === 'Cancelled') {
          start();
        }
      },
      onRestart: () => setRestartConfirmOpen(true),
      onSkip: () => skip(),
      onEnterFocusMode: () => setFocusMode(true),
    },
    { enabled: !focusMode && !restartConfirmOpen },
  );

  // Nicht-sekündliche Ankündigung für Screenreader: Phase + Status (Req 18.4).
  const announcement = `${PHASE_LABELS[state.phaseType]} – ${state.status}`;

  if (focusMode) {
    return <FocusMode onExit={() => setFocusMode(false)} />;
  }

  return (
    <section
      data-testid={TIMER_VIEW_MARKER}
      className={styles.view}
      aria-labelledby="timer-view-heading"
    >
      <h1 id="timer-view-heading" className="visually-hidden">
        Timer
      </h1>

      <PhaseLabel phaseType={state.phaseType} />

      <ProgressRing
        plannedDurationMs={state.plannedDurationMs}
        remainingMs={remainingMs}
        phaseType={state.phaseType}
      >
        <CountdownDisplay
          remainingMs={remainingMs}
          phaseType={state.phaseType}
          announcement={announcement}
        />
      </ProgressRing>

      <CycleProgress
        pomodoroNumberInCycle={state.pomodoroNumberInCycle}
        focusPerCycle={settings.focusPerCycle}
        completedFocusInCycle={state.completedFocusInCycle}
      />

      <ConnectedTimerControls />

      <button
        type="button"
        className={styles.focusModeButton}
        onClick={() => setFocusMode(true)}
        data-testid="enter-focus-mode"
      >
        Fokusmodus
      </button>

      <TodayProgress pomodoros={today.pomodoros} focusMinutes={today.focusMinutes} />

      {/* Bestätigungsdialog für den per Tastatur (R) ausgelösten Neustart (Req 4.4). */}
      <ConfirmDialog
        open={restartConfirmOpen}
        title={RESTART_CONFIRM_TITLE}
        description={RESTART_CONFIRM_DESCRIPTION}
        confirmLabel="Neustart"
        onConfirm={() => {
          setRestartConfirmOpen(false);
          restart();
        }}
        onCancel={() => setRestartConfirmOpen(false)}
      />
    </section>
  );
}
