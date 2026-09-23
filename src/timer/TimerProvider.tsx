// TimerProvider: verdrahtet die reine Timer-Zustandsmaschine (timerReducer) mit
// React, einem Anzeige-Ticker, Sichtbarkeits-/Fokus-Listenern, EXPIRE-Handling,
// Session-Erfassung bei abgeschlossenem Fokus, Auto-Start und Persistenz.
//
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitte „TimerProvider",
// „Timestamp-basierte Berechnung", „Persistenz", „Auto-Start") und den
// Anforderungen 6.1–6.4, 5.3, 5.5, 5.6, 20.2, 20.3.
//
// Leitprinzipien:
// - Der Ticker (~250 ms) ist NUR eine Quelle für die Anzeige-Neuberechnung, NICHT die
//   Zeitquelle. Der Reducer leitet die verbleibende Zeit stets aus `endsAt`/`now` ab
//   (Req 6.2). Übersprungene Zeit (Standby/Hintergrund) wird korrekt erfasst, weil nur
//   `endsAt` zählt.
// - Bei `visibilitychange` (→ sichtbar) und Fenster-`focus` wird sofort ein TICK
//   dispatcht, damit Hintergrunddrosselung keine Rolle spielt (Req 6.3/6.4, 20.2/20.3).
// - Persistenz: Zustand wird bei relevanten Übergängen via `saveTimerState` gespeichert
//   und beim Mounten via `loadTimerState` hydriert. Ist kein Speicher verfügbar, läuft
//   die App in-memory weiter (`storageAvailable = false`, Req 7.5/20.1).
//
// SEAM für Task 6 (Statistik/IndexedDB):
//   Der Provider erfasst bei einem abgeschlossenen Fokus (EXPIRE oder COMPLETE_EARLY)
//   eine vollständige `Session` und reicht sie an den optionalen Callback
//   `onSessionComplete(session)` weiter. Dieser Provider implementiert BEWUSST KEINE
//   IndexedDB-Logik. Task 6 (`stats/db.ts` / `StatsProvider`) stellt lediglich den
//   Callback bereit, der die Session persistiert. So bleibt der Timer frei von
//   Speicher-Details und bleibt rein testbar.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, TimerState } from '../types';
import { useSettings } from '../settings/SettingsProvider';
import { timerReducer, durationForPhase, type TimerAction } from './timerReducer';
import {
  loadTimerState,
  saveTimerState,
  type LoadResult,
} from './persistence';
import type { Settings } from '../types';

/** Intervall des Anzeige-Tickers in ms (~250 ms; nur Anzeige, nicht Zeitquelle). */
export const TICK_INTERVAL_MS = 250;

/**
 * Optionale Injektionen für den Provider – primär für Tests und den Task-6-Seam.
 */
export interface TimerProviderProps {
  children: ReactNode;
  /**
   * SEAM für Task 6: Wird bei jedem abgeschlossenen Fokus (EXPIRE/COMPLETE_EARLY) mit
   * der erfassten {@link Session} aufgerufen. Der Statistik-Layer (IndexedDB) hängt sich
   * hier ein. Standard: kein Callback (Timer funktioniert eigenständig).
   */
  onSessionComplete?: (session: Session) => void;
  /** Injizierbare Zeitquelle (Tests). Standard: `Date.now`. */
  now?: () => number;
  /** Injizierbarer ID-Generator für Sessions (Tests). Standard: `crypto.randomUUID`/Fallback. */
  generateId?: () => string;
  /** Ticker-Intervall überschreibbar (Tests). Standard: {@link TICK_INTERVAL_MS}. */
  tickIntervalMs?: number;
}

/** Vom Kontext bereitgestellte Werte und Aktions-Dispatcher. */
export interface TimerContextValue {
  /** Aktueller Timerzustand. */
  state: TimerState;
  /**
   * Für die Anzeige abgeleitete Restzeit in ms. Im Zustand Running aus `endsAt - now`
   * berechnet und auf 0 geklemmt; sonst der eingefrorene `remainingMs` (Req 6.2/20.2).
   */
  remainingMs: number;
  /** True, wenn persistenter Speicher verfügbar ist; sonst In-Memory-Betrieb (Req 20.1). */
  storageAvailable: boolean;

