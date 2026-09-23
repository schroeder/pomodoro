# Design – Pomodoro Web App

## Überblick

Die Pomodoro Web App ist eine clientseitige, installierbare PWA ohne Backend. Sie besteht aus drei Hauptbereichen (Timer, Statistik, Einstellungen) und einem Fokusmodus. Der Kern ist eine **timestamp-basierte Timer-Engine**, die die verbleibende Zeit stets aus der aktuellen Uhrzeit und einer gespeicherten Endzeit ableitet, statt ein Intervall herunterzuzählen. Dadurch bleibt der Timer korrekt über Tab-Wechsel, Standby, Sperrbildschirm und Reload hinweg.

Alle Daten werden lokal gehalten: kurzlebiger Timerzustand und Einstellungen in `localStorage`, die Session-Historie für Statistiken in `IndexedDB`. Es findet keine Netzwerkübertragung von Nutzerdaten statt.

### Technologie-Entscheidungen

| Bereich | Wahl | Begründung |
|---|---|---|
| Build/Framework | Vite + React + TypeScript | Schnelles Setup, typsicher, gute PWA-Integration, komponentenbasiert passend zu 3 Views + Fokusmodus |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, Service Worker, Precaching, Offline-Fähigkeit ohne Boilerplate |
| State | React Context + Reducer (kein Redux) | Timerlogik ist eine überschaubare Zustandsmaschine; Reducer macht Übergänge testbar |
| Styling | CSS mit Custom Properties (Design Tokens), CSS Modules pro Komponente | Minimalistisch, kein schweres UI-Framework; Theming (Light/Dark/System) über CSS-Variablen |
| Persistenz (Zustand/Settings) | `localStorage` | Klein, synchron, ideal für Timerzustand-Rekonstruktion beim Start |
| Persistenz (Statistik) | `IndexedDB` (via schlankem Wrapper `idb`) | Wächst über Zeit, strukturierte Abfragen nach Datum |
| Diagramme | Eigene, leichte SVG-Balken | Vermeidet schwere Chart-Libs; passt zum minimalistischen Anspruch |
| Zeitquelle | `Date.now()` + `performance`-unabhängig | Absolute Endzeit, robust gegen Drosselung |
| Tests | Vitest + React Testing Library | Einheitlich mit Vite; Reducer und Zeitlogik gut unit-testbar |

### Nicht-Ziele (aus spec.md §36)

Kein Backend, keine Accounts, keine Cloud-Sync, keine Aufgaben/Projekte. Diese beeinflussen die Architektur bewusst in Richtung „lokal zuerst".

---

## Architektur

### High-Level-Struktur

```
main.tsx
 └─ App
     ├─ SettingsProvider        (Einstellungen laden/speichern, Theme anwenden)
     ├─ StatsProvider           (IndexedDB-Zugriff, Aggregationen)
     ├─ TimerProvider           (Timer-Zustandsmaschine, Persistenz, Ticker)
     │   └─ Effekte: NotificationService, SoundService, DocumentTitle
     └─ AppShell
         ├─ Navigation (Top/Side auf Desktop, Bottom auf Mobile)
         └─ Router-Ausgabe
             ├─ TimerView   (Hauptansicht + Fokusmodus)
             ├─ StatsView
             └─ SettingsView
```

Routing über eine leichte Zustandsvariable oder `react-router` (Hash-basiert, damit es als statische PWA problemlos deployt). Wir verwenden `react-router-dom` mit `HashRouter` zur Einfachheit beim statischen Hosting.

### Datenfluss

```
Nutzeraktion / Tick / Sichtbarkeitswechsel
        │
        ▼
   TimerProvider (dispatch)
        │  reduce(state, action) -> neuer Zustand
        ▼
  ┌─────────────┬───────────────┬────────────────┐
  ▼             ▼               ▼                ▼
localStorage   DocumentTitle   Sound/Notify     UI (Views)
(persist)      (Tab-Titel)     (bei Ablauf)     (Render)
        │
        ▼ (bei abgeschlossenem Pomodoro/Session)
   StatsProvider -> IndexedDB
```

