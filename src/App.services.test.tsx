// Integrationstest für die Ton-/Benachrichtigungs-Verdrahtung (Bugfix: Ton +
// Benachrichtigung feuerten am Phasenende nicht, weil SoundService/NotificationService
// nie mit dem Timer verbunden waren).
//
// Getestet wird der TimerLayer aus App.tsx mit INJIZIERTEN Fake-Services (App erlaubt
// dies über die optionale `services`-Prop; Produktion nutzt die echten Services). Damit
// bleibt der Test frei von echten Browser-APIs (Web Audio / Notification), verifiziert
// aber, dass die Verdrahtung die Services am Phasenende und bei der ersten Nutzergeste
// korrekt aufruft und dabei die aktuellen Einstellungen weitergibt.
//
// Testinfrastruktur: dieselben Muster wie integration.test.tsx / TimerProvider.test.tsx
// (In-Memory-localStorage-Shim, fake-indexeddb, injizierbare Uhr, Fake-Timer).

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { TimerLayer, type AppServices } from './App';
import { SettingsProvider } from './settings/SettingsProvider';
import { StatsProvider } from './stats/StatsProvider';
import { useTimer } from './timer/TimerProvider';
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from './settings/defaults';
import type {
  NotificationPermissionState,
  NotificationService,
} from './services/notifications';
import type { SoundService } from './services/sound';
import type { PhaseType, Settings } from './types';

const MIN = 60_000;

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as Storage;
}

function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

function makeClock(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (delta: number) => {
      current += delta;
    },
  };
}

function seedSettings(patch: Partial<Settings>): void {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}

/** Fake-SoundService, der die Aufrufe protokolliert. */
function makeFakeSound() {
  const calls = {
    unlock: 0,
    play: [] as Array<{ soundId: string; volume: number; soundEnabled?: boolean }>,
    dispose: 0,
  };
  const service: SoundService = {
    unlock: () => {
      calls.unlock += 1;
    },
    isUnlocked: () => calls.unlock > 0,
    play: (soundId, volume, soundEnabled) => {
      calls.play.push({ soundId, volume, soundEnabled });
    },
    dispose: () => {
      calls.dispose += 1;
    },
  };
  return { service, calls };
}

/** Fake-NotificationService mit steuerbarem Support/Permission. */
function makeFakeNotifications(opts: {
  supported?: boolean;
  permission?: NotificationPermissionState;
} = {}) {
  const calls = {
    requestPermission: 0,
    notifyPhaseEnd: [] as Array<{ phaseType: PhaseType; settings: Settings }>,
  };
  let permission: NotificationPermissionState = opts.permission ?? 'default';
  const supported = opts.supported ?? true;
  const service: NotificationService = {
    isSupported: () => supported,
    getPermission: () => permission,
    requestPermission: async () => {
      calls.requestPermission += 1;
      permission = 'granted';
      return permission;
    },
    notifyPhaseEnd: async (phaseType, settings) => {
      calls.notifyPhaseEnd.push({ phaseType, settings });
    },
  };
  return { service, calls };
}

interface TreeOpts {
  now: () => number;
  tickIntervalMs?: number;
  services: AppServices;
}

function makeWrapper(opts: TreeOpts) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SettingsProvider>
        <StatsProvider now={opts.now}>
          <TimerLayer services={opts.services}>{children}</TimerLayer>
        </StatsProvider>
      </SettingsProvider>
    );
  };
}

// Der TimerLayer benutzt intern die Default-Uhr des TimerProvider (Date.now), da er die
// `now`-Prop nicht durchreicht. Für deterministische Ablauf-Tests injizieren wir die Uhr
// über vi.useFakeTimers({ now }) und steuern Date.now via vi.setSystemTime.

