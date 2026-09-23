import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FocusMode, {
  FOCUS_MODE_MARKER,
  defaultFullscreenController,
  type FullscreenController,
} from './FocusMode';
import type { TimerState, TimerStatus } from '../types';
import type { TimerContextValue } from '../timer/TimerProvider';

// Tests für den Fokusmodus (Task 10, Req 10.1–10.4).
//
// FocusMode liest den Timer über `useTimer()`. Um präzise prüfen zu können, WELCHE
// Timer-Aktionen ausgelöst werden (insbesondere: Verlassen ändert den Timerzustand
// NICHT), mocken wir den Provider-Hook und geben eine vollständige, mit Spies
// bestückte Kontextimplementierung zurück.

const mockTimer = vi.hoisted(() => ({
  value: null as unknown as TimerContextValue,
}));

vi.mock('../timer/TimerProvider', () => ({
  useTimer: () => mockTimer.value,
}));

/** Baut einen Timerzustand mit sinnvollen Defaults. */
function makeState(status: TimerStatus): TimerState {
  return {
    phaseType: 'Focus',
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
  status: TimerStatus = 'Running',
  overrides: Partial<TimerContextValue> = {},
): TimerContextValue {
  return {
    state: makeState(status),
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
    ...overrides,
  };
}

/** No-Op-Fullscreen-Controller für Tests (keine echten Browser-APIs nötig). */
function makeNoopFullscreen(overrides: Partial<FullscreenController> = {}): FullscreenController {
  return {
    isSupported: vi.fn(() => false),
    isActive: vi.fn(() => false),
    request: vi.fn(),
    exit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockTimer.value = makeTimerContext('Running');
});

describe('FocusMode – reduzierte Anzeige (Req 10.1/10.2)', () => {
  it('zeigt Phase, Timer, Fortschritt, Pause/Start, Stoppen und „Vollbild verlassen"', () => {
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    // Overlay vorhanden.
    expect(screen.getByTestId(FOCUS_MODE_MARKER)).toBeInTheDocument();
    // Phase (Text) + Timer (role="timer") + Fortschritt (SVG-Bogen).
    expect(screen.getByText('Fokus')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByTestId('progress-arc')).toBeInTheDocument();
    // Reduzierter Steuerungssatz.
    expect(screen.getByTestId('focus-primary')).toBeInTheDocument();
    expect(screen.getByTestId('focus-stop')).toBeInTheDocument();
    expect(screen.getByTestId('focus-exit')).toBeInTheDocument();
  });

  it('rendert genau drei Steuer-Buttons (keine Navigation/Statistik/Einstellungen)', () => {
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('zeigt im Running-Zustand „Pause" als Primäraktion', () => {
    mockTimer.value = makeTimerContext('Running');
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);
    expect(screen.getByTestId('focus-primary')).toHaveTextContent('Pause');
  });

  it('zeigt im Paused-Zustand „Fortsetzen" als Primäraktion', () => {
    mockTimer.value = makeTimerContext('Paused');
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);
    expect(screen.getByTestId('focus-primary')).toHaveTextContent('Fortsetzen');
  });
});

describe('FocusMode – Steuerung (Req 10.1)', () => {
  it('Pause/Start ruft im Running-Zustand pause() auf', async () => {
    const user = userEvent.setup();
    const ctx = makeTimerContext('Running');
    mockTimer.value = ctx;
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    await user.click(screen.getByTestId('focus-primary'));
    expect(ctx.pause).toHaveBeenCalledTimes(1);
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.start).not.toHaveBeenCalled();
  });

  it('Pause/Start ruft im Paused-Zustand resume() auf', async () => {
    const user = userEvent.setup();
    const ctx = makeTimerContext('Paused');
    mockTimer.value = ctx;
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    await user.click(screen.getByTestId('focus-primary'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.pause).not.toHaveBeenCalled();
  });

  it('Stoppen ruft cancel() auf', async () => {
    const user = userEvent.setup();
    const ctx = makeTimerContext('Running');
    mockTimer.value = ctx;
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    await user.click(screen.getByTestId('focus-stop'));
    expect(ctx.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('FocusMode – Verlassen ohne Zustandsänderung (Req 10.4)', () => {
  it('Klick auf „Vollbild verlassen" ruft onExit auf', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const ctx = makeTimerContext('Running');
    mockTimer.value = ctx;
    render(<FocusMode onExit={onExit} fullscreen={makeNoopFullscreen()} />);

    await user.click(screen.getByTestId('focus-exit'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('Esc ruft onExit auf', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    mockTimer.value = makeTimerContext('Running');
    render(<FocusMode onExit={onExit} fullscreen={makeNoopFullscreen()} />);

    await user.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('Verlassen (Button) ändert KEINEN Timerzustand (kein cancel/pause/resume/start/restart)', async () => {
    const user = userEvent.setup();
    const ctx = makeTimerContext('Running');
    mockTimer.value = ctx;
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    await user.click(screen.getByTestId('focus-exit'));
    expect(ctx.cancel).not.toHaveBeenCalled();
    expect(ctx.pause).not.toHaveBeenCalled();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.start).not.toHaveBeenCalled();
    expect(ctx.restart).not.toHaveBeenCalled();
    expect(ctx.skip).not.toHaveBeenCalled();
  });

  it('Verlassen (Esc) ändert KEINEN Timerzustand', async () => {
    const user = userEvent.setup();
    const ctx = makeTimerContext('Running');
    mockTimer.value = ctx;
    render(<FocusMode onExit={vi.fn()} fullscreen={makeNoopFullscreen()} />);

    await user.keyboard('{Escape}');
    expect(ctx.cancel).not.toHaveBeenCalled();
    expect(ctx.pause).not.toHaveBeenCalled();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.start).not.toHaveBeenCalled();
  });
});

describe('FocusMode – Vollbild (Req 10.3), defensiv/injizierbar', () => {
  it('fordert bei Betreten Vollbild an, wenn unterstützt', () => {
    const fs = makeNoopFullscreen({ isSupported: vi.fn(() => true) });
    render(<FocusMode onExit={vi.fn()} fullscreen={fs} />);
    expect(fs.request).toHaveBeenCalledTimes(1);
  });

  it('fordert KEIN Vollbild an, wenn requestFullscreenOnEnter=false', () => {
    const fs = makeNoopFullscreen({ isSupported: vi.fn(() => true) });
    render(
      <FocusMode onExit={vi.fn()} requestFullscreenOnEnter={false} fullscreen={fs} />,
    );
    expect(fs.request).not.toHaveBeenCalled();
  });

  it('verlässt Vollbild beim Unmount, wenn aktiv', () => {
    const fs = makeNoopFullscreen({
      isSupported: vi.fn(() => true),
      isActive: vi.fn(() => true),
    });
    const { unmount } = render(<FocusMode onExit={vi.fn()} fullscreen={fs} />);
    unmount();
    expect(fs.exit).toHaveBeenCalledTimes(1);
  });

  it('wirft nicht, wenn die Fullscreen API fehlt (jsdom): Standard-Controller no-opt', () => {
    // Der Standard-Controller ist feature-detektiert; in jsdom fehlt die API.
    expect(defaultFullscreenController.isSupported()).toBe(false);
    // Rendern mit dem echten Standard-Controller darf nicht werfen.
    expect(() =>
      render(<FocusMode onExit={vi.fn()} />),
    ).not.toThrow();
    // Defensive Aufrufe werfen ebenfalls nicht.
    expect(() => defaultFullscreenController.exit()).not.toThrow();
    expect(() => defaultFullscreenController.isActive()).not.toThrow();
  });
});
