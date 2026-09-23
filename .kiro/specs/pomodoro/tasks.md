# Implementierungsplan – Pomodoro Web App

- [x] 1. Projekt-Setup und Grundgerüst
  - Vite-Projekt mit React + TypeScript initialisieren, Verzeichnisstruktur gemäß Design anlegen
  - Vitest + React Testing Library konfigurieren; ein Smoke-Test der Toolchain
  - `types.ts` mit `PhaseType`, `TimerStatus`, `Settings`, `Session`, `TimerState` anlegen
  - Design Tokens (`styles/tokens.css`) und `global.css` mit Light/Dark-Variablen einrichten
  - _Anforderungen: 13.1, 13.3_

- [x] 2. Timer-Zustandsmaschine (reine Logik)
- [x] 2.1 Reducer und Übergänge implementieren
  - `timer/timerReducer.ts` mit allen Aktionen (START, PAUSE, RESUME, RESTART, CANCEL, SKIP, EXTEND, COMPLETE_EARLY, TICK, EXPIRE, ADVANCE, HYDRATE, RESET_CYCLE)
  - `endsAt`-Berechnung bei START/RESUME/EXTEND; `remainingMs`-Einfrieren bei PAUSE; Klemmen negativer Restzeit
  - Unit-Tests für alle Übergänge inkl. Pomodoro-Wertung (nur bei EXPIRE/COMPLETE_EARLY, nicht bei CANCEL/SKIP)
  - _Anforderungen: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.2, 2.4, 2.5_
- [x] 2.2 Zyklus-Logik implementieren
  - `timer/cycle.ts` mit `nextPhase(state, settings)`: 4× Fokus → lange Pause, kurze Pausen dazwischen, Reset nach langer Pause
  - Unit-Tests für vollständigen Zyklus und Zählerverhalten
  - _Anforderungen: 2.1, 2.2, 2.3_

- [x] 3. Einstellungen (Settings)
  - `settings/defaults.ts` mit Standardwerten; `settings/SettingsProvider.tsx` (Context) mit Laden/Speichern in localStorage
  - Grenz-Validierung (Fokus 5–120, Pausen 1–60) beim Speichern
  - `hooks/useTheme.ts`: Theme (system/light/dark) anwenden, auf `prefers-color-scheme` reagieren
  - Unit-Tests für Klemm-Logik und Theme-Auflösung
  - _Anforderungen: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2_

- [x] 4. Persistenz und Wiederherstellung
  - localStorage-Wrapper mit try/catch und In-Memory-Fallback
  - Hydration-Logik: Running mit abgelaufener `endsAt` → Completed; Paused bleibt Paused; Running mit Restzeit läuft weiter
  - Persistieren des Timerzustands bei relevanten Übergängen
  - Unit-Tests für Hydration-Fälle (Reload während Running/Paused, abgelaufen, kein Storage)
  - _Anforderungen: 7.1, 7.2, 7.3, 7.4, 7.5, 20.1_

- [x] 5. TimerProvider mit Ticker und Effekten
  - `timer/TimerProvider.tsx`: Reducer einbinden, Ticker (~250–500 ms) dispatcht TICK mit `Date.now()`
  - `visibilitychange`/`focus`-Listener für sofortige Neuberechnung nach Standby/Hintergrund
  - EXPIRE-Handling anstoßen; Session-Erfassung bei abgeschlossenem Fokus
  - Auto-Start-Verhalten gemäß Einstellungen (Standard aus)
  - _Anforderungen: 6.1, 6.2, 6.3, 6.4, 5.3, 5.5, 5.6, 20.2, 20.3_

- [x] 6. Statistik-Speicher und Aggregation
- [x] 6.1 IndexedDB-Zugriff
  - `stats/db.ts`: DB `pomodoro`, Store `sessions`, Index `byStartDate`; try/catch-Fallback
  - Session beim Fokus-Abschluss speichern (aus TimerProvider)
  - _Anforderungen: 11.1, 19.1, 19.2, 20.1_
- [x] 6.2 Aggregationen
  - `stats/aggregate.ts`: Heute (Pomodoros, Fokuszeit, Ø-Dauer, Pausen), Woche (Summen, Fokuszeit/Tag), Historie, Streak
  - `stats/StatsProvider.tsx` stellt Aggregationen bereit
  - Unit-Tests für Aggregationen und Streak über mehrere Tage
  - _Anforderungen: 11.2, 11.3, 11.4, 11.5_

