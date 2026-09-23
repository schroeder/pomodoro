// TodayStats – „Heute"-Kennzahlen der Statistik-Ansicht (Task 12, Req 11.2).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „StatsView"):
// - abgeschlossene Pomodoros, gesamte Fokuszeit, Ø Fokusdauer, Anzahl Pausen.
//
// Zeiten werden menschenlesbar formatiert (Xh Ymin) – wir verwenden dieselbe
// Formatierung wie der Tagesfortschritt der Hauptansicht (formatFocusMinutes).
//
// Rein präsentational: erhält die Werte als Props (typischerweise aus `useStats().today`)
// und ist damit ohne Provider unit-testbar.

import { formatFocusMinutes } from '../timer/TodayProgress';
import styles from './TodayStats.module.css';

export interface TodayStatsProps {
  /** Anzahl heute abgeschlossener Pomodoros. */
  pomodoros: number;
  /** Heutige gesamte Fokuszeit in Minuten (gerundet). */
  focusMinutes: number;
  /** Durchschnittliche Fokusdauer heute in Minuten (gerundet). */
  averageFocusMinutes: number;
  /** Anzahl der heute erfassten Pausen. */
  breaks: number;
}

/** Klemmt eine Zahl defensiv auf einen nicht-negativen ganzzahligen Wert. */
function safeCount(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/**
 * Rendert die vier „Heute"-Kennzahlen als beschriftete Werte (Req 11.2).
 */
export default function TodayStats({
  pomodoros,
  focusMinutes,
  averageFocusMinutes,
  breaks,
}: TodayStatsProps) {
  const metrics: { key: string; term: string; value: string }[] = [
    { key: 'pomodoros', term: 'Pomodoros', value: String(safeCount(pomodoros)) },
    { key: 'focus', term: 'Fokuszeit', value: formatFocusMinutes(focusMinutes) },
    {
      key: 'average',
      term: 'Ø Fokusdauer',
      value: formatFocusMinutes(averageFocusMinutes),
    },
    { key: 'breaks', term: 'Pausen', value: String(safeCount(breaks)) },
  ];

  return (
    <section className={styles.section} aria-labelledby="today-stats-heading">
      <h2 id="today-stats-heading" className={styles.heading}>
        Heute
      </h2>
      <dl className={styles.grid}>
        {metrics.map((m) => (
          <div key={m.key} className={styles.card}>
            <dt className={styles.term}>{m.term}</dt>
            <dd className={styles.value}>{m.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
