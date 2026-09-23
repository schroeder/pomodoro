// StatsProvider: lädt die Session-Historie aus IndexedDB (db.ts), berechnet die
// Aggregationen (aggregate.ts) und stellt sie samt einer Refresh-Funktion über einen
// React-Context bereit.
//
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitte „StatsProvider", „StatsView")
// und den Anforderungen 11.2, 11.3, 11.4, 11.5 sowie 20.1.
//
// Leitprinzipien:
// - Die eigentliche Aggregationslogik ist rein und lebt in `aggregate.ts`. Dieser Provider
//   kümmert sich ausschließlich um das Laden der Sessions, das Auslösen der Berechnung und
//   die Bereitstellung im Context.
// - Robustheit (Req 20.1): Der DB-Zugriff ist in `db.ts` bereits gegen Fehler/Unverfügbarkeit
//   abgesichert (liefert leere Arrays statt zu werfen). Zusätzlich fangen wir hier Fehler ab,
//   sodass Unverfügbarkeit stets zu leeren Statistiken führt und die App bedienbar bleibt.
// - SEAM zum TimerProvider: Der Provider bietet eine `refresh()`-Funktion sowie einen
//   `onSessionWritten`-kompatiblen Callback (siehe {@link useStatsRefresh}). Der
//   Session-Writer aus `db.ts` (`createSessionWriter(onWritten)`) kann `refresh` als
//   `onWritten` erhalten, damit die Statistik nach jedem geschriebenen Fokus aktualisiert wird.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '../types';
import { getAllSessions } from './db';
import {
  dateKeyFromEpoch,
  history,
  streak,
  todayStats,
  weekStats,
  type HistoryDay,
  type TodayStats,
  type WeekStats,
} from './aggregate';

/** Gebündelte, aus den Sessions berechnete Aggregationen (Req 11.2–11.5). */
export interface StatsAggregations {
  /** „Heute": Pomodoros, Fokuszeit, Ø-Dauer, Pausen (Req 11.2). */
  today: TodayStats;
  /** „Diese Woche": Summen und Fokuszeit pro Tag (Req 11.3). */
  week: WeekStats;
  /** Historie vergangener Tage (Req 11.4). */
  history: HistoryDay[];
  /** Fokus-Serie in Tagen (Req 11.5). */
  streak: number;
}

/** Vom Kontext bereitgestellte Werte und Aktionen. */
export interface StatsContextValue extends StatsAggregations {
  /** Die zugrunde liegenden, geladenen Sessions (für Detailansichten). */
  sessions: Session[];
  /** True, solange der initiale Ladevorgang läuft. */
  loading: boolean;
  /** Lädt die Sessions neu aus der DB und berechnet die Aggregationen neu. */
  refresh: () => void;
}

const StatsContext = createContext<StatsContextValue | null>(null);

/**
 * Berechnet alle Aggregationen aus den Sessions relativ zu einem Referenzzeitpunkt.
 * Ausgelagert, damit dieselbe Logik auch außerhalb des Providers testbar wäre.
 */
export function computeAggregations(
  sessions: Session[],
  nowMs: number,
): StatsAggregations {
  const todayKey = dateKeyFromEpoch(nowMs);
  return {
    today: todayStats(sessions, todayKey),
    week: weekStats(sessions, todayKey),
    history: history(sessions),
    streak: streak(sessions, todayKey),
  };
}

/**
 * Optionale Injektionen – primär für Tests.
 */
export interface StatsProviderProps {
  children: ReactNode;
  /** Injizierbare Zeitquelle (Tests). Standard: `Date.now`. */
  now?: () => number;
  /**
   * Injizierbarer Session-Loader (Tests). Standard: {@link getAllSessions} aus `db.ts`.
   * Muss bei Unverfügbarkeit ein leeres Array liefern (statt zu werfen) – der Provider
   * fängt zusätzlich Fehler ab (Req 20.1).
   */
  loadSessions?: () => Promise<Session[]>;
}

export function StatsProvider({
  children,
  now: nowFn = Date.now,
  loadSessions = getAllSessions,
}: StatsProviderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Loader/Zeitquelle als Refs, damit `refresh` stabil bleibt.
  const loadSessionsRef = useRef(loadSessions);
  loadSessionsRef.current = loadSessions;
  const nowRef = useRef(nowFn);
  nowRef.current = nowFn;

  // Verhindert das Setzen von State nach dem Unmount (späte Promise-Auflösung).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    void (async () => {
      try {
        const loaded = await loadSessionsRef.current();
        if (mountedRef.current) {
          setSessions(loaded ?? []);
        }
      } catch {
        // Unverfügbarkeit/Fehler → leere Statistiken, App bleibt bedienbar (Req 20.1).
        if (mountedRef.current) {
          setSessions([]);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();
  }, []);

  // Initialer Ladevorgang.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Aggregationen aus den geladenen Sessions ableiten (Req 11.2–11.5).
  const aggregations = useMemo(
    () => computeAggregations(sessions, nowRef.current()),
    [sessions],
  );

  const value = useMemo<StatsContextValue>(
    () => ({
      ...aggregations,
      sessions,
      loading,
      refresh,
    }),
    [aggregations, sessions, loading, refresh],
  );

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}

/** Zugriff auf den Statistik-Kontext; wirft außerhalb des Providers. */
export function useStats(): StatsContextValue {
  const ctx = useContext(StatsContext);
  if (ctx == null) {
    throw new Error('useStats muss innerhalb von <StatsProvider> verwendet werden.');
  }
  return ctx;
}

/**
 * Bequemer Zugriff nur auf die `refresh`-Funktion des Statistik-Kontexts.
 *
 * Gedacht als `onSessionWritten`-Seam: Der TimerProvider bzw. der Session-Writer aus
 * `db.ts` (`createSessionWriter(onWritten)`) kann diese Funktion als `onWritten` nutzen,
 * um nach jedem geschriebenen Fokus die Aggregationen zu aktualisieren.
 */
export function useStatsRefresh(): () => void {
  return useStats().refresh;
}
