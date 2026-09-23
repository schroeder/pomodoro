// Tests für die verdrahtete SettingsView (Task 13, Req 12, 13, 19).
//
// Diese Tests rendern die View innerhalb eines echten SettingsProvider und prüfen,
// dass Änderungen über updateSettings zentral geklemmt/persistiert werden
// (z. B. Fokusdauer 3 → 5, 200 → 120). Der Benachrichtigungs-Flow wird über einen
// gemockten NotificationService verifiziert.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '../settings/SettingsProvider';
import SettingsView, { SETTINGS_VIEW_MARKER } from './SettingsView';
import { SETTINGS_STORAGE_KEY } from '../settings/defaults';
import * as notifications from '../services/notifications';

/**
 * Minimaler In-Memory-localStorage-Ersatz. In dieser Testumgebung ist das
 * jsdom-`localStorage` nicht befüllt; wir installieren daher einen frischen
 * deterministischen Store (analog zu den übrigen Timer-Tests).
 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  } as Storage;
}

function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

function renderView() {
  return render(
    <SettingsProvider>
      <SettingsView />
    </SettingsProvider>,
  );
}

/** Liest die persistierten Einstellungen aus localStorage. */
function readStored(): Record<string, unknown> {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

describe('SettingsView (verdrahtet)', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rendert die Einstellungs-Ansicht mit Überschrift', () => {
    renderView();
    expect(screen.getByTestId(SETTINGS_VIEW_MARKER)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Einstellungen' }),
    ).toBeInTheDocument();
  });

  it('klemmt einen zu kleinen Fokus-Wert auf das Minimum (3 → 5, Req 12.2)', async () => {
    renderView();
    const input = screen.getByLabelText<HTMLInputElement>('Fokusdauer (Minuten)');

    // Eine einzelne, deterministische Eingabe; der Provider klemmt auf das Minimum.
    fireEvent.change(input, { target: { value: '3' } });

    await waitFor(() => expect(input.value).toBe('5'));
    expect(readStored().focusMinutes).toBe(5);
  });

  it('klemmt einen zu großen Fokus-Wert auf das Maximum (200 → 120, Req 12.2)', async () => {
    renderView();
    const input = screen.getByLabelText<HTMLInputElement>('Fokusdauer (Minuten)');

    fireEvent.change(input, { target: { value: '200' } });

    await waitFor(() => expect(input.value).toBe('120'));
    expect(readStored().focusMinutes).toBe(120);
  });

  it('persistiert einen umgeschalteten Auto-Start-Wert (Req 12.3, 12.6)', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(
      screen.getByRole('switch', { name: 'Pausen automatisch starten' }),
    );
    await waitFor(() => expect(readStored().autoStartBreaks).toBe(true));
  });

  it('aktualisiert das Farbschema und persistiert es (Req 12.6, 13)', async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(screen.getByLabelText('Farbschema'), 'dark');
    await waitFor(() => expect(readStored().theme).toBe('dark'));
  });

  it('fragt beim Aktivieren von Benachrichtigungen die Berechtigung an und aktiviert bei granted (Req 8.1/8.2)', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted' as const);
    vi.spyOn(notifications, 'createNotificationService').mockReturnValue({
      isSupported: () => true,
      getPermission: () => 'default',
      requestPermission,
      notifyPhaseEnd: vi.fn().mockResolvedValue(undefined),
    });

    const user = userEvent.setup();
    renderView();

    await user.click(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    );

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(readStored().notificationsEnabled).toBe(true));
  });

  it('aktiviert Benachrichtigungen nicht, wenn die Berechtigung verweigert wird (Req 8.7)', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied' as const);
    vi.spyOn(notifications, 'createNotificationService').mockReturnValue({
      isSupported: () => true,
      getPermission: () => 'default',
      requestPermission,
      notifyPhaseEnd: vi.fn().mockResolvedValue(undefined),
    });

    const user = userEvent.setup();
    renderView();

    await user.click(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    );

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(readStored().notificationsEnabled).toBe(false));
  });
});
