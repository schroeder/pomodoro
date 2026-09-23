// SoundService – kurze, dezente Signaltöne am Phasenende (Req 9).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt SoundService):
// - Nutzt die Web Audio API. Ein AudioContext wird erst NACH der ersten
//   Nutzergeste (Start-Klick/Tastendruck) erzeugt bzw. resume()-t, um
//   Autoplay-Blockaden zu umgehen (Req 9.3).
// - Bietet mehrere kurze, synthetisch erzeugte Töne (Oszillator + kurze
//   Hüllkurve), damit keine Audiodateien nötig sind und es offline
//   funktioniert (Req 9.1, 9.4).
// - play(soundId, volume) respektiert soundEnabled/volume (Req 9.2).
// - Alle AudioContext-Zugriffe sind in try/catch gekapselt, damit ein
//   blockierter/nicht unterstützter Kontext still fehlschlägt
//   (Req 9.3 / 20.1).

/** Minimaler Ausschnitt der Web-Audio-Typen, den der Service benötigt. */
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: AudioNode;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** Factory, die einen AudioContext erzeugt (injizierbar für Tests). */
export type AudioContextFactory = () => AudioContextLike;

/** Ein einzelner Teilton eines Signals (ein Oszillator-Anschlag). */
interface Partial {
  /** Grundfrequenz in Hz. */
  frequency: number;
  /** Wellenform des Oszillators. */
  type: OscillatorType;
  /** Versatz des Anschlags relativ zum Signalbeginn in Sekunden. */
  delay: number;
  /** Dauer der Hüllkurve (Attack + Release) in Sekunden. */
  duration: number;
  /** Relative Spitzenlautstärke dieses Teiltons (0..1). */
  gain: number;
}

/** Definition eines auswählbaren Signaltons. */
interface ToneDefinition {
  id: string;
  /** Für die Einstellungs-UI (Req 9.2). */
  label: string;
  partials: Partial[];
}

/** Ton-Eintrag für die Einstellungs-UI. */
export interface SoundOption {
  id: string;
  label: string;
}

// Katalog kurzer, nicht aggressiver Töne (jeweils wenige Sekunden, Req 9.1).
const TONES: ToneDefinition[] = [
  {
    id: 'soft',
    label: 'Sanft',
    partials: [
      { frequency: 660, type: 'sine', delay: 0, duration: 0.9, gain: 1 },
      { frequency: 990, type: 'sine', delay: 0.12, duration: 0.8, gain: 0.5 },
    ],
  },
  {
    id: 'chime',
    label: 'Glocke',
    partials: [
      { frequency: 880, type: 'sine', delay: 0, duration: 1.1, gain: 0.9 },
      { frequency: 1318.5, type: 'sine', delay: 0.18, duration: 1.0, gain: 0.6 },
      { frequency: 1760, type: 'sine', delay: 0.36, duration: 0.9, gain: 0.35 },
    ],
  },
  {
    id: 'marimba',
    label: 'Marimba',
    partials: [
      { frequency: 523.25, type: 'triangle', delay: 0, duration: 0.5, gain: 0.9 },
      { frequency: 783.99, type: 'triangle', delay: 0.14, duration: 0.5, gain: 0.7 },
      { frequency: 1046.5, type: 'triangle', delay: 0.28, duration: 0.5, gain: 0.5 },
    ],
  },
];

const DEFAULT_TONE_ID = 'soft';

/** Öffentliche Ton-Liste für die Einstellungs-UI (Req 9.2). */
export const AVAILABLE_SOUNDS: readonly SoundOption[] = TONES.map((t) => ({
  id: t.id,
  label: t.label,
}));

/** Optionen zur Erzeugung eines SoundService. */
export interface SoundServiceOptions {
  /**
   * Factory für den AudioContext. Standard: der native AudioContext
   * (bzw. webkitAudioContext). In Tests/ohne Web Audio injizierbar.
   */
  audioContextFactory?: AudioContextFactory | null;
}

