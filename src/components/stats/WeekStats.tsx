// WeekStats – „Diese Woche"-Kennzahlen inkl. Balkendiagramm (Task 12, Req 11.3).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „StatsView"):
// - Gesamtpomodoros, gesamte Fokuszeit, Balkendiagramm Fokuszeit pro Tag (eigenes SVG).
//
// Rein präsentational: erhält die Wochendaten als Props (typischerweise aus
// `useStats().week`) und ist ohne Provider testbar. Das Diagramm ist in WeekBarChart
// ausgelagert.

import { formatFocusMinutes } from '../timer/TodayProgress';
import WeekBarChart, { type WeekBarDatum } from './WeekBarChart';
import styles from './WeekStats.module.css';

export interface WeekStatsProps {
  /** Gesamtzahl der Pomodoros in der Woche. */
  totalPomodoros: number;
  /** Gesamte Fokuszeit der Woche in Minuten (gerundet). */
  totalFocusMinutes: number;
  /** Die sieben Tage der Woche (Mo..So), chronologisch. */
  days: WeekBarDatum[];
}

function safeCount(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/**
 * Rendert die Wochenübersicht: Summen und das Fokuszeit-Balkendiagramm (Req 11.3).
 */
export default function WeekStats({
  totalPomodoros,
  totalFocusMinutes,
  days,
}: WeekStatsProps) {
  return (
    <section className={styles.section} aria-labelledby="week-stats-heading">
      <h2 id="week-stats-heading" className={styles.heading}>
        Diese Woche
      </h2>

      <dl className={styles.totals}>
        <div className={styles.total}>
          <dt className={styles.term}>Pomodoros</dt>
          <dd className={styles.value}>{safeCount(totalPomodoros)}</dd>
        </div>
        <div className={styles.total}>
          <dt className={styles.term}>Fokuszeit</dt>
          <dd className={styles.value}>{formatFocusMinutes(totalFocusMinutes)}</dd>
        </div>
      </dl>

      <WeekBarChart days={days} />
    </section>
  );
}
