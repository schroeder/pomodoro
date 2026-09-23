import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TodayStats from './TodayStats';

// Tests für die „Heute"-Kennzahlen (Task 12, Req 11.2).
describe('TodayStats', () => {
  it('rendert alle vier Kennzahlen mit korrekter Formatierung', () => {
    render(
      <TodayStats
        pomodoros={5}
        focusMinutes={125}
        averageFocusMinutes={25}
        breaks={2}
      />,
    );

    const pomodoros = screen.getByText('Pomodoros').closest('div') as HTMLElement;
    expect(within(pomodoros).getByText('5')).toBeInTheDocument();

    const focus = screen.getByText('Fokuszeit').closest('div') as HTMLElement;
    expect(within(focus).getByText('2h 5min')).toBeInTheDocument();

    const average = screen.getByText('Ø Fokusdauer').closest('div') as HTMLElement;
    expect(within(average).getByText('25min')).toBeInTheDocument();

    const breaks = screen.getByText('Pausen').closest('div') as HTMLElement;
    expect(within(breaks).getByText('2')).toBeInTheDocument();
  });

  it('zeigt Nullwerte für einen leeren Tag an', () => {
    render(
      <TodayStats
        pomodoros={0}
        focusMinutes={0}
        averageFocusMinutes={0}
        breaks={0}
      />,
    );
    expect(screen.getAllByText('0')).toHaveLength(2); // Pomodoros + Pausen
    expect(screen.getAllByText('0min')).toHaveLength(2); // Fokuszeit + Ø Fokusdauer
  });

  it('klemmt negative/ungültige Zählwerte auf 0', () => {
    render(
      <TodayStats
        pomodoros={-3}
        focusMinutes={60}
        averageFocusMinutes={30}
        breaks={Number.NaN}
      />,
    );
    const pomodoros = screen.getByText('Pomodoros').closest('div') as HTMLElement;
    expect(within(pomodoros).getByText('0')).toBeInTheDocument();
    const breaks = screen.getByText('Pausen').closest('div') as HTMLElement;
    expect(within(breaks).getByText('0')).toBeInTheDocument();
  });
});
