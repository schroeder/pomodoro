import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import WeekStats from './WeekStats';
import type { WeekBarDatum } from './WeekBarChart';

// Tests für die Wochenübersicht (Task 12, Req 11.3).

function makeWeek(minutes: number[]): WeekBarDatum[] {
  const base = ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-08', '2024-06-09'];
  return base.map((dateKey, i) => ({ dateKey, focusMinutes: minutes[i] ?? 0 }));
}

describe('WeekStats', () => {
  it('zeigt Gesamtpomodoros und gesamte Fokuszeit', () => {
    render(
      <WeekStats
        totalPomodoros={12}
        totalFocusMinutes={300}
        days={makeWeek([25, 50, 0, 75, 100, 25, 25])}
      />,
    );

    const pomodoros = screen.getByText('Pomodoros').closest('div') as HTMLElement;
    expect(within(pomodoros).getByText('12')).toBeInTheDocument();

    // Gesamte Fokuszeit der Woche (eindeutiger Wert, unabhängig von der Tabelle).
    expect(screen.getByText('5h 0min')).toBeInTheDocument();
  });

  it('rendert das Balkendiagramm mit sieben Balken', () => {
    render(
      <WeekStats
        totalPomodoros={0}
        totalFocusMinutes={0}
        days={makeWeek([0, 0, 0, 0, 0, 0, 0])}
      />,
    );
    expect(screen.getAllByTestId('week-bar')).toHaveLength(7);
  });
});
