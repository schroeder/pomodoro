// WeekBarChart – eigenes, leichtes SVG-Balkendiagramm der Fokuszeit pro Tag (Task 12, Req 11.3).
//
// Design (.kiro/specs/pomodoro/design.md): „eigene, leichte SVG-Balken" statt Chart-Lib.
// Erwartet genau sieben Tage (Mo..So) aus `week.days` (aggregate.ts liefert stets 7).
//
// Accessibility (Req 18):
// - Die SVG-Balken sind eine rein visuelle Darstellung und werden als `role="img"` mit
//   beschreibendem `aria-label` bereitgestellt.
// - Zusätzlich existiert eine visuell verborgene Tabelle mit den exakten Werten, damit
//   Screenreader die Daten strukturiert lesen können (nicht nur über Farbe/Position).
//
// Rein präsentational: erhält die Tagesdaten als Props und ist ohne Provider testbar.

import { formatFocusMinutes } from '../timer/TodayProgress';
import { formatGermanDate } from './formatDate';
import styles from './WeekBarChart.module.css';

/** Minimaldaten eines Tages, die das Diagramm benötigt (kompatibel zu WeekDayStat). */
export interface WeekBarDatum {
  /** Tagesschlüssel `YYYY-MM-DD` (für Beschriftung/Tabellenzeile). */
  dateKey: string;
  /** Fokuszeit dieses Tages in Minuten. */
  focusMinutes: number;
}

export interface WeekBarChartProps {
  /** Die sieben Tage der Woche (Mo..So), chronologisch. */
  days: WeekBarDatum[];
}

/** Kurzlabels der Wochentage (Index 0 = Montag), passend zur chronologischen `days`-Reihenfolge. */
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

// Interne SVG-Geometrie (viewBox-Koordinaten, skaliert responsiv über CSS).
const CHART_HEIGHT = 100;
const BAR_MAX_HEIGHT = 80; // Platz für die Balken; Rest für Labels.
const BAR_WIDTH = 10;
const SLOT_WIDTH = 16; // Balkenbreite + Abstand.
const MIN_VISIBLE_HEIGHT = 2; // Sichtbarer Sockel für Werte > 0.

function safeMinutes(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Rendert ein SVG-Balkendiagramm der Fokuszeit pro Wochentag.
 * Die Balkenhöhen sind proportional zum Maximalwert der Woche skaliert; ein all-null
 * Diagramm zeigt sieben leere Balken (Höhe 0).
 */
export default function WeekBarChart({ days }: WeekBarChartProps) {
  const values = days.map((d) => safeMinutes(d.focusMinutes));
  const maxValue = values.reduce((max, v) => (v > max ? v : max), 0);

  const totalWidth = days.length * SLOT_WIDTH;

  // Beschreibendes Label für die visuelle Darstellung (Req 18).
  const summaryLabel =
    maxValue === 0
      ? 'Fokuszeit pro Tag dieser Woche: keine Fokuszeit erfasst.'
      : `Fokuszeit pro Tag dieser Woche. ${days
          .map(
            (_d, i) => `${DAY_LABELS[i] ?? ''}: ${formatFocusMinutes(values[i])}`,
          )
          .join(', ')}.`;

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
        role="img"
        aria-label={summaryLabel}
        preserveAspectRatio="xMidYMax meet"
      >
        {days.map((d, i) => {
          const value = values[i];
          const ratio = maxValue > 0 ? value / maxValue : 0;
          const rawHeight = ratio * BAR_MAX_HEIGHT;
          const height =
            value > 0 ? Math.max(MIN_VISIBLE_HEIGHT, rawHeight) : 0;
          const x = i * SLOT_WIDTH + (SLOT_WIDTH - BAR_WIDTH) / 2;
          const y = BAR_MAX_HEIGHT - height;
          const labelY = CHART_HEIGHT - 4;
          return (
            <g key={d.dateKey} data-testid="week-bar-group">
              <rect
                className={styles.bar}
                data-testid="week-bar"
                data-day={DAY_LABELS[i]}
                data-minutes={value}
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={height}
                rx={2}
              />
              <text
                className={styles.dayLabel}
                x={i * SLOT_WIDTH + SLOT_WIDTH / 2}
                y={labelY}
                textAnchor="middle"
              >
                {DAY_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Visuell verborgene Tabelle als Textalternative (Req 18). */}
      <table className="visually-hidden">
        <caption>Fokuszeit pro Tag dieser Woche</caption>
        <thead>
          <tr>
            <th scope="col">Tag</th>
            <th scope="col">Fokuszeit</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.dateKey}>
              <th scope="row">
                {DAY_LABELS[i]} ({formatGermanDate(d.dateKey)})
              </th>
              <td>{formatFocusMinutes(values[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
