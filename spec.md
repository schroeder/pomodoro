# Produktspezifikation – Pomodoro Web App

## 1. Produktübersicht

Die Anwendung ist eine webbasierte Pomodoro-App für Projektmanager und andere Wissensarbeiter, die ihre Arbeitszeit strukturieren und fokussierter arbeiten möchten.

Der Schwerpunkt liegt bewusst auf einem einfachen, zuverlässigen Fokus-Timer. Die Anwendung ist **keine Aufgaben- oder Projektmanagementsoftware**. Nutzer sollen ohne Vorbereitung unmittelbar eine Fokusphase starten können.

Die App basiert auf der klassischen Pomodoro-Methode:

**25 Minuten Fokus → 5 Minuten Pause**

Nach vier abgeschlossenen Fokusphasen folgt eine längere Pause von standardmäßig 15 Minuten.

Die Anwendung soll minimalistisch, professionell, ruhig und für den regelmäßigen Einsatz während eines Arbeitstages geeignet sein.

---

# 2. Produktziele

## Primäres Ziel

Nutzer dabei unterstützen, konzentrierter und strukturierter zu arbeiten.

## Sekundäre Ziele

Die Anwendung soll:

- den Einstieg in eine Fokusphase möglichst einfach machen
- Ablenkung durch unnötige Funktionen vermeiden
- den aktuellen Arbeitsrhythmus jederzeit verständlich darstellen
- Fokuszeiten dokumentieren
- Nutzer zuverlässig über Phasenwechsel informieren
- einen motivierenden Überblick über die persönliche Fokusleistung geben

---

# 3. Zielgruppe

Primäre Zielgruppe:

**Projektmanager und Wissensarbeiter**

Typische Nutzungssituationen:

- Vorbereitung von Präsentationen
- Konzeptarbeit
- Projektplanung
- Dokumentation
- Recherche
- E-Mail-Bearbeitung
- konzentriertes Abarbeiten administrativer Aufgaben
- Deep-Work-Phasen

Die Anwendung ist für Einzelpersonen gedacht.

Team-, Kollaborations- oder Projektmanagementfunktionen sind zunächst nicht Bestandteil des Produkts.

---

# 4. Plattform

Die Anwendung wird als responsive Web-Anwendung umgesetzt.

Unterstützte Geräte:

- Desktop
- Laptop
- Tablet
- Smartphone

Der primäre Anwendungsfall ist Desktop bzw. Laptop.

Unterstützte moderne Browser:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

Die Anwendung soll als Progressive Web App (PWA) ausgelegt werden können.

Dadurch kann sie optional auf Desktop oder Smartphone wie eine eigenständige App installiert werden.

---

# 5. Grundprinzip des Pomodoro-Zyklus

Standardzyklus:

1. Fokusphase – 25 Minuten
2. kurze Pause – 5 Minuten
3. Fokusphase – 25 Minuten
4. kurze Pause – 5 Minuten
5. Fokusphase – 25 Minuten
6. kurze Pause – 5 Minuten
7. Fokusphase – 25 Minuten
8. lange Pause – 15 Minuten

Danach beginnt der Zyklus erneut.

Ein Fokusblock zählt nur dann als abgeschlossener Pomodoro, wenn der Timer vollständig beendet wurde.

---

# 6. Hauptansicht

Die Hauptansicht soll sehr reduziert gestaltet sein.

Zentral angezeigt werden:

## Aktuelle Phase

Beispiele:

**FOKUS**

**KURZE PAUSE**

**LANGE PAUSE**

---

## Countdown

Sehr groß dargestellte verbleibende Zeit.

Beispiel:

**24:37**

Der Countdown ist das dominante UI-Element.

---

## Fortschrittsanzeige

Zusätzlich zum Countdown wird der Fortschritt visuell dargestellt.

Empfehlung:

kreisförmige Fortschrittsanzeige um den Timer.

Alternativ kann ein horizontaler Fortschrittsbalken verwendet werden.

---

## Pomodoro-Fortschritt

Anzeige:

**Pomodoro 2 von 4**

oder visuell beispielsweise:

● ● ○ ○

---

## Tagesfortschritt

Zusätzlich:

**Heute: 5 Pomodoros**

**Fokuszeit: 2h 05min**

---

# 7. Timer-Steuerung

