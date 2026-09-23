// Wurzelkomponente der App.
//
// Verantwortlichkeiten (Task 8):
// - Provider-Verschachtelung: SettingsProvider → StatsProvider → TimerProvider → AppShell.
// - Routing: HashRouter (Hash-basiert, damit die App als statische PWA problemlos deployt).
// - Statistik-Seam verdrahten: Abgeschlossene Fokus-Sessions werden über den
//   Session-Writer aus stats/db.ts persistiert; nach dem Schreiben aktualisiert der
//   StatsProvider seine Aggregationen (Req 11.1, 20.1).
//
// Warum eine interne Komponente `TimerLayer`?
//   Der Session-Writer benötigt die `refresh`-Funktion des StatsProvider als
//   `onWritten`-Callback. `useStatsRefresh()` ist aber nur INNERHALB des StatsProvider
//   nutzbar. Daher liest eine kleine Komponente unterhalb von StatsProvider das Refresh,
//   erzeugt den Writer (stabil via useMemo) und rendert damit den TimerProvider. So bleibt
//   die Verdrahtung sauber: Timer kennt keine IndexedDB-Details, db.ts kennt kein React.

import { useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { SettingsProvider } from './settings/SettingsProvider';
import { StatsProvider, useStatsRefresh } from './stats/StatsProvider';
import { TimerProvider } from './timer/TimerProvider';
import { createSessionWriter } from './stats/db';
import AppShell from './components/AppShell';
import type { ReactNode } from 'react';

/**
 * Verbindet den Timer-Seam mit der Statistik: erzeugt den Session-Writer mit dem
 * StatsProvider-`refresh` als `onWritten`-Callback und stellt ihn dem TimerProvider als
 * `onSessionComplete` bereit. Muss innerhalb von <StatsProvider> gerendert werden.
 */
function TimerLayer({ children }: { children: ReactNode }) {
  const refreshStats = useStatsRefresh();
  const writeSession = useMemo(
    () => createSessionWriter(refreshStats),
    [refreshStats],
  );

  return <TimerProvider onSessionComplete={writeSession}>{children}</TimerProvider>;
}

export default function App() {
  return (
    <SettingsProvider>
      <StatsProvider>
        <TimerLayer>
          <HashRouter>
            {/* AppShell definiert die Routes; daher muss der Router außen liegen. */}
            <AppShell />
          </HashRouter>
        </TimerLayer>
      </StatsProvider>
    </SettingsProvider>
  );
}