  // Aktions-Dispatcher (kapseln die Reducer-Aktionen inkl. `now`/`settings`).
  /** Ready → Running. */
  start: () => void;
  /** Running → Paused (Restzeit einfrieren). */
  pause: () => void;
  /** Paused → Running (Restzeit fortsetzen). */
  resume: () => void;
  /** Aktuelle Phase auf ihre geplante Dauer zurücksetzen (→ Ready). */
  restart: () => void;
  /** Aktuelle Phase abbrechen (→ Cancelled, keine Wertung). */
  cancel: () => void;
  /** Aktuelle Phase überspringen → nächste Phase vorbereiten (Ready, keine Wertung). */
  skip: () => void;
  /** Geplante Endzeit um `ms` verlängern (+1/+5/+10 min in der UI). */
  extend: (ms: number) => void;
  /** Fokus manuell als abgeschlossen werten (nur Focus). */
  completeEarly: () => void;
  /** Aus Completed in die nächste Phase (Ready oder – bei Auto-Start – Running). */
  advance: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/** Sicherer ID-Generator mit Fallback, falls `crypto.randomUUID` fehlt. */
function defaultGenerateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignorieren und Fallback nutzen
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Anzeige-Restzeit ableiten (Req 6.2/20.2). */
function deriveRemaining(state: TimerState, now: number): number {
  if (state.status === 'Running' && state.endsAt !== null) {
    const ms = state.endsAt - now;
    return ms > 0 ? ms : 0;
  }
  return state.remainingMs;
}

/** Lokaler Datumsschlüssel YYYY-MM-DD (für den Statistik-Index). */
function toDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Erzeugt den initialen Timerzustand: Fokus, Ready, geplante Dauer aus den Einstellungen.
 * Existiert ein persistierter Zustand, wird dieser (bereits hydriert) übernommen.
 */
function createInitialState(settings: Settings, loaded: LoadResult): TimerState {
  if (loaded.state !== null) {
    return loaded.state;
  }
  const plannedDurationMs = durationForPhase('Focus', settings);
  return {
    phaseType: 'Focus',
    status: 'Ready',
    plannedDurationMs,
    endsAt: null,
    remainingMs: plannedDurationMs,
    startedAt: null,
    completedFocusInCycle: 0,
    pomodoroNumberInCycle: 1,
    notificationPrompted: false,
  };
}

export function TimerProvider({
  children,
  onSessionComplete,
  now: nowFn = Date.now,
  generateId = defaultGenerateId,
  tickIntervalMs = TICK_INTERVAL_MS,
}: TimerProviderProps) {
  const { settings } = useSettings();

  // Einmalig laden/hydrieren. Der Ausgangspunkt (available) bestimmt In-Memory-Betrieb.
  const loadedRef = useRef<LoadResult | null>(null);
  if (loadedRef.current === null) {
    loadedRef.current = loadTimerState(nowFn());
  }
  const storageAvailableRef = useRef<boolean>(loadedRef.current.available);

  const [state, dispatch] = useReducer(
    timerReducer,
    undefined,
    () => createInitialState(settings, loadedRef.current as LoadResult),
  );

  // Aktuelle Einstellungen als Ref, damit Callbacks/Effekte stabil bleiben.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Callback als Ref, damit sich Effektabhängigkeiten nicht ändern.
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;

  // Zustand als Ref für Listener, die zum Bindungszeitpunkt eingefroren wären.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Merkt sich den zuletzt für eine Session erfassten Fokus, um Doppel-Erfassung zu
  // vermeiden (z. B. TICK-EXPIRE gefolgt von erneutem TICK). Schlüssel ist `startedAt`.
  const recordedFocusStartRef = useRef<number | null>(null);

  // Render-Nonce: Ein TICK, der `now >= endsAt` NICHT überschreitet, lässt den
  // Reducer-Zustand strukturell unverändert (gleiche Objektreferenz) – React würde dann
  // kein Re-Render auslösen und die abgeleitete Anzeige-Restzeit bliebe stehen. Dieser
  // Zähler wird bei jedem Tick/jeder Neuberechnung erhöht und erzwingt so ein Re-Render,
  // damit `remainingMs` (aus `endsAt`/`now`) aktuell bleibt (Req 6.2). Er ist rein für
  // die Anzeige und beeinflusst die Zustandsmaschine nicht.
  const [, forceDisplayTick] = useState(0);
  const bumpDisplay = useCallback(() => forceDisplayTick((n) => n + 1), []);

  // --- Persistenz bei relevanten Übergängen (Req 7.1) ---
  // Bei jeder Zustandsänderung speichern; Erfolg aktualisiert die Verfügbarkeit.
  useEffect(() => {
    const ok = saveTimerState(state);
    storageAvailableRef.current = ok;
  }, [state]);

  // --- Session-Erfassung bei abgeschlossenem Fokus (SEAM für Task 6) ---
  // Läuft immer dann, wenn eine Fokusphase in Completed übergeht. Erfasst genau einmal
  // pro Fokusinstanz (über startedAt) und ruft den optionalen Callback auf.
  useEffect(() => {
    if (
      state.phaseType === 'Focus' &&
      state.status === 'Completed' &&
      state.startedAt !== null &&
      recordedFocusStartRef.current !== state.startedAt
    ) {
      recordedFocusStartRef.current = state.startedAt;
      const endedAt = nowFn();
      const session: Session = {
        id: generateId(),
        type: 'Focus',
        startedAt: state.startedAt,
        endedAt,
        plannedDurationMs: state.plannedDurationMs,
        actualDurationMs: Math.max(0, endedAt - state.startedAt),
        status: 'completed',
        completed: true,
        dateKey: toDateKey(state.startedAt),
      };
      onSessionCompleteRef.current?.(session);
    }
    // Ein neuer Fokus erhält ohnehin ein neues `startedAt`, daher ist kein explizites
    // Zurücksetzen von `recordedFocusStartRef` nötig, um Doppel-Erfassung zu vermeiden.
  }, [state, nowFn, generateId]);

  // --- Auto-Start nach EXPIRE (Req 5.3/5.5/5.6) ---
  // Nach dem Übergang in Completed wird die nächste Phase über ADVANCE (→ Ready)
  // vorbereitet. Ist Auto-Start für die neue Phasenart aktiv, folgt automatisch START.
  // Standard: kein Auto-Start.
  useEffect(() => {
    if (state.status !== 'Completed') return;
    const s = settingsRef.current;
    // Die nächste Phase ergibt sich aus der aktuellen (abgeschlossenen) Phase:
    // Focus → Pause, Pause → Focus.
    const nextIsBreak = state.phaseType === 'Focus';
    const shouldAutoStart = nextIsBreak ? s.autoStartBreaks : s.autoStartFocus;

    // Immer zuerst in die nächste Phase (Ready) übergehen.
    dispatch({ type: 'ADVANCE', settings: s });
    if (shouldAutoStart) {
      // Direkt starten. Da ADVANCE synchron in Ready mündet, kann START mit aktuellem
      // `now` gefeuert werden.
      dispatch({ type: 'START', now: nowFn() });
    }
    // Nur auf Statuswechsel nach Completed reagieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.phaseType]);

  // --- Anzeige-Ticker (~250 ms) (Req 6.1/6.2) ---
  // Dispatcht TICK mit der aktuellen Uhrzeit. Der Reducer prüft `now >= endsAt` und
  // behandelt den Ablauf. Läuft nur im Zustand Running, um unnötige Renders zu vermeiden.
  useEffect(() => {
    if (state.status !== 'Running') return;
    const id = setInterval(() => {
      dispatch({ type: 'TICK', now: nowFn() });
      // Anzeige aktualisieren, auch wenn der Reducer-Zustand unverändert bleibt.
      bumpDisplay();
    }, tickIntervalMs);
    return () => clearInterval(id);
  }, [state.status, nowFn, tickIntervalMs, bumpDisplay]);

  // --- Sofortige Neuberechnung bei Sichtbarkeit/Fokus (Req 6.3/6.4, 20.2/20.3) ---
  // Beim Zurückkehren aus Hintergrund/Standby sofort TICK, damit die verbleibende Zeit
  // aus `endsAt` neu bewertet wird (ggf. → Completed), unabhängig von Drosselung.
  useEffect(() => {
    const recalc = () => {
      if (stateRef.current.status === 'Running') {
        dispatch({ type: 'TICK', now: nowFn() });
        bumpDisplay();
      }
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        recalc();
      }
    };
    window.addEventListener('focus', recalc);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', recalc);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [nowFn, bumpDisplay]);

  // --- Aktions-Dispatcher ---
  const start = useCallback(() => {
    dispatch({ type: 'START', now: nowFn() });
  }, [nowFn]);
  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE', now: nowFn() });
  }, [nowFn]);
  const resume = useCallback(() => {
    dispatch({ type: 'RESUME', now: nowFn() });
  }, [nowFn]);
  const restart = useCallback(() => {
    dispatch({ type: 'RESTART' });
  }, []);
  const cancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, []);
  const skip = useCallback(() => {
    dispatch({ type: 'SKIP', settings: settingsRef.current });
  }, []);
  const extend = useCallback((ms: number) => {
    dispatch({ type: 'EXTEND', ms, now: nowFn() });
  }, [nowFn]);
  const completeEarly = useCallback(() => {
    dispatch({ type: 'COMPLETE_EARLY', now: nowFn() });
  }, [nowFn]);
  const advance = useCallback(() => {
    dispatch({ type: 'ADVANCE', settings: settingsRef.current });
  }, []);

  const remainingMs = deriveRemaining(state, nowFn());

  const value = useMemo<TimerContextValue>(
    () => ({
      state,
      remainingMs,
      storageAvailable: storageAvailableRef.current,
      start,
      pause,
      resume,
      restart,
      cancel,
      skip,
      extend,
      completeEarly,
      advance,
    }),
    [state, remainingMs, start, pause, resume, restart, cancel, skip, extend, completeEarly, advance],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

/** Zugriff auf den Timer-Kontext; wirft außerhalb des Providers. */
export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (ctx == null) {
    throw new Error('useTimer muss innerhalb von <TimerProvider> verwendet werden.');
  }
  return ctx;
}

// Re-Export für Bequemlichkeit von Konsumenten (z. B. Views/Tests).
export type { TimerAction };