Folgende Aktionen stehen zur Verfügung:

## Start

Startet die aktuelle Phase.

---

## Pause

Stoppt den Countdown temporär.

Der aktuelle Zeitstand bleibt erhalten.

---

## Fortsetzen

Setzt einen pausierten Timer fort.

---

## Neustart

Setzt die aktuelle Phase auf die ursprünglich konfigurierte Zeit zurück.

Beispiel:

12:37 verbleibend → Neustart → 25:00.

Vor dem Neustart sollte eine kurze Sicherheitsabfrage erscheinen.

---

## Abbrechen

Bricht die aktuelle Phase vollständig ab.

Eine abgebrochene Fokusphase zählt nicht als abgeschlossener Pomodoro.

---

## Überspringen

Beendet die aktuelle Phase und wechselt sofort zur nächsten Phase.

Beispiel:

Fokus → kurze Pause.

Oder:

Pause → nächste Fokusphase.

---

## Zeit verlängern

Nutzer können während einer laufenden Phase zusätzliche Zeit hinzufügen.

Empfohlene Auswahl:

+1 Minute  
+5 Minuten  
+10 Minuten

Optional kann zusätzlich eine individuelle Zeit eingegeben werden.

---

## Phase früher abschließen

Nutzer können eine Fokusphase manuell als abgeschlossen markieren.

Dabei wird abgefragt:

**„Fokusphase als abgeschlossen markieren?“**

Bei Bestätigung zählt sie als abgeschlossener Pomodoro.

---

# 8. Verhalten nach Ablauf einer Phase

Nach Ablauf des Timers:

1. Timer erreicht 00:00.
2. Ein Benachrichtigungston wird abgespielt.
3. Eine Browser-/Push-Notification erscheint.
4. Die nächste Phase wird vorbereitet.
5. Die nächste Phase startet nicht automatisch.

Der Nutzer startet sie bewusst über:

**Pause starten**

bzw.

**Fokus starten**

Diese Entscheidung verhindert, dass Pausen oder Fokuszeiten unbeabsichtigt im Hintergrund laufen.

---

# 9. Push Notifications

Die Anwendung verwendet Browser Push Notifications.

Beim ersten sinnvollen Zeitpunkt wird um die entsprechende Berechtigung gebeten.

Die Berechtigung sollte nicht direkt beim ersten Seitenaufruf angefragt werden.

Empfehlung:

Die Anfrage erfolgt nach dem ersten Start eines Pomodoros.

Beispiel:

**„Möchtest du benachrichtigt werden, wenn deine Fokuszeit endet?“**

---

## Benachrichtigungen

### Ende einer Fokusphase

Titel:

**Fokusphase abgeschlossen**

Text:

**Zeit für eine kurze Pause.**

---

### Ende einer kurzen Pause

Titel:

**Pause beendet**

Text:

**Bereit für die nächste Fokusphase?**

---

### Ende einer langen Pause

Titel:

**Lange Pause beendet**

Text:

**Starte deinen nächsten Fokuszyklus.**

---

# 10. Benachrichtigungen bei geschlossenem Browser

Wenn technisch und vom Betriebssystem unterstützt, sollen Push Notifications auch erscheinen, wenn die Web-App nicht aktiv im Vordergrund geöffnet ist.

Dafür kann eine PWA-/Service-Worker-Architektur verwendet werden.

Die Timerlogik darf nicht ausschließlich auf einem im Browser laufenden JavaScript-Intervall basieren.

Stattdessen wird beim Start einer Phase die erwartete Endzeit gespeichert.

Beispiel:

Start:

10:00:00

Endzeit:

10:25:00

Beim erneuten Öffnen oder Aktivieren der Anwendung wird die verbleibende Zeit anhand der tatsächlichen Uhrzeit berechnet.

Dadurch bleibt der Timer auch korrekt, wenn:

- der Browser-Tab im Hintergrund ist
- der Computer gesperrt wird
- der Browser Ressourcen reduziert
- das Gerät kurzzeitig in den Standby-Modus geht

---

# 11. Ton

Beim Ende einer Phase wird ein kurzer, angenehmer Signalton abgespielt.

Anforderungen:

- nicht aggressiv
- klar hörbar
- maximal wenige Sekunden
- unterschiedliche Töne für Fokus- und Pausenende sind optional