- [x] 7. Services: Ton, Benachrichtigungen, Tab-Titel
- [x] 7.1 SoundService
  - `services/sound.ts`: Web Audio, AudioContext nach erster Nutzergeste; mehrere synthetische Töne; respektiert soundEnabled/volume
  - _Anforderungen: 9.1, 9.2, 9.3, 9.4_
- [x] 7.2 NotificationService
  - `services/notifications.ts`: verzögerte Berechtigungsanfrage (nach erstem Start), exakte Texte je Phasenende, Anzeige via Service Worker mit Fallback, stiller Umgang bei Verweigerung
  - _Anforderungen: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
- [x] 7.3 DocumentTitleService
  - `services/documentTitle.ts`: „MM:SS – Phase" bei Running, Abschluss-Hinweis bei Ablauf, Standardtitel sonst
  - _Anforderungen: 15.1, 15.2, 15.3_

- [x] 8. App-Shell, Navigation, Routing
  - `App.tsx`: Provider-Verschachtelung (Settings → Stats → Timer → Shell); HashRouter mit drei Views
  - `components/AppShell.tsx` + `components/Navigation.tsx`: Top/Side auf Desktop, Bottom auf Mobile; große Touch-Ziele
  - Responsive Media-Queries
  - _Anforderungen: 14.1, 14.2, 14.3, 14.4_

- [x] 9. Hauptansicht (TimerView) und Steuerung
- [x] 9.1 Anzeige-Komponenten
  - CountdownDisplay (MM:SS, dominant), ProgressRing (SVG), PhaseLabel (Text+Icon), CycleProgress („X von N" + Punkte), TodayProgress
  - Phase nicht nur über Farbe; ARIA-Texte
  - _Anforderungen: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
- [x] 9.2 Steuerungs-Komponenten
  - TimerControls (kontextabhängig je Zustand), ExtendMenu (+1/+5/+10), ConfirmDialog für Neustart und „Früher abschließen"
  - Ein-Klick-Start im Ready-Zustand; Übergangs-Buttons im Completed-Zustand
  - _Anforderungen: 1.1, 1.2, 1.3, 1.4, 4.4, 4.7, 4.8, 5.4_

- [x] 10. Fokusmodus
  - `components/FocusMode.tsx`: reduzierte Ansicht (Phase, Timer, Fortschritt, Pause/Start, Stoppen, Vollbild verlassen); Fullscreen API; Verlassen ohne Zustandsänderung
  - _Anforderungen: 10.1, 10.2, 10.3, 10.4_

- [x] 11. Tastatursteuerung
  - `hooks/useKeyboardShortcuts.ts`: Space, R, S, F, Esc; keine Auslösung in Eingabefeldern; sichtbare Fokuszustände sicherstellen
  - _Anforderungen: 16.1, 16.2, 16.3_

- [x] 12. Statistik-Ansicht (StatsView)
  - TodayStats, WeekStats mit eigenem SVG-Balkendiagramm, HistoryList, StreakBadge (dezent)
  - _Anforderungen: 11.2, 11.3, 11.4, 11.5_

- [x] 13. Einstellungs-Ansicht (SettingsView)
  - SettingsForm: Timer (mit Validierung), Automatischer Start, Ton, Benachrichtigungen, Darstellung; Datenschutz-Hinweis
  - _Anforderungen: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 19.3_

- [x] 14. PWA und Offline
  - `vite-plugin-pwa` konfigurieren (Manifest, Icons, autoUpdate, Precaching); Service Worker für Hintergrund-Benachrichtigungen
  - Offline-Funktion prüfen (Timer/Settings/Statistik ohne Netz)
  - _Anforderungen: 17.1, 17.2, 17.3_

- [x] 15. Accessibility- und Design-Feinschliff
  - ARIA-Rollen/Labels (role="timer", aria-live bei Phasenwechsel), Kontraste prüfen, große Touch-Ziele, zurückhaltende Animationen
  - Phaseninfo über Text/Icon zusätzlich zur Farbe verifizieren
  - _Anforderungen: 18.1, 18.2, 18.3, 18.4, 13.3, 13.4_

- [x] 16. Integration, Fehlerfälle und Verifikation
  - End-to-End-Durchlauf des Kern-User-Flows (Start → Ablauf → Pause → nächster Fokus)
  - Fehlerfälle prüfen: kein Storage, verweigerte Notifications, blockiertes Audio, Reload während Running/Paused, Standby, Systemzeit-Sprung
  - Build ausführen und Tests laufen lassen; gefundene Fehler beheben
  - _Anforderungen: 20.1, 20.2, 20.3, 5.1, 5.2, 7.2, 7.3, 7.4_
