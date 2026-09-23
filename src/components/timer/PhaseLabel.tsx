// PhaseLabel – textliche Phasenanzeige mit Icon (Req 3.1, 3.6, 18.3).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht"):
// - Textlabel der Phase (nicht nur Farbe), mit Icon.
// - Die Phase wird bewusst über TEXT UND SYMBOL kommuniziert, nicht ausschließlich
//   über Farbe (Req 3.6/18.3). Das Icon ist rein dekorativ (`aria-hidden`), da der
//   Text die zugängliche Quelle ist.
// - Wiederverwendung der zentralen `PHASE_LABELS` aus dem DocumentTitleService, damit
//   Tab-Titel, Ankündigungen und diese Anzeige konsistente deutsche Beschriftungen
//   nutzen.
//
// Rein präsentational: erhält `phaseType` als Prop und ist ohne Provider testbar.

import type { PhaseType } from '../../types';
import { PHASE_LABELS } from '../../services/documentTitle';
import styles from './PhaseLabel.module.css';

export interface PhaseLabelProps {
  /** Aktueller Phasentyp. */
  phaseType: PhaseType;
}

/** Dekoratives Icon je Phase (Fokus: Ziel, kurze Pause: Tasse, lange Pause: Mond). */
function PhaseIcon({ phaseType }: { phaseType: PhaseType }) {
  const common = {
    className: styles.icon,
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  switch (phaseType) {
    case 'Focus':
      // Zielscheibe – steht für konzentriertes Arbeiten.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case 'ShortBreak':
      // Kaffeetasse – kurze Pause.
      return (
        <svg {...common}>
          <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
          <path d="M17 9h2a2 2 0 0 1 0 4h-2" />
          <path d="M7 3v2M11 3v2" />
        </svg>
      );
    case 'LongBreak':
      // Mond – längere Erholung.
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Rendert die aktuelle Phase als Icon + Text. Text ist die zugängliche Quelle; das Icon
 * ist dekorativ. Farbe ist damit NIE der einzige Indikator (Req 3.6/18.3).
 */
export default function PhaseLabel({ phaseType }: PhaseLabelProps) {
  const label = PHASE_LABELS[phaseType];
  return (
    <p className={styles.label} data-phase={phaseType}>
      <PhaseIcon phaseType={phaseType} />
      <span className={styles.text}>{label}</span>
    </p>
  );
}