describe('App-Verdrahtung: Ton + Benachrichtigung am Phasenende (Bugfix)', () => {
  beforeEach(() => {
    installMemoryStorage();
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('spielt den Ton und benachrichtigt beim Fokusende mit den aktuellen Einstellungen', async () => {
    seedSettings({
      soundEnabled: true,
      soundId: 'chime',
      volume: 0.4,
      notificationsEnabled: true,
      notifyFocusEnd: true,
    });
    const sound = makeFakeSound();
    const notifications = makeFakeNotifications({ permission: 'granted' });
    const clock = makeClock(1_000_000);

    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        services: {
          soundService: sound.service,
          notificationService: notifications.service,
        },
      }),
    });

    act(() => {
      result.current.start();
    });
    // Fokus ablaufen lassen. Der TimerProvider nutzt Date.now – daher Systemzeit setzen.
    act(() => {
      vi.setSystemTime(1_000_000 + 25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });

    // Ton mit LIVE-Einstellungen gespielt.
    expect(sound.calls.play).toHaveLength(1);
    expect(sound.calls.play[0]).toEqual({
      soundId: 'chime',
      volume: 0.4,
      soundEnabled: true,
    });
    // Benachrichtigung für das Fokusende ausgelöst.
    expect(notifications.calls.notifyPhaseEnd).toHaveLength(1);
    expect(notifications.calls.notifyPhaseEnd[0].phaseType).toBe('Focus');
    expect(notifications.calls.notifyPhaseEnd[0].settings.notificationsEnabled).toBe(true);
  });

  it('entsperrt den Ton bei der ersten Nutzergeste und fragt Berechtigung an (enabled + default)', () => {
    seedSettings({ notificationsEnabled: true });
    const sound = makeFakeSound();
    const notifications = makeFakeNotifications({
      supported: true,
      permission: 'default',
    });
    const clock = makeClock(1_000_000);

    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        services: {
          soundService: sound.service,
          notificationService: notifications.service,
        },
      }),
    });

    act(() => {
      result.current.start();
    });

    expect(sound.calls.unlock).toBe(1);
    expect(notifications.calls.requestPermission).toBe(1);
  });

  it('fragt bei der ersten Nutzergeste KEINE Berechtigung an, wenn Notifications aus sind', () => {
    seedSettings({ notificationsEnabled: false });
    const sound = makeFakeSound();
    const notifications = makeFakeNotifications({
      supported: true,
      permission: 'default',
    });
    const clock = makeClock(1_000_000);

    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        services: {
          soundService: sound.service,
          notificationService: notifications.service,
        },
      }),
    });

    act(() => {
      result.current.start();
    });

    // AudioContext wird dennoch entsperrt (Autoplay-Policy), aber keine Anfrage.
    expect(sound.calls.unlock).toBe(1);
    expect(notifications.calls.requestPermission).toBe(0);
  });

  it('fragt keine Berechtigung an, wenn bereits entschieden wurde (granted)', () => {
    seedSettings({ notificationsEnabled: true });
    const sound = makeFakeSound();
    const notifications = makeFakeNotifications({
      supported: true,
      permission: 'granted',
    });
    const clock = makeClock(1_000_000);

    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        services: {
          soundService: sound.service,
          notificationService: notifications.service,
        },
      }),
    });

    act(() => {
      result.current.start();
    });

    expect(sound.calls.unlock).toBe(1);
    expect(notifications.calls.requestPermission).toBe(0);
  });

  it('spielt bei soundEnabled=false zwar play() (der Service klemmt selbst), gibt aber die Einstellung durch', async () => {
    seedSettings({ soundEnabled: false, soundId: 'soft', volume: 0.6 });
    const sound = makeFakeSound();
    const notifications = makeFakeNotifications({ permission: 'granted' });
    const clock = makeClock(1_000_000);

    const { result } = renderHook(() => useTimer(), {
      wrapper: makeWrapper({
        now: clock.now,
        tickIntervalMs: 250,
        services: {
          soundService: sound.service,
          notificationService: notifications.service,
        },
      }),
    });

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.setSystemTime(1_000_000 + 25 * MIN + 500);
      vi.advanceTimersByTime(250);
    });

    // play wird aufgerufen; die tatsächliche Stummschaltung übernimmt der SoundService
    // (soundEnabled=false → No-Op im echten Service). Wichtig: die Einstellung wird
    // korrekt durchgereicht.
    expect(sound.calls.play).toHaveLength(1);
    expect(sound.calls.play[0].soundEnabled).toBe(false);
  });
});
