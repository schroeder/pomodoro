import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CountdownDisplay from './CountdownDisplay';

// Tests für die CountdownDisplay-Komponente (Task 9.1, Req 3.2, 18.4).
describe('CountdownDisplay', () => {
  it('zeigt die verbleibende Zeit im Format MM:SS', () => {
    render(<CountdownDisplay remainingMs={25 * 60 * 1000} phaseType="Focus" />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('rundet auf ganze Sekunden ab und füllt zweistellig auf', () => {
    // 1 min 5,9 s → 01:05
    render(<CountdownDisplay remainingMs={65_900} phaseType="Focus" />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('klemmt negative/ungültige Restzeit auf 00:00 (Req 20.2)', () => {
    render(<CountdownDisplay remainingMs={-5000} phaseType="ShortBreak" />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('exponiert eine Timer-Region mit sprechendem ARIA-Label inkl. Phase', () => {
    render(<CountdownDisplay remainingMs={5 * 60 * 1000} phaseType="ShortBreak" />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-label', '05:00 verbleibend – Kurze Pause');
  });

  it('kündigt die Zeit NICHT sekündlich an (aria-live="off" auf der Timer-Region, Req 18.4)', () => {
    render(<CountdownDisplay remainingMs={5 * 60 * 1000} phaseType="Focus" />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  });

  it('gibt Phasen-/Statuswechsel über eine polite Live-Region aus', () => {
    render(
      <CountdownDisplay
        remainingMs={5 * 60 * 1000}
        phaseType="Focus"
        announcement="Fokus gestartet"
      />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Fokus gestartet');
  });
});
