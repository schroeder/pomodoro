// HistoryList – Historie vergangener Tage mit Pomodoros und Fokuszeit (Task 12, Req 11.4).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „StatsView"):
// - vergangene Tage mit Pomodoros und Fokuszeit.
//
// Das Datum wird in ein lesbares deutsches Format gebracht (formatGermanDate). Leere
// Historie wird mit einem freundlichen Hinweis dargestellt.
//
// Rein präsentational: erhält die Historie als Props (typischerweise aus
// `useStats().history`) und ist ohne Provider testbar.

import { formatFocusMinutes } from '../timer/TodayProgress';
import { formatGermanDate } from './formatDate';
import styles from './HistoryList.module.css';

/** Minimaldaten eines Historientags (kompatibel zu HistoryDay aus aggregate.ts). */
export interface HistoryEntry {
  /** Tagesschlüssel `YYYY-MM-DD`. */
  dateKey: string;
  /** Abgeschlossene Pomodoros an diesem Tag. */
  pomodoros: number;
  /** Fokuszeit an diesem Tag in Minuten. */
  focusMinutes: number;
}

export interface HistoryListProps {
  /** Historientage (üblicherweise neueste zuerst). */
  entries: HistoryEntry[];
}

/**
 * Rendert die Tages-Historie als Liste; bei leerer Historie einen Hinweistext (Req 11.4).
 */
export default function HistoryList({ entries }: HistoryListProps) {
  const items = Array.isArray(entries) ? entries : [];

  return (
    <section className={styles.section} aria-labelledby="history-heading">
      <h2 id="history-heading" className={styles.heading}>
        Historie
      </h2>

      {items.length === 0 ? (
        <p className={styles.empty}>Noch keine Daten vorhanden.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((entry) => (
            <li key={entry.dateKey} className={styles.item} data-testid="history-item">
              <span className={styles.date}>{formatGermanDate(entry.dateKey)}</span>
              <span className={styles.metrics}>
                <span className={styles.metric}>
                  {Math.max(0, Math.round(entry.pomodoros))} Pomodoros
                </span>
                <span className={styles.separator} aria-hidden="true">
                  ·
                </span>
                <span className={styles.metric}>
                  {formatFocusMinutes(entry.focusMinutes)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
