// CycleProgress – Pomodoro-Fortschritt im aktuellen Zyklus (Req 3.4).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht"):
// - „Pomodoro X von N" + Punkte (● ● ○ ○) mit ARIA-Text.
// - N = Anzahl Fokusphasen pro Zyklus (settings.focusPerCycle).
// - X = 1-basierte Nummer der aktuellen/nächsten Fokusphase (pomodoroNumberInCycle).
// - Die Punkte zeigen die bereits ABGESCHLOSSENEN Fokusphasen des Zyklus gefüllt (●),
//   die restlichen leer (○). Anzahl gefüllter Punkte = completedFocusInCycle.
//
// Accessibility (Req 18.2/18.3): Die Punkt-Reihe ist rein dekorativ (`aria-hidden`);
// eine zusätzliche, textliche ARIA-Alternative beschreibt den Fortschritt vollständig,
// sodass die Information nicht ausschließlich visuell/über Farbe vorliegt.
//
// Rein präsentational: erhält die Zahlenwerte als Props und ist ohne Provider testbar.

import styles from './CycleProgress.module.css';

export interface CycleProgressProps {
  /** 1-basierte Nummer der aktuellen/nächsten Fokusphase im Zyklus (X). */
  pomodoroNumberInCycle: number;
  /** Anzahl Fokusphasen pro Zyklus (N, = settings.focusPerCycle). */
  focusPerCycle: number;
  /** Anzahl bereits abgeschlossener Fokusphasen im aktuellen Zyklus (gefüllte Punkte). */
  completedFocusInCycle: number;
}

/** Klemmt eine Zahl auf ganze Werte im Bereich [min, max]. */
function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.round(value) : min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Rendert „Pomodoro X von N" samt einer Punktanzeige der abgeschlossenen Fokusphasen.
 * Die Punkte sind dekorativ; der sichtbare Text sowie eine ausführliche ARIA-Beschreibung
 * vermitteln den Fortschritt zugänglich (Req 3.4/18.3).
 */
export default function CycleProgress({
  pomodoroNumberInCycle,
  focusPerCycle,
  completedFocusInCycle,
}: CycleProgressProps) {
  // Mindestens ein Slot; Werte defensiv klemmen.
  const total = clampInt(focusPerCycle, 1, 99);
  const current = clampInt(pomodoroNumberInCycle, 1, total);
  const completed = clampInt(completedFocusInCycle, 0, total);

  const label = `Pomodoro ${current} von ${total}`;
  const ariaText = `${label}, ${completed} von ${total} abgeschlossen`;

  return (
    <div className={styles.wrapper} role="group" aria-label={ariaText}>
      <span className={styles.label}>{label}</span>
      {/* Dekorative Punktanzeige; die ARIA-Beschreibung liegt bereits am Wrapper. */}
      <span className={styles.dots} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={i < completed ? styles.dotFilled : styles.dotEmpty}
            data-testid={i < completed ? 'dot-filled' : 'dot-empty'}
          >
            {i < completed ? '●' : '○'}
          </span>
        ))}
      </span>
    </div>
  );
}
