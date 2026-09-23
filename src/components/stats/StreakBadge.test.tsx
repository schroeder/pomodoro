import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakBadge from './StreakBadge';

// Tests für das Streak-Badge (Task 12, Req 11.5).
describe('StreakBadge', () => {
  it('zeigt die Serie mit Flamme und Pluralform', () => {
    render(<StreakBadge streak={5} />);
    const badge = screen.getByTestId('streak-badge');
    expect(badge).toHaveTextContent('5 Tage in Folge');
    expect(badge).toHaveTextContent('🔥');
    expect(badge).toHaveAttribute('aria-label', '🔥 5 Tage in Folge');
  });

  it('verwendet die Singularform bei genau einem Tag', () => {
    render(<StreakBadge streak={1} />);
    const badge = screen.getByTestId('streak-badge');
    expect(badge).toHaveTextContent('1 Tag in Folge');
    expect(badge).not.toHaveTextContent('Tage');
  });

  it('stellt den Nullfall dezent mit „—" dar (keine Flamme)', () => {
    render(<StreakBadge streak={0} />);
    const badge = screen.getByTestId('streak-badge');
    expect(badge).toHaveTextContent('—');
    expect(badge).not.toHaveTextContent('🔥');
    expect(badge).not.toHaveTextContent('in Folge');
  });

  it('behandelt negative/ungültige Werte wie den Nullfall', () => {
    render(<StreakBadge streak={-2} />);
    expect(screen.getByTestId('streak-badge')).toHaveTextContent('—');
  });
});
