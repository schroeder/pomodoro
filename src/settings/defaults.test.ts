import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  clampNumber,
  sanitizeSettings,
} from './defaults';

// Grenz-Validierung der Einstellungen (Req 12.2).
describe('clampNumber', () => {
  it('gibt Werte innerhalb des Bereichs unverändert zurück', () => {
    expect(clampNumber(30, 5, 120, 25)).toBe(30);
  });

  it('klemmt Werte unterhalb des Minimums auf min', () => {
    expect(clampNumber(2, 5, 120, 25)).toBe(5);
  });

  it('klemmt Werte oberhalb des Maximums auf max', () => {
    expect(clampNumber(999, 5, 120, 25)).toBe(120);
  });

  it('erlaubt die Grenzwerte selbst (inklusiv)', () => {
    expect(clampNumber(5, 5, 120, 25)).toBe(5);
    expect(clampNumber(120, 5, 120, 25)).toBe(120);
  });

  it('nutzt den Fallback bei NaN oder nicht-numerischen Werten', () => {
    expect(clampNumber(NaN, 5, 120, 25)).toBe(25);
    expect(clampNumber('abc', 5, 120, 25)).toBe(25);
    expect(clampNumber(undefined, 5, 120, 25)).toBe(25);
    expect(clampNumber(null, 5, 120, 25)).toBe(25);
    expect(clampNumber(Infinity, 5, 120, 25)).toBe(25);
  });

  it('konvertiert numerische Strings', () => {
    expect(clampNumber('30', 5, 120, 25)).toBe(30);
  });
});

describe('sanitizeSettings', () => {
  it('liefert die Defaults bei leerer/fehlender Eingabe', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('klemmt Fokusdauer auf 5..120 Minuten', () => {
    expect(sanitizeSettings({ focusMinutes: 1 }).focusMinutes).toBe(
      LIMITS.focusMinutes.min,
    );
    expect(sanitizeSettings({ focusMinutes: 500 }).focusMinutes).toBe(
      LIMITS.focusMinutes.max,
    );
    expect(sanitizeSettings({ focusMinutes: 50 }).focusMinutes).toBe(50);
  });

  it('klemmt kurze und lange Pausen auf 1..60 Minuten', () => {
    expect(sanitizeSettings({ shortBreakMinutes: 0 }).shortBreakMinutes).toBe(1);
    expect(sanitizeSettings({ shortBreakMinutes: 90 }).shortBreakMinutes).toBe(60);
    expect(sanitizeSettings({ longBreakMinutes: 0 }).longBreakMinutes).toBe(1);
    expect(sanitizeSettings({ longBreakMinutes: 90 }).longBreakMinutes).toBe(60);
  });

  it('klemmt die Lautstärke auf 0..1', () => {
    expect(sanitizeSettings({ volume: -0.5 }).volume).toBe(0);
    expect(sanitizeSettings({ volume: 2 }).volume).toBe(1);
    expect(sanitizeSettings({ volume: 0.3 }).volume).toBe(0.3);
  });

  it('behält gültige boolesche und string-Werte bei', () => {
    const result = sanitizeSettings({
      autoStartBreaks: true,
      autoStartFocus: true,
      soundEnabled: false,
      soundId: 'chime',
      notificationsEnabled: true,
    });
    expect(result.autoStartBreaks).toBe(true);
    expect(result.autoStartFocus).toBe(true);
    expect(result.soundEnabled).toBe(false);
    expect(result.soundId).toBe('chime');
    expect(result.notificationsEnabled).toBe(true);
  });

  it('fällt bei ungültigem theme auf den Standard "system" zurück', () => {
    expect(sanitizeSettings({ theme: 'blau' as never }).theme).toBe('system');
    expect(sanitizeSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(sanitizeSettings({ theme: 'light' }).theme).toBe('light');
  });

  it('fällt bei leerem soundId auf den Standard zurück', () => {
    expect(sanitizeSettings({ soundId: '' }).soundId).toBe(DEFAULT_SETTINGS.soundId);
  });
});
