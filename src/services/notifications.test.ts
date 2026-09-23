import { describe, it, expect, vi } from 'vitest';
import {
  createNotificationService,
  NOTIFICATION_TEXTS,
  type NotificationApiLike,
  type NotificationPermissionState,
  type RegistrationLike,
} from './notifications';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { PhaseType, Settings } from '../types';

// jsdom stellt keine Notification-API und keinen Service Worker bereit.
// Wir injizieren leichte Fakes, um die Logik (Texte, Flags, verzögerte
// Berechtigung, SW-bevorzugte Anzeige, stiller No-Op) ohne echte Browser-
// APIs zu testen.

function createFakeApi(
  opts: { permission?: NotificationPermissionState; requestResult?: NotificationPermissionState; requestRejects?: boolean } = {},
) {
  let permission = opts.permission ?? 'default';
  const show = vi.fn();
  const requestPermission = vi.fn(async () => {
    if (opts.requestRejects) throw new Error('blocked');
    permission = opts.requestResult ?? 'granted';
    return permission;
  });
  const api: NotificationApiLike = {
    get permission() {
      return permission;
    },
    requestPermission,
    show,
  };
  return { api, show, requestPermission, setPermission: (p: NotificationPermissionState) => (permission = p) };
}

function createFakeRegistration(opts: { rejects?: boolean } = {}) {
  const showNotification = vi.fn(async () => {
    if (opts.rejects) throw new Error('sw failed');
  });
  const registration: RegistrationLike = { showNotification };
  return { registration, showNotification };
}

/** Einstellungen mit erlaubten Benachrichtigungen als Basis. */
function enabledSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    notificationsEnabled: true,
    notifyFocusEnd: true,
    notifyBreakEnd: true,
    ...overrides,
  };
}

describe('NOTIFICATION_TEXTS – exakte Texte (Req 8.3–8.5)', () => {
  it('nutzt die verbatim Texte für Fokusende (Req 8.3)', () => {
    expect(NOTIFICATION_TEXTS.Focus).toEqual({
      title: 'Fokusphase abgeschlossen',
      body: 'Zeit für eine kurze Pause.',
    });
  });

  it('nutzt die verbatim Texte für kurzes Pausenende (Req 8.4)', () => {
    expect(NOTIFICATION_TEXTS.ShortBreak).toEqual({
      title: 'Pause beendet',
      body: 'Bereit für die nächste Fokusphase?',
    });
  });

  it('nutzt die verbatim Texte für langes Pausenende (Req 8.5)', () => {
    expect(NOTIFICATION_TEXTS.LongBreak).toEqual({
      title: 'Lange Pause beendet',
      body: 'Starte deinen nächsten Fokuszyklus.',
    });
  });
});

describe('createNotificationService – Unterstützung & Status', () => {
  it('meldet isSupported=false, wenn keine Notification-API vorhanden ist', () => {
    const service = createNotificationService({ notificationApi: null, getRegistration: null });
    expect(service.isSupported()).toBe(false);
    expect(service.getPermission()).toBe('default');
  });

  it('meldet isSupported=true und den Status der API', () => {
    const { api } = createFakeApi({ permission: 'granted' });
    const service = createNotificationService({ notificationApi: api, getRegistration: null });
    expect(service.isSupported()).toBe(true);
    expect(service.getPermission()).toBe('granted');
  });
});