In den Einstellungen kann der Nutzer:

- Ton aktivieren/deaktivieren
- Lautstärke einstellen
- Signalton auswählen

---

# 12. Fokusmodus

Die Anwendung besitzt einen Fokusmodus.

Im Fokusmodus werden nur folgende Elemente angezeigt:

- Phase
- Timer
- Fortschritt
- Pause/Start
- Stoppen
- Vollbild verlassen

Navigation, Statistik und Einstellungen werden ausgeblendet.

Optional kann der Browser-Vollbildmodus aktiviert werden.

Ziel:

maximale visuelle Ruhe während einer Fokusphase.

---

# 13. Statistiken

Die Anwendung dokumentiert abgeschlossene Fokusphasen.

## Dashboard

Das Dashboard zeigt:

### Heute

- abgeschlossene Pomodoros
- gesamte Fokuszeit
- durchschnittliche Fokusdauer
- Anzahl Pausen

---

### Diese Woche

- Gesamtzahl Pomodoros
- gesamte Fokuszeit
- Fokuszeit pro Tag

Darstellung beispielsweise als Balkendiagramm.

---

### Historie

Darstellung der vergangenen Tage.

Beispiel:

Montag  
6 Pomodoros  
2h 30min

Dienstag  
8 Pomodoros  
3h 20min

Mittwoch  
4 Pomodoros  
1h 40min

---

# 14. Streak

Optional wird eine Fokus-Serie angezeigt.

Beispiel:

**🔥 5 Tage in Folge**

Ein Tag zählt für den Streak, sobald mindestens ein Pomodoro vollständig abgeschlossen wurde.

Der Streak ist eine motivierende Zusatzinformation, soll aber visuell nicht dominant sein.

---

# 15. Einstellungen

Die Anwendung besitzt eine zentrale Einstellungsseite.

## Timer

Standard:

Fokuszeit:  
25 Minuten

Kurze Pause:  
5 Minuten

Lange Pause:  
15 Minuten

Lange Pause nach:  
4 Fokusphasen

Alle Werte können verändert werden.

Empfohlene Grenzen:

Fokus:

5–120 Minuten

Pause:

1–60 Minuten

---

## Automatischer Start

Optionen:

**Pausen automatisch starten**

Standard: deaktiviert

**Fokusphasen automatisch starten**

Standard: deaktiviert

---

## Ton

Optionen:

- Ton aktivieren
- Signalton
- Lautstärke

---

## Benachrichtigungen

Optionen:

- Browser Notifications aktivieren
- Fokusende
- Pausenende

---

## Darstellung

Optionen:

- System
- Hell
- Dunkel

Standard:

**Systemeinstellung verwenden**

---

# 16. Dark Mode

Die Anwendung unterstützt:

- Light Mode
- Dark Mode
- automatische Systemeinstellung

Dark Mode eignet sich insbesondere für längere Fokusphasen und Arbeit am Abend.

---

# 17. Benutzerkonto

Für das MVP ist **kein Benutzerkonto notwendig**.

Die Anwendung funktioniert unmittelbar nach dem Aufruf.

Daten werden lokal im Browser gespeichert.

Beispiele:

- Einstellungen
- Statistik
- Timerzustand
- aktueller Pomodoro-Zyklus

Technisch beispielsweise über:

LocalStorage oder IndexedDB.

---

# 18. Spätere Erweiterung: Benutzerkonto

In einer späteren Version kann ein Benutzerkonto ergänzt werden.

Mögliche Login-Methoden:

- E-Mail
- Google
- Microsoft
- Apple

Vorteile:

- Synchronisierung zwischen Geräten
- Cloud-Backup
- langfristige Statistiken

Diese Funktionen sind nicht Teil des MVP.

---

# 19. Navigation

Empfohlene Hauptnavigation:

**Timer**

**Statistik**

**Einstellungen**

Mehr Navigation sollte das MVP nicht enthalten.

Auf mobilen Geräten kann eine Bottom Navigation verwendet werden.

---

# 20. Timerzustände

Der Timer kann folgende Zustände besitzen:

1. Ready
2. Running
3. Paused
4. Completed
5. Cancelled

Zusätzlich existieren die Phasentypen:

- Focus
- Short Break
- Long Break

