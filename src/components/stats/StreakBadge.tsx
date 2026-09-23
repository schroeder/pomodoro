// StreakBadge – Fokus-Serie (Streak), dezent platziert (Task 12, Req 11.5).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „StatsView"):
// - „🔥 N Tage in Folge", dezent platziert.
// Req 11.5: Die Anzeige SOLL visuell nicht dominant sein.
//
// Verhalten bei Streak 0: dezenter Platzhalter „—" (kein Feuer-Emoji, keine Betonung),
// damit der Nullfall bewusst zurückhaltend bleibt.
//
// Rein präsentational: erhält den Zählwert als Prop (typischerweise aus
// `useStats().streak`) und ist ohne Provider testbar.

import styles from './StreakBadge.module.css';

export interface StreakBadgeProps {
  /** Anzahl aufeinanderfolgender Tage mit mindestens einem abgeschlossenen Pomodoro. */
  streak: number;
}

/**
 * Rendert die Fokus-Serie zurückhaltend. Bei 0 ein dezenter Platzhalter statt Betonung.
 */
export default function StreakBadge({ streak }: StreakBadgeProps) {
  const safe =
    typeof streak === 'number' && Number.isFinite(streak) && streak > 0
      ? Math.round(streak)
      : 0;

  if (safe === 0) {
    return (
      <span className={styles.badge} data-testid="streak-badge">
        <span className={styles.muted} aria-label="Keine aktuelle Fokus-Serie">
          —
        </span>
      </span>
    );
  }

  const label = `🔥 ${safe} ${safe === 1 ? 'Tag' : 'Tage'} in Folge`;

  return (
    <span
      className={styles.badge}
      data-testid="streak-badge"
      title={label}
      aria-label={label}
    >
      <span className={styles.icon} aria-hidden="true">
        🔥
      </span>
      <span className={styles.text}>
        {safe} {safe === 1 ? 'Tag' : 'Tage'} in Folge
      </span>
    </span>
  );
}
