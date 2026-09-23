import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HistoryList from './HistoryList';

// Tests für die Historienliste (Task 12, Req 11.4).
describe('HistoryList', () => {
  it('rendert einen Eintrag pro Historientag mit Datum und Kennzahlen', () => {
    render(
      <HistoryList
        entries={[
          { dateKey: '2024-06-05', pomodoros: 4, focusMinutes: 100 },
          { dateKey: '2024-06-03', pomodoros: 2, focusMinutes: 50 },
        ]}
      />,
    );

    const items = screen.getAllByTestId('history-item');
    expect(items).toHaveLength(2);

    // Erster Eintrag: Mittwoch, 5. Juni 2024.
    expect(within(items[0]).getByText('Mi, 5. Juni 2024')).toBeInTheDocument();
    expect(within(items[0]).getByText('4 Pomodoros')).toBeInTheDocument();
    expect(within(items[0]).getByText('1h 40min')).toBeInTheDocument();

    // Zweiter Eintrag.
    expect(within(items[1]).getByText('Mo, 3. Juni 2024')).toBeInTheDocument();
    expect(within(items[1]).getByText('2 Pomodoros')).toBeInTheDocument();
    expect(within(items[1]).getByText('50min')).toBeInTheDocument();
  });

  it('zeigt einen Hinweis, wenn keine Historie vorhanden ist', () => {
    render(<HistoryList entries={[]} />);
    expect(screen.getByText('Noch keine Daten vorhanden.')).toBeInTheDocument();
    expect(screen.queryByTestId('history-item')).not.toBeInTheDocument();
  });
});
