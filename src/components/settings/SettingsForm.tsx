// SettingsForm – präsentationales Einstellungs-Formular (Task 13, Req 12, 13, 19).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „SettingsView"):
// - Formularabschnitte: Timer (mit Grenz-Validierung), Automatischer Start, Ton,
//   Benachrichtigungen, Darstellung; Datenschutz-Hinweis.
//
// Diese Komponente ist rein präsentational: Sie erhält die aktuellen `settings`
// und Callbacks als Props und ruft `onChange(patch)` mit den zu ändernden Feldern
// auf. Das Klemmen/Validieren und Persistieren erfolgt zentral im SettingsProvider
// (updateSettings → sanitizeSettings), sodass hier keine Duplikat-Logik nötig ist
// (Req 12.2, 12.6). Der Ton-Vorschau- und Benachrichtigungs-Flow wird über Callbacks
// injiziert, damit die Komponente ohne Services/Provider unit-testbar bleibt.
//
// Jeder Abschnitt ist ein <fieldset> mit <legend>; alle Eingaben sind über
// <label htmlFor> mit ihrem Control verbunden (Req 18.1/18.2).

import { useId } from 'react';
import type { Settings } from '../../types';
import { LIMITS } from '../../settings/defaults';
import { AVAILABLE_SOUNDS, type SoundOption } from '../../services/sound';
import type { NotificationPermissionState } from '../../services/notifications';
import styles from './SettingsForm.module.css';

/** Exakter Datenschutz-Hinweis (spec.md §19, Req 19.3). VERBATIM. */
export const PRIVACY_NOTICE =
  'Deine Fokusdaten werden ausschließlich auf diesem Gerät gespeichert.';

