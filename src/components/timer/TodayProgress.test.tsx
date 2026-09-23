import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TodayProgress, { formatFocusMinutes } from './TodayProgress';

// Tests für die Tagesfortschritt-Formatierung (Task 9.1, Req 3.5).
describe('formatFocusMinutes', () => {
  it('gibt „0min" bei 0 Minuten zurück', () => {
    expect(formatFocusMinutes(0)).toBe('0min');
  });

  it('gibt „59min" bei 59 Minuten (< 1h) zurück', () => {
    expect(formatFocusMinutes(59)).toBe('59min');
  });

  it('gibt „1h 0min" bei genau 60 Minuten zurück', () => {
    expect(formatFocusMinutes(60)).toBe('1h 0min');
  });

  it('gibt „2h 5min" bei 125 Minuten zurück', () => {
    expect(formatFocusMinutes(125)).toBe('2h 5min');
  });

  it('klemmt negative/ungültige Werte auf „0min"', () => {
    expect(formatFocusMinutes(-10)).toBe('0min');
    expect(formatFocusMinutes(Number.NaN)).toBe('0min');
  });
});

describe('TodayProgress (Rendering)', () => {
  it('zeigt Anzahl der heutigen Pomodoros und die formatierte Fokuszeit', () => {
    render(<TodayProgress pomodoros={3} focusMinutes={125} />);
    expect(screen.getByText('3 Pomodoros')).toBeInTheDocument();
    expect(screen.getByText('2h 5min')).toBeInTheDocument();
  });

  it('zeigt „0 Pomodoros" und „0min" für einen leeren Tag', () => {
    render(<TodayProgress pomodoros={0} focusMinutes={0} />);
    expect(screen.getByText('0 Pomodoros')).toBeInTheDocument();
    expect(screen.getByText('0min')).toBeInTheDocument();
  });

  it('formatiert Fokuszeiten unter 1h ohne Stundenanteil', () => {
    render(<TodayProgress pomodoros={2} focusMinutes={50} />);
    expect(screen.getByText('50min')).toBeInTheDocument();
  });
});
