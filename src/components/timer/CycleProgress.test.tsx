import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CycleProgress from './CycleProgress';

// Tests für die Zyklus-Fortschrittsanzeige (Task 9.1, Req 3.4, 18.3).
describe('CycleProgress', () => {
  it('zeigt den Text „Pomodoro X von N"', () => {
    render(
      <CycleProgress
        pomodoroNumberInCycle={2}
        focusPerCycle={4}
        completedFocusInCycle={1}
      />,
    );
    expect(screen.getByText('Pomodoro 2 von 4')).toBeInTheDocument();
  });

  it('rendert N Punkte, davon so viele gefüllt wie abgeschlossene Fokusphasen', () => {
    render(
      <CycleProgress
        pomodoroNumberInCycle={3}
        focusPerCycle={4}
        completedFocusInCycle={2}
      />,
    );
    expect(screen.getAllByTestId('dot-filled')).toHaveLength(2);
    expect(screen.getAllByTestId('dot-empty')).toHaveLength(2);
  });

  it('stellt eine ausführliche ARIA-Text-Alternative bereit (Req 18.3)', () => {
    render(
      <CycleProgress
        pomodoroNumberInCycle={2}
        focusPerCycle={4}
        completedFocusInCycle={1}
      />,
    );
    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-label', 'Pomodoro 2 von 4, 1 von 4 abgeschlossen');
  });

  it('respektiert eine abweichende Zykluslänge (N aus focusPerCycle)', () => {
    render(
      <CycleProgress
        pomodoroNumberInCycle={1}
        focusPerCycle={6}
        completedFocusInCycle={0}
      />,
    );
    expect(screen.getByText('Pomodoro 1 von 6')).toBeInTheDocument();
    expect(screen.getAllByTestId('dot-empty')).toHaveLength(6);
    expect(screen.queryAllByTestId('dot-filled')).toHaveLength(0);
  });

  it('klemmt unplausible Werte defensiv (mind. 1 Slot, current/completed ≤ N)', () => {
    render(
      <CycleProgress
        pomodoroNumberInCycle={9}
        focusPerCycle={4}
        completedFocusInCycle={9}
      />,
    );
    expect(screen.getByText('Pomodoro 4 von 4')).toBeInTheDocument();
    expect(screen.getAllByTestId('dot-filled')).toHaveLength(4);
  });
});
