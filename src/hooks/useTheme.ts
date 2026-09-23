// Theme-Anwendung: setzt `data-theme` am Wurzelelement und reagiert bei
// gewähltem "system"-Modus auf Änderungen von `prefers-color-scheme`.
// Anforderungen 13.1, 13.2.

import { useEffect } from 'react';
import type { Settings } from '../types';

/** Konkret angewendetes Farbschema (nach Auflösung von "system"). */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Löst die Theme-Präferenz zu einem konkreten Farbschema auf.
 *
 * - "light" / "dark" werden direkt übernommen.
 * - "system" folgt dem Betriebssystem: `prefersDark = true` → "dark", sonst "light".
 *
 * Reine Funktion (kein DOM-Zugriff), daher deterministisch testbar (Req 13.2).
 */
export function resolveTheme(
  theme: Settings['theme'],
  prefersDark: boolean,
): ResolvedTheme {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  // theme === 'system'
  return prefersDark ? 'dark' : 'light';
}

/** Media-Query, über die das System-Farbschema erkannt wird. */
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Liest die aktuelle Systempräferenz; robust, falls matchMedia fehlt. */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

/** Wendet das aufgelöste Theme über das `data-theme`-Attribut an. */
function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Hook, der das gewünschte Theme anwendet und – bei "system" – auf
 * Änderungen der Betriebssystem-Einstellung reagiert (Req 13.1, 13.2).
 */
export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    // Direkte Anwendung des aktuell aufgelösten Themes.
    applyTheme(resolveTheme(theme, systemPrefersDark()));

    // Nur im "system"-Modus müssen wir auf OS-Änderungen lauschen.
    if (theme !== 'system') {
      return;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(resolveTheme('system', event.matches));
    };

    // addEventListener wird bevorzugt; ältere Browser nutzen addListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    // Fallback für ältere Implementierungen.
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, [theme]);
}