---

# 21. Browser-Tab

Während eines laufenden Timers soll der Seitentitel die verbleibende Zeit anzeigen.

Beispiel:

**24:31 – Fokus**

Dadurch sieht der Nutzer den Timer auch dann, wenn ein anderer Browser-Tab geöffnet ist.

Nach Ablauf:

**Fokus beendet ✓**

---

# 22. Verhalten bei Neuladen der Seite

Ein Reload darf einen laufenden Timer nicht zurücksetzen.

Folgende Daten werden gespeichert:

- Timerstatus
- Startzeit
- geplante Endzeit
- aktuelle Phase
- aktuelle Pomodoro-Nummer
- angepasste Dauer

Beim Reload wird der Timerzustand rekonstruiert.

---

# 23. Verhalten bei Browser-Schließen

Wird der Browser geschlossen, läuft die geplante Zeit logisch weiter.

Beim erneuten Öffnen wird anhand der gespeicherten Endzeit geprüft, ob die Phase bereits beendet wurde.

Falls ja:

Status:

**Fokusphase abgeschlossen**

und der nächste Schritt wird angeboten.

---

# 24. Unterbrechungen

Wird eine Fokusphase pausiert, wird die verbleibende Zeit gespeichert.

Ein Browser-Reload während einer Pause darf die Phase nicht fortsetzen.

---

# 25. Responsive Design

Desktop:

Timer zentral im Fenster.

Navigation beispielsweise oben oder links.

Mobile:

Timer nimmt einen Großteil des sichtbaren Bereichs ein.

Buttons müssen für Touch-Bedienung optimiert sein.

---

# 26. Designprinzipien

Die Anwendung soll wirken:

- ruhig
- professionell
- minimalistisch
- modern
- fokussiert
- hochwertig

Keine:

- unnötigen Animationen
- Gamification-Überladung
- Werbung
- komplizierten Dashboards
- Projektmanagementfunktionen

---

# 27. Empfohlene Farben

Fokusphase:

dezente warme Akzentfarbe

Pause:

ruhige Grün- oder Blautöne

Die konkrete Farbgebung sollte barrierefrei sein und ausreichenden Kontrast bieten.

Die Phase darf nicht ausschließlich über Farbe kommuniziert werden.

---

# 28. Animationen

Animationen sollen sehr zurückhaltend eingesetzt werden.

Beispiele:

- sanfter Übergang zwischen Fokus und Pause
- animierter Fortschrittsring
- dezentes Pulsieren bei Timer-Ende

Keine auffälligen oder permanenten Animationen während der Fokusphase.

---

# 29. Accessibility

Die Anwendung sollte WCAG-orientiert umgesetzt werden.

Insbesondere:

- ausreichender Farbkontrast
- Tastaturbedienbarkeit
- sichtbare Fokuszustände
- Screenreader-Labels
- Phase nicht ausschließlich über Farben darstellen
- große Touch-Ziele

---

# 30. Tastatursteuerung

Empfohlene Shortcuts:

Space  
Start / Pause

R  
Restart

S  
Skip

F  
Focus Mode

Esc  
Focus Mode verlassen

Shortcuts dürfen nicht ausgelöst werden, wenn Nutzer gerade ein Eingabefeld verwenden.

---

# 31. Datenmodell

## Session

Eine gespeicherte Fokusphase enthält:

- ID
- Typ
- Startzeit
- Endzeit
- geplante Dauer
- tatsächliche Dauer
- Status
- abgeschlossen ja/nein

---

## Einstellungen

Enthalten beispielsweise:

- Fokusdauer
- Dauer kurze Pause
- Dauer lange Pause
- Fokusblöcke pro Zyklus
- automatische Pause
- automatischer Fokusstart
- Ton aktiviert
- Lautstärke
- Notifications
- Theme

---

# 32. Datenschutz

Da im MVP kein Benutzerkonto existiert, werden alle Daten lokal im Browser gespeichert.

Es werden keine persönlichen Produktivitätsdaten an einen Server übertragen.

Die App sollte transparent kommunizieren:

**„Deine Fokusdaten werden ausschließlich auf diesem Gerät gespeichert.“**

Bei Einführung einer Cloud-Synchronisierung muss das Datenschutzkonzept entsprechend erweitert werden.