/** Öffentliche Schnittstelle des SoundService. */
export interface SoundService {
  /**
   * Erzeugt bzw. reaktiviert den AudioContext. MUSS aus einer Nutzergeste
   * heraus aufgerufen werden (Start-Klick/Tastendruck), um Autoplay-Blockaden
   * zu umgehen (Req 9.3).
   */
  unlock(): void;
  /** Ob der AudioContext bereits nach einer Nutzergeste bereit ist. */
  isUnlocked(): boolean;
  /**
   * Spielt den Ton `soundId` mit `volume` (0..1) ab, sofern der Ton aktiviert
   * und der Kontext entsperrt ist. Kein Ton, wenn deaktiviert, nicht entsperrt
   * oder Web Audio nicht verfügbar (Req 9.1, 9.2, 9.3).
   */
  play(soundId: string, volume: number, soundEnabled?: boolean): void;
  /** Gibt den AudioContext frei (z. B. beim Unmount). */
  dispose(): void;
}

/**
 * Ermittelt die native AudioContext-Factory, falls die Web Audio API im
 * aktuellen Environment verfügbar ist. Gibt sonst null zurück (z. B. jsdom).
 */
function resolveNativeFactory(): AudioContextFactory | null {
  try {
    const g = globalThis as unknown as {
      AudioContext?: new () => AudioContextLike;
      webkitAudioContext?: new () => AudioContextLike;
    };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return null;
    return () => new Ctor();
  } catch {
    return null;
  }
}

/** Klemmt einen Wert auf [0, 1]; ungültige Werte werden zu 0. */
function clampVolume(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function findTone(soundId: string): ToneDefinition {
  return TONES.find((t) => t.id === soundId) ?? TONES.find((t) => t.id === DEFAULT_TONE_ID)!;
}

/**
 * Erzeugt einen SoundService. Die AudioContext-Factory ist injizierbar,
 * sodass die Gating-Logik ohne echte Audio-Hardware testbar ist.
 */
export function createSoundService(options: SoundServiceOptions = {}): SoundService {
  const factory =
    options.audioContextFactory === undefined
      ? resolveNativeFactory()
      : options.audioContextFactory;

  let ctx: AudioContextLike | null = null;

  function unlock(): void {
    if (!factory) return; // Web Audio nicht verfügbar -> still ignorieren (Req 20.1).
    try {
      if (!ctx) {
        ctx = factory();
      }
      // Nach Autoplay-Blockade befindet sich der Kontext im Zustand
      // 'suspended' und muss durch eine Nutzergeste reaktiviert werden.
      if (ctx && ctx.state === 'suspended') {
        // resume() kann ein Promise ablehnen -> Fehler still schlucken.
        void ctx.resume().catch(() => {});
      }
    } catch {
      // Blockierter/nicht unterstützter Kontext -> still fehlschlagen (Req 9.3).
      ctx = null;
    }
  }

  function isUnlocked(): boolean {
    return ctx != null && ctx.state !== 'closed';
  }

  function play(soundId: string, volume: number, soundEnabled = true): void {
    // Respektiert soundEnabled (Req 9.2) und verlangt eine vorherige Nutzergeste (Req 9.3).
    if (!soundEnabled) return;
    if (!ctx) return;

    const level = clampVolume(volume);
    if (level === 0) return; // Bei stumm nichts erzeugen.

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const tone = findTone(soundId);
      const now = ctx.currentTime;

      for (const partial of tone.partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = partial.type;
        osc.frequency.value = partial.frequency;

        const start = now + partial.delay;
        const peak = level * partial.gain;
        const attack = 0.01;
        const stop = start + partial.duration;

        // Kurze Hüllkurve: schneller Attack, sanftes exponentielles Ausklingen.
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(Math.max(peak, 0.0001), start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, stop);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(stop + 0.02);
      }
    } catch {
      // Fehler beim Erzeugen der Audio-Nodes still ignorieren (Req 20.1).
    }
  }

  function dispose(): void {
    if (!ctx) return;
    try {
      void ctx.close().catch(() => {});
    } catch {
      // ignorieren
    } finally {
      ctx = null;
    }
  }

  return { unlock, isUnlocked, play, dispose };
}
