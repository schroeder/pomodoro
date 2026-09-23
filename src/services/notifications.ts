// NotificationService – Browser-/Push-Benachrichtigungen bei Phasenende (Req 8).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt NotificationService):
// - Fragt die Berechtigung NICHT beim Laden, sondern nach dem ersten Start
//   über einen erklärenden In-App-Dialog, gefolgt von
//   Notification.requestPermission() (Req 8.1/8.2). Dieser Service stellt
//   dafür requestPermission() + getPermission() bereit; der erklärende
//   In-App-Dialog selbst ist UI (Timer-/Settings-View).
// - Zeigt Benachrichtigungen bei Phasenende mit den EXAKTEN Texten aus
//   spec.md §9 (Req 8.3–8.5).
// - Bevorzugt die Anzeige über den Service Worker
//   (registration.showNotification), damit sie auch bei nicht fokussierter
//   App erscheint (Req 8.6). Fällt auf die Notification-API zurück.
// - Bei verweigerter/nicht unterstützter Berechtigung: still, kein Fehler
//   (Req 8.7). Alle Zugriffe sind in try/catch gekapselt.

import type { PhaseType, Settings } from '../types';

/** Berechtigungsstatus analog zur nativen NotificationPermission. */
export type NotificationPermissionState = 'default' | 'granted' | 'denied';

/**
 * Exakte Benachrichtigungstexte je Phasenende (spec.md §9, Req 8.3–8.5).
 * VERBATIM – dürfen nicht verändert werden. Exportiert, damit UI und Tests
 * dieselbe Quelle referenzieren.
 */
export const NOTIFICATION_TEXTS: Record<PhaseType, { title: string; body: string }> = {
  Focus: {
    title: 'Fokusphase abgeschlossen',
    body: 'Zeit für eine kurze Pause.',
  },
  ShortBreak: {
    title: 'Pause beendet',
    body: 'Bereit für die nächste Fokusphase?',
  },
  LongBreak: {
    title: 'Lange Pause beendet',
    body: 'Starte deinen nächsten Fokuszyklus.',
  },
};

/**
 * Minimaler Ausschnitt der nativen Notification-API, den der Service benötigt
 * (injizierbar für Tests, da jsdom keine Notification-API bereitstellt).
 */
export interface NotificationApiLike {
  /** Aktueller Berechtigungsstatus. */
  readonly permission: NotificationPermissionState;
  /** Fragt die Berechtigung an (Nutzergeste). */
  requestPermission(): Promise<NotificationPermissionState>;
  /** Konstruktor-Fallback, falls kein Service Worker verfügbar ist. */
  show(title: string, options?: { body?: string }): void;
}

/** Optionen zum Anzeigen einer Benachrichtigung über den Service Worker. */
interface ShowNotificationOptions {
  body?: string;
}

/**
 * Minimaler Ausschnitt der ServiceWorkerRegistration, den der Service nutzt.
 */
export interface RegistrationLike {
  showNotification(title: string, options?: ShowNotificationOptions): void | Promise<void>;
}

/** Liefert die bereite ServiceWorkerRegistration oder null (injizierbar). */
export type GetRegistration = () => Promise<RegistrationLike | null>;

/** Optionen zur Erzeugung eines NotificationService. */
export interface NotificationServiceOptions {
  /**
   * Abstraktion der nativen Notification-API. Standard: aus globalThis
   * ermittelt. `null` = nicht unterstützt (z. B. jsdom).
   */
  notificationApi?: NotificationApiLike | null;
  /**
   * Liefert die Service-Worker-Registration für die bevorzugte Anzeige
   * (Req 8.6). Standard: navigator.serviceWorker.ready. `null` = kein SW.
   */
  getRegistration?: GetRegistration | null;
}

/** Öffentliche Schnittstelle des NotificationService. */
export interface NotificationService {
  /** Ob Browser-Benachrichtigungen im aktuellen Environment unterstützt werden. */
  isSupported(): boolean;
  /** Aktueller Berechtigungsstatus ('default' wenn nicht unterstützt). */
  getPermission(): NotificationPermissionState;
  /**
   * Fragt die Berechtigung an (Req 8.1/8.2). MUSS aus einer Nutzergeste bzw.
   * nach dem ersten Timer-Start aufgerufen werden – NICHT beim Laden.
   * Gibt den resultierenden Status zurück; bei fehlender Unterstützung
   * still 'denied'.
   */
  requestPermission(): Promise<NotificationPermissionState>;
  /**
   * Zeigt die Benachrichtigung für das Ende der Phase `phaseType` an, sofern
   * die Einstellungen (notificationsEnabled + notifyFocusEnd/notifyBreakEnd)
   * dies erlauben und die Berechtigung erteilt wurde. Bevorzugt den Service
   * Worker (Req 8.6), fällt auf die Notification-API zurück. Bei Verweigerung
   * oder fehlender Unterstützung stiller No-Op (Req 8.7).
   */
  notifyPhaseEnd(phaseType: PhaseType, settings: Settings): Promise<void>;
}

