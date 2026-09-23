import { describe, it, expect } from 'vitest';
import { resolveTheme } from './useTheme';

// Theme-Auflösung (Req 13.1, 13.2).
describe('resolveTheme', () => {
  it('übernimmt "light" unabhängig von der Systempräferenz', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('übernimmt "dark" unabhängig von der Systempräferenz', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('folgt bei "system" der Betriebssystem-Einstellung', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