---

# 33. Fehlerfälle

Die Anwendung muss insbesondere folgende Situationen sauber behandeln:

- Browser wird geschlossen
- Seite wird neu geladen
- Computer geht in Standby
- Internetverbindung fällt aus
- Notification-Berechtigung wird verweigert
- Audio darf vom Browser nicht automatisch abgespielt werden
- LocalStorage/IndexedDB ist nicht verfügbar
- Systemzeit ändert sich

Der Timer selbst soll möglichst unabhängig von einer aktiven Internetverbindung funktionieren.

---

# 34. Offline-Fähigkeit

Empfehlung:

Die App wird als PWA umgesetzt und kann nach dem ersten Laden weitgehend offline funktionieren.

Timer, Einstellungen und Statistiken funktionieren ohne Internetverbindung.

---

# 35. MVP

Die erste produktive Version enthält:

- Fokus-Timer
- kurze Pause
- lange Pause
- konfigurierbare Zeiten
- Start
- Pause
- Fortsetzen
- Abbrechen
- Neustart
- Überspringen
- Zeit verlängern
- Pomodoro-Zähler
- Fortschrittsanzeige
- Ton
- Browser Notifications
- Fokusmodus
- Dark Mode
- Tagesstatistik
- Wochenstatistik
- lokale Datenspeicherung
- Timer-Wiederherstellung nach Reload
- responsive Weboberfläche

---

# 36. Nicht Bestandteil des MVP

Folgende Funktionen werden bewusst zunächst nicht umgesetzt:

- Aufgabenverwaltung
- Projekte
- Teamfunktionen
- Kalenderintegration
- Zeiterfassung für Kunden
- Rechnungsstellung
- KI-Funktionen
- Chat
- Social Features
- Rankings
- komplexe Gamification
- Benutzerkonten
- Cloud-Synchronisierung

---

# 37. Mögliche spätere Erweiterungen

Nach erfolgreichem MVP könnten ergänzt werden:

- Benutzerkonto
- Gerätesynchronisation
- Google-/Microsoft-Login
- Kalenderintegration
- automatische Fokusblöcke im Kalender
- Desktop-App
- mobile Apps
- Widgets
- Browser Extension
- Fokusstatistiken über Monate
- persönliche Fokusziele
- individuelle Timer-Presets
- Ambient Sounds
- Spotify-/Musikintegration
- „Do Not Disturb“-Integration
- Microsoft Teams / Slack Status

---

# 38. Kern-User-Flow

## Erster Besuch

Nutzer öffnet die Website.

↓

Timer zeigt:

**25:00**

**Fokus starten**

↓

Nutzer klickt Start.

↓

Timer läuft.

↓

Nach dem ersten Start wird optional die Notification-Berechtigung erklärt und angefragt.

↓

Timer erreicht 00:00.

↓

Signalton.

↓

Push Notification:

**Fokusphase abgeschlossen**

↓

App zeigt:

**Gut gemacht. Zeit für eine 5-minütige Pause.**

Button:

**Pause starten**

↓

Pause läuft.

↓

Nach fünf Minuten:

Signalton + Notification.

↓

Button:

**Nächsten Fokus starten**

Nach vier Fokusphasen wird automatisch eine lange Pause angeboten.

---

# 39. UX-Leitprinzip

Die wichtigste Produktregel lautet:

**Ein Nutzer soll innerhalb von maximal einem Klick eine Fokusphase starten können.**

Die Anwendung darf den Nutzer niemals zwingen, vor einem Pomodoro:

- eine Aufgabe anzulegen
- ein Projekt auszuwählen
- sich anzumelden
- Einstellungen vorzunehmen

Der Timer ist immer der Mittelpunkt des Produkts.

---

# 40. Erfolgskriterium des MVP

Das Produkt ist erfolgreich umgesetzt, wenn ein Nutzer die Anwendung öffnen und ohne Erklärung:

1. einen Pomodoro starten,
2. die verbleibende Zeit jederzeit erkennen,
3. den Timer kontrollieren,
4. zuverlässig über das Ende informiert werden,
5. eine Pause starten,
6. nach mehreren Sessions seine Fokuszeit nachvollziehen kann.

Der gesamte Ablauf soll sich einfach, ruhig und zuverlässig anfühlen.