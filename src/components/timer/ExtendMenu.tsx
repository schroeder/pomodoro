// ExtendMenu – Zeitverlängerung um +1/+5/+10 Minuten (Req 4.7).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht" →
// „TimerControls" / „Verlängern (+1/+5/+10, Menü)"):
// - Bietet die drei festen Optionen +1, +5 und +10 Minuten an. Ein Klick ruft
//   `onExtend(ms)` mit `ms = minuten * 60000` auf; der Provider verlängert damit die
//   geplante Endzeit (Req 4.7).
// - Umsetzung als aufklappbares Menü, damit die Steuerung kompakt bleibt. Der Toggle-Button
//   trägt `aria-haspopup="menu"` und `aria-expanded`; die Optionen liegen in einer
//   `role="menu"`-Gruppe mit `role="menuitem"`-Einträgen (Req 18.1/18.2).
//
// Rein präsentational: erhält `onExtend` als Callback und ist damit ohne Provider testbar.

import { useEffect, useRef, useState } from 'react';
import styles from './ExtendMenu.module.css';

/** Eine Minute in Millisekunden. */
export const MINUTE_MS = 60_000;

/** Die anzubietenden Verlängerungen in Minuten (Req 4.7). */
export const EXTEND_OPTIONS_MINUTES = [1, 5, 10] as const;

export interface ExtendMenuProps {
  /**
   * Wird mit der Verlängerung in Millisekunden aufgerufen (Minuten × 60000).
   * Entspricht der `extend(ms)`-Aktion des TimerProviders.
   */
  onExtend: (ms: number) => void;
  /** Deaktiviert die Steuerung (z. B. wenn keine Phase läuft). */
  disabled?: boolean;
}

/**
 * Rendert einen Toggle-Button „Verlängern", der ein Menü mit +1/+5/+10 Minuten öffnet.
 * Bei Auswahl wird `onExtend(minuten × 60000)` aufgerufen und das Menü geschlossen.
 */
export default function ExtendMenu({ onExtend, disabled = false }: ExtendMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Menü bei Klick außerhalb und bei Esc schließen.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = (minutes: number) => {
    onExtend(minutes * MINUTE_MS);
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        className={styles.toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        Verlängern
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Zeit verlängern">
          {EXTEND_OPTIONS_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => handleSelect(minutes)}
            >
              +{minutes} Minuten
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
