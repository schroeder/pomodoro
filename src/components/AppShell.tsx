// App-Shell: Layout-Rahmen, der die Navigation und die geroutete Ausgabe zusammenführt
// (Task 8, Req 14.1–14.3).
//
// Muss innerhalb eines Routers (App verwendet <HashRouter>) gerendert werden, da hier die
// <Routes> definiert sind. Drei Hauptbereiche gemäß Req 14.1:
//   /          → TimerView       (Hauptansicht)
//   /stats     → StatsView       (Statistik)
//   /settings  → SettingsView    (Einstellungen)
// Ein Catch-all leitet unbekannte Pfade zurück auf die Timer-Startseite.
//
// Die Views sind in Task 8 bewusst nur Platzhalter; ihre vollständigen Implementierungen
// folgen in den Tasks 9/12/13.

import { Navigate, Route, Routes } from 'react-router-dom';
import Navigation from './Navigation';
import TimerView from '../views/TimerView';
import StatsView from '../views/StatsView';
import SettingsView from '../views/SettingsView';
import './AppShell.css';

export default function AppShell() {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="app-shell__main">
        <Routes>
          <Route path="/" element={<TimerView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
