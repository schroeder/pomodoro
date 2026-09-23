import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeekBarChart, { type WeekBarDatum } from './WeekBarChart';

// Tests für das SVG-Balkendiagramm der Woche (Task 12, Req 11.3 / 18).

/** Erzeugt sieben Tage (Mo..So) mit den angegebenen Fokusminuten. */
function makeWeek(minutes: number[]): WeekBarDatum[] {
  const base = ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-08', '2024-06-09'];
  return base.map((dateKey, i) => ({ dateKey, focusMinutes: minutes[i] ?? 0 }));
}

describe('WeekBarChart', () => {
  it('rendert genau sieben Balken', () => {
    render(<WeekBarChart days={makeWeek([25, 50, 0, 75, 100, 0, 10])} />);
    const bars = screen.getAllByTestId('week-bar');
    expect(bars).toHaveLength(7);
  });

  it('skaliert die Balkenhöhen proportional zum Wochenmaximum', () => {
    // Tag mit 100 min ist das Maximum; Tag mit 50 min soll etwa halb so hoch sein.
    render(<WeekBarChart days={makeWeek([0, 50, 0, 0, 100, 0, 0])} />);
    const bars = screen.getAllByTestId('week-bar');
    const heights = bars.map((b) => Number(b.getAttribute('height')));

    const maxHeight = heights[4]; // Freitag (100 min)
    const halfHeight = heights[1]; // Dienstag (50 min)

    expect(maxHeight).toBeGreaterThan(0);
    expect(halfHeight).toBeGreaterThan(0);
    // Proportional: 50/100 → ~halbe Höhe.
    expect(halfHeight).toBeLessThan(maxHeight);
    expect(halfHeight / maxHeight).toBeCloseTo(0.5, 1);

    // Tage mit 0 min haben Höhe 0.
    expect(heights[0]).toBe(0);
    expect(heights[2]).toBe(0);
  });

  it('rendert bei einer Woche ohne Fokuszeit sieben Balken der Höhe 0', () => {
    render(<WeekBarChart days={makeWeek([0, 0, 0, 0, 0, 0, 0])} />);
    const bars = screen.getAllByTestId('week-bar');
    expect(bars).toHaveLength(7);
    for (const bar of bars) {
      expect(Number(bar.getAttribute('height'))).toBe(0);
    }
  });

  it('beschriftet die Wochentage Mo..So', () => {
    render(<WeekBarChart days={makeWeek([1, 2, 3, 4, 5, 6, 7])} />);
    const bars = screen.getAllByTestId('week-bar');
    expect(bars.map((b) => b.getAttribute('data-day'))).toEqual([
      'Mo',
      'Di',
      'Mi',
      'Do',
      'Fr',
      'Sa',
      'So',
    ]);
  });

  it('bietet eine barrierefreie Textalternative (Diagramm-Label)', () => {
    render(<WeekBarChart days={makeWeek([60, 0, 0, 0, 0, 0, 0])} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('aria-label');
    expect(img.getAttribute('aria-label')).toContain('Mo: 1h 0min');
  });

  it('stellt eine verborgene Tabelle mit den Werten bereit', () => {
    render(<WeekBarChart days={makeWeek([90, 0, 0, 0, 0, 0, 0])} />);
    // Die Tabelle nennt die Fokuszeit des Montags.
    expect(screen.getByText('1h 30min')).toBeInTheDocument();
  });
});