describe('createNotificationService – Berechtigungsanfrage (Req 8.1/8.2)', () => {
  it('fragt die Berechtigung NICHT automatisch bei der Erzeugung an', () => {
    const { api, requestPermission } = createFakeApi();
    createNotificationService({ notificationApi: api, getRegistration: null });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('fragt die Berechtigung nur bei explizitem requestPermission() an', async () => {
    const { api, requestPermission } = createFakeApi({ requestResult: 'granted' });
    const service = createNotificationService({ notificationApi: api, getRegistration: null });
    const result = await service.requestPermission();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toBe('granted');
  });

  it('gibt still "denied" zurück, wenn nicht unterstützt', async () => {
    const service = createNotificationService({ notificationApi: null, getRegistration: null });
    await expect(service.requestPermission()).resolves.toBe('denied');
  });

  it('behandelt eine abgelehnte Anfrage still als "denied"', async () => {
    const { api } = createFakeApi({ requestRejects: true });
    const service = createNotificationService({ notificationApi: api, getRegistration: null });
    await expect(service.requestPermission()).resolves.toBe('denied');
  });
});

describe('createNotificationService – notifyPhaseEnd Text je Phase (Req 8.3–8.5)', () => {
  const cases: Array<[PhaseType, { title: string; body: string }]> = [
    ['Focus', NOTIFICATION_TEXTS.Focus],
    ['ShortBreak', NOTIFICATION_TEXTS.ShortBreak],
    ['LongBreak', NOTIFICATION_TEXTS.LongBreak],
  ];

  for (const [phase, text] of cases) {
    it(`zeigt den korrekten Text für ${phase}`, async () => {
      const { api } = createFakeApi({ permission: 'granted' });
      const { registration, showNotification } = createFakeRegistration();
      const service = createNotificationService({
        notificationApi: api,
        getRegistration: async () => registration,
      });
      await service.notifyPhaseEnd(phase, enabledSettings());
      expect(showNotification).toHaveBeenCalledWith(text.title, { body: text.body });
    });
  }
});

describe('createNotificationService – respektiert Einstellungs-Flags (Req 12.4)', () => {
  it('zeigt nichts, wenn notificationsEnabled=false', async () => {
    const { api } = createFakeApi({ permission: 'granted' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings({ notificationsEnabled: false }));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('zeigt kein Fokusende, wenn notifyFocusEnd=false', async () => {
    const { api } = createFakeApi({ permission: 'granted' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings({ notifyFocusEnd: false }));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('zeigt trotz notifyFocusEnd=false weiterhin Pausenende', async () => {
    const { api } = createFakeApi({ permission: 'granted' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('ShortBreak', enabledSettings({ notifyFocusEnd: false }));
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('zeigt kein Pausenende (kurz/lang), wenn notifyBreakEnd=false', async () => {
    const { api } = createFakeApi({ permission: 'granted' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('ShortBreak', enabledSettings({ notifyBreakEnd: false }));
    await service.notifyPhaseEnd('LongBreak', enabledSettings({ notifyBreakEnd: false }));
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('createNotificationService – SW-bevorzugte Anzeige mit Fallback (Req 8.6)', () => {
  it('nutzt den Service Worker, wenn eine Registration verfügbar ist', async () => {
    const { api, show } = createFakeApi({ permission: 'granted' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(showNotification).toHaveBeenCalledTimes(1);
    // Nicht der Konstruktor-Fallback.
    expect(show).not.toHaveBeenCalled();
  });

  it('fällt auf den Notification-Konstruktor zurück, wenn kein SW vorhanden ist', async () => {
    const { api, show } = createFakeApi({ permission: 'granted' });
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: null,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('Fokusphase abgeschlossen', {
      body: 'Zeit für eine kurze Pause.',
    });
  });

  it('fällt auf den Konstruktor zurück, wenn getRegistration null liefert', async () => {
    const { api, show } = createFakeApi({ permission: 'granted' });
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => null,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('fällt auf den Konstruktor zurück, wenn showNotification wirft', async () => {
    const { api, show } = createFakeApi({ permission: 'granted' });
    const { registration } = createFakeRegistration({ rejects: true });
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(show).toHaveBeenCalledTimes(1);
  });
});

describe('createNotificationService – stiller Umgang bei Verweigerung (Req 8.7)', () => {
  it('zeigt nichts, wenn die Berechtigung "denied" ist', async () => {
    const { api, show } = createFakeApi({ permission: 'denied' });
    const { registration, showNotification } = createFakeRegistration();
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: async () => registration,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(showNotification).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('zeigt nichts, wenn die Berechtigung "default" (noch nicht erteilt) ist', async () => {
    const { api, show } = createFakeApi({ permission: 'default' });
    const service = createNotificationService({
      notificationApi: api,
      getRegistration: null,
    });
    await service.notifyPhaseEnd('Focus', enabledSettings());
    expect(show).not.toHaveBeenCalled();
  });

  it('ist ein sicherer No-Op, wenn die Notification-API nicht unterstützt wird', async () => {
    const service = createNotificationService({ notificationApi: null, getRegistration: null });
    await expect(service.notifyPhaseEnd('Focus', enabledSettings())).resolves.toBeUndefined();
  });
});
