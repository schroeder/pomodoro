// CountdownDisplay – dominantes MM:SS-Element der Hauptansicht (Req 3.2).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht"
// und „Accessibility"):
// - Zeigt die verbleibende Zeit als großes, dominantes Element im Format MM:SS.
//   Die Formatierung wird aus dem DocumentTitleService (`formatRemaining`)
//   wiederverwendet, damit Tab-Titel und Anzeige konsistent bleiben.
// - Accessibility (Req 18.2/18.4): Die Zeitziffer selbst ist eine `role="timer"`
//   Region mit einem sprechenden `aria-label` (verbleibende Zeit + Phase). Der
//   Zahlenwert wird bewusst NICHT sekündlich per Live-Region angekündigt
//   (`aria-live="off"` auf der Timer-Region), damit Screenreader nicht jede
//   Sekunde „spammen". Phasen-/Statuswechsel werden separat über eine
//   `aria-live="polite"` Region angekündigt (siehe `announcement`-Prop) – das ist
//   der laut Design vorgesehene, nicht-spammende Ankündigungsweg.
//
// Diese Komponente ist rein präsentational: Sie erhält `remainingMs`, `phaseType`
// und eine optionale Ankündigung als Props und ist damit ohne Provider testbar.

import type { PhaseType } from '../../types';
import { formatRemaining, PHASE_LABELS } from '../../services/documentTitle';
import styles from './CountdownDisplay.module.css';

export interface CountdownDisplayProps {
  /** Verbleibende Zeit in ms (vom Provider aus `endsAt`/`now` abgeleitet). */
  remainingMs: number;
  /** Aktueller Phasentyp – fließt in das ARIA-Label ein (Text, nicht nur Farbe). */
  phaseType: PhaseType;
  /**
   * Optionale, nicht-sekündliche Ankündigung für Screenreader (Phasen-/Statuswechsel),
   * wird über eine `aria-live="polite"` Region ausgegeben (Req 18.4). Ist der Wert leer,
   * bleibt die Region leer und kündigt nichts an.
   */
  announcement?: string;
}

/**
 * Rendert die verbleibende Zeit als dominantes MM:SS-Element mit `role="timer"`.
 * Die Zahl selbst wird nicht sekündlich vorgelesen; Ankündigungen laufen über die
 * separate Polite-Region.
 */
export default function CountdownDisplay({
  remainingMs,
  phaseType,
  announcement = '',
}: CountdownDisplayProps) {
  const time = formatRemaining(remainingMs);
  const phaseLabel = PHASE_LABELS[phaseType];
  const ariaLabel = `${time} verbleibend – ${phaseLabel}`;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.time}
        role="timer"
        aria-label={ariaLabel}
        // Die Ziffern selbst nicht sekündlich ankündigen (Req 18.4).
        aria-live="off"
      >
        {time}
      </div>
      {/* Nicht-spammende Ankündigungen für Phasen-/Statuswechsel (Req 18.4). */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
