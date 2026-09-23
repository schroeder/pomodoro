// Statistik-Ansicht (Route "/stats") – Task 12, Req 11.2–11.5.
//
// Komponiert die präsentationalen Statistik-Komponenten und verdrahtet sie mit dem
// StatsProvider über `useStats()`:
// - StreakBadge (dezent, oben rechts neben der Überschrift) – Req 11.5
// - TodayStats – Req 11.2
// - WeekStats (inkl. eigenem SVG-Balkendiagramm) – Req 11.3
// - HistoryList – Req 11.4
//
// Die eigentliche Aggregationslogik liegt in stats/aggregate.ts; die Komponenten sind
// rein präsentational und nehmen ihre Daten als Props. Diese View besorgt die Daten und
// behandelt den Ladezustand.

import { useStats } from '../stats/StatsProvider';
import TodayStats from '../components/stats/TodayStats';
import WeekStats from '../components/stats/WeekStats';
import HistoryList from '../components/stats/HistoryList';
import StreakBadge from '../components/stats/StreakBadge';
import styles from './StatsView.module.css';

/** Stabiler Test-Marker der Statistik-Ansicht. */
export const STATS_VIEW_MARKER = 'stats-view';

export default function StatsView() {
  const { today, week, history, streak, loading } = useStats();

  return (
    <section
      data-testid={STATS_VIEW_MARKER}
      className={styles.view}
      aria-labelledby="stats-view-heading"
    >
      <header className={styles.header}>
        <h1 id="stats-view-heading" className={styles.title}>
          Statistik
        </h1>
        <StreakBadge streak={streak} />
      </header>

      {loading ? (
        <p className={styles.loading} role="status">
          Statistiken werden geladen …
        </p>
      ) : (
        <div className={styles.content}>
          <TodayStats
            pomodoros={today.pomodoros}
            focusMinutes={today.focusMinutes}
            averageFocusMinutes={today.averageFocusMinutes}
            breaks={today.breaks}
          />

          <WeekStats
            totalPomodoros={week.totalPomodoros}
            totalFocusMinutes={week.totalFocusMinutes}
            days={week.days}
          />

          <HistoryList entries={history} />
        </div>
      )}
    </section>
  );
}
