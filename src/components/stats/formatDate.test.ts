import { describe, it, expect } from 'vitest';
import { formatGermanDate, formatGermanDateShort } from './formatDate';

// Tests für die deutsche Datums-Formatierung der Statistik-Ansicht (Task 12, Req 11.4).
describe('formatGermanDate', () => {
  it('formatiert einen Tagesschlüssel als deutsches Datum mit Wochentag', () => {
    // 2024-06-03 ist ein Montag.
    expect(formatGermanDate('2024-06-03')).toBe('Mo, 3. Juni 2024');
  });

  it('formatiert den Monatsnamen und einstellige Tage korrekt', () => {
    // 2024-01-01 ist ein Montag.
    expect(formatGermanDate('2024-01-01')).toBe('Mo, 1. Januar 2024');
  });

  it('behandelt März mit korrektem Umlaut', () => {
    // 2024-03-15 ist ein Freitag.
    expect(formatGermanDate('2024-03-15')).toBe('Fr, 15. März 2024');
  });

  it('gibt bei ungültigem Format den Eingabewert unverändert zurück', () => {
    expect(formatGermanDate('kein-datum')).toBe('kein-datum');
    expect(formatGermanDate('2024-13-01')).toBe('2024-13-01');
    expect(formatGermanDate('2024-02-31')).toBe('2024-02-31');
  });

  it('gibt für leere Eingabe einen leeren String zurück', () => {
    expect(formatGermanDate('')).toBe('');
  });
});

describe('formatGermanDateShort', () => {
  it('formatiert kompakt als TT.MM.', () => {
    expect(formatGermanDateShort('2024-06-03')).toBe('3.6.');
    expect(formatGermanDateShort('2024-12-25')).toBe('25.12.');
  });

  it('fällt bei ungültiger Eingabe auf den Rohwert zurück', () => {
    expect(formatGermanDateShort('foo')).toBe('foo');
  });
});
