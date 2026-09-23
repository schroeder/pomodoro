// Zentrale Typdefinitionen der Pomodoro-App.
// Abgeleitet aus dem Design-Dokument (.kiro/specs/pomodoro/design.md).

/** Typ einer Phase im Pomodoro-Zyklus. */
export type PhaseType = 'Focus' | 'ShortBreak' | 'LongBreak';

/** Zustand der Timer-Zustandsmaschine (spec.md §20). */
export type TimerStatus = 'Ready' | 'Running' | 'Paused' | 'Completed' | 'Cancelled';

/** Vom Nutzer konfigurierbare Einstellungen (spec.md §15/§31). */
export interface Settings {
  /** Fokusdauer in Minuten, 5..120, Standard 25. */
  focusMinutes: number;
  /** Dauer der kurzen Pause in Minuten, 1..60, Standard 5. */
  shortBreakMinutes: number;
  /** Dauer der langen Pause in Minuten, 1..60, Standard 15. */
  longBreakMinutes: number;
  /** Anzahl Fokusphasen bis zur langen Pause, Standard 4. */
  focusPerCycle: number;
  /** Pausen automatisch starten, Standard false. */
  autoStartBreaks: boolean;
  /** Fokusphasen automatisch starten, Standard false. */
  autoStartFocus: boolean;
  /** Ton am Phasenende abspielen, Standard true. */
  soundEnabled: boolean;
  /** Ausgewählter Signalton, Standard 'soft'. */
  soundId: string;
  /** Lautstärke 0..1, Standard 0.6. */
  volume: number;
  /** Benachrichtigungen aktiviert (erst nach erteilter Berechtigung), Standard false. */
  notificationsEnabled: boolean;
  /** Bei Fokusende benachrichtigen, Standard true. */
  notifyFocusEnd: boolean;
  /** Bei Pausenende benachrichtigen, Standard true. */
  notifyBreakEnd: boolean;
  /** Darstellung: Systemeinstellung, hell oder dunkel, Standard 'system'. */
  theme: 'system' | 'light' | 'dark';
}

/** Eine dokumentierte Session für die Statistik (in IndexedDB gespeichert). */
export interface Session {
  /** Eindeutige ID (uuid). */
  id: string;
  /** Phasentyp; für die Statistik in der Praxis Focus, Pausen optional. */
  type: PhaseType;
  /** Startzeitpunkt in epoch ms. */
  startedAt: number;
  /** Endzeitpunkt in epoch ms. */
  endedAt: number;
  /** Geplante Dauer der Phase in ms. */
  plannedDurationMs: number;
  /** Tatsächliche Dauer der Phase in ms. */
  actualDurationMs: number;
  /** Abschluss-Status der Session. */
  status: 'completed' | 'cancelled';
  /** Ob die Phase als abgeschlossen gewertet wurde. */
  completed: boolean;
  /** Lokaler Datumsschlüssel YYYY-MM-DD, für den Index. */
  dateKey: string;
}

/** Laufzeit-Zustand des Timers (Zustandsmaschine). */
export interface TimerState {
  /** Aktueller Phasentyp: Focus | ShortBreak | LongBreak. */
  phaseType: PhaseType;
  /** Aktueller Timer-Status. */
  status: TimerStatus;
  /** Konfigurierte Dauer der aktuellen Phase in ms (inkl. Verlängerungen). */
  plannedDurationMs: number;
  /** Absolute Endzeit (Date.now()-basiert), null wenn nicht Running. */
  endsAt: number | null;
  /** Bei Paused/Ready: erhaltene Restzeit; bei Running: abgeleitet. */
  remainingMs: number;
  /** Startzeitpunkt der aktuellen Phase (für Session-Dokumentation), null wenn nicht gestartet. */
  startedAt: number | null;
  /** Anzahl abgeschlossener Fokusphasen im aktuellen Zyklus (0..focusPerCycle). */
  completedFocusInCycle: number;
  /** 1-basierte Nummer der aktuellen/nächsten Fokusphase. */
  pomodoroNumberInCycle: number;
  /** Ob die Benachrichtigungsberechtigung bereits einmal angefragt wurde. */
  notificationPrompted: boolean;
}
