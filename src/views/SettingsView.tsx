// Einstellungs-Ansicht (Route "/settings") – Task 13, Req 12, 13, 19.
//
// Komponiert das präsentationale SettingsForm und verdrahtet es mit dem
// SettingsProvider (useSettings) sowie den Services:
// - Sound-Vorschau: createSoundService.unlock() (Nutzergeste) + play() – Req 9.2/9.3.
// - Benachrichtigungs-Flow: beim Aktivieren wird die Berechtigung angefragt
//   (createNotificationService.requestPermission()); nur bei 'granted' wird
//   notificationsEnabled gesetzt (Req 8.1/8.2, 12.5).
//
// Das Klemmen/Validieren und Persistieren der Werte erfolgt zentral im Provider
// (updateSettings → sanitizeSettings), daher reicht das Formular Roh-Patches durch
// (Req 12.2, 12.6).

import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../settings/SettingsProvider';
import { createSoundService } from '../services/sound';
import {
  createNotificationService,
  type NotificationPermissionState,
} from '../services/notifications';
import SettingsForm from '../components/settings/SettingsForm';
import styles from './SettingsView.module.css';

/** Stabiler Test-Marker der Einstellungs-Ansicht. */
export const SETTINGS_VIEW_MARKER = 'settings-view';

export default function SettingsView() {
  const { settings, updateSettings, storageAvailable } = useSettings();

  // Services einmalig erzeugen (stabil über Re-Renders).
  const soundService = useMemo(() => createSoundService(), []);
  const notificationService = useMemo(() => createNotificationService(), []);

  useEffect(() => () => soundService.dispose(), [soundService]);

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => notificationService.getPermission());

  /** Aktiviert Benachrichtigungen nach erfolgreicher Berechtigungsanfrage (Req 8.1/8.2). */
  const handleEnableNotifications = async () => {
    const result = await notificationService.requestPermission();
    setNotificationPermission(result);
    // Nur bei erteilter Berechtigung tatsächlich aktivieren (Req 8.7).
    updateSettings({ notificationsEnabled: result === 'granted' });
  };

  /** Spielt den ausgewählten Ton zur Vorschau ab (Nutzergeste, Req 9.3). */
  const handlePreviewSound = () => {
    soundService.unlock();
    soundService.play(settings.soundId, settings.volume, settings.soundEnabled);
  };

  return (
    <section
      data-testid={SETTINGS_VIEW_MARKER}
      className={styles.view}
      aria-labelledby="settings-view-heading"
    >
      <h1 id="settings-view-heading" className={styles.title}>
        Einstellungen
      </h1>

      <SettingsForm
        settings={settings}
        onChange={updateSettings}
        onEnableNotifications={handleEnableNotifications}
        onPreviewSound={handlePreviewSound}
        notificationPermission={notificationPermission}
        notificationsSupported={notificationService.isSupported()}
        storageAvailable={storageAvailable}
      />
    </section>
  );
}
