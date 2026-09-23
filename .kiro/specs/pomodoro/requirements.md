# Anforderungen – Pomodoro Web App

## Einleitung

Die Pomodoro Web App ist eine minimalistische, PWA-fähige Webanwendung für Wissensarbeiter und Projektmanager. Der Kern ist ein zuverlässiger Fokus-Timer nach der Pomodoro-Methode (Standard: 25 min Fokus, 5 min kurze Pause, 15 min lange Pause nach 4 Fokusphasen). Die App arbeitet ohne Benutzerkonto, speichert alle Daten lokal im Browser und funktioniert weitgehend offline. Leitprinzip: Ein Nutzer soll mit maximal einem Klick eine Fokusphase starten können.

Dieses Dokument leitet sich aus `spec.md` ab und formuliert die Anforderungen testbar. Der Umfang entspricht dem MVP (spec.md §35); ausgeschlossene Funktionen (§36) sind nicht Teil dieser Anforderungen.

## Glossar

- **Phase**: Ein Zeitabschnitt eines der Typen Fokus, kurze Pause oder lange Pause.
- **Pomodoro**: Eine vollständig abgeschlossene Fokusphase.
- **Zyklus**: Eine Abfolge von N Fokusphasen (Standard 4), abgeschlossen durch eine lange Pause.
- **Timerzustand**: Ready, Running, Paused, Completed oder Cancelled.
- **Endzeit (timestamp-basiert)**: Der beim Start berechnete absolute Zeitpunkt, an dem die Phase endet.

---

## Requirement 1 – Fokusphase mit einem Klick starten

**User Story:** Als Nutzer möchte ich sofort nach dem Öffnen der App eine Fokusphase starten können, damit ich ohne Vorbereitung mit konzentriertem Arbeiten beginnen kann.

#### Akzeptanzkriterien

1. WENN die App erstmals geöffnet wird DANN SOLL das System einen Fokus-Timer im Zustand Ready mit der konfigurierten Fokusdauer (Standard 25:00) und einer Schaltfläche „Fokus starten" anzeigen.
2. WENN der Nutzer „Fokus starten" auslöst DANN SOLL das System die Phase in den Zustand Running versetzen und den Countdown beginnen.
3. Das System SOLL vor dem Start einer Fokusphase KEINE Aufgabe, KEIN Projekt, KEINE Anmeldung und KEINE Einstellung erzwingen.
4. WENN die App geladen wird UND kein persistierter Timerzustand existiert DANN SOLL der Start einer Fokusphase mit genau einer Interaktion (einem Klick oder einem Tastendruck) erreichbar sein.

---

## Requirement 2 – Pomodoro-Zyklus

**User Story:** Als Nutzer möchte ich, dass die App den klassischen Pomodoro-Zyklus einhält, damit sich Fokus und Pausen im richtigen Rhythmus abwechseln.

#### Akzeptanzkriterien

1. Das System SOLL Phasen in der Reihenfolge Fokus → kurze Pause abwechseln.
2. WENN die konfigurierte Anzahl an Fokusphasen pro Zyklus (Standard 4) erreicht ist DANN SOLL nach der vierten Fokusphase eine lange Pause statt einer kurzen Pause folgen.
3. WENN eine lange Pause abgeschlossen ist DANN SOLL der Zyklus erneut mit einer Fokusphase beginnen und der Pomodoro-Zähler des Zyklus zurückgesetzt werden.
4. Eine Fokusphase SOLL nur dann als abgeschlossener Pomodoro gezählt werden, WENN der Timer vollständig abgelaufen ist ODER der Nutzer sie explizit als abgeschlossen markiert hat.
5. WENN eine Fokusphase abgebrochen wird DANN SOLL sie NICHT als abgeschlossener Pomodoro gezählt werden.

---

## Requirement 3 – Hauptansicht und Fortschrittsdarstellung

**User Story:** Als Nutzer möchte ich jederzeit klar erkennen, in welcher Phase ich bin und wie viel Zeit verbleibt, damit ich meinen Arbeitsrhythmus verstehe.

#### Akzeptanzkriterien

