// Kontext für Einstellungen: Laden/Speichern in localStorage mit
// In-Memory-Fallback und Grenz-Validierung beim Speichern.
// Wendet zusätzlich das Theme an (via useTheme).
// Anforderungen 12.1–12.6, 13.1, 13.2, 20.1.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Settings } from '../types';
import { useTheme } from '../hooks/useTheme';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  sanitizeSettings,
} from './defaults';

/** Vom Kontext bereitgestellte Werte und Aktionen. */
export interface SettingsContextValue {
  /** Aktuelle, stets validierte Einstellungen. */
  settings: Settings;
  /**
   * Aktualisiert (Teile der) Einstellungen. Werte werden geklemmt/validiert
   * und persistiert (Req 12.2, 12.6).
   */
  updateSettings: (patch: Partial<Settings>) => void;
  /** Setzt alle Einstellungen auf die Standardwerte zurück. */
  resetSettings: () => void;
  /** True, wenn kein persistenter Speicher verfügbar ist (In-Memory-Betrieb, Req 20.1). */
  storageAvailable: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Liest die gespeicherten Einstellungen aus localStorage.
 * Bei fehlendem/kaputtem Speicher werden Defaults zurückgegeben und
 * `available: false` gemeldet (Req 7.5 / 20.1).
 */
function loadSettings(): { settings: Settings; available: boolean } {
  try {
    if (typeof localStorage === 'undefined') {
      return { settings: { ...DEFAULT_SETTINGS }, available: false };
    }
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw == null) {
      // Speicher ist verfügbar, es existieren nur noch keine Einstellungen.
      return { settings: { ...DEFAULT_SETTINGS }, available: true };
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { settings: sanitizeSettings(parsed), available: true };
  } catch {
    // Privatmodus, Quota, defektes JSON o. Ä. → In-Memory-Fallback.
    return { settings: { ...DEFAULT_SETTINGS }, available: false };
  }
}

/** Versucht, die Einstellungen zu persistieren; meldet Erfolg (Req 12.6, 20.1). */
function persistSettings(settings: Settings): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Einmalig beim Mounten laden (lazy initializer).
  const initial = useRef(loadSettings());
  const [settings, setSettings] = useState<Settings>(initial.current.settings);
  const [storageAvailable, setStorageAvailable] = useState<boolean>(
    initial.current.available,
  );

  // Theme anwenden und auf System-Änderungen reagieren (Req 13.1, 13.2).
  useTheme(settings.theme);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = sanitizeSettings({ ...prev, ...patch });
      const ok = persistSettings(next);
      setStorageAvailable(ok);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    const ok = persistSettings(next);
    setStorageAvailable(ok);
    setSettings(next);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, updateSettings, resetSettings, storageAvailable }),
    [settings, updateSettings, resetSettings, storageAvailable],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Zugriff auf den Einstellungs-Kontext; wirft außerhalb des Providers. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (ctx == null) {
    throw new Error('useSettings muss innerhalb von <SettingsProvider> verwendet werden.');
  }
  return ctx;
}
