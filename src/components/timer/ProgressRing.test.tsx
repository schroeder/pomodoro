import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressRing, { computeProgress, dashOffsetForProgress } from './ProgressRing';

// Tests für den Fortschrittsring (Task 9.1, Req 3.3, 18.3).
describe('computeProgress', () => {
  it('ist 0 zu Beginn (volle Restzeit)', () => {
    expect(computeProgress(1000, 1000)).toBe(0);
  });

  it('ist 0.5 bei halber verstrichener Zeit', () => {
    expect(computeProgress(1000, 500)).toBeCloseTo(0.5, 10);
  });

  it('ist 1 bei abgelaufener Zeit', () => {
    expect(computeProgress(1000, 0)).toBe(1);
  });

  it('klemmt bei negativer Restzeit auf 1 (Req 20.2)', () => {
    expect(computeProgress(1000, -500)).toBe(1);
  });

  it('gibt 0 bei nicht-positiver/ungültiger geplanter Dauer zurück', () => {
    expect(computeProgress(0, 0)).toBe(0);
    expect(computeProgress(-100, 50)).toBe(0);
    expect(computeProgress(Number.NaN, 50)).toBe(0);
  });
});

describe('dashOffsetForProgress', () => {
  it('ist gleich dem Umfang bei Fortschritt 0 (nichts gefüllt)', () => {
    expect(dashOffsetForProgress(100, 0)).toBe(100);
  });

  it('ist 0 bei Fortschritt 1 (voll gefüllt)', () => {
    expect(dashOffsetForProgress(100, 1)).toBe(0);
  });

  it('ist die Hälfte des Umfangs bei Fortschritt 0.5', () => {
    expect(dashOffsetForProgress(100, 0.5)).toBe(50);
  });
});

describe('ProgressRing (Rendering)', () => {
  it('setzt stroke-dasharray = Umfang und dashoffset proportional zum Fortschritt', () => {
    const size = 240;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    render(
      <ProgressRing
        plannedDurationMs={1000}
        remainingMs={250}
        size={size}
        strokeWidth={strokeWidth}
      />,
    );

    const arc = screen.getByTestId('progress-arc');
    // Fortschritt = (1000 - 250) / 1000 = 0.75
    const expectedOffset = circumference * (1 - 0.75);
    expect(Number(arc.getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 5);
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset, 5);
  });

  it('ist dekorativ und für Screenreader verborgen (aria-hidden, Req 18.3)', () => {
    const { container } = render(
      <ProgressRing plannedDurationMs={1000} remainingMs={500} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('rendert den Mittelinhalt (children)', () => {
    render(
      <ProgressRing plannedDurationMs={1000} remainingMs={500}>
        <span>Mitte</span>
      </ProgressRing>,
    );
    expect(screen.getByText('Mitte')).toBeInTheDocument();
  });
});
