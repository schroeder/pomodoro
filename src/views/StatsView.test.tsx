import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsView, { STATS_VIEW_MARKER } from './StatsView';
import { StatsProvider } from '../stats/StatsProvider';
import type { Session } from '../types';

// Tests der komponierten Statistik-Ansicht (Task 12, Req 11.2–11.5).
// Wir umgehen IndexedDB, indem wir dem StatsProvider einen Session-Loader und eine
// feste Zeitquelle injizieren.

// Feste Referenzzeit: 2024-06-05 (Mittwoch) 12:00 lokal.
const NOW = new Date(2024, 5, 5, 12, 0, 0).getTime();

function focusSession(dateKey: string, durationMs: number, id: string): Session {
  return {
    id,
    type: 'Focus',
    startedAt: NOW,
    endedAt: NOW + durationMs,
    plannedDurationMs: durationMs,
    actualDurationMs: durationMs,
    status: 'completed',
    completed: true,
    dateKey,
  };
}

function renderWithStats(sessions: Session[]) {
  return render(
    <StatsProvider now={() => NOW} loadSessions={async () => sessions}>
      <StatsView />
    </StatsProvider>,
  );
}

const MIN = 60000;

describe('StatsView', () => {
  it('rendert die Ansicht mit stabilem Marker und Überschrift', async () => {
    renderWithStats([]);
    expect(await screen.findByTestId(STATS_VIEW_MARKER)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Statistik' })).toBeInTheDocument();
  });

  it('zeigt „Heute"-Kennzahlen, Wochendiagramm und Historie mit echten Daten', async () => {
    const sessions = [
      // Heute (2024-06-05): 2 Pomodoros à 25 min.
      focusSession('2024-06-05', 25 * MIN, 'a'),
      focusSession('2024-06-05', 25 * MIN, 'b'),
      // Früher in der Woche (Montag 2024-06-03): 1 Pomodoro à 50 min.
      focusSession('2024-06-03', 50 * MIN, 'c'),
    ];
    renderWithStats(sessions);

    // Warten, bis der Ladezustand vorbei ist.
    await screen.findByRole('heading', { name: 'Heute' });

    // Heute: 2 Pomodoros, 50 min Fokuszeit.
    const today = screen.getByRole('heading', { name: 'Heute' })
      .parentElement as HTMLElement;
    expect(today).toHaveTextContent('2');
    expect(today).toHaveTextContent('50min');

    // Woche: 3 Pomodoros gesamt, sieben Balken.
    const week = screen.getByRole('heading', { name: 'Diese Woche' })
      .parentElement as HTMLElement;
    expect(week).toHaveTextContent('3');
    expect(screen.getAllByTestId('week-bar')).toHaveLength(7);

    // Historie: zwei Tage mit Pomodoros.
    expect(screen.getAllByTestId('history-item')).toHaveLength(2);
  });

  it('zeigt die leere Historie und den dezenten Streak-Nullfall ohne Daten', async () => {
    renderWithStats([]);
    await screen.findByRole('heading', { name: 'Historie' });
    expect(screen.getByText('Noch keine Daten vorhanden.')).toBeInTheDocument();
    expect(screen.getByTestId('streak-badge')).toHaveTextContent('—');
  });
});
