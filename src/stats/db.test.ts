// Tests für den IndexedDB-Zugriff (stats/db.ts).
// Abgedeckt: Schema (DB/Store/Index), CRUD, Datumsbereichs-Abfrage über den
// byStartDate-Index, Löschen sowie das graceful-Fallback-Verhalten bei fehlendem
// IndexedDB (Req 11.1, 19.1, 20.1).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Reales IndexedDB in jsdom bereitstellen (nur für diese Tests).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import type { Session } from '../types';
import {
  DB_NAME,
  INDEX_BY_START_DATE,
  STORE_SESSIONS,
  addSession,
  clearSessions,
  createSessionWriter,
  getAllSessions,
  getSessionsByDateRange,
  isIndexedDbAvailable,
  openDb,
} from './db';

/** Baut eine Session mit sinnvollen Defaults; einzelne Felder überschreibbar. */
function makeSession(overrides: Partial<Session> = {}): Session {
  const startedAt = overrides.startedAt ?? Date.parse('2024-01-15T09:00:00Z');
  const endedAt = overrides.endedAt ?? startedAt + 25 * 60_000;
  return {
    id: overrides.id ?? `id-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? 'Focus',
    startedAt,
    endedAt,
    plannedDurationMs: overrides.plannedDurationMs ?? 25 * 60_000,
    actualDurationMs: overrides.actualDurationMs ?? 25 * 60_000,
    status: overrides.status ?? 'completed',
    completed: overrides.completed ?? true,
    dateKey: overrides.dateKey ?? '2024-01-15',
  };
}

describe('stats/db – mit verfügbarem IndexedDB', () => {
  beforeEach(async () => {
    // Frische Datenbank pro Test: globales indexedDB zurücksetzen.
    globalThis.indexedDB = new IDBFactory();
    await clearSessions();
  });

  it('meldet IndexedDB als verfügbar', () => {
    expect(isIndexedDbAvailable()).toBe(true);
  });

  it('öffnet die DB und legt Store + Index gemäß Schema an', async () => {
    const db = await openDb();
    expect(db).not.toBeNull();
    expect(db!.name).toBe(DB_NAME);
    expect(db!.objectStoreNames.contains(STORE_SESSIONS)).toBe(true);

    const tx = db!.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains(INDEX_BY_START_DATE)).toBe(true);
    db!.close();
  });

  it('speichert eine Session und liest sie wieder', async () => {
    const session = makeSession({ id: 'abc' });
    const ok = await addSession(session);
    expect(ok).toBe(true);

    const all = await getAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(session);
  });

  it('überschreibt Sessions mit gleicher id (keyPath id)', async () => {
    await addSession(makeSession({ id: 'dup', actualDurationMs: 1000 }));
    await addSession(makeSession({ id: 'dup', actualDurationMs: 2000 }));

    const all = await getAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0].actualDurationMs).toBe(2000);
  });

  it('fragt Sessions über den byStartDate-Index inklusiv im Datumsbereich ab', async () => {
    await addSession(makeSession({ id: 'a', dateKey: '2024-01-13' }));
    await addSession(makeSession({ id: 'b', dateKey: '2024-01-14' }));
    await addSession(makeSession({ id: 'c', dateKey: '2024-01-15' }));
    await addSession(makeSession({ id: 'd', dateKey: '2024-01-16' }));

    const inRange = await getSessionsByDateRange('2024-01-14', '2024-01-15');
    const ids = inRange.map((s) => s.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('schließt die Bereichsgrenzen ein (inklusiv)', async () => {
    await addSession(makeSession({ id: 'start', dateKey: '2024-02-01' }));
    await addSession(makeSession({ id: 'end', dateKey: '2024-02-07' }));
    await addSession(makeSession({ id: 'outside', dateKey: '2024-02-08' }));

    const week = await getSessionsByDateRange('2024-02-01', '2024-02-07');
    const ids = week.map((s) => s.id).sort();
    expect(ids).toEqual(['end', 'start']);
  });

  it('leert den Store mit clearSessions (Datenschutz-Reset, Req 19)', async () => {
    await addSession(makeSession({ id: 'x' }));
    await addSession(makeSession({ id: 'y' }));
    expect(await getAllSessions()).toHaveLength(2);

    const cleared = await clearSessions();
    expect(cleared).toBe(true);
    expect(await getAllSessions()).toHaveLength(0);
  });

  it('createSessionWriter persistiert die Session und ruft onWritten auf', async () => {
    const onWritten = vi.fn();
    const write = createSessionWriter(onWritten);
    const session = makeSession({ id: 'writer' });

    write(session);
    // Auf die fire-and-forget-Persistenz warten.
    await vi.waitFor(async () => {
      const all = await getAllSessions();
      expect(all.map((s) => s.id)).toContain('writer');
    });
    expect(onWritten).toHaveBeenCalledWith(session);
  });
});

describe('stats/db – ohne verfügbares IndexedDB (Fallback, Req 20.1)', () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    // IndexedDB entfernen, um die Umgebung „ohne Speicher" zu simulieren.
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDb;
  });

  it('meldet IndexedDB als nicht verfügbar', () => {
    expect(isIndexedDbAvailable()).toBe(false);
  });

  it('openDb liefert null statt zu werfen', async () => {
    await expect(openDb()).resolves.toBeNull();
  });

  it('addSession ist ein No-Op und liefert false', async () => {
    await expect(addSession(makeSession())).resolves.toBe(false);
  });

  it('getAllSessions liefert ein leeres Array', async () => {
    await expect(getAllSessions()).resolves.toEqual([]);
  });

  it('getSessionsByDateRange liefert ein leeres Array', async () => {
    await expect(getSessionsByDateRange('2024-01-01', '2024-12-31')).resolves.toEqual([]);
  });

  it('clearSessions liefert false ohne zu werfen', async () => {
    await expect(clearSessions()).resolves.toBe(false);
  });

  it('createSessionWriter schluckt Fehler still und ruft onWritten nicht auf', async () => {
    const onWritten = vi.fn();
    const write = createSessionWriter(onWritten);
    expect(() => write(makeSession())).not.toThrow();
    // Kurz warten, damit ein etwaiges Promise abschließen könnte.
    await Promise.resolve();
    await Promise.resolve();
    expect(onWritten).not.toHaveBeenCalled();
  });
});
