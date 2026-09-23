// ProgressRing – dezenter, kreisförmiger Fortschrittsring um den Timer (Req 3.3).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht"):
// - SVG-Kreis, dessen `stroke-dashoffset` proportional zum Fortschritt der
//   laufenden Phase ist; dezent.
// - Der Fortschritt ergibt sich aus (plannedDurationMs - remainingMs) / plannedDurationMs,
//   geklemmt auf 0..1.
// - Accessibility (Req 18.2/18.3): Der Ring ist rein DEKORATIV (`aria-hidden`), da die
//   verbleibende Zeit bereits über CountdownDisplay (`role="timer"`) zugänglich ist. So
//   wird keine redundante/verwirrende Information für Screenreader erzeugt.
//
// Rein präsentational: erhält `plannedDurationMs`, `remainingMs` und optionale
// Darstellungsparameter als Props und ist damit ohne Provider testbar.

import type { ReactNode } from 'react';
import type { PhaseType } from '../../types';
import styles from './ProgressRing.module.css';

export interface ProgressRingProps {
  /** Geplante Dauer der aktuellen Phase in ms. */
  plannedDurationMs: number;
  /** Verbleibende Zeit in ms. */
  remainingMs: number;
  /**
   * Aktueller Phasentyp – steuert nur die Akzentfarbe des Rings. Die Phase wird NICHT
   * allein über Farbe kommuniziert (das übernimmt PhaseLabel via Text+Icon, Req 3.6/18.3);
   * der Ring ist ohnehin dekorativ (aria-hidden).
   */
  phaseType?: PhaseType;
  /** Durchmesser des Rings in px (Standard 240). */
  size?: number;
  /** Strichstärke in px (Standard 10). */
  strokeWidth?: number;
  /** Optionaler Inhalt in der Ringmitte (z. B. Countdown/Phase). */
  children?: ReactNode;
}

/**
 * Berechnet den Fortschritt (0..1) der laufenden Phase aus geplanter Dauer und
 * verbleibender Zeit. 0 = gerade gestartet, 1 = abgelaufen. Ergebnis stets auf 0..1
 * geklemmt; bei nicht-positiver/ungültiger geplanter Dauer wird 0 zurückgegeben.
 */
export function computeProgress(plannedDurationMs: number, remainingMs: number): number {
  if (
    typeof plannedDurationMs !== 'number' ||
    !Number.isFinite(plannedDurationMs) ||
    plannedDurationMs <= 0
  ) {
    return 0;
  }
  const safeRemaining =
    typeof remainingMs === 'number' && Number.isFinite(remainingMs) && remainingMs > 0
      ? remainingMs
      : 0;
  const elapsed = plannedDurationMs - safeRemaining;
  const ratio = elapsed / plannedDurationMs;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

/**
 * Berechnet den `stroke-dashoffset` für einen Kreis mit gegebenem Umfang und
 * Fortschritt (0..1). Bei Fortschritt 0 ist der Offset gleich dem Umfang (nichts
 * gefüllt), bei 1 ist er 0 (voll gefüllt).
 */
export function dashOffsetForProgress(circumference: number, progress: number): number {
  const clamped = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return circumference * (1 - clamped);
}

export default function ProgressRing({
  plannedDurationMs,
  remainingMs,
  phaseType = 'Focus',
  size = 240,
  strokeWidth = 10,
  children,
}: ProgressRingProps) {
  const progress = computeProgress(plannedDurationMs, remainingMs);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = dashOffsetForProgress(circumference, progress);
  const center = size / 2;

  return (
    <div
      className={styles.wrapper}
      style={{ width: size, height: size }}
      data-phase={phaseType}
    >
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Rein dekorativ – die Zeit ist über die Timer-Region zugänglich (Req 18.3).
        aria-hidden="true"
        focusable="false"
      >
        {/* Neutrale Bahn */}
        <circle
          className={styles.track}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {/* Fortschritts-Bogen; startet oben (−90°) und läuft im Uhrzeigersinn. */}
        <circle
          className={styles.progress}
          data-testid="progress-arc"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children != null && <div className={styles.center}>{children}</div>}
    </div>
  );
}
