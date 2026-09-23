// TodayProgress – Tagesfortschritt: heutige Pomodoros und Fokuszeit (Req 3.5).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht"):
// - „Heute: n Pomodoros" + „Fokuszeit: Xh Ymin".
// - Die Fokuszeit wird aus der Tages-Aggregation (`focusMinutes`) formatiert:
//   < 1 h → „Ymin", sonst „Xh Ymin".
//
// Rein präsentational: erhält `pomodoros` und `focusMinutes` als Props (typischerweise
// aus `useStats().today`) und ist damit ohne Provider testbar.

import styles from './TodayProgress.module.css';

export interface TodayProgressProps {
  /** Anzahl heute abgeschlossener Pomodoros. */
  pomodoros: number;
  /** Heutige gesamte Fokuszeit in Minuten (gerundet). */
  focusMinutes: number;
}

/**
 * Formatiert eine Fokuszeit in Minuten menschenlesbar:
 * - Werte < 60 min → „Ymin" (z. B. „0min", „59min").
 * - Werte ≥ 60 min → „Xh Ymin" (z. B. „1h 0min", „2h 5min").
 * Negative/ungültige Werte werden auf 0 geklemmt.
 */
export function formatFocusMinutes(totalMinutes: number): string {
  const safe =
    typeof totalMinutes === 'number' && Number.isFinite(totalMinutes) && totalMinutes > 0
      ? Math.round(totalMinutes)
      : 0;
  if (safe < 60) {
    return `${safe}min`;
  }
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}h ${minutes}min`;
}

/**
 * Rendert den Tagesfortschritt: Anzahl heutiger Pomodoros und formatierte Fokuszeit.
 */
export default function TodayProgress({ pomodoros, focusMinutes }: TodayProgressProps) {
  const safePomodoros =
    typeof pomodoros === 'number' && Number.isFinite(pomodoros) && pomodoros > 0
      ? Math.round(pomodoros)
      : 0;
  const focusText = formatFocusMinutes(focusMinutes);

  return (
    <dl className={styles.wrapper}>
      <div className={styles.item}>
        <dt className={styles.term}>Heute</dt>
        <dd className={styles.value}>{safePomodoros} Pomodoros</dd>
      </div>
      <div className={styles.item}>
        <dt className={styles.term}>Fokuszeit</dt>
        <dd className={styles.value}>{focusText}</dd>
      </div>
    </dl>
  );
}
