// Standardwerte und Grenz-Validierung der Einstellungen.
// Abgeleitet aus dem Design-Dokument (.kiro/specs/pomodoro/design.md)
// und den Anforderungen 12.1, 12.2, 12.3, 12.4, 12.5.

import type { Settings } from '../types';

/**
 * Erlaubte Grenzen der numerischen Timer-Einstellungen (Req 12.2).
 * - Fokusdauer: 5..120 Minuten
 * - Pausen (kurz/lang): 1..60 Minuten
 */
export const LIMITS = {
  focusMinutes: { min: 5, max: 120 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 60 },
  /** Mindestens 1 Fokusphase bis zur langen Pause; obere Grenze zur Sicherheit. */
  focusPerCycle: { min: 1, max: 12 },
  /** Lautstärke im Bereich 0..1. */
  volume: { min: 0, max: 1 },
} as const;

/** Standard-Einstellungen (spec.md §15/§31, Design-Dokument). */
export const DEFAULT_SETTINGS: Settings = {
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

/** localStorage-Schlüssel für die serialisierten Einstellungen. */
export const SETTINGS_STORAGE_KEY = 'pomodoro.settings.v1';

/**
 * Klemmt einen numerischen Wert auf den Bereich [min, max].
 * Ungültige Werte (NaN, undefined, kein Zahl-Typ) fallen auf `fallback` zurück.
 */
export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  // Fehlende Werte gelten als "nicht gesetzt" und nutzen den Fallback.
  // (Number(null) wäre 0 und Number('') ebenfalls – das wollen wir hier nicht.)
  if (value == null || value === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Validiert und klemmt eingehende (Teil-)Einstellungen beim Speichern (Req 12.2).
 * Fehlende oder ungültige Felder werden aus {@link DEFAULT_SETTINGS} ergänzt,
 * numerische Werte auf die erlaubten Grenzen geklemmt.
 */
export function sanitizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const src = input ?? {};

  const theme: Settings['theme'] =
    src.theme === 'light' || src.theme === 'dark' || src.theme === 'system'
      ? src.theme
      : DEFAULT_SETTINGS.theme;

  return {
    focusMinutes: clampNumber(
      src.focusMinutes,
      LIMITS.focusMinutes.min,
      LIMITS.focusMinutes.max,
      DEFAULT_SETTINGS.focusMinutes,
    ),
    shortBreakMinutes: clampNumber(
      src.shortBreakMinutes,
      LIMITS.shortBreakMinutes.min,
      LIMITS.shortBreakMinutes.max,
      DEFAULT_SETTINGS.shortBreakMinutes,
    ),
    longBreakMinutes: clampNumber(
      src.longBreakMinutes,
      LIMITS.longBreakMinutes.min,
      LIMITS.longBreakMinutes.max,
      DEFAULT_SETTINGS.longBreakMinutes,
    ),
    focusPerCycle: clampNumber(
      src.focusPerCycle,
      LIMITS.focusPerCycle.min,
      LIMITS.focusPerCycle.max,
      DEFAULT_SETTINGS.focusPerCycle,
    ),
    autoStartBreaks:
      typeof src.autoStartBreaks === 'boolean'
        ? src.autoStartBreaks
        : DEFAULT_SETTINGS.autoStartBreaks,
    autoStartFocus:
      typeof src.autoStartFocus === 'boolean'
        ? src.autoStartFocus
        : DEFAULT_SETTINGS.autoStartFocus,
    soundEnabled:
      typeof src.soundEnabled === 'boolean'
        ? src.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
    soundId:
      typeof src.soundId === 'string' && src.soundId.length > 0
        ? src.soundId
        : DEFAULT_SETTINGS.soundId,
    volume: clampNumber(
      src.volume,
      LIMITS.volume.min,
      LIMITS.volume.max,
      DEFAULT_SETTINGS.volume,
    ),
    notificationsEnabled:
      typeof src.notificationsEnabled === 'boolean'
        ? src.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    notifyFocusEnd:
      typeof src.notifyFocusEnd === 'boolean'
        ? src.notifyFocusEnd
        : DEFAULT_SETTINGS.notifyFocusEnd,
    notifyBreakEnd:
      typeof src.notifyBreakEnd === 'boolean'
        ? src.notifyBreakEnd
        : DEFAULT_SETTINGS.notifyBreakEnd,
    theme,
  };
}