1. Das System SOLL die aktuelle Phase textlich anzeigen (z. B. „FOKUS", „KURZE PAUSE", „LANGE PAUSE").
2. Das System SOLL die verbleibende Zeit als dominantes Element im Format MM:SS anzeigen.
3. Das System SOLL den Fortschritt der laufenden Phase visuell darstellen (empfohlen: kreisförmiger Fortschrittsring um den Timer).
4. Das System SOLL den Pomodoro-Fortschritt im Zyklus anzeigen (z. B. „Pomodoro 2 von 4" sowie eine visuelle Punktanzeige).
5. Das System SOLL den Tagesfortschritt anzeigen (Anzahl heute abgeschlossener Pomodoros und heutige gesamte Fokuszeit).
6. Das System SOLL die aktuelle Phase NICHT ausschließlich über Farbe kommunizieren, sondern zusätzlich über Text und/oder Symbole.

---

## Requirement 4 – Timer-Steuerung

**User Story:** Als Nutzer möchte ich den Timer vollständig steuern können, damit ich flexibel auf Unterbrechungen und Situationen reagieren kann.

#### Akzeptanzkriterien

1. WENN eine Phase im Zustand Ready ist UND der Nutzer Start auslöst DANN SOLL das System in Running wechseln.
2. WENN eine Phase Running ist UND der Nutzer Pause auslöst DANN SOLL das System in Paused wechseln UND die verbleibende Zeit erhalten.
3. WENN eine Phase Paused ist UND der Nutzer Fortsetzen auslöst DANN SOLL das System in Running wechseln UND von der erhaltenen verbleibenden Zeit fortfahren.
4. WENN der Nutzer Neustart auslöst DANN SOLL das System eine Sicherheitsabfrage anzeigen UND bei Bestätigung die aktuelle Phase auf ihre konfigurierte Dauer zurücksetzen.
5. WENN der Nutzer Abbrechen auslöst DANN SOLL das System die aktuelle Phase in den Zustand Cancelled versetzen UND sie nicht als Pomodoro werten.
6. WENN der Nutzer Überspringen auslöst DANN SOLL das System die aktuelle Phase beenden UND unmittelbar die nächste Phase vorbereiten.
7. WENN der Nutzer Zeit verlängern auslöst DANN SOLL das System Optionen +1, +5 und +10 Minuten anbieten UND die geplante Endzeit entsprechend verlängern.
8. WENN der Nutzer während einer Fokusphase „Phase früher abschließen" auslöst DANN SOLL das System die Abfrage „Fokusphase als abgeschlossen markieren?" anzeigen UND bei Bestätigung die Phase als abgeschlossenen Pomodoro werten.

---

## Requirement 5 – Verhalten nach Ablauf einer Phase

**User Story:** Als Nutzer möchte ich zuverlässig über das Ende einer Phase informiert werden und bewusst die nächste starten, damit weder Fokus noch Pause unbeabsichtigt im Hintergrund laufen.

#### Akzeptanzkriterien

1. WENN der Countdown 00:00 erreicht DANN SOLL das System einen Signalton abspielen (sofern aktiviert und vom Browser erlaubt).
2. WENN der Countdown 00:00 erreicht DANN SOLL das System eine Browser-Benachrichtigung anzeigen (sofern die Berechtigung erteilt wurde).
3. WENN eine Phase abgelaufen ist DANN SOLL das System die nächste Phase vorbereiten, sie aber NICHT automatisch starten (sofern der automatische Start nicht in den Einstellungen aktiviert ist).
4. WENN eine Phase abgelaufen ist DANN SOLL das System eine Schaltfläche zum bewussten Start der nächsten Phase anzeigen (z. B. „Pause starten" bzw. „Fokus starten").
5. WENN „Pausen automatisch starten" aktiviert ist DANN SOLL nach einer Fokusphase die Pause automatisch starten.
6. WENN „Fokusphasen automatisch starten" aktiviert ist DANN SOLL nach einer Pause die nächste Fokusphase automatisch starten.

---

## Requirement 6 – Zuverlässige, timestamp-basierte Zeitmessung

**User Story:** Als Nutzer möchte ich, dass der Timer korrekt bleibt, auch wenn der Tab im Hintergrund ist oder das Gerät im Standby war, damit ich mich auf die Zeit verlassen kann.

#### Akzeptanzkriterien

1. WENN eine Phase gestartet wird DANN SOLL das System die geplante Endzeit als absoluten Zeitstempel speichern.
2. Das System SOLL die verbleibende Zeit aus der tatsächlichen aktuellen Uhrzeit und der gespeicherten Endzeit berechnen und NICHT ausschließlich durch Herunterzählen eines JavaScript-Intervalls.
3. WENN die App nach Hintergrund, Sperrbildschirm, Standby oder Ressourcendrosselung wieder aktiviert wird DANN SOLL das System die verbleibende Zeit korrekt aus der Endzeit neu berechnen.
4. WENN sich die aktuelle Uhrzeit beim Reaktivieren als nach der Endzeit liegend erweist DANN SOLL das System die Phase als abgelaufen behandeln.

---

## Requirement 7 – Persistenz und Wiederherstellung

**User Story:** Als Nutzer möchte ich, dass ein laufender Timer ein Neuladen oder Schließen des Browsers übersteht, damit ich meine Fokusphase nicht verliere.

#### Akzeptanzkriterien

1. Das System SOLL Timerstatus, Startzeit, geplante Endzeit, aktuelle Phase, aktuelle Pomodoro-Nummer und angepasste Dauer lokal persistieren.
2. WENN die Seite neu geladen wird UND ein laufender Timer existierte DANN SOLL das System den Timerzustand rekonstruieren, ohne ihn zurückzusetzen.
3. WENN die Seite während einer pausierten Phase neu geladen wird DANN SOLL das System die Phase pausiert lassen UND nicht automatisch fortsetzen.
4. WENN der Browser geschlossen und später wieder geöffnet wird UND die gespeicherte Endzeit bereits verstrichen ist DANN SOLL das System die Phase als abgeschlossen anzeigen und den nächsten Schritt anbieten.
5. WENN kein LocalStorage/IndexedDB verfügbar ist DANN SOLL die App weiterhin bedienbar bleiben (in-memory) UND dies angemessen behandeln, ohne abzustürzen.

---

## Requirement 8 – Benachrichtigungen (Push/Browser)

**User Story:** Als Nutzer möchte ich über Phasenwechsel benachrichtigt werden, auch wenn die App nicht im Vordergrund ist, damit ich Pausen und Fokusphasen nicht verpasse.

#### Akzeptanzkriterien

1. Das System SOLL die Benachrichtigungsberechtigung NICHT beim ersten Seitenaufruf anfragen.
2. WENN der Nutzer erstmals einen Pomodoro gestartet hat DANN SOLL das System zum passenden Zeitpunkt erklären und um die Benachrichtigungsberechtigung bitten.
3. WENN eine Fokusphase endet DANN SOLL die Benachrichtigung den Titel „Fokusphase abgeschlossen" und den Text „Zeit für eine kurze Pause." enthalten.
4. WENN eine kurze Pause endet DANN SOLL die Benachrichtigung den Titel „Pause beendet" und den Text „Bereit für die nächste Fokusphase?" enthalten.
5. WENN eine lange Pause endet DANN SOLL die Benachrichtigung den Titel „Lange Pause beendet" und den Text „Starte deinen nächsten Fokuszyklus." enthalten.
6. WENN es technisch und vom Betriebssystem unterstützt wird DANN SOLL das System Benachrichtigungen auch anzeigen, wenn die App nicht im Vordergrund ist (via Service Worker).
7. WENN die Benachrichtigungsberechtigung verweigert wird DANN SOLL die App weiterhin funktionieren und ausschließlich In-App-Hinweise sowie Ton (falls aktiv) nutzen.

---

## Requirement 9 – Ton

**User Story:** Als Nutzer möchte ich am Ende einer Phase einen angenehmen Signalton hören, damit ich das Ende auch ohne Blick auf den Bildschirm bemerke.

#### Akzeptanzkriterien

1. WENN eine Phase endet UND Ton aktiviert ist DANN SOLL das System einen kurzen, nicht aggressiven Signalton von wenigen Sekunden abspielen.
2. Das System SOLL in den Einstellungen erlauben, Ton zu aktivieren/deaktivieren, die Lautstärke einzustellen und einen Signalton auszuwählen.
3. WENN der Browser automatisches Abspielen von Audio blockiert DANN SOLL das System dies behandeln, ohne zu fehlerhaften Zuständen zu führen (z. B. Audio-Kontext nach erster Nutzerinteraktion aktivieren).
4. Unterschiedliche Töne für Fokus- und Pausenende SIND optional.

---

## Requirement 10 – Fokusmodus

**User Story:** Als Nutzer möchte ich einen ablenkungsfreien Fokusmodus, damit ich während einer Fokusphase maximale visuelle Ruhe habe.

#### Akzeptanzkriterien

1. WENN der Fokusmodus aktiv ist DANN SOLL das System nur Phase, Timer, Fortschritt, Pause/Start, Stoppen und „Vollbild verlassen" anzeigen.
2. WENN der Fokusmodus aktiv ist DANN SOLL das System Navigation, Statistik und Einstellungen ausblenden.
3. Das System SOLL optional den Browser-Vollbildmodus aktivieren können.
4. WENN der Nutzer den Fokusmodus verlässt DANN SOLL das System zur normalen Ansicht zurückkehren, ohne den Timerzustand zu verändern.

---

## Requirement 11 – Statistiken und Dashboard

**User Story:** Als Nutzer möchte ich meine Fokusleistung nachvollziehen, damit ich meinen Fortschritt sehe und motiviert bleibe.

#### Akzeptanzkriterien

1. Das System SOLL jede abgeschlossene Fokusphase als Session mit ihren Daten dokumentieren.
2. Das System SOLL für „Heute" abgeschlossene Pomodoros, gesamte Fokuszeit, durchschnittliche Fokusdauer und Anzahl Pausen anzeigen.
3. Das System SOLL für „Diese Woche" Gesamtzahl Pomodoros, gesamte Fokuszeit und Fokuszeit pro Tag anzeigen (Darstellung z. B. als Balkendiagramm).
4. Das System SOLL eine Historie vergangener Tage mit Anzahl Pomodoros und Fokuszeit pro Tag anzeigen.
5. Das System SOLL optional eine Fokus-Serie (Streak) anzeigen, wobei ein Tag zählt, sobald mindestens ein Pomodoro vollständig abgeschlossen wurde; die Anzeige SOLL visuell nicht dominant sein.

---

## Requirement 12 – Einstellungen

**User Story:** Als Nutzer möchte ich Timerzeiten und Verhalten anpassen, damit die App zu meinem Arbeitsstil passt.

#### Akzeptanzkriterien

1. Das System SOLL konfigurierbar machen: Fokuszeit, kurze Pause, lange Pause und Anzahl Fokusphasen bis zur langen Pause.
2. Das System SOLL Fokuszeiten auf 5–120 Minuten und Pausen auf 1–60 Minuten begrenzen.
3. Das System SOLL Optionen für automatischen Start von Pausen und Fokusphasen anbieten (Standard: beide deaktiviert).
4. Das System SOLL Ton-Optionen (aktivieren, Signalton, Lautstärke) und Benachrichtigungs-Optionen (aktivieren, Fokusende, Pausenende) anbieten.
5. Das System SOLL die Darstellung (System, Hell, Dunkel) konfigurierbar machen mit Standard „Systemeinstellung verwenden".
6. WENN Einstellungen geändert werden DANN SOLL das System sie lokal persistieren und beim nächsten Start anwenden.

---

## Requirement 13 – Darstellung, Dark Mode und Design

**User Story:** Als Nutzer möchte ich eine ruhige, professionelle Oberfläche mit Hell-/Dunkelmodus, damit die App auch bei langen Fokusphasen und abends angenehm ist.

#### Akzeptanzkriterien

1. Das System SOLL Light Mode, Dark Mode und automatische Systemeinstellung unterstützen.
2. WENN „System" gewählt ist DANN SOLL das System dem Betriebssystem-Farbschema folgen und auf Änderungen reagieren.
3. Das System SOLL Farben mit ausreichendem Kontrast verwenden (Fokus: dezente warme Akzentfarbe; Pause: ruhige Grün-/Blautöne).
4. Das System SOLL Animationen zurückhaltend einsetzen und keine auffälligen oder permanenten Animationen während der Fokusphase zeigen.

---

## Requirement 14 – Navigation und Responsive Design

**User Story:** Als Nutzer möchte ich die App auf Desktop und Mobilgeräten gut bedienen können, damit ich sie überall nutzen kann.

#### Akzeptanzkriterien

1. Das System SOLL genau drei Hauptbereiche bereitstellen: Timer, Statistik, Einstellungen.
2. WENN die App auf Desktop/Laptop angezeigt wird DANN SOLL der Timer zentral im Fenster stehen und die Navigation oben oder seitlich sein.
3. WENN die App auf einem Mobilgerät angezeigt wird DANN SOLL der Timer den Großteil des sichtbaren Bereichs einnehmen UND SOLL eine Bottom Navigation verwendet werden.
4. Das System SOLL Touch-Ziele ausreichend groß gestalten.

---

## Requirement 15 – Browser-Tab-Titel

**User Story:** Als Nutzer möchte ich die verbleibende Zeit im Tab-Titel sehen, damit ich den Timer auch bei anderem aktiven Tab im Blick habe.

#### Akzeptanzkriterien

1. WENN ein Timer läuft DANN SOLL das System den Seitentitel im Format „MM:SS – <Phase>" (z. B. „24:31 – Fokus") anzeigen.
2. WENN eine Phase abgelaufen ist DANN SOLL das System den Seitentitel auf einen Abschluss-Hinweis setzen (z. B. „Fokus beendet ✓").
3. WENN kein Timer läuft DANN SOLL das System den Standard-Seitentitel der App anzeigen.

---

## Requirement 16 – Tastatursteuerung

**User Story:** Als Nutzer möchte ich die App per Tastatur steuern, damit ich schnell und ohne Maus arbeiten kann.

#### Akzeptanzkriterien

1. Das System SOLL folgende Shortcuts unterstützen: Leertaste (Start/Pause), R (Neustart), S (Überspringen), F (Fokusmodus), Esc (Fokusmodus verlassen).
2. WENN der Fokus in einem Eingabefeld liegt DANN SOLL das System die Shortcuts NICHT auslösen.
3. Das System SOLL sichtbare Fokuszustände für alle interaktiven Elemente bieten.

---

## Requirement 17 – PWA und Offline-Fähigkeit

**User Story:** Als Nutzer möchte ich die App installieren und offline nutzen können, damit sie wie eine eigenständige App verfügbar ist.

#### Akzeptanzkriterien

1. Das System SOLL als installierbare PWA mit Manifest und Service Worker ausgeliefert werden.
2. WENN die App einmal geladen wurde DANN SOLL sie ohne Internetverbindung weiterhin funktionieren (Timer, Einstellungen, Statistiken).
3. Das System SOLL Timerlogik unabhängig von einer aktiven Internetverbindung ausführen.

---

## Requirement 18 – Accessibility

**User Story:** Als Nutzer mit Einschränkungen möchte ich die App barrierefrei bedienen können, damit ich sie unabhängig von meinen Fähigkeiten nutzen kann.

#### Akzeptanzkriterien

1. Das System SOLL WCAG-orientiert umgesetzt sein: ausreichender Farbkontrast, Tastaturbedienbarkeit, sichtbare Fokuszustände.
2. Das System SOLL Screenreader-Labels für interaktive Elemente und den Timerstatus bereitstellen.
3. Das System SOLL Phaseninformationen nicht ausschließlich über Farbe vermitteln.
4. Das System SOLL Zeit- und Phasenänderungen für Screenreader zugänglich ankündigen (z. B. via ARIA-Live-Region), ohne dabei sekündlich zu spammen.

---

## Requirement 19 – Datenschutz

**User Story:** Als Nutzer möchte ich, dass meine Fokusdaten privat bleiben, damit keine Produktivitätsdaten mein Gerät verlassen.

#### Akzeptanzkriterien

1. Das System SOLL im MVP alle Daten (Einstellungen, Statistik, Timerzustand) ausschließlich lokal speichern.
2. Das System SOLL KEINE persönlichen Produktivitätsdaten an einen Server übertragen.
3. Das System SOLL transparent kommunizieren, dass Fokusdaten ausschließlich auf diesem Gerät gespeichert werden.

---

## Requirement 20 – Fehlerfälle

**User Story:** Als Nutzer möchte ich, dass die App auch in Ausnahmesituationen stabil bleibt, damit ich mich auf sie verlassen kann.

#### Akzeptanzkriterien

1. Das System SOLL folgende Situationen sauber behandeln, ohne abzustürzen: Browser geschlossen, Seite neu geladen, Standby, ausgefallene Internetverbindung, verweigerte Notification-Berechtigung, blockiertes Audio-Autoplay, nicht verfügbarer lokaler Speicher, geänderte Systemzeit.
2. WENN sich die Systemzeit während einer laufenden Phase ändert DANN SOLL das System die verbleibende Zeit anhand der Endzeit neu bewerten und einen plausiblen Zustand herstellen.
3. Der Timer SOLL ohne aktive Internetverbindung funktionieren.