/** Auswahloptionen für die Darstellung (Req 12.5, 13.1). */
const THEME_OPTIONS: { value: Settings['theme']; label: string }[] = [
  { value: 'system', label: 'Systemeinstellung verwenden' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

export interface SettingsFormProps {
  /** Aktuelle, validierte Einstellungen. */
  settings: Settings;
  /** Ändert (Teile der) Einstellungen; das Klemmen/Persistieren erfolgt zentral. */
  onChange: (patch: Partial<Settings>) => void;
  /**
   * Wird ausgelöst, wenn der Nutzer Benachrichtigungen aktiviert. Führt den
   * Berechtigungs-Flow aus (Req 8.1/8.2, 12.5). Bei Deaktivieren wird nur
   * onChange aufgerufen.
   */
  onEnableNotifications: () => void;
  /** Optionaler Ton-Vorschau-Handler (benötigt Nutzergeste, Req 9.3). */
  onPreviewSound?: () => void;
  /** Aktueller Benachrichtigungs-Berechtigungsstatus. */
  notificationPermission: NotificationPermissionState;
  /** Ob Browser-Benachrichtigungen unterstützt werden. */
  notificationsSupported: boolean;
  /** True, wenn kein persistenter Speicher verfügbar ist (Req 20.1). */
  storageAvailable: boolean;
  /** Auswählbare Signaltöne (Standard: AVAILABLE_SOUNDS). */
  sounds?: readonly SoundOption[];
}

/**
 * Wandelt den rohen Eingabewert eines number-Feldes in einen Patch-Wert.
 * Leere Eingaben werden als NaN weitergereicht, damit der Provider auf den
 * Standardwert zurückfällt (sanitizeSettings). Der Provider klemmt zusätzlich
 * auf die erlaubten Grenzen (Req 12.2).
 */
function parseNumberInput(raw: string): number {
  if (raw.trim() === '') return Number.NaN;
  return Number(raw);
}

/**
 * Rendert das vollständige Einstellungs-Formular.
 */
export default function SettingsForm({
  settings,
  onChange,
  onEnableNotifications,
  onPreviewSound,
  notificationPermission,
  notificationsSupported,
  storageAvailable,
  sounds = AVAILABLE_SOUNDS,
}: SettingsFormProps) {
  // Stabile, eindeutige ID-Basis für label/control-Verknüpfungen.
  const id = useId();
  const fid = (name: string) => `${id}-${name}`;

  const notificationsBlocked =
    !notificationsSupported || notificationPermission === 'denied';

  /** Handler für die Benachrichtigungs-Aktivierung (Req 8.1/8.2). */
  const handleNotificationsToggle = (checked: boolean) => {
    if (checked) {
      // Erst beim Aktivieren die Berechtigung anfragen (Req 8.1).
      onEnableNotifications();
    } else {
      onChange({ notificationsEnabled: false });
    }
  };

  return (
    <div className={styles.form}>
      {!storageAvailable && (
        <p className={styles.storageHint} role="status">
          Kein lokaler Speicher verfügbar – Einstellungen bleiben nur für diese Sitzung
          erhalten.
        </p>
      )}

      {/* ---------------------------------------------------------------- Timer */}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Timer</legend>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('focusMinutes')}>
            Fokusdauer (Minuten)
          </label>
          <input
            id={fid('focusMinutes')}
            className={styles.numberInput}
            type="number"
            inputMode="numeric"
            min={LIMITS.focusMinutes.min}
            max={LIMITS.focusMinutes.max}
            value={settings.focusMinutes}
            aria-describedby={fid('focusMinutes-hint')}
            onChange={(e) => onChange({ focusMinutes: parseNumberInput(e.target.value) })}
          />
          <span id={fid('focusMinutes-hint')} className={styles.hint}>
            {LIMITS.focusMinutes.min}–{LIMITS.focusMinutes.max} Minuten
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('shortBreakMinutes')}>
            Kurze Pause (Minuten)
          </label>
          <input
            id={fid('shortBreakMinutes')}
            className={styles.numberInput}
            type="number"
            inputMode="numeric"
            min={LIMITS.shortBreakMinutes.min}
            max={LIMITS.shortBreakMinutes.max}
            value={settings.shortBreakMinutes}
            aria-describedby={fid('shortBreakMinutes-hint')}
            onChange={(e) =>
              onChange({ shortBreakMinutes: parseNumberInput(e.target.value) })
            }
          />
          <span id={fid('shortBreakMinutes-hint')} className={styles.hint}>
            {LIMITS.shortBreakMinutes.min}–{LIMITS.shortBreakMinutes.max} Minuten
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('longBreakMinutes')}>
            Lange Pause (Minuten)
          </label>
          <input
            id={fid('longBreakMinutes')}
            className={styles.numberInput}
            type="number"
            inputMode="numeric"
            min={LIMITS.longBreakMinutes.min}
            max={LIMITS.longBreakMinutes.max}
            value={settings.longBreakMinutes}
            aria-describedby={fid('longBreakMinutes-hint')}
            onChange={(e) =>
              onChange({ longBreakMinutes: parseNumberInput(e.target.value) })
            }
          />
          <span id={fid('longBreakMinutes-hint')} className={styles.hint}>
            {LIMITS.longBreakMinutes.min}–{LIMITS.longBreakMinutes.max} Minuten
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('focusPerCycle')}>
            Fokusphasen bis zur langen Pause
          </label>
          <input
            id={fid('focusPerCycle')}
            className={styles.numberInput}
            type="number"
            inputMode="numeric"
            min={LIMITS.focusPerCycle.min}
            max={LIMITS.focusPerCycle.max}
            value={settings.focusPerCycle}
            aria-describedby={fid('focusPerCycle-hint')}
            onChange={(e) => onChange({ focusPerCycle: parseNumberInput(e.target.value) })}
          />
          <span id={fid('focusPerCycle-hint')} className={styles.hint}>
            {LIMITS.focusPerCycle.min}–{LIMITS.focusPerCycle.max} Fokusphasen
          </span>
        </div>
      </fieldset>

      {/* -------------------------------------------------- Automatischer Start */}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Automatischer Start</legend>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('autoStartBreaks')}>
            Pausen automatisch starten
          </label>
          <input
            id={fid('autoStartBreaks')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.autoStartBreaks}
            onChange={(e) => onChange({ autoStartBreaks: e.target.checked })}
          />
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('autoStartFocus')}>
            Fokusphasen automatisch starten
          </label>
          <input
            id={fid('autoStartFocus')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.autoStartFocus}
            onChange={(e) => onChange({ autoStartFocus: e.target.checked })}
          />
        </div>
      </fieldset>

      {/* ------------------------------------------------------------------ Ton */}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Ton</legend>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('soundEnabled')}>
            Ton am Phasenende
          </label>
          <input
            id={fid('soundEnabled')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.soundEnabled}
            onChange={(e) => onChange({ soundEnabled: e.target.checked })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('soundId')}>
            Signalton
          </label>
          <select
            id={fid('soundId')}
            className={styles.select}
            value={settings.soundId}
            disabled={!settings.soundEnabled}
            onChange={(e) => onChange({ soundId: e.target.value })}
          >
            {sounds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('volume')}>
            Lautstärke
          </label>
          <input
            id={fid('volume')}
            className={styles.slider}
            type="range"
            min={LIMITS.volume.min}
            max={LIMITS.volume.max}
            step={0.05}
            value={settings.volume}
            disabled={!settings.soundEnabled}
            aria-valuetext={`${Math.round(settings.volume * 100)} Prozent`}
            onChange={(e) => onChange({ volume: parseNumberInput(e.target.value) })}
          />
        </div>

        {onPreviewSound && (
          <button
            type="button"
            className={styles.previewButton}
            disabled={!settings.soundEnabled}
            onClick={onPreviewSound}
          >
            Vorschau abspielen
          </button>
        )}
      </fieldset>

      {/* -------------------------------------------------- Benachrichtigungen */}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Benachrichtigungen</legend>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('notificationsEnabled')}>
            Browser-Benachrichtigungen
          </label>
          <input
            id={fid('notificationsEnabled')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.notificationsEnabled}
            disabled={notificationsBlocked}
            aria-describedby={
              notificationsBlocked ? fid('notifications-hint') : undefined
            }
            onChange={(e) => handleNotificationsToggle(e.target.checked)}
          />
        </div>

        {notificationsBlocked && (
          <p id={fid('notifications-hint')} className={styles.hint} role="status">
            {notificationsSupported
              ? 'Benachrichtigungen wurden im Browser blockiert. Bitte in den Browser-Einstellungen erlauben.'
              : 'Dieser Browser unterstützt keine Benachrichtigungen.'}
          </p>
        )}

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('notifyFocusEnd')}>
            Bei Fokusende benachrichtigen
          </label>
          <input
            id={fid('notifyFocusEnd')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.notifyFocusEnd}
            disabled={!settings.notificationsEnabled}
            onChange={(e) => onChange({ notifyFocusEnd: e.target.checked })}
          />
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor={fid('notifyBreakEnd')}>
            Bei Pausenende benachrichtigen
          </label>
          <input
            id={fid('notifyBreakEnd')}
            type="checkbox"
            role="switch"
            className={styles.toggle}
            checked={settings.notifyBreakEnd}
            disabled={!settings.notificationsEnabled}
            onChange={(e) => onChange({ notifyBreakEnd: e.target.checked })}
          />
        </div>
      </fieldset>

      {/* ----------------------------------------------------------- Darstellung */}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Darstellung</legend>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={fid('theme')}>
            Farbschema
          </label>
          <select
            id={fid('theme')}
            className={styles.select}
            value={settings.theme}
            onChange={(e) => onChange({ theme: e.target.value as Settings['theme'] })}
          >
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* ------------------------------------------------------- Datenschutz */}
      <p className={styles.privacyNote}>{PRIVACY_NOTICE}</p>
    </div>
  );
}