/**
 * Ermittelt die native Notification-API aus globalThis, falls verfügbar.
 * Gibt sonst null zurück (z. B. jsdom ohne Notification).
 */
function resolveNativeApi(): NotificationApiLike | null {
  try {
    const g = globalThis as unknown as {
      Notification?: {
        permission: NotificationPermissionState;
        requestPermission(): Promise<NotificationPermissionState>;
        new (title: string, options?: { body?: string }): unknown;
      };
    };
    const Ctor = g.Notification;
    if (!Ctor || typeof Ctor.requestPermission !== 'function') return null;
    return {
      get permission() {
        return Ctor.permission;
      },
      requestPermission: () => Ctor.requestPermission(),
      show: (title, options) => {
        // eslint-disable-next-line no-new -- Konstruktor-Fallback zeigt die Notification an.
        new Ctor(title, options);
      },
    };
  } catch {
    return null;
  }
}

/**
 * Ermittelt die Standard-Registration-Quelle (navigator.serviceWorker.ready),
 * falls ein Service Worker unterstützt wird. Gibt sonst null zurück.
 */
function resolveNativeGetRegistration(): GetRegistration | null {
  try {
    const nav = (globalThis as unknown as { navigator?: Navigator }).navigator;
    if (!nav || !('serviceWorker' in nav)) return null;
    return async () => {
      try {
        const reg = await nav.serviceWorker.ready;
        return (reg as unknown as RegistrationLike) ?? null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

/**
 * Prüft, ob für die gegebene Phase laut Einstellungen benachrichtigt werden
 * soll. Fokusende hängt an notifyFocusEnd, Pausenende an notifyBreakEnd
 * (Req 8, Req 12.4).
 */
function shouldNotify(phaseType: PhaseType, settings: Settings): boolean {
  if (!settings.notificationsEnabled) return false;
  if (phaseType === 'Focus') return settings.notifyFocusEnd;
  // ShortBreak und LongBreak sind Pausen.
  return settings.notifyBreakEnd;
}

/**
 * Erzeugt einen NotificationService. Notification-API und Service-Worker-
 * Registration sind injizierbar, sodass die Logik ohne echte Browser-APIs
 * (z. B. in jsdom) testbar ist.
 */
export function createNotificationService(
  options: NotificationServiceOptions = {},
): NotificationService {
  const api =
    options.notificationApi === undefined ? resolveNativeApi() : options.notificationApi;
  const getRegistration =
    options.getRegistration === undefined
      ? resolveNativeGetRegistration()
      : options.getRegistration;

  function isSupported(): boolean {
    return api != null;
  }

  function getPermission(): NotificationPermissionState {
    if (!api) return 'default';
    try {
      return api.permission;
    } catch {
      return 'default';
    }
  }

  async function requestPermission(): Promise<NotificationPermissionState> {
    if (!api) return 'denied'; // Nicht unterstützt -> still (Req 8.7).
    try {
      const result = await api.requestPermission();
      return result ?? 'denied';
    } catch {
      // Fehler bei der Anfrage still behandeln (Req 8.7).
      return 'denied';
    }
  }

  async function display(title: string, body: string): Promise<void> {
    // Bevorzugt den Service Worker, damit die Benachrichtigung auch bei nicht
    // fokussierter App erscheint (Req 8.6).
    if (getRegistration) {
      try {
        const registration = await getRegistration();
        if (registration) {
          await registration.showNotification(title, { body });
          return;
        }
      } catch {
        // Fällt unten auf die Notification-API zurück.
      }
    }

    // Fallback: Notification-Konstruktor.
    if (api) {
      try {
        api.show(title, { body });
      } catch {
        // Anzeige fehlgeschlagen -> still ignorieren (Req 8.7 / 20.1).
      }
    }
  }

  async function notifyPhaseEnd(phaseType: PhaseType, settings: Settings): Promise<void> {
    // Respektiert die Benachrichtigungs-Einstellungen (Req 12.4).
    if (!shouldNotify(phaseType, settings)) return;
    // Ohne erteilte Berechtigung keine Anzeige (Req 8.7).
    if (getPermission() !== 'granted') return;

    const text = NOTIFICATION_TEXTS[phaseType];
    if (!text) return;

    try {
      await display(text.title, text.body);
    } catch {
      // Jeglicher Fehler bleibt still (Req 8.7 / 20.1).
    }
  }

  return { isSupported, getPermission, requestPermission, notifyPhaseEnd };
}
