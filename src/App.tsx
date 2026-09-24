// Wurzelkomponente der App.
//
// Verantwortlichkeiten (Task 8 + Ton/Benachrichtigungs-Verdrahtung):
// - Provider-Verschachtelung: SettingsProvider → StatsProvider → TimerProvider → AppShell.
// - Routing: HashRouter (Hash-basiert, damit die App als statische PWA problemlos deployt).
// - Statistik-Seam verdrahten: Abgeschlossene Fokus-Sessions werden über den
//   Session-Writer aus stats/db.ts persistiert; nach dem Schreiben aktualisiert der
//   StatsProvider seine Aggregationen (Req 11.1, 20.1).
// - Ton/Benachrichtigungs-Seam verdrahten (Req 8/9): SoundService + NotificationService
//   werden hier (nicht im TimerProvider) instanziiert und über die Provider-Seams
//   `onPhaseEnd`/`onFirstStart` an den Timer gehängt. So bleibt der TimerProvider rein
//   und frei von Service-Details – exakt wie beim bestehenden Session-Writer.
//
// Warum eine interne Komponente `TimerLayer`?
//   Der Session-Writer benötigt die `refresh`-Funktion des StatsProvider als
//   `onWritten`-Callback. `useStatsRefresh()` ist aber nur INNERHALB des StatsProvider
//   nutzbar. Ebenso müssen Ton/Benachrichtigung die AKTUELLEN Einstellungen lesen
//   (Lautstärke, soundEnabled, notify*), daher liest der TimerLayer via `useSettings`
//   live aus dem SettingsProvider. So bleibt die Verdrahtung sauber: Timer kennt keine
//   Service-/IndexedDB-Details, die Services kennen kein React.

import { useEffect, useMemo, useRef } from 'react';
import { HashRouter } from 'react-router-dom';
import { SettingsProvider, useSettings } from './settings/SettingsProvider';
import { StatsProvider, useStatsRefresh } from './stats/StatsProvider';
import { TimerProvider } from './timer/TimerProvider';
import { createSessionWriter } from './stats/db';
import { createSoundService, type SoundService } from './services/sound';
import {
  createNotificationService,
  type NotificationService,
} from './services/notifications';
import AppShell from './components/AppShell';
import type { ReactNode } from 'react';
import type { PhaseType } from './types';

/** Optionale Injektion der Services (nur für Tests; Produktion nutzt die Defaults). */
export interface AppServices {
  soundService?: SoundService;
  notificationService?: NotificationService;
}

/**
 * Verbindet den Timer mit Statistik, Ton und Benachrichtigung:
 * - erzeugt den Session-Writer mit dem StatsProvider-`refresh` als `onWritten`-Callback
 *   (→ `onSessionComplete`),
 * - liest die aktuellen Einstellungen live (useSettings) und reicht sie beim Phasenende
 *   an SoundService/NotificationService weiter (→ `onPhaseEnd`),
 * - entsperrt den AudioContext und fragt – nach der gewählten Regel – die
 *   Benachrichtigungsberechtigung bei der ersten Nutzergeste an (→ `onFirstStart`).
 * Muss innerhalb von <StatsProvider> (und damit <SettingsProvider>) gerendert werden.
 */
function TimerLayer({
  children,
  services,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const refreshStats = useStatsRefresh();
  const { settings } = useSettings();

  // Services stabil über die Lebensdauer halten (einmalig erzeugen bzw. injizierte
  // Instanzen übernehmen). useMemo mit leerer Abhängigkeit reicht, da wir die Instanzen
  // nicht austauschen wollen.
  const soundService = useMemo(
    () => services?.soundService ?? createSoundService(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const notificationService = useMemo(
    () => services?.notificationService ?? createNotificationService(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // SoundService beim Unmount freigeben (AudioContext schließen).
  useEffect(() => () => soundService.dispose(), [soundService]);

  const writeSession = useMemo(
    () => createSessionWriter(refreshStats),
    [refreshStats],
  );

  // Aktuelle Einstellungen als Ref, damit die an den Timer übergebenen Callbacks stabil
  // bleiben (der Timer soll seine Effektabhängigkeiten nicht wegen Settings-Änderungen
  // neu binden) und dennoch stets die LIVE-Werte lesen.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Ton + Benachrichtigung beim tatsächlichen Phasenende (Req 8/9). Liest die aktuellen
  // Einstellungen: `play` respektiert soundEnabled/volume, `notifyPhaseEnd` respektiert
  // notificationsEnabled/notifyFocusEnd/notifyBreakEnd und die erteilte Berechtigung.
  const handlePhaseEnd = useMemo(
    () =>
      (phaseType: PhaseType) => {
        const s = settingsRef.current;
        soundService.play(s.soundId, s.volume, s.soundEnabled);
        // notifyPhaseEnd ist fire-and-forget und in sich fehlertolerant (Req 8.7/20.1).
        void notificationService.notifyPhaseEnd(phaseType, s);
      },
    [soundService, notificationService],
  );

  // Erste Nutzergeste (Req 8.1/8.2, 9.3): AudioContext entsperren und – NUR wenn der
  // Nutzer Benachrichtigungen aktiviert hat und die Berechtigung noch unentschieden
  // ('default') ist – die Berechtigung anfragen. Diese Regel vermeidet ungefragte
  // Prompts (kein Anfragen, wenn der Nutzer Notifications gar nicht will) und respektiert
  // eine bereits getroffene Entscheidung ('granted'/'denied'). Alles fehlertolerant.
  const handleFirstStart = useMemo(
    () => () => {
      soundService.unlock();
      const s = settingsRef.current;
      if (
        s.notificationsEnabled &&
        notificationService.isSupported() &&
        notificationService.getPermission() === 'default'
      ) {
        void notificationService.requestPermission();
      }
    },
    [soundService, notificationService],
  );

  return (
    <TimerProvider
      onSessionComplete={writeSession}
      onPhaseEnd={handlePhaseEnd}
      onFirstStart={handleFirstStart}
    >
      {children}
    </TimerProvider>
  );
}

export default function App({ services }: { services?: AppServices } = {}) {
  return (
    <SettingsProvider>
      <StatsProvider>
        <TimerLayer services={services}>
          <HashRouter>
            {/* AppShell definiert die Routes; daher muss der Router außen liegen. */}
            <AppShell />
          </HashRouter>
        </TimerLayer>
      </StatsProvider>
    </SettingsProvider>
  );
}

// Export für Tests: erlaubt das Rendern des TimerLayer mit injizierten Services.
export { TimerLayer };