Der **Ticker** ist ein `setInterval` (~250–500 ms), aber nur zur *Neuberechnung der Anzeige* aus der Endzeit — nicht als Zeitquelle. Beim `visibilitychange`-Event wird sofort neu berechnet, damit Hintergrunddrosselung keine Rolle spielt.

---

## Kernkomponente: Timer-Engine (Zustandsmaschine)

### Zustände (spec.md §20)

`Ready | Running | Paused | Completed | Cancelled`

### Phasentypen

`Focus | ShortBreak | LongBreak`

### Zustandsobjekt

```ts
interface TimerState {
  phaseType: PhaseType;          // Focus | ShortBreak | LongBreak
  status: TimerStatus;           // Ready | Running | Paused | Completed | Cancelled
  plannedDurationMs: number;     // konfigurierte Dauer der aktuellen Phase (inkl. Verlängerungen)
  endsAt: number | null;         // absolute Endzeit (Date.now()-basiert), null wenn nicht Running
  remainingMs: number;           // bei Paused/Ready: erhaltene Restzeit; bei Running: abgeleitet
  startedAt: number | null;      // Startzeitpunkt der aktuellen Phase (für Session-Doku)
  completedFocusInCycle: number; // 0..focusPerCycle, zählt abgeschlossene Fokusphasen im aktuellen Zyklus
  pomodoroNumberInCycle: number; // 1-basierte Nummer der aktuellen/nächsten Fokusphase
  notificationPrompted: boolean; // ob Berechtigung bereits einmal angefragt wurde
}
```

### Aktionen (Reducer)

```ts
type TimerAction =
  | { type: 'START' }                       // Ready -> Running
  | { type: 'PAUSE' }                        // Running -> Paused (remainingMs einfrieren)
  | { type: 'RESUME' }                       // Paused -> Running (endsAt neu setzen)
  | { type: 'RESTART' }                      // -> Ready mit plannedDuration der Phase
  | { type: 'CANCEL' }                       // -> Cancelled (keine Pomodoro-Wertung)
  | { type: 'SKIP' }                         // aktuelle Phase beenden -> nächste vorbereiten
  | { type: 'EXTEND'; ms: number }           // endsAt/plannedDuration verlängern
  | { type: 'COMPLETE_EARLY' }               // Fokus manuell als abgeschlossen werten
  | { type: 'TICK'; now: number }            // Anzeige neu berechnen; ggf. -> Completed
  | { type: 'EXPIRE' }                       // Zeit abgelaufen -> Completed
  | { type: 'ADVANCE' }                      // Completed -> nächste Phase (Ready oder Running bei Auto-Start)
  | { type: 'HYDRATE'; state: TimerState }   // aus Persistenz wiederherstellen
  | { type: 'RESET_CYCLE' };                 // Zyklus zurücksetzen
```

### Zentrale Übergangsregeln

- **START/RESUME**: `endsAt = now + remainingMs`; `status = Running`.
- **PAUSE**: `remainingMs = max(0, endsAt - now)`; `endsAt = null`; `status = Paused`.
- **TICK/EXPIRE**: wenn `now >= endsAt` → `EXPIRE`. `EXPIRE` setzt `status = Completed`, löst Ton + Notification aus und – falls die Phase eine Fokusphase war – wertet sie als abgeschlossenen Pomodoro (Session speichern, `completedFocusInCycle++`).
- **COMPLETE_EARLY**: nur bei `Focus`; nach Bestätigung wie regulärer Fokus-Abschluss (Session mit tatsächlicher Dauer).
- **CANCEL**: `status = Cancelled`; keine Pomodoro-Wertung; danach kann die Phase neu gestartet werden (zurück zu Ready derselben Phase).
- **SKIP**: aktuelle Phase ohne Wertung beenden → nächste Phase bestimmen. Ein übersprungener **Fokus** zählt **nicht** als Pomodoro.
- **ADVANCE / Nächste Phase bestimmen** (Kernlogik des Zyklus):

