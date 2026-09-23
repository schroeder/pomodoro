// DocumentTitleService – zeigt die verbleibende Zeit im Browser-Tab-Titel (Req 15).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt DocumentTitleService;
// spec.md §21):
// - Bei laufendem Timer (status === 'Running') zeigt der Titel
//   „MM:SS – <Phase>", z. B. „24:31 – Fokus" (Req 15.1). Der Bindestrich ist
//   ein von Leerzeichen umgebener Gedankenstrich (en dash „–").
// - Nach Ablauf einer Phase (status === 'Completed') zeigt der Titel einen
//   Abschluss-Hinweis, z. B. „Fokus beendet ✓" (Req 15.2).
// - Ansonsten (Ready/Paused/Cancelled) zeigt der Titel den App-Standardtitel
//   (Req 15.3).
//
// Der Kern ist eine reine, unit-testbare Formatierungsfunktion. Der
// Seiteneffekt (`document.title` setzen) ist als dünner Wrapper gekapselt und
// wird still zum No-Op, wenn `document` nicht verfügbar ist (z. B. SSR/Tests),
// analog zu den anderen Services (sound.ts, notifications.ts).

import type { PhaseType, TimerState, TimerStatus } from '../types';

/**
 * Der App-Standardtitel, der angezeigt wird, wenn kein Timer läuft (Req 15.3).
 * Entspricht dem `<title>` in index.html. Exportiert, damit UI und Tests
 * dieselbe Quelle referenzieren.
 */
export const DEFAULT_DOCUMENT_TITLE = 'Pomodoro';

/**
 * Anzeigenamen der Phasentypen im Titel (spec.md §21, deutsch). Exportiert,
 * damit die UI dieselben Beschriftungen wiederverwenden kann.
 */
export const PHASE_LABELS: Record<PhaseType, string> = {
  Focus: 'Fokus',
  ShortBreak: 'Kurze Pause',
  LongBreak: 'Lange Pause',
};

/** Von Leerzeichen umgebener Gedankenstrich (en dash) zwischen Zeit und Phase. */
const TITLE_SEPARATOR = ' – ';

/** Für die Formatierung benötigter Ausschnitt des Timer-Zustands. */
export interface TitleInput {
  /** Aktueller Timer-Status. */
  status: TimerStatus;
  /** Aktueller Phasentyp. */
  phaseType: PhaseType;
  /** Verbleibende Zeit in ms (bei Running vom Provider abgeleitet). */
  remainingMs: number;
}

/**
 * Formatiert eine Restzeit in Millisekunden als „MM:SS".
 * - Auf ganze Sekunden abgerundet (floor).
 * - Minuten und Sekunden zweistellig, links mit Null aufgefüllt.
 * - Negative/ungültige Werte werden auf 0 geklemmt (Req 20.2).
 * Minuten können über 99 hinausgehen (z. B. „120:00"), bleiben aber
 * mindestens zweistellig.
 */
export function formatRemaining(remainingMs: number): string {
  const safeMs =
    typeof remainingMs === 'number' && Number.isFinite(remainingMs) && remainingMs > 0
      ? remainingMs
      : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Berechnet den anzuzeigenden Seitentitel aus dem Timer-Zustand (Req 15).
 * Reine Funktion – kein Seiteneffekt, damit sie deterministisch testbar ist.
 *
 * @param input        Status, Phasentyp und Restzeit.
 * @param defaultTitle Standardtitel für „kein Timer läuft"; Standard
 *                     `DEFAULT_DOCUMENT_TITLE`.
 */
export function formatTimerTitle(
  input: TitleInput,
  defaultTitle: string = DEFAULT_DOCUMENT_TITLE,
): string {
  const label = PHASE_LABELS[input.phaseType];

  switch (input.status) {
    case 'Running':
      // „MM:SS – <Phase>" (Req 15.1).
      return `${formatRemaining(input.remainingMs)}${TITLE_SEPARATOR}${label}`;
    case 'Completed':
      // Abschluss-Hinweis, z. B. „Fokus beendet ✓" (Req 15.2).
      return `${label} beendet ✓`;
    default:
      // Ready/Paused/Cancelled → Standardtitel (Req 15.3).
      return defaultTitle;
  }
}

/**
 * Setzt `document.title` auf `title`. Stiller No-Op, wenn `document` nicht
 * verfügbar ist (z. B. SSR oder Testumgebung ohne DOM), analog zu den
 * anderen Services.
 */
export function setDocumentTitle(title: string): void {
  try {
    const doc = (globalThis as unknown as { document?: { title: string } }).document;
    if (!doc) return;
    doc.title = title;
  } catch {
    // Fehler beim Zugriff auf das Dokument still ignorieren (Req 20.1).
  }
}

/**
 * Berechnet den Titel aus dem Timer-Zustand und setzt ihn (Req 15).
 * Kombiniert `formatTimerTitle` (reine Logik) mit `setDocumentTitle`
 * (Seiteneffekt). Gibt den gesetzten Titel für Tests/Debugging zurück.
 */
export function applyTimerTitle(
  state: Pick<TimerState, 'status' | 'phaseType' | 'remainingMs'>,
  defaultTitle: string = DEFAULT_DOCUMENT_TITLE,
): string {
  const title = formatTimerTitle(
    { status: state.status, phaseType: state.phaseType, remainingMs: state.remainingMs },
    defaultTitle,
  );
  setDocumentTitle(title);
  return title;
}
