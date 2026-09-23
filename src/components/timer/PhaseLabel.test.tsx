import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PhaseLabel from './PhaseLabel';

// Tests für die Phasen-Beschriftung (Task 9.1, Req 3.1, 3.6, 18.3).
describe('PhaseLabel', () => {
  it('zeigt den deutschen Text „Fokus" für die Fokusphase', () => {
    render(<PhaseLabel phaseType="Focus" />);
    expect(screen.getByText('Fokus')).toBeInTheDocument();
  });

  it('zeigt den deutschen Text „Kurze Pause" für die kurze Pause', () => {
    render(<PhaseLabel phaseType="ShortBreak" />);
    expect(screen.getByText('Kurze Pause')).toBeInTheDocument();
  });

  it('zeigt den deutschen Text „Lange Pause" für die lange Pause', () => {
    render(<PhaseLabel phaseType="LongBreak" />);
    expect(screen.getByText('Lange Pause')).toBeInTheDocument();
  });

  it('vermittelt die Phase zusätzlich über ein (dekoratives) Icon, nicht nur über Farbe (Req 3.6/18.3)', () => {
    const { container } = render(<PhaseLabel phaseType="Focus" />);
    // Text ist vorhanden (zugängliche Quelle) …
    expect(screen.getByText('Fokus')).toBeInTheDocument();
    // … und ein dekoratives Icon begleitet ihn.
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('rendert je Phase ein unterschiedliches Icon-Markup', () => {
    const focus = render(<PhaseLabel phaseType="Focus" />).container.querySelector('svg')
      ?.innerHTML;
    const short = render(<PhaseLabel phaseType="ShortBreak" />).container.querySelector(
      'svg',
    )?.innerHTML;
    const long = render(<PhaseLabel phaseType="LongBreak" />).container.querySelector(
      'svg',
    )?.innerHTML;

    expect(focus).toBeTruthy();
    expect(short).toBeTruthy();
    expect(long).toBeTruthy();
    expect(focus).not.toEqual(short);
    expect(short).not.toEqual(long);
    expect(focus).not.toEqual(long);
  });
});
