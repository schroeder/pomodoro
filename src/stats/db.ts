// IndexedDB-Zugriff für die Statistik (Session-Historie).
// Abgeleitet aus .kiro/specs/pomodoro/design.md (Abschnitt „IndexedDB (Statistik)")
// und den Anforderungen 11.1, 19.1, 19.2, 20.1.
//
// Leitprinzipien:
// - Lokal zuerst: Sessions werden ausschließlich lokal in IndexedDB gehalten. Es findet
//   KEINE Netzwerkübertragung statt (Req 19.1/19.2).
// - Schlanker, nativer Wrapper: Bewusst KEINE zusätzliche Abhängigkeit (`idb`). Die
//   native IndexedDB-API wird in Promise-freundliche Funktionen gekapselt, damit die
//   Offline-/No-Network-Garantie einfach bleibt.
// - Robustheit (Req 20.1): Alle Zugriffe sind mit try/catch abgesichert. Ist IndexedDB
//   nicht verfügbar (Privatmodus, nicht unterstützt, blockiert), arbeiten die Funktionen
//   als No-Op bzw. liefern leere Ergebnisse zurück, ohne zu werfen. Über
//   `isIndexedDbAvailable()` lässt sich die Verfügbarkeit abfragen.
//
// Diese Datei enthält bewusst KEINE Aggregationslogik (Heute/Woche/Streak) – die kommt
// in Task 6.2 (`stats/aggregate.ts` / `StatsProvider`). Hier: reiner Speicherzugriff plus
// eine kleine `sessionWriter`-Funktion, die als Seam in den `TimerProvider`
// (`onSessionComplete`) gehängt werden kann.

import type { Session } from '../types';

/** Name der IndexedDB-Datenbank (design.md). */
export const DB_NAME = 'pomodoro';
/** Version des Datenbankschemas. */
export const DB_VERSION = 1;
/** Name des Objectstores für Sessions (keyPath `id`). */
export const STORE_SESSIONS = 'sessions';
/** Name des Index auf dem `dateKey`-Feld (YYYY-MM-DD) für Datums-/Wochenabfragen. */
export const INDEX_BY_START_DATE = 'byStartDate';

/**
 * Ermittelt das globale IndexedDB-Objekt, sofern in der Laufzeitumgebung vorhanden.
 * In jsdom ohne Polyfill oder im Privatmodus kann dies `undefined` sein → Fallback.
 */
function getIndexedDb(): IDBFactory | undefined {
  try {
    if (typeof indexedDB !== 'undefined') {
      return indexedDB;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined') {
      return globalThis.indexedDB;
    }
  } catch {
    // Zugriff auf indexedDB kann in manchen Umgebungen werfen (SecurityError).
  }
  return undefined;
}

/**
 * True, wenn in dieser Umgebung grundsätzlich ein IndexedDB-Objekt vorhanden ist.
 * Ein `true` garantiert noch keinen erfolgreichen Öffnungsvorgang (kann trotzdem
 * blockiert sein) – die eigentlichen Operationen fangen Fehler zusätzlich ab (Req 20.1).
 */
export function isIndexedDbAvailable(): boolean {
  return getIndexedDb() !== undefined;
}

/** Verpackt eine IDBRequest in ein Promise. */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Öffnet die Datenbank `pomodoro` und legt bei Bedarf Objectstore und Index an.
 *
 * Erfolgreiche Öffnung liefert die {@link IDBDatabase}; ist IndexedDB nicht verfügbar
 * oder schlägt das Öffnen fehl, wird `null` zurückgegeben (kein Wurf, Req 20.1).
 */