```
nextPhase(state, settings):
  wenn aktuelle Phase == Focus (und als abgeschlossen gewertet):
     wenn completedFocusInCycle >= settings.focusPerCycle:  -> LongBreak
     sonst:                                                 -> ShortBreak
  wenn aktuelle Phase == ShortBreak:                        -> Focus (pomodoroNumberInCycle++)
  wenn aktuelle Phase == LongBreak:                         -> Focus, RESET_CYCLE (completedFocusInCycle=0, pomodoroNumberInCycle=1)
```

- **Auto-Start**: Nach `EXPIRE` wird die nächste Phase vorbereitet und bleibt `Ready`. Ist `settings.autoStartBreaks` bzw. `settings.autoStartFocus` aktiv, folgt automatisch ein `START` für die entsprechende Phasenart. Standard: kein Auto-Start (spec.md §8/§15).

### Timestamp-basierte Berechnung (Req 6)

`remainingMs` für die Anzeige = `Running ? max(0, endsAt - Date.now()) : remainingMs`.

Der Ticker ruft `dispatch({type:'TICK', now: Date.now()})` auf. Zusätzlich lauschen wir auf `visibilitychange` und `focus`, um bei Reaktivierung sofort zu ticken. Übersprungene Zeit (Standby) wird korrekt erfasst, weil nur `endsAt` zählt. Erkennt der Reducer beim Hydrieren, dass `endsAt` in der Vergangenheit liegt, wird direkt `EXPIRE` behandelt (verpasste Benachrichtigung wird als „bereits abgelaufen" dargestellt, siehe Req 7.4).

---

## Persistenz

### localStorage-Schlüssel

| Key | Inhalt |
|---|---|
| `pomodoro.settings.v1` | Serialisierte `Settings` |
| `pomodoro.timer.v1` | Serialisierter `TimerState` (persistenter Teil) |

**Hydration beim Start:**
1. Settings laden (Fallback auf Defaults).
2. Timerzustand laden. Wenn `status === Running` und `endsAt < now` → als `Completed` rekonstruieren und nächsten Schritt anbieten (Req 7.4). Wenn `Paused` → pausiert lassen (Req 7.3). Wenn `Running` und noch Zeit übrig → weiterlaufen lassen.
3. Wenn `localStorage` nicht verfügbar ist (Privatmodus/Quota) → In-Memory-Betrieb, Hinweis anzeigen (Req 7.5 / 20.1).

### IndexedDB (Statistik)

Datenbank `pomodoro`, Objectstore `sessions` (keyPath `id`), Index `byStartDate` auf einem `YYYY-MM-DD`-Feld für Tages-/Wochenabfragen.

```ts
interface Session {
  id: string;              // uuid
  type: PhaseType;         // in der Praxis Focus für Statistik, Pausen optional erfasst
  startedAt: number;       // epoch ms
  endedAt: number;         // epoch ms
  plannedDurationMs: number;
  actualDurationMs: number;
  status: 'completed' | 'cancelled';
  completed: boolean;
  dateKey: string;         // YYYY-MM-DD (lokal), für Index
}
```

Aggregationen (Heute/Woche/Historie/Streak) werden in `StatsProvider` aus den Sessions berechnet.

---

## Datenmodelle

### Settings (spec.md §15/§31)

```ts
interface Settings {
  focusMinutes: number;        // 5..120, default 25
  shortBreakMinutes: number;   // 1..60,  default 5
  longBreakMinutes: number;    // 1..60,  default 15
  focusPerCycle: number;       // default 4
  autoStartBreaks: boolean;    // default false
  autoStartFocus: boolean;     // default false
  soundEnabled: boolean;       // default true
  soundId: string;             // default 'soft'
  volume: number;              // 0..1, default 0.6
  notificationsEnabled: boolean;   // default false bis Berechtigung erteilt
  notifyFocusEnd: boolean;     // default true
  notifyBreakEnd: boolean;     // default true
  theme: 'system' | 'light' | 'dark'; // default 'system'
}
```

Eingabewerte werden beim Speichern auf die erlaubten Grenzen geklemmt (Req 12.2).

---

## Services

### SoundService (Req 9)

- Nutzt **Web Audio API**. Ein `AudioContext` wird erst nach der ersten Nutzerinteraktion (Start-Klick/Tastendruck) erzeugt bzw. `resume()`-t, um Autoplay-Blockaden zu umgehen (Req 9.3).
- Bietet mehrere kurze, dezente Signaltöne (z. B. `soft`, `chime`, `marimba`) — synthetisch generiert (Oszillator + kurze Hüllkurve), damit keine Audiodateien nötig sind und Offline funktioniert.
- `play(soundId, volume)` respektiert `soundEnabled` und `volume`.

### NotificationService (Req 8)

- Fragt Berechtigung **nicht** beim Laden, sondern nach dem ersten Start (`notificationPrompted`) über einen erklärenden In-App-Dialog, gefolgt von `Notification.requestPermission()` (Req 8.1/8.2).
- Zeigt Benachrichtigungen bei Phasenende mit den exakten Texten aus spec.md §9 (Req 8.3–8.5).
- Bevorzugt Anzeige über den **Service Worker** (`registration.showNotification`), damit sie auch bei nicht fokussierter App erscheint (Req 8.6). Fällt auf die `Notification`-API zurück.
- Bei verweigerter Berechtigung: still, App nutzt nur In-App-Hinweis + Ton (Req 8.7).

### DocumentTitleService (Req 15)

- Setzt `document.title` bei laufendem Timer auf `MM:SS – <Phase>`, bei Ablauf auf z. B. `Fokus beendet ✓`, sonst auf den App-Standardtitel.

---

## UI-Komponenten

### AppShell & Navigation (Req 14)

- Desktop/Laptop: Navigation oben (oder seitlich), Timer zentriert.
- Mobile: Bottom Navigation mit drei Zielen (Timer, Statistik, Einstellungen), großzügige Touch-Ziele.
- Responsiv über CSS-Media-Queries; Breakpoint z. B. 768px.

### TimerView / Hauptansicht (Req 3, 4, 5)

- **PhaseLabel**: Textlabel der Phase (nicht nur Farbe), mit Icon.
- **CountdownDisplay**: großes MM:SS, dominantes Element.
- **ProgressRing**: SVG-Kreis, `stroke-dashoffset` proportional zum Fortschritt; dezent animiert.
- **CycleProgress**: „Pomodoro X von N" + Punkte (● ● ○ ○) mit ARIA-Text.
- **TodayProgress**: „Heute: n Pomodoros" + „Fokuszeit: Xh Ymin".
- **TimerControls**: kontextabhängige Buttons je Zustand:
  - Ready: Start; (Neustart deaktiviert/aus)
  - Running: Pause, Verlängern (+1/+5/+10, Menü), Abbrechen, Neustart, Überspringen, „Früher abschließen" (nur Focus)
  - Paused: Fortsetzen, Neustart, Abbrechen, Überspringen
  - Completed: „Pause starten" / „Fokus starten" (nächste Phase), ggf. Auto-Start
- **Bestätigungsdialoge**: für Neustart (Req 4.4) und „Früher abschließen" (Req 4.8).

### FokusModus (Req 10)

- Boolescher UI-Zustand (kein Routing). Blendet Navigation/Statistik/Einstellungen aus, zeigt nur Phase, Timer, Fortschritt, Pause/Start, Stoppen, „Vollbild verlassen".
- Optionaler Browser-Vollbildmodus via Fullscreen API.
- Verlassen per Esc oder Button, ohne Timerzustand zu ändern.

### StatsView (Req 11)

- **TodayStats**: abgeschlossene Pomodoros, gesamte Fokuszeit, Ø Fokusdauer, Anzahl Pausen.
- **WeekStats**: Gesamtpomodoros, gesamte Fokuszeit, Balkendiagramm Fokuszeit pro Tag (eigenes SVG).
- **HistoryList**: vergangene Tage mit Pomodoros und Fokuszeit.
- **StreakBadge**: „🔥 N Tage in Folge", dezent platziert.

### SettingsView (Req 12, 13, 19)

- Formularabschnitte: Timer (mit Grenz-Validierung), Automatischer Start, Ton, Benachrichtigungen, Darstellung.
- Datenschutz-Hinweis: „Deine Fokusdaten werden ausschließlich auf diesem Gerät gespeichert."

### Theming (Req 13)

- CSS Custom Properties in `:root` (Light) und `[data-theme="dark"]`. `system` liest `prefers-color-scheme` und aktualisiert bei Änderung.
- Farbrollen: neutrale Fläche/Text; Akzent Fokus = dezente warme Farbe; Akzent Pause = ruhige Grün-/Blautöne. Alle mit ausreichendem Kontrast; Phase zusätzlich über Text/Icon.

---

## Tastatursteuerung (Req 16)

Ein globaler `keydown`-Listener (in TimerView aktiv), der ignoriert wird, wenn das Ziel ein Eingabeelement ist (`input`, `textarea`, `select`, `[contenteditable]`).

| Taste | Aktion |
|---|---|
| Space | Start/Pause (kontextabhängig) |
| R | Neustart (mit Bestätigung) |
| S | Überspringen |
| F | Fokusmodus an |
| Esc | Fokusmodus aus / Vollbild verlassen |

---

## PWA & Offline (Req 17)

- `vite-plugin-pwa` mit `registerType: 'autoUpdate'`, Manifest (Name, Icons, `display: standalone`, Theme-Color je Modus, Startseite).
- Workbox-Precaching aller App-Assets → App startet und läuft offline (Req 17.2).
- Service Worker stellt zusätzlich `showNotification` für Hintergrund-Benachrichtigungen bereit.
- Da keine Serverdaten nötig sind, ist die App nach erstem Laden vollständig offline nutzbar (Req 17.3, 20.3).

---

## Fehlerbehandlung (Req 20)

| Fall | Verhalten |
|---|---|
| Kein localStorage/IndexedDB | Try/catch um alle Zugriffe; In-Memory-Fallback; einmaliger Hinweis; App bleibt bedienbar |
| Notification verweigert/nicht unterstützt | Kein Fehler; nur In-App-Hinweis + Ton |
| Audio-Autoplay blockiert | AudioContext erst nach Nutzergeste; bei Fehler still ignorieren |
| Reload während Running/Paused | Hydration rekonstruiert Zustand korrekt (Req 7.2/7.3) |
| Standby/Hintergrund | Timestamp-basierte Neuberechnung bei `visibilitychange` |
| Systemzeit springt | Bewertung immer über `endsAt`; wenn `now` jenseits `endsAt` → als abgelaufen behandeln; negative Restzeit auf 0 klemmen (Req 20.2) |
| Offline | Keine Netzwerkabhängigkeit im Timer |

---

## Accessibility (Req 18)

- Semantische Elemente und Labels; alle Controls per Tastatur erreichbar mit sichtbarem Fokus-Ring.
- Timer-Region als `role="timer"` mit `aria-label`; Phasenwechsel über eine `aria-live="polite"` Region angekündigt (nicht sekündlich, sondern bei Phasen-/Statuswechsel).
- Kontraste gemäß WCAG AA; Phaseninfo über Text + Icon, nicht nur Farbe.
- Große Touch-Ziele (mind. 44×44 px) auf Mobile.

> Hinweis: Vollständige WCAG-Konformität erfordert manuelles Testen mit assistiven Technologien und Experten-Review; das Design zielt auf WCAG-Orientierung ab.

---

## Projektstruktur

```
promodoro/
├─ index.html
├─ package.json
├─ vite.config.ts            (inkl. vite-plugin-pwa)
├─ tsconfig.json
├─ public/
│   └─ icons/                (PWA-Icons)
└─ src/
    ├─ main.tsx
    ├─ App.tsx
    ├─ types.ts              (PhaseType, TimerStatus, Session, Settings)
    ├─ timer/
    │   ├─ timerReducer.ts   (reine Zustandsmaschine – unit-testbar)
    │   ├─ TimerProvider.tsx (Ticker, Persistenz, Effekte)
    │   └─ cycle.ts          (nextPhase-Logik)
    ├─ settings/
    │   ├─ SettingsProvider.tsx
    │   └─ defaults.ts
    ├─ stats/
    │   ├─ db.ts             (IndexedDB-Wrapper)
    │   ├─ StatsProvider.tsx
    │   └─ aggregate.ts      (Heute/Woche/Historie/Streak – unit-testbar)
    ├─ services/
    │   ├─ sound.ts
    │   ├─ notifications.ts
    │   └─ documentTitle.ts
    ├─ components/
    │   ├─ AppShell.tsx
    │   ├─ Navigation.tsx
    │   ├─ timer/ (CountdownDisplay, ProgressRing, CycleProgress, TimerControls, TodayProgress, ExtendMenu, ConfirmDialog)
    │   ├─ FocusMode.tsx
    │   ├─ stats/ (TodayStats, WeekStats, WeekBarChart, HistoryList, StreakBadge)
    │   └─ settings/ (SettingsForm, ...)
    ├─ views/
    │   ├─ TimerView.tsx
    │   ├─ StatsView.tsx
    │   └─ SettingsView.tsx
    ├─ hooks/
    │   ├─ useKeyboardShortcuts.ts
    │   └─ useTheme.ts
    └─ styles/
        ├─ tokens.css        (Design Tokens, Light/Dark)
        └─ global.css
```

---

## Teststrategie

Fokus auf die risikoreichen, reinen Logikteile (kein erzwungenes Test-Coverage-Ziel):

- **timerReducer**: alle Übergänge (START/PAUSE/RESUME/RESTART/CANCEL/SKIP/EXTEND/COMPLETE_EARLY/EXPIRE/ADVANCE); Pomodoro-Wertung nur bei Ablauf/COMPLETE_EARLY, nicht bei CANCEL/SKIP.
- **cycle.nextPhase**: 4× Fokus → lange Pause; kurze Pausen dazwischen; Reset nach langer Pause.
- **Zeitlogik**: `endsAt`-Berechnung bei Start/Resume/Extend; Ablauf, wenn `now >= endsAt`; Klemmen negativer Restzeit.
- **Hydration**: Running mit `endsAt` in Vergangenheit → Completed; Paused bleibt Paused.
- **aggregate**: Heute/Woche-Summen, Ø-Dauer, Streak-Berechnung über mehrere Tage.

Tools: Vitest + React Testing Library. Zeit wird über injizierbaren `now`-Parameter deterministisch getestet.

---

## Abbildung Requirements → Design

| Requirement | Adressiert durch |
|---|---|
| 1 Ein-Klick-Start | TimerView Ready-Zustand, Default-Settings, HashRouter Startseite |
| 2 Zyklus | `cycle.nextPhase`, `completedFocusInCycle`, RESET_CYCLE |
| 3 Hauptansicht | CountdownDisplay, ProgressRing, CycleProgress, TodayProgress |
| 4 Steuerung | TimerControls + Reducer-Aktionen + ConfirmDialog/ExtendMenu |
| 5 Nach Ablauf | EXPIRE-Handling, Sound/Notification, Auto-Start-Optionen |
| 6 Timestamp-Timer | `endsAt`, Ticker, `visibilitychange`, Klemmen |
| 7 Persistenz | localStorage-Hydration, Reload-/Close-Regeln |
| 8 Notifications | NotificationService, SW-Anzeige, verzögerte Berechtigung |
| 9 Ton | SoundService (Web Audio), Einstellungen |
| 10 Fokusmodus | FocusMode + Fullscreen API |
| 11 Statistik | StatsProvider, aggregate, StatsView, StreakBadge |
| 12 Einstellungen | SettingsProvider, SettingsForm, Grenz-Validierung |
| 13 Design/Dark | tokens.css, useTheme, prefers-color-scheme |
| 14 Navigation/Responsive | AppShell, Navigation, Media-Queries |
| 15 Tab-Titel | DocumentTitleService |
| 16 Tastatur | useKeyboardShortcuts |
| 17 PWA/Offline | vite-plugin-pwa, Manifest, SW-Precaching |
| 18 Accessibility | ARIA-Rollen/Labels, Fokus-Ringe, Kontraste |
| 19 Datenschutz | Nur lokale Speicher, Hinweistext |
| 20 Fehlerfälle | Try/catch-Fallbacks, `endsAt`-basierte Robustheit |
