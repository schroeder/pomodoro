// Tests für das präsentationale SettingsForm (Task 13, Req 12, 13, 19).
//
// Das Formular ist rein präsentational: Es ruft onChange(patch) mit dem geänderten
// Feld auf und delegiert das Klemmen/Persistieren an den Provider. Die Tests prüfen,
// dass alle Abschnitte gerendert werden, die richtigen Patches ausgelöst werden und
// der Datenschutz-Hinweis vorhanden ist.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsForm, { PRIVACY_NOTICE } from './SettingsForm';
import { DEFAULT_SETTINGS } from '../../settings/defaults';
import type { Settings } from '../../types';

function renderForm(overrides: Partial<Settings> = {}, props: Record<string, unknown> = {}) {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...overrides };
  const onChange = vi.fn();
  const onEnableNotifications = vi.fn();
  const onPreviewSound = vi.fn();
  render(
    <SettingsForm
      settings={settings}
      onChange={onChange}
      onEnableNotifications={onEnableNotifications}
      onPreviewSound={onPreviewSound}
      notificationPermission="default"
      notificationsSupported
      storageAvailable
      {...props}
    />,
  );
  return { onChange, onEnableNotifications, onPreviewSound };
}

describe('SettingsForm', () => {
  it('rendert alle Formularabschnitte (Req 12)', () => {
    renderForm();
    expect(screen.getByRole('group', { name: 'Timer' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Automatischer Start' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ton' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Benachrichtigungen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Darstellung' })).toBeInTheDocument();
  });

  it('zeigt den Datenschutz-Hinweis (Req 19.3)', () => {
    renderForm();
    expect(screen.getByText(PRIVACY_NOTICE)).toBeInTheDocument();
    expect(PRIVACY_NOTICE).toBe(
      'Deine Fokusdaten werden ausschließlich auf diesem Gerät gespeichert.',
    );
  });

  it('zeigt die erlaubten Bereiche als Hinweise (Req 12.2)', () => {
    renderForm();
    expect(screen.getByText('5–120 Minuten')).toBeInTheDocument();
    // Kurze und lange Pause teilen sich denselben Bereichstext.
    expect(screen.getAllByText('1–60 Minuten')).toHaveLength(2);
  });

  it('ruft onChange mit numerischem Timer-Wert auf (Req 12.1)', () => {
    const { onChange } = renderForm();
    const input = screen.getByLabelText('Fokusdauer (Minuten)');
    // Das Formular ist präsentational (kontrollierter Wert bleibt statisch),
    // daher eine einzelne, deterministische Änderung.
    fireEvent.change(input, { target: { value: '40' } });
    expect(onChange).toHaveBeenLastCalledWith({ focusMinutes: 40 });
  });

  it('ruft onChange mit dem Auto-Start-Patch auf (Req 12.3)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();
    await user.click(screen.getByRole('switch', { name: 'Pausen automatisch starten' }));
    expect(onChange).toHaveBeenCalledWith({ autoStartBreaks: true });
  });

  it('ruft onChange beim Wechsel des Signaltons auf (Req 12.4)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();
    await user.selectOptions(screen.getByLabelText('Signalton'), 'chime');
    expect(onChange).toHaveBeenCalledWith({ soundId: 'chime' });
  });

  it('ruft den Vorschau-Handler auf (Req 9.2)', async () => {
    const user = userEvent.setup();
    const { onPreviewSound } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Vorschau abspielen' }));
    expect(onPreviewSound).toHaveBeenCalledTimes(1);
  });

  it('ruft onEnableNotifications beim Aktivieren auf, nicht onChange (Req 8.1/8.2)', async () => {
    const user = userEvent.setup();
    const { onEnableNotifications, onChange } = renderForm();
    await user.click(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    );
    expect(onEnableNotifications).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ notificationsEnabled: true }),
    );
  });

  it('deaktiviert Benachrichtigungen über onChange (Req 12.5)', async () => {
    const user = userEvent.setup();
    const { onChange, onEnableNotifications } = renderForm({
      notificationsEnabled: true,
    });
    await user.click(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    );
    expect(onChange).toHaveBeenCalledWith({ notificationsEnabled: false });
    expect(onEnableNotifications).not.toHaveBeenCalled();
  });

  it('deaktiviert den Benachrichtigungs-Schalter, wenn nicht unterstützt', () => {
    renderForm({}, { notificationsSupported: false });
    expect(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Dieser Browser unterstützt keine Benachrichtigungen.'),
    ).toBeInTheDocument();
  });

  it('spiegelt einen verweigerten Berechtigungsstatus (Req 8.7)', () => {
    renderForm({}, { notificationPermission: 'denied' });
    expect(
      screen.getByRole('switch', { name: 'Browser-Benachrichtigungen' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/im Browser blockiert/),
    ).toBeInTheDocument();
  });

  it('ruft onChange beim Wechsel des Farbschemas auf (Req 12.6, 13)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();
    await user.selectOptions(screen.getByLabelText('Farbschema'), 'dark');
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('weist auf fehlenden Speicher hin (Req 20.1)', () => {
    renderForm({}, { storageAvailable: false });
    expect(screen.getByText(/Kein lokaler Speicher verfügbar/)).toBeInTheDocument();
  });
});
