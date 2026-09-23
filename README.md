# Pomodoro

Eine minimalistische, installierbare Pomodoro-Timer-App (PWA). Sie läuft vollständig
lokal im Browser – ohne Backend, ohne Konto, ohne Datenübertragung. Der Timerzustand
und die Einstellungen werden in `localStorage` gespeichert, die Session-Historie für
die Statistik in `IndexedDB`.

Technik: Vite + React + TypeScript, getestet mit Vitest.

---

## Voraussetzungen

Für die lokale Entwicklung wird nur Node.js benötigt (npm ist enthalten).

| Werkzeug | Empfohlene Version | Zweck |
|----------|--------------------|-------|
| Node.js  | 20 LTS oder neuer (mindestens 18) | Build- und Dev-Umgebung |
| npm      | 9 oder neuer (kommt mit Node)     | Paketverwaltung |
| Git      | aktuell (optional)                | Projekt klonen |

Hinweis: Vite 5 setzt Node **18+** voraus; Node **20 LTS** wird empfohlen.
Prüfe deine Versionen mit:

```bash
node -v
npm -v
```

Ein moderner Browser (Chrome, Edge, Firefox oder Safari) wird zum Ausführen der App
benötigt. Für PWA-Installation und Benachrichtigungen sind Chrome/Edge am
verlässlichsten.

---

## Installation unter Windows

### 1. Node.js installieren

Wähle eine der beiden Varianten:

**Variante A – Installer (am einfachsten)**

1. Öffne <https://nodejs.org> und lade den **LTS**-Installer (`.msi`) herunter.
2. Installer ausführen und den Schritten folgen (Standardeinstellungen genügen).
3. Ein **neues** Terminal öffnen (PowerShell oder Windows Terminal), damit die
   PATH-Änderungen wirksam sind.

**Variante B – über winget (Windows Paketmanager)**

```powershell
winget install OpenJS.NodeJS.LTS
```

Danach ein neues Terminal öffnen und die Installation prüfen:

```powershell
node -v
npm -v
```

### 2. Projekt beschaffen und Abhängigkeiten installieren

Falls du das Projekt per Git holst:

```powershell
git clone <REPO-URL> promodoro
cd promodoro
```

Oder wenn du den Projektordner bereits hast, einfach in ihn wechseln:

```powershell
cd Pfad\zu\promodoro
```

Abhängigkeiten installieren:

```powershell
npm install
```

### 3. App starten

```powershell
npm run dev
```

Vite zeigt eine lokale Adresse an (standardmäßig <http://localhost:5173>).
Diese im Browser öffnen.

---

## Installation unter macOS

### 1. Node.js installieren

Wähle eine der beiden Varianten:

**Variante A – Installer (am einfachsten)**

1. Öffne <https://nodejs.org> und lade den **LTS**-Installer (`.pkg`) herunter.
2. Installer ausführen und den Schritten folgen.
3. Ein **neues** Terminalfenster öffnen.

**Variante B – über Homebrew**

Falls [Homebrew](https://brew.sh) installiert ist:

```bash
brew install node
```

Installation prüfen:

```bash
node -v
npm -v
```

### 2. Projekt beschaffen und Abhängigkeiten installieren

Falls du das Projekt per Git holst:

```bash
git clone <REPO-URL> promodoro
cd promodoro
```

Oder in den vorhandenen Projektordner wechseln:

```bash
cd /Pfad/zu/promodoro
```

Abhängigkeiten installieren:

```bash
npm install
```

### 3. App starten

```bash
npm run dev
```

Die angezeigte Adresse (standardmäßig <http://localhost:5173>) im Browser öffnen.

---

## Verfügbare Befehle

Alle Befehle werden im Projektordner ausgeführt und funktionieren identisch unter
Windows und macOS:

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Startet den Entwicklungsserver mit Hot-Reload (Standard: Port 5173). |
| `npm run build` | Erstellt den optimierten Produktions-Build im Ordner `dist/` (inkl. Service Worker und Web-App-Manifest). |
| `npm run preview` | Startet einen lokalen Server, der den Produktions-Build aus `dist/` ausliefert. |
| `npm test` | Führt die gesamte Testsuite einmalig aus (Vitest). |
| `npm run test:watch` | Führt die Tests im Watch-Modus aus. |

### Produktions-Build lokal testen

Um die App als echte PWA (mit Offline-Cache über den Service Worker) zu testen:

```bash
npm run build
npm run preview
```

Danach die angezeigte Preview-Adresse im Browser öffnen. In Chrome/Edge kann die App
über das Installations-Symbol in der Adressleiste als eigenständige App installiert
werden.

---

## Als PWA installieren

1. `npm run build` und danach `npm run preview` ausführen (oder die App auf einem
   beliebigen statischen Host bereitstellen).
2. Die Seite in Chrome oder Edge öffnen.
3. Auf das Installations-Symbol in der Adressleiste klicken bzw. im Browsermenü
   „App installieren" wählen.

Nach der ersten Installation funktioniert die App dank Precaching auch offline.
Benachrichtigungen und Ton müssen bei der ersten Nutzung im Browser erlaubt werden.

---

## Fehlerbehebung

- **`node` oder `npm` wird nicht gefunden:** Terminal nach der Node-Installation neu
  öffnen. Unter Windows ggf. neu anmelden, damit die PATH-Änderung greift.
- **Port 5173 ist belegt:** Vite wählt automatisch den nächsten freien Port und zeigt
  die tatsächliche Adresse im Terminal an.
- **`npm install` schlägt fehl:** Sicherstellen, dass Node 18+ (empfohlen 20 LTS)
  installiert ist. Bei hartnäckigen Problemen den Ordner `node_modules` und die Datei
  `package-lock.json` löschen und `npm install` erneut ausführen.
- **Alte Node-Version:** Für parallele Node-Versionen eignet sich ein Versionsmanager
  wie [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows) oder
  [nvm](https://github.com/nvm-sh/nvm) (macOS).

---

## Datenschutz

Alle Fokusdaten werden ausschließlich lokal auf dem Gerät gespeichert. Es findet keine
Netzwerkübertragung von Nutzerdaten statt.
