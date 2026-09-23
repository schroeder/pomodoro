import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimerView, { TIMER_VIEW_MARKER } from './TimerView';
import type { PhaseType, Settings, TimerState, TimerStatus } from '../types';
import type { TimerContextValue } from '../timer/TimerProvider';
import { DEFAULT_SETTINGS } from '../settings/defaults';

// Accessibility-Feinschliff der Timer-Hauptansicht (Task 15, Req 18.1–18.4).
//
// Diese Tests prüfen auf Integrationsebene, dass die Ansicht Phasen-/Statuswechsel
// über GENAU EINE polite Live-Region ankündigt (nicht sekündlich, Req 18.4) und dass
// die zentralen Steuer-Elemente zugängliche deutsche Namen tragen (Req 18.2).
//
// Wie in FocusMode.test.tsx mocken wir die Provider-Hooks, um den Timerzustand
// deterministisch vorzugeben, ohne echte Ticker/Persistenz zu benötigen.

const mockTimer = vi.hoisted(() => ({
  value: null as unknown as TimerContextValue,
}));
const mockStats = vi.hoisted(() => ({
  today: { pomodoros: 0, focusMinutes: 0, averageFocusMinutes: 0, breaks: 0 },
}));
const mockSettings = vi.hoisted(() => ({
  settings: null as unknown as Settings,
}));

vi.mock('../timer/TimerProvider', () => ({
  useTimer: () => mockTimer.value,
}));

vi.mock('../stats/StatsProvider', () => ({
  useStats: () => ({ today: mockStats.today }),
}));

vi.mock('../settings/SettingsProvider', () => ({
  useSettings: () => ({ settings: mockSettings.settings }),
}));

/** Baut einen Timerzustand mit sinnvollen Defaults. */
function makeState(
  status: TimerStatus,
  phaseType: PhaseType = 'Focus',
): TimerState {
  return {
    phaseType,
    status,
    plannedDurationMs: 25 * 60_000,
    endsAt: null,
    remainingMs: 25 * 60_000,
    startedAt: null,
    completedFocusInCycle: 0,
    pomodoroNumberInCycle: 1,
    notificationPrompted: false,
  };
}

/** Baut einen Timer-Kontext mit Spy-Aktionen und erlaubt Overrides. */
function makeTimerContext(
  status: TimerStatus,
  phaseType: PhaseType = 'Focus',
): TimerContextValue {
  return {
    state: makeState(status, phaseType),
    remainingMs: 25 * 60_000,
    storageAvailable: true,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    restart: vi.fn(),
    cancel: vi.fn(),
    skip: vi.fn(),
    extend: vi.fn(),
    completeEarly: vi.fn(),
    advance: vi.fn(),
  };
}

function renderTimerView() {
  return render(
    <MemoryRouter>
      <TimerView />
    </MemoryRouter>,
  );
}

describe('TimerView – Accessibility-Feinschliff (Task 15)', () => {
  beforeEach(() => {
    mockStats.today = {
      pomodoros: 0,
      focusMinutes: 0,
      averageFocusMinutes: 0,
      breaks: 0,
    };
    mockSettings.settings = DEFAULT_SETTINGS;
    mockTimer.value = makeTimerContext('Ready', 'Focus');
  });

  it('rendert genau EINE polite Live-Region (role="status") für Ankündigungen (Req 18.4)', () => {
    renderTimerView();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('kündigt die aktuelle Phase/Status in der politen Live-Region an (Req 18.4)', () => {
    mockTimer.value = makeTimerContext('Running', 'Focus');
    renderTimerView();
    const status = screen.getByRole('status');
    // Enthält den deutschen Phasentext (Text statt reiner Farbe, Req 18.3).
    expect(status).toHaveTextContent('Fokus');
  });

  it('aktualisiert die Live-Region bei einem Phasenwechsel (Fokus → Kurze Pause, Req 18.4)', () => {
    mockTimer.value = makeTimerContext('Running', 'Focus');
    const { rerender } = renderTimerView();
    expect(screen.getByRole('status')).toHaveTextContent('Fokus');

    // Phasenwechsel simulieren und erneut rendern.
    mockTimer.value = makeTimerContext('Ready', 'ShortBreak');
    rerender(
      <MemoryRouter>
        <TimerView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Kurze Pause');
  });

  it('kündigt die Zeit NICHT sekündlich an: die Timer-Region ist aria-live="off" (Req 18.4)', () => {
    mockTimer.value = makeTimerContext('Running', 'Focus');
    renderTimerView();
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  });

  it('stellt der Startschaltfläche einen zugänglichen deutschen Namen bereit (Req 18.2)', () => {
    mockTimer.value = makeTimerContext('Ready', 'Focus');
    renderTimerView();
    expect(screen.getByRole('button', { name: 'Fokus starten' })).toBeInTheDocument();
    // Auch der Einstieg in den Fokusmodus trägt einen zugänglichen Namen.
    expect(screen.getByRole('button', { name: 'Fokusmodus' })).toBeInTheDocument();
  });

  it('behält den stabilen Test-Marker der Ansicht bei', () => {
    renderTimerView();
    expect(screen.getByTestId(TIMER_VIEW_MARKER)).toBeInTheDocument();
  });
});
