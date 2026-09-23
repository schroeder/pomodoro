import { describe, it, expect } from 'vitest';
import { nextPhase } from './cycle';
import type { CycleState, NextPhaseResult } from './cycle';
import type { Settings } from '../types';

// Standard-Einstellungen mit 4 Fokusphasen pro Zyklus (spec.md-Standard).
const settings: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  focusPerCycle: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundId: 'soft',
  volume: 0.6,
  notificationsEnabled: false,
  notifyFocusEnd: true,
  notifyBreakEnd: true,
  theme: 'system',
};

/** Erzeugt einen zyklusrelevanten Zustand mit sinnvollen Vorgaben. */
function cycle(overrides: Partial<CycleState> = {}): CycleState {
  return {
    phaseType: 'Focus',
    completedFocusInCycle: 0,
    pomodoroNumberInCycle: 1,
    ...overrides,
  };
}

describe('nextPhase – Fokus → Pause (Req 2.1, 2.2)', () => {
  it('führt von einer abgeschlossenen Fokusphase zur kurzen Pause (Zähler bereits erhöht)', () => {
    const result = nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 1 }), settings);
    expect(result.phaseType).toBe('ShortBreak');
    expect(result.completedFocusInCycle).toBe(1);
    expect(result.pomodoroNumberInCycle).toBe(1);
  });

  it('führt nach Erreichen von focusPerCycle zur langen Pause statt zur kurzen', () => {
    const result = nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 4 }), settings);
    expect(result.phaseType).toBe('LongBreak');
    expect(result.completedFocusInCycle).toBe(4);
  });

  it('behandelt completedFocusInCycle > focusPerCycle ebenfalls als lange Pause', () => {
    const result = nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 5 }), settings);
    expect(result.phaseType).toBe('LongBreak');
  });
});

describe('nextPhase – countFocus-Option (Req 2.4)', () => {
  it('erhöht den Zähler, wenn der Fokus im Übergang gewertet werden soll', () => {
    const result = nextPhase(
      cycle({ phaseType: 'Focus', completedFocusInCycle: 0 }),
      settings,
      { countFocus: true },
    );
    expect(result.completedFocusInCycle).toBe(1);
    expect(result.phaseType).toBe('ShortBreak');
  });

  it('wählt bei countFocus die lange Pause, wenn dadurch focusPerCycle erreicht wird', () => {
    const result = nextPhase(
      cycle({ phaseType: 'Focus', completedFocusInCycle: 3 }),
      settings,
      { countFocus: true },
    );
    expect(result.completedFocusInCycle).toBe(4);
    expect(result.phaseType).toBe('LongBreak');
  });

  it('zählt den Fokus standardmäßig NICHT (Übergang ohne Wertung, z. B. SKIP – Req 2.5)', () => {
    const result = nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 0 }), settings);
    expect(result.completedFocusInCycle).toBe(0);
    expect(result.phaseType).toBe('ShortBreak');
  });
});

describe('nextPhase – kurze Pause → Fokus (Req 2.1)', () => {
  it('führt von der kurzen Pause zurück zum Fokus und erhöht die Pomodoro-Nummer', () => {
    const result = nextPhase(
      cycle({ phaseType: 'ShortBreak', completedFocusInCycle: 1, pomodoroNumberInCycle: 1 }),
      settings,
    );
    expect(result.phaseType).toBe('Focus');
    expect(result.pomodoroNumberInCycle).toBe(2);
    expect(result.completedFocusInCycle).toBe(1);
  });
});

describe('nextPhase – lange Pause → Fokus mit Reset (Req 2.3)', () => {
  it('setzt nach der langen Pause den Zyklus zurück und beginnt mit Fokus', () => {
    const result = nextPhase(
      cycle({ phaseType: 'LongBreak', completedFocusInCycle: 4, pomodoroNumberInCycle: 4 }),
      settings,
    );
    expect(result.phaseType).toBe('Focus');
    expect(result.completedFocusInCycle).toBe(0);
    expect(result.pomodoroNumberInCycle).toBe(1);
  });
});

describe('nextPhase – respektiert konfigurierbares focusPerCycle', () => {
  it('nutzt einen abweichenden Zyklus (focusPerCycle = 2)', () => {
    const twoPerCycle: Settings = { ...settings, focusPerCycle: 2 };
    // Nach 1 Fokus: noch nicht erreicht -> kurze Pause.
    expect(
      nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 1 }), twoPerCycle).phaseType,
    ).toBe('ShortBreak');
    // Nach 2 Fokus: erreicht -> lange Pause.
    expect(
      nextPhase(cycle({ phaseType: 'Focus', completedFocusInCycle: 2 }), twoPerCycle).phaseType,
    ).toBe('LongBreak');
  });
});

describe('nextPhase – vollständiger Zyklus (Req 2.1, 2.2, 2.3)', () => {
  it('durchläuft 4× Fokus mit kurzen Pausen, mündet in eine lange Pause und setzt zurück', () => {
    // Wir simulieren einen vollen Zyklus. Der Fokus-Abschluss wird über countFocus=true
    // im Fokus-Übergang gewertet (analog EXPIRE/COMPLETE_EARLY, die den Zähler erhöhen).
    let state: CycleState = cycle();
    const sequence: NextPhaseResult[] = [];

    const step = (options?: { countFocus?: boolean }) => {
      const result = nextPhase(state, settings, options);
      sequence.push(result);
      state = {
        phaseType: result.phaseType,
        completedFocusInCycle: result.completedFocusInCycle,
        pomodoroNumberInCycle: result.pomodoroNumberInCycle,
      };
      return result;
    };

    // Fokus 1 abgeschlossen -> kurze Pause
    expect(step({ countFocus: true })).toMatchObject({
      phaseType: 'ShortBreak',
      completedFocusInCycle: 1,
      pomodoroNumberInCycle: 1,
    });
    // Kurze Pause -> Fokus 2
    expect(step()).toMatchObject({ phaseType: 'Focus', pomodoroNumberInCycle: 2 });

    // Fokus 2 abgeschlossen -> kurze Pause
    expect(step({ countFocus: true })).toMatchObject({
      phaseType: 'ShortBreak',
      completedFocusInCycle: 2,
    });
    // Kurze Pause -> Fokus 3
    expect(step()).toMatchObject({ phaseType: 'Focus', pomodoroNumberInCycle: 3 });

    // Fokus 3 abgeschlossen -> kurze Pause
    expect(step({ countFocus: true })).toMatchObject({
      phaseType: 'ShortBreak',
      completedFocusInCycle: 3,
    });
    // Kurze Pause -> Fokus 4
    expect(step()).toMatchObject({ phaseType: 'Focus', pomodoroNumberInCycle: 4 });

    // Fokus 4 abgeschlossen -> lange Pause
    expect(step({ countFocus: true })).toMatchObject({
      phaseType: 'LongBreak',
      completedFocusInCycle: 4,
    });

    // Lange Pause -> Fokus mit Reset
    expect(step()).toMatchObject({
      phaseType: 'Focus',
      completedFocusInCycle: 0,
      pomodoroNumberInCycle: 1,
    });
  });
});
