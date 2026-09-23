# Deployment auf Uberspace

Diese App ist eine rein statische PWA (kein Backend, kein Node-Prozess in Produktion).
Für das Deployment wird die App lokal gebaut und der Inhalt des `dist/`-Ordners in das
Web-Root des Uberspace hochgeladen. Apache liefert die Dateien direkt aus.

Die App wird unter einem Unterordner ausgeliefert: **`/pomodoro/`**
(z. B. `https://<user>.uber.space/pomodoro/`). Der Basis-Pfad ist in `vite.config.ts`
über die Umgebungsvariable `BASE_PATH` konfigurierbar.

> Routing-Hinweis: Die App nutzt einen HashRouter (`/#/stats` usw.). Deshalb sind auf
> dem Server KEINE URL-Rewrite-Regeln nötig – auch das Neuladen tiefer Ansichten
> funktioniert ohne zusätzliche Apache-Konfiguration.

---

## Voraussetzungen

- Ein Uberspace-Account mit SSH-Zugang (`<user>@<host>.uber.space`).
- Node.js 18+ (empfohlen 20 LTS) **lokal** auf deinem Rechner für den Build.
- `rsync` oder `scp` lokal (auf macOS/Linux vorhanden; unter Windows via WSL, Git Bash
  oder das mitgelieferte `scp`/`rsync`).

Es muss KEIN Node auf dem Uberspace installiert werden – dort wird nichts ausgeführt,
nur statische Dateien ausgeliefert.

---

## Schritt 1: Produktions-Build lokal erstellen

Standard (Unterordner `/pomodoro/`):

```bash
npm install
npm run build
```

Das Ergebnis liegt im Ordner `dist/`.

Falls du die App doch im Domain-Root ausliefern willst, mit angepasstem Basis-Pfad
bauen:

```bash
# Linux/macOS
BASE_PATH=/ npm run build

# Windows PowerShell
$env:BASE_PATH="/"; npm run build
```

---

## Schritt 2: Ziel-Ordner auf dem Uberspace

Das Web-Root eines Uberspace ist `~/html`. Für das Unterverzeichnis `/pomodoro/` legst
du dort einen Ordner `pomodoro` an. Per SSH:

```bash
ssh <user>@<host>.uber.space
mkdir -p ~/html/pomodoro
exit
```

Die App ist danach unter `https://<user>.uber.space/pomodoro/` erreichbar. Wenn du eine
eigene Domain auf den Uberspace zeigen lässt (siehe Uberspace-Doku „web domains"),
funktioniert `https://deine-domain.tld/pomodoro/` genauso.

---

## Schritt 3: Dateien hochladen

Vom lokalen Projektordner aus. Der Punkt-Slash `dist/` (mit abschließendem Slash) lädt
den **Inhalt** des Ordners, nicht den Ordner selbst.

Mit rsync (empfohlen – lädt nur Änderungen, räumt alte Dateien auf):

```bash
rsync -avz --delete dist/ <user>@<host>.uber.space:~/html/pomodoro/
```

Alternativ mit scp:

```bash
scp -r dist/* <user>@<host>.uber.space:~/html/pomodoro/
```

`--delete` bei rsync entfernt auf dem Server Dateien, die im neuen Build nicht mehr
vorkommen (z. B. alte, gehashte Asset-Namen) – das hält das Verzeichnis sauber.

---

## Schritt 4: Aufrufen und prüfen

Öffne `https://<user>.uber.space/pomodoro/` im Browser.

- Der Timer sollte sofort einsatzbereit sein (Ein-Klick-Start).
- In Chrome/Edge erscheint ein Installations-Symbol in der Adressleiste, um die App als
  PWA zu installieren.
- Nach dem ersten Laden funktioniert die App dank Service-Worker-Precaching auch
  offline.

HTTPS ist auf Uberspace standardmäßig aktiv (Let's Encrypt). Das ist wichtig, weil
Service Worker und Benachrichtigungen HTTPS voraussetzen.

---

## Aktualisieren (neue Version ausrollen)

1. Lokal neu bauen: `npm run build`
2. Erneut hochladen (Befehl aus Schritt 3).

Die App ist mit `registerType: 'autoUpdate'` konfiguriert: Der Service Worker lädt die
neue Version im Hintergrund und aktiviert sie beim nächsten Laden automatisch.

Wenn im Browser nach einem Update noch die alte Version erscheint, hilft ein Hard-Reload
(Strg/Cmd + Shift + R). In den DevTools unter „Application → Service Workers" lässt sich
der Worker bei Bedarf manuell zurücksetzen.

---

## Optionales Deploy-Skript

Ein kleines lokales Skript bündelt Build und Upload. Passe `USER`/`HOST` an:

```bash
#!/usr/bin/env bash
set -euo pipefail
USER="dein-user"
HOST="dein-host"      # z. B. "andromeda"
TARGET="~/html/pomodoro/"

npm run build
rsync -avz --delete dist/ "${USER}@${HOST}.uber.space:${TARGET}"
echo "Deploy fertig: https://${USER}.uber.space/pomodoro/"
```

Als `deploy.sh` speichern, `chmod +x deploy.sh`, dann `./deploy.sh` ausführen.

---

## Fehlerbehebung

- **Leere Seite / 404 auf JS/CSS:** Der Basis-Pfad passt nicht zum Ort. Für `/pomodoro/`
  ohne `BASE_PATH` bauen (das ist der Standard); für Root mit `BASE_PATH=/`. Nach einer
  Änderung neu bauen und hochladen.
- **App lädt unter der Domain-Wurzel statt im Unterordner:** Prüfen, dass die Dateien in
  `~/html/pomodoro/` (nicht direkt in `~/html/`) liegen.
- **Service Worker aktualisiert nicht:** Hard-Reload; ggf. Worker in den DevTools
  entfernen. `--delete` beim rsync stellt sicher, dass keine veralteten Assets
  zurückbleiben.
- **Benachrichtigungen funktionieren nicht:** Nur über HTTPS möglich und erst nach
  Erlaubnis im Browser. Auf Uberspace ist HTTPS standardmäßig verfügbar.
