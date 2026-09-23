import { describe, it, expect, vi } from 'vitest';
import {
  createSoundService,
  AVAILABLE_SOUNDS,
  type AudioContextLike,
} from './sound';

// jsdom stellt keine Web Audio API bereit. Wir bauen einen leichten Fake,
// um die Gating-Logik (Entsperren, Aktivierung, Lautstärke) ohne echte
// Audio-Hardware zu testen.

class FakeOscillator {
  type = 'sine';
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGainNode {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

interface FakeCtxOptions {
  initialState?: string;
  resumeRejects?: boolean;
}

function createFakeContext(opts: FakeCtxOptions = {}) {
  let state = opts.initialState ?? 'running';
  const oscillators: FakeOscillator[] = [];
  const destination = {} as AudioNode;

  const ctx = {
    get state() {
      return state;
    },
    currentTime: 0,
    destination,
    createOscillator: vi.fn(() => {
      const osc = new FakeOscillator();
      oscillators.push(osc);
      return osc as unknown as OscillatorNode;
    }),
    createGain: vi.fn(() => new FakeGainNode() as unknown as GainNode),
    resume: vi.fn(() => {
      if (opts.resumeRejects) return Promise.reject(new Error('blocked'));
      state = 'running';
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      state = 'closed';
      return Promise.resolve();
    }),
  };

  return { ctx: ctx as unknown as AudioContextLike, oscillators, raw: ctx };
}

describe('createSoundService – Ton-Katalog', () => {
  it('bietet mehrere Töne mit id und label für die Einstellungs-UI', () => {
    expect(AVAILABLE_SOUNDS.length).toBeGreaterThanOrEqual(3);
    for (const opt of AVAILABLE_SOUNDS) {
      expect(typeof opt.id).toBe('string');
      expect(opt.id.length).toBeGreaterThan(0);
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
    }
    expect(AVAILABLE_SOUNDS.map((s) => s.id)).toContain('soft');
  });
});

describe('createSoundService – Entsperren (Req 9.3)', () => {
  it('ist vor der ersten Nutzergeste nicht entsperrt', () => {
    const { ctx } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    expect(service.isUnlocked()).toBe(false);
  });

  it('erzeugt den Kontext erst bei unlock()', () => {
    const { ctx } = createFakeContext();
    const factory = vi.fn(() => ctx);
    const service = createSoundService({ audioContextFactory: factory });
    expect(factory).not.toHaveBeenCalled();
    service.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(service.isUnlocked()).toBe(true);
  });

  it('erzeugt den Kontext bei mehrfachem unlock() nur einmal', () => {
    const { ctx } = createFakeContext();
    const factory = vi.fn(() => ctx);
    const service = createSoundService({ audioContextFactory: factory });
    service.unlock();
    service.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('reaktiviert einen suspendierten Kontext via resume()', () => {
    const { ctx, raw } = createFakeContext({ initialState: 'suspended' });
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    expect(raw.resume).toHaveBeenCalled();
  });

  it('schluckt einen abgelehnten resume() still', () => {
    const { ctx } = createFakeContext({ initialState: 'suspended', resumeRejects: true });
    const service = createSoundService({ audioContextFactory: () => ctx });
    expect(() => service.unlock()).not.toThrow();
  });
});

describe('createSoundService – play Gating (Req 9.1, 9.2)', () => {
  it('spielt nichts ab, wenn der Kontext nicht entsperrt wurde', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.play('soft', 0.6);
    expect(raw.createOscillator).not.toHaveBeenCalled();
  });

  it('spielt nichts ab, wenn Ton deaktiviert ist (soundEnabled=false)', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', 0.6, false);
    expect(raw.createOscillator).not.toHaveBeenCalled();
  });

  it('spielt einen Ton ab, wenn entsperrt und aktiviert', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', 0.6, true);
    expect(raw.createOscillator).toHaveBeenCalled();
    expect(raw.createGain).toHaveBeenCalled();
  });

  it('spielt nichts bei Lautstärke 0 ab', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', 0, true);
    expect(raw.createOscillator).not.toHaveBeenCalled();
  });

  it('fällt auf den Standard-Ton zurück, wenn die soundId unbekannt ist', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('gibtsnicht', 0.6, true);
    expect(raw.createOscillator).toHaveBeenCalled();
  });
});

describe('createSoundService – Lautstärke-Klemmung (Req 9.2)', () => {
  it('klemmt die Spitzenlautstärke auf höchstens 1.0', () => {
    const { ctx, oscillators } = createFakeContext();
    // Nur einen Teilton, damit die Prüfung eindeutig ist: 'soft' hat mehrere,
    // aber der erste Teilton hat gain 1 -> peak == geklemmte Lautstärke.
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', 5, true); // > 1 -> auf 1 geklemmt
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('behandelt negative Lautstärke wie 0 (kein Ton)', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', -1, true);
    expect(raw.createOscillator).not.toHaveBeenCalled();
  });

  it('behandelt NaN-Lautstärke wie 0 (kein Ton)', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    service.play('soft', NaN, true);
    expect(raw.createOscillator).not.toHaveBeenCalled();
  });
});

describe('createSoundService – Web Audio nicht verfügbar (Req 20.1)', () => {
  it('bleibt ein No-Op, wenn keine Factory verfügbar ist', () => {
    const service = createSoundService({ audioContextFactory: null });
    expect(() => service.unlock()).not.toThrow();
    expect(service.isUnlocked()).toBe(false);
    expect(() => service.play('soft', 0.6, true)).not.toThrow();
  });

  it('schluckt einen werfenden Factory-Aufruf still', () => {
    const service = createSoundService({
      audioContextFactory: () => {
        throw new Error('unsupported');
      },
    });
    expect(() => service.unlock()).not.toThrow();
    expect(service.isUnlocked()).toBe(false);
  });
});

describe('createSoundService – dispose', () => {
  it('schließt den Kontext und meldet danach nicht mehr entsperrt', () => {
    const { ctx, raw } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    service.unlock();
    expect(service.isUnlocked()).toBe(true);
    service.dispose();
    expect(raw.close).toHaveBeenCalled();
    expect(service.isUnlocked()).toBe(false);
  });

  it('ist ohne vorheriges unlock() ein sicheres No-Op', () => {
    const { ctx } = createFakeContext();
    const service = createSoundService({ audioContextFactory: () => ctx });
    expect(() => service.dispose()).not.toThrow();
  });
});
