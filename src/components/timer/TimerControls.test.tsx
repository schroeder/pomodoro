import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerControls, {
  type TimerControlsProps,
  COMPLETE_EARLY_CONFIRM_TITLE,
  RESTART_CONFIRM_TITLE,
  nextPhaseStartLabel,
  nextPhaseTypeForLabel,
} from './TimerControls';
import type { PhaseType, TimerStatus } from '../../types';
import { MINUTE_MS } from './ExtendMenu';

// Tests für die kontextabhängige Steuerung (Task 9.2, Req 1, 4.4, 4.7, 4.8, 5.4).

/** Baut Props mit no-op Callbacks und erlaubt gezielte Overrides. */
function makeProps(
  status: TimerStatus,
  phaseType: PhaseType = 'Focus',
  overrides: Partial<TimerControlsProps> = {},
): TimerControlsProps {
  return {
    status,
    phaseType,
    nextPhaseType: nextPhaseTypeForLabel(phaseType),
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onCancel: vi.fn(),
    onSkip: vi.fn(),
    onExtend: vi.fn(),
    onCompleteEarly: vi.fn(),
    onAdvance: vi.fn(),
    ...overrides,
  };
}

describe('TimerControls – kontextabhängige Buttons', () => {
  it('Ready: zeigt einen prominenten Ein-Klick-Start und keine Pause/Neustart (Req 1)', () => {
    render(<TimerControls {...makeProps('Ready', 'Focus')} />);
    expect(screen.getByRole('button', { name: 'Fokus starten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neustart' })).not.toBeInTheDocument();
  });

  it('Ready: ein Klick auf Start löst onStart aus (Req 1.2/1.4)', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<TimerControls {...makeProps('Ready', 'Focus', { onStart })} />);
    await user.click(screen.getByRole('button', { name: 'Fokus starten' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('Running (Focus): zeigt Pause, Verlängern, Überspringen, Neustart, Abbrechen und Früher abschließen', () => {
    render(<TimerControls {...makeProps('Running', 'Focus')} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verlängern' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Überspringen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neustart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Früher abschließen' }),
    ).toBeInTheDocument();
  });

  it('Running (Pause-Phase): zeigt KEIN „Früher abschließen" (nur Focus, Req 4.8)', () => {
    render(<TimerControls {...makeProps('Running', 'ShortBreak')} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Früher abschließen' }),
    ).not.toBeInTheDocument();
  });

  it('Running: Pause-Button löst onPause aus (Req 4.2)', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    render(<TimerControls {...makeProps('Running', 'Focus', { onPause })} />);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('Running: Verlängern ruft onExtend mit korrekten ms auf (Req 4.7)', async () => {
    const user = userEvent.setup();
    const onExtend = vi.fn();
    render(<TimerControls {...makeProps('Running', 'Focus', { onExtend })} />);
    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    await user.click(screen.getByRole('menuitem', { name: '+10 Minuten' }));
    expect(onExtend).toHaveBeenCalledWith(10 * MINUTE_MS);
  });

  it('Paused: zeigt Fortsetzen, Neustart, Überspringen, Abbrechen (Req 4.3)', () => {
    render(<TimerControls {...makeProps('Paused', 'Focus')} />);
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neustart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Überspringen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });

  it('Paused: Fortsetzen löst onResume aus (Req 4.3)', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<TimerControls {...makeProps('Paused', 'Focus', { onResume })} />);
    await user.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('Completed nach Fokus: zeigt „Pause starten" und ruft onAdvance auf (Req 5.4)', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    render(
      <TimerControls
        {...makeProps('Completed', 'Focus', {
          nextPhaseType: 'ShortBreak',
          onAdvance,
        })}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Pause starten' });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('Completed nach Pause: zeigt „Fokus starten" (Req 5.4)', () => {
    render(
      <TimerControls
        {...makeProps('Completed', 'ShortBreak', { nextPhaseType: 'Focus' })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Fokus starten' })).toBeInTheDocument();
  });
});

describe('TimerControls – Bestätigungsdialoge', () => {
  it('Neustart öffnet eine Sicherheitsabfrage; erst bei Bestätigung wird onRestart gerufen (Req 4.4)', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(<TimerControls {...makeProps('Running', 'Focus', { onRestart })} />);

    await user.click(screen.getByRole('button', { name: 'Neustart' }));
    // Dialog erscheint, onRestart noch nicht aufgerufen.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(RESTART_CONFIRM_TITLE)).toBeInTheDocument();
    expect(onRestart).not.toHaveBeenCalled();

    // Bestätigen (Button im Dialog).
    await user.click(within(dialog).getByRole('button', { name: 'Neustart' }));
    // Nach Bestätigung: onRestart einmal, Dialog geschlossen.
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Neustart-Abfrage kann abgebrochen werden, ohne onRestart zu rufen (Req 4.4)', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(<TimerControls {...makeProps('Running', 'Focus', { onRestart })} />);

    await user.click(screen.getByRole('button', { name: 'Neustart' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(onRestart).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('„Früher abschließen" zeigt die exakte Abfrage und ruft onCompleteEarly erst bei Bestätigung (Req 4.8)', async () => {
    const user = userEvent.setup();
    const onCompleteEarly = vi.fn();
    render(
      <TimerControls {...makeProps('Running', 'Focus', { onCompleteEarly })} />,
    );

    await user.click(screen.getByRole('button', { name: 'Früher abschließen' }));
    expect(screen.getByText(COMPLETE_EARLY_CONFIRM_TITLE)).toBeInTheDocument();
    expect(onCompleteEarly).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Als abgeschlossen markieren' }),
    );
    expect(onCompleteEarly).toHaveBeenCalledTimes(1);
  });
});

describe('TimerControls – Hilfsfunktionen', () => {
  it('nextPhaseStartLabel liefert die passende Beschriftung', () => {
    expect(nextPhaseStartLabel('Focus')).toBe('Fokus starten');
    expect(nextPhaseStartLabel('ShortBreak')).toBe('Pause starten');
    expect(nextPhaseStartLabel('LongBreak')).toBe('Pause starten');
  });

  it('nextPhaseTypeForLabel wechselt zwischen Fokus und Pause', () => {
    expect(nextPhaseTypeForLabel('Focus')).toBe('ShortBreak');
    expect(nextPhaseTypeForLabel('ShortBreak')).toBe('Focus');
    expect(nextPhaseTypeForLabel('LongBreak')).toBe('Focus');
  });
});
