import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_DOCUMENT_TITLE,
  PHASE_LABELS,
  formatRemaining,
  formatTimerTitle,
  setDocumentTitle,
  applyTimerTitle,
  type TitleInput,
} from './documentTitle';
import type { PhaseType, TimerStatus } from '../types';

// Tests für den DocumentTitleService (Req 15). Der Kern ist die reine
// Formatierungsfunktion; der Seiteneffekt wird über das (in jsdom vorhandene)
// `document` geprüft.

describe('formatRemaining – MM:SS-Formatierung', () => {
  it('füllt Minuten und Sekunden zweistellig auf', () => {
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(5 * 1000)).toBe('00:05');
    expect(formatRemaining(9 * 60 * 1000 + 3 * 1000)).toBe('09:03');
  });

  it('rundet auf ganze Sekunden ab (floor)', () => {
    expect(formatRemaining(1999)).toBe('00:01');
    expect(formatRemaining(59_999)).toBe('00:59');
    expect(formatRemaining(60_001)).toBe('01:00');
  });

  it('behandelt Grenzwerte 0s, 59s, 60s und 3599s', () => {
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(59 * 1000)).toBe('00:59');
    expect(formatRemaining(60 * 1000)).toBe('01:00');
    expect(formatRemaining(3599 * 1000)).toBe('59:59');
  });

  it('erlaubt Minuten über 99 (mindestens zweistellig)', () => {
    expect(formatRemaining(120 * 60 * 1000)).toBe('120:00');
  });

  it('klemmt negative Werte auf 0 (Req 20.2)', () => {
    expect(formatRemaining(-1)).toBe('00:00');
    expect(formatRemaining(-60_000)).toBe('00:00');
  });

  it('behandelt ungültige Werte (NaN/Infinity) als 0', () => {
    expect(formatRemaining(Number.NaN)).toBe('00:00');
    expect(formatRemaining(Number.POSITIVE_INFINITY)).toBe('00:00');
    expect(formatRemaining(Number.NEGATIVE_INFINITY)).toBe('00:00');
  });
});

describe('PHASE_LABELS und DEFAULT_DOCUMENT_TITLE', () => {
  it('nutzt die deutschen Phasenbezeichnungen (spec.md §21)', () => {
    expect(PHASE_LABELS).toEqual({
      Focus: 'Fokus',
      ShortBreak: 'Kurze Pause',
      LongBreak: 'Lange Pause',
    });
  });

  it('nutzt „Pomodoro" als Standardtitel', () => {
    expect(DEFAULT_DOCUMENT_TITLE).toBe('Pomodoro');
  });
});

describe('formatTimerTitle – Running (Req 15.1)', () => {
  it('zeigt „MM:SS – <Phase>" mit von Leerzeichen umgebenem Gedankenstrich', () => {
    const input: TitleInput = {
      status: 'Running',
      phaseType: 'Focus',
      remainingMs: 24 * 60 * 1000 + 31 * 1000,
    };
    expect(formatTimerTitle(input)).toBe('24:31 – Fokus');
  });

  it('formatiert jede Phase korrekt bei Running', () => {
    expect(
      formatTimerTitle({ status: 'Running', phaseType: 'Focus', remainingMs: 90_000 }),
    ).toBe('01:30 – Fokus');
    expect(
      formatTimerTitle({ status: 'Running', phaseType: 'ShortBreak', remainingMs: 90_000 }),
    ).toBe('01:30 – Kurze Pause');
    expect(
      formatTimerTitle({ status: 'Running', phaseType: 'LongBreak', remainingMs: 90_000 }),
    ).toBe('01:30 – Lange Pause');
  });

  it('klemmt negative Restzeit bei Running auf 00:00', () => {
    expect(
      formatTimerTitle({ status: 'Running', phaseType: 'Focus', remainingMs: -5000 }),
    ).toBe('00:00 – Fokus');
  });
});

describe('formatTimerTitle – Completed/Abschluss-Hinweis (Req 15.2)', () => {
  it('zeigt „<Phase> beendet ✓" pro Phase', () => {
    expect(
      formatTimerTitle({ status: 'Completed', phaseType: 'Focus', remainingMs: 0 }),
    ).toBe('Fokus beendet ✓');
    expect(
      formatTimerTitle({ status: 'Completed', phaseType: 'ShortBreak', remainingMs: 0 }),
    ).toBe('Kurze Pause beendet ✓');
    expect(
      formatTimerTitle({ status: 'Completed', phaseType: 'LongBreak', remainingMs: 0 }),
    ).toBe('Lange Pause beendet ✓');
  });

  it('ignoriert die Restzeit im Completed-Zustand', () => {
    expect(
      formatTimerTitle({ status: 'Completed', phaseType: 'Focus', remainingMs: 123_456 }),
    ).toBe('Fokus beendet ✓');
  });
});

describe('formatTimerTitle – Standardtitel (Req 15.3)', () => {
  const nonRunningStatuses: TimerStatus[] = ['Ready', 'Paused', 'Cancelled'];
  const phases: PhaseType[] = ['Focus', 'ShortBreak', 'LongBreak'];

  it.each(nonRunningStatuses)('zeigt den Standardtitel bei Status %s', (status) => {
    for (const phaseType of phases) {
      expect(formatTimerTitle({ status, phaseType, remainingMs: 60_000 })).toBe(
        DEFAULT_DOCUMENT_TITLE,
      );
    }
  });

  it('nutzt einen übergebenen benutzerdefinierten Standardtitel', () => {
    expect(
      formatTimerTitle({ status: 'Ready', phaseType: 'Focus', remainingMs: 0 }, 'Mein Timer'),
    ).toBe('Mein Timer');
  });
});

describe('setDocumentTitle / applyTimerTitle – Seiteneffekt', () => {
  const original = document.title;
  afterEach(() => {
    document.title = original;
  });

  it('setzt document.title', () => {
    setDocumentTitle('Testtitel');
    expect(document.title).toBe('Testtitel');
  });

  it('applyTimerTitle setzt den berechneten Titel und gibt ihn zurück', () => {
    const result = applyTimerTitle({
      status: 'Running',
      phaseType: 'Focus',
      remainingMs: 25 * 60 * 1000,
    });
    expect(result).toBe('25:00 – Fokus');
    expect(document.title).toBe('25:00 – Fokus');
  });

  it('applyTimerTitle setzt bei nicht laufendem Timer den Standardtitel', () => {
    applyTimerTitle({ status: 'Paused', phaseType: 'ShortBreak', remainingMs: 60_000 });
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });
});