export function openDb(): Promise<IDBDatabase | null> {
  const idb = getIndexedDb();
  if (idb === undefined) {
    return Promise.resolve(null);
  }
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          store.createIndex(INDEX_BY_START_DATE, 'dateKey', { unique: false });
        } else {
          // Store existiert bereits – sicherstellen, dass der Index vorhanden ist.
          const store = request.transaction?.objectStore(STORE_SESSIONS);
          if (store && !store.indexNames.contains(INDEX_BY_START_DATE)) {
            store.createIndex(INDEX_BY_START_DATE, 'dateKey', { unique: false });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Führt eine Aktion innerhalb einer Transaktion auf dem Sessions-Store aus und schließt
 * die Datenbank anschließend. Fehler werden abgefangen und liefern `fallback` zurück.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fallback: T,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    if (db === null) {
      return fallback;
    }
    const tx = db.transaction(STORE_SESSIONS, mode);
    const store = tx.objectStore(STORE_SESSIONS);
    const result = await action(store);
    return result;
  } catch {
    return fallback;
  } finally {
    try {
      db?.close();
    } catch {
      // Schließen darf nie werfen.
    }
  }
}

/**
 * Speichert (bzw. überschreibt) eine Session. No-Op bei fehlendem/kaputtem Speicher.
 *
 * @returns `true`, wenn geschrieben werden konnte, sonst `false` (Req 20.1).
 */
export function addSession(session: Session): Promise<boolean> {
  return withStore('readwrite', false, async (store) => {
    await promisifyRequest(store.put(session));
    return true;
  });
}

/**
 * Liefert alle gespeicherten Sessions. Leeres Array bei fehlendem Speicher (Req 20.1).
 */
export function getAllSessions(): Promise<Session[]> {
  return withStore<Session[]>('readonly', [], async (store) => {
    const all = await promisifyRequest(store.getAll());
    return (all as Session[]) ?? [];
  });
}

/**
 * Liefert alle Sessions, deren `dateKey` inklusiv im Bereich [startKey, endKey] liegt.
 * Nutzt den {@link INDEX_BY_START_DATE}-Index. Da `dateKey` das Format `YYYY-MM-DD`
 * hat, entspricht die lexikografische Sortierung der chronologischen (Req 11.1).
 *
 * Leeres Array bei fehlendem Speicher (Req 20.1).
 *
 * @param startKey Untere Grenze im Format `YYYY-MM-DD` (inklusiv).
 * @param endKey Obere Grenze im Format `YYYY-MM-DD` (inklusiv).
 */
export function getSessionsByDateRange(startKey: string, endKey: string): Promise<Session[]> {
  return withStore<Session[]>('readonly', [], async (store) => {
    const index = store.index(INDEX_BY_START_DATE);
    const range = IDBKeyRange.bound(startKey, endKey, false, false);
    const all = await promisifyRequest(index.getAll(range));
    return (all as Session[]) ?? [];
  });
}

/**
 * Entfernt alle Sessions (für die Datenschutz-/Datenrücksetzung, Req 19).
 * No-Op bei fehlendem Speicher.
 *
 * @returns `true`, wenn der Store geleert werden konnte, sonst `false`.
 */
export function clearSessions(): Promise<boolean> {
  return withStore('readwrite', false, async (store) => {
    await promisifyRequest(store.clear());
    return true;
  });
}

/**
 * Erzeugt einen Session-Writer, der als `onSessionComplete`-Seam in den
 * {@link import('../timer/TimerProvider').TimerProvider} gehängt werden kann.
 *
 * Der Writer persistiert die übergebene Session „fire-and-forget" in IndexedDB und
 * schluckt Fehler still (Req 20.1). Nach erfolgreichem Schreiben wird optional
 * `onWritten(session)` aufgerufen – so kann Task 6.2 (StatsProvider) die Aggregationen
 * aktualisieren, ohne dass `db.ts` selbst davon weiß.
 *
 * @param onWritten Optionaler Callback nach erfolgreichem Persistieren.
 */
export function createSessionWriter(
  onWritten?: (session: Session) => void,
): (session: Session) => void {
  return (session: Session) => {
    void addSession(session)
      .then((ok) => {
        if (ok) {
          onWritten?.(session);
        }
      })
      .catch(() => {
        // Fehler still behandeln – die App bleibt bedienbar (Req 20.1).
      });
  };
}
