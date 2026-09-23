// FocusMode – ablenkungsfreier Fokusmodus (Req 10.1–10.4).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „FokusModus"):
// - Boolescher UI-Zustand (KEIN Routing). Blendet Navigation, Statistik und
//   Einstellungen aus (Req 10.2) und zeigt NUR: Phase, Timer, Fortschritt,
//   Pause/Start, Stoppen und „Vollbild verlassen" (Req 10.1).
// - Optionaler Browser-Vollbildmodus über die Fullscreen API (Req 10.3). Der Zugriff
//   ist feature-detektiert und in try/catch gekapselt, weil nicht jeder Browser bzw.
//   nicht jede Berechtigung Vollbild erlaubt (in jsdom fehlt die API vollständig).
// - Verlassen per Esc oder Button, OHNE den Timerzustand zu verändern (Req 10.4):
//   `onExit` ändert ausschließlich die Ansicht; es wird KEINE zustandsändernde
//   Timer-Aktion (pause/cancel/…) ausgelöst.
//
// Wiederverwendung der präsentationalen Anzeige-Komponenten aus Task 9 (PhaseLabel,
// ProgressRing, CountdownDisplay). Der reduzierte Steuerungssatz (Pause/Start, Stoppen)
// wird bewusst NICHT über TimerControls gerendert, da der Fokusmodus nur eine minimale
// Teilmenge zeigt.

import { useEffect } from 'react';
import { useTimer } from '../timer/TimerProvider';
import { PHASE_LABELS } from '../services/documentTitle';
import PhaseLabel from './timer/PhaseLabel';
import ProgressRing from './timer/ProgressRing';
import CountdownDisplay from './timer/CountdownDisplay';
import styles from './FocusMode.module.css';

/** Stabiler Test-Marker des Fokusmodus. */
export const FOCUS_MODE_MARKER = 'focus-mode';

/**
 * Minimale, injizierbare Abstraktion über die Fullscreen API. In Produktion greift die
 * Standardimplementierung defensiv auf `document`/`Element` zu; in Tests (jsdom) fehlt
 * die API und die Aufrufe werden als No-Op behandelt. Injektion erlaubt zudem, das
 * Verhalten deterministisch zu prüfen, ohne echte Browser-APIs.
 */
export interface FullscreenController {
  /** True, wenn Vollbild grundsätzlich unterstützt wird. */
  isSupported: () => boolean;
  /** True, wenn aktuell ein Element im Vollbild ist. */
  isActive: () => boolean;
  /** Vollbild für das übergebene Element anfordern (best effort). */
  request: (el: Element) => void;
  /** Vollbild verlassen, falls aktiv (best effort). */
  exit: () => void;
}

/**
 * Standard-Fullscreen-Controller auf Basis der Browser-Fullscreen-API. Alle Zugriffe
 * sind feature-detektiert und in try/catch gekapselt, damit fehlende Unterstützung oder
 * verweigerte Berechtigungen niemals werfen (Req 10.3; jsdom kennt die API nicht).
 */
export const defaultFullscreenController: FullscreenController = {
  isSupported() {
    try {
      return (
        typeof document !== 'undefined' &&
        typeof (document as Document).exitFullscreen === 'function' &&
        typeof (Element.prototype as unknown as { requestFullscreen?: unknown })
          .requestFullscreen === 'function'
      );
    } catch {
      return false;
    }
  },
  isActive() {
    try {
      return typeof document !== 'undefined' && document.fullscreenElement != null;
    } catch {
      return false;
    }
  },
  request(el: Element) {
    try {
      const anyEl = el as unknown as { requestFullscreen?: () => Promise<void> | void };
      if (typeof anyEl.requestFullscreen === 'function') {
        // Promise-Rückgabe defensiv abfangen (z. B. NotAllowedError).
        const result = anyEl.requestFullscreen();
        if (result != null && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            /* Vollbild abgelehnt – bewusst ignorieren (Req 10.3). */
          });
        }
      }
    } catch {
      /* Vollbild nicht möglich – bewusst ignorieren (Req 10.3). */
    }
  },
  exit() {
    try {
      if (
        typeof document !== 'undefined' &&
        document.fullscreenElement != null &&
        typeof document.exitFullscreen === 'function'
      ) {
        const result = document.exitFullscreen();
        if (result != null && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            /* Verlassen fehlgeschlagen – bewusst ignorieren. */
          });
        }
      }
    } catch {
      /* Bewusst ignorieren. */
    }
  },
};

