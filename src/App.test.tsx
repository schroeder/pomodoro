import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { TIMER_VIEW_MARKER } from './views/TimerView';
import { STATS_VIEW_MARKER } from './views/StatsView';
import { SETTINGS_VIEW_MARKER } from './views/SettingsView';

// Tests für die App-Shell, Navigation und das Routing (Task 8, Req 14.1–14.4).
// App verwendet intern einen HashRouter; wir setzen den Hash vor jedem Test zurück,
// damit die Timer-Startseite ("/") aktiv ist.
describe('App-Shell, Navigation und Routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('rendert die Provider-Kette und zeigt initial die Timer-Ansicht', () => {
    render(<App />);
    // Provider-Baum + Routing haben gerendert, ohne zu werfen.
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByTestId(TIMER_VIEW_MARKER)).toBeInTheDocument();
  });

  it('stellt genau drei Navigationsziele bereit (Req 14.1)', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(within(nav).getByRole('link', { name: 'Timer' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Statistik' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Einstellungen' })).toBeInTheDocument();
  });

  it('wechselt beim Klick auf „Statistik" zur Statistik-Ansicht', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId(TIMER_VIEW_MARKER)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Statistik' }));

    expect(screen.getByTestId(STATS_VIEW_MARKER)).toBeInTheDocument();
    expect(screen.queryByTestId(TIMER_VIEW_MARKER)).not.toBeInTheDocument();
  });

  it('wechselt beim Klick auf „Einstellungen" zur Einstellungs-Ansicht und zurück zum Timer', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Einstellungen' }));
    expect(screen.getByTestId(SETTINGS_VIEW_MARKER)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Timer' }));
    expect(screen.getByTestId(TIMER_VIEW_MARKER)).toBeInTheDocument();
    expect(screen.queryByTestId(SETTINGS_VIEW_MARKER)).not.toBeInTheDocument();
  });
});