export interface FocusModeProps {
  /**
   * Verlässt den Fokusmodus. Ändert AUSSCHLIESSLICH die Ansicht – niemals den
   * Timerzustand (Req 10.4). Wird per Esc oder „Vollbild verlassen"-Button ausgelöst.
   */
  onExit: () => void;
  /**
   * Ob beim Betreten des Fokusmodus der Browser-Vollbildmodus angefordert werden soll
   * (Req 10.3). Standard: true. Beim Verlassen wird Vollbild – falls aktiv – beendet.
   */
  requestFullscreenOnEnter?: boolean;
  /** Injizierbarer Fullscreen-Controller (Tests). Standard: {@link defaultFullscreenController}. */
  fullscreen?: FullscreenController;
}

/**
 * Reduzierte, ruhige Fokusansicht. Liest Timerzustand und -aktionen über `useTimer()`.
 * Zeigt nur die vom Design vorgegebene Teilmenge an Elementen.
 */
export default function FocusMode({
  onExit,
  requestFullscreenOnEnter = true,
  fullscreen = defaultFullscreenController,
}: FocusModeProps) {
  const { state, remainingMs, start, pause, resume, cancel } = useTimer();

  // --- Vollbild beim Betreten anfordern / beim Verlassen beenden (Req 10.3) ---
  // Feature-detektiert und defensiv: In Umgebungen ohne Fullscreen API (jsdom) ist dies
  // ein No-Op und wirft nicht. Das Beenden beim Unmount ändert NICHT den Timerzustand.
  useEffect(() => {
    if (requestFullscreenOnEnter && fullscreen.isSupported()) {
      const el =
        typeof document !== 'undefined' ? document.documentElement : null;
      if (el != null) {
        fullscreen.request(el);
      }
    }
    return () => {
      if (fullscreen.isSupported() && fullscreen.isActive()) {
        fullscreen.exit();
      }
    };
    // Nur beim Mount/Unmount; der Controller ist während der Lebensdauer stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Esc verlässt den Fokusmodus, ohne den Timerzustand zu ändern (Req 10.4) ---
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onExit();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  // Reduzierte Pause/Start-Steuerung: Beschriftung und Aktion abhängig vom Status.
  // Nur die für den Fokusmodus relevanten Zustände werden bedient (Req 10.1).
  const isRunning = state.status === 'Running';
  const isPaused = state.status === 'Paused';
  const primaryLabel = isRunning ? 'Pause' : 'Fortsetzen';
  const onPrimary = () => {
    if (isRunning) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      // Ready/Cancelled: Phase (neu) starten.
      start();
    }
  };
  // Im Ready-/Cancelled-Zustand ist der bewusste Start passender beschriftet.
  const primaryText = isRunning || isPaused ? primaryLabel : 'Start';

  const announcement = `${PHASE_LABELS[state.phaseType]} – ${state.status}`;

  return (
    <section
      className={styles.overlay}
      data-testid={FOCUS_MODE_MARKER}
      role="region"
      aria-label="Fokusmodus"
    >
      <div className={styles.content}>
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

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.primary}
            onClick={onPrimary}
            data-testid="focus-primary"
          >
            {primaryText}
          </button>

          {/* Stoppen: bricht die aktuelle Phase ab (Req 10.1). */}
          <button
            type="button"
            className={styles.secondary}
            onClick={cancel}
            data-testid="focus-stop"
          >
            Stoppen
          </button>

          {/* Fokusmodus verlassen – ändert NICHT den Timerzustand (Req 10.4). */}
          <button
            type="button"
            className={styles.secondary}
            onClick={onExit}
            data-testid="focus-exit"
          >
            Vollbild verlassen
          </button>
        </div>
      </div>
    </section>
  );
}
