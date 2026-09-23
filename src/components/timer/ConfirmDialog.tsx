// ConfirmDialog – wiederverwendbarer, zugänglicher Bestätigungsdialog (Req 4.4, 4.8).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „TimerView / Hauptansicht" →
// „Bestätigungsdialoge"):
// - Wird für den Neustart (Req 4.4) und „Phase früher abschließen" (Req 4.8) verwendet.
// - Zugänglichkeit (Req 18.1/18.2): `role="dialog"`, `aria-modal="true"`, per
//   `aria-labelledby`/`aria-describedby` beschriftet. Beim Öffnen erhält der
//   Abbrechen-Button (die sichere Standardaktion) den Fokus. Esc bricht ab.
//
// Rein präsentational: erhält Texte und `onConfirm`/`onCancel`-Callbacks als Props und
// ist damit ohne Provider testbar. Rendert nichts, solange `open` false ist.

import { useEffect, useId, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  /** Steuert die Sichtbarkeit. Ist der Wert false, wird nichts gerendert. */
  open: boolean;
  /** Überschrift/Frage des Dialogs (z. B. „Fokusphase als abgeschlossen markieren?"). */
  title: string;
  /** Optionaler erläuternder Text unterhalb des Titels. */
  description?: string;
  /** Beschriftung der Bestätigungsaktion. Standard: „Bestätigen". */
  confirmLabel?: string;
  /** Beschriftung der Abbruchaktion. Standard: „Abbrechen". */
  cancelLabel?: string;
  /** Wird bei Bestätigung aufgerufen. */
  onConfirm: () => void;
  /** Wird bei Abbruch (Button, Esc, Klick auf Overlay) aufgerufen. */
  onCancel: () => void;
}

/**
 * Rendert einen modalen Bestätigungsdialog. Fokussiert beim Öffnen den Abbrechen-Button,
 * schließt bei Esc über `onCancel` und bietet klar getrennte Bestätigen-/Abbrechen-Aktionen.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Beim Öffnen den Abbrechen-Button (sichere Standardaktion) fokussieren.
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Esc bricht ab, solange der Dialog offen ist.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      // Klick auf das Overlay (außerhalb der Box) bricht ab.
      onClick={onCancel}
      data-testid="confirm-overlay"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        // Klicks innerhalb der Box nicht bis zum Overlay durchreichen.
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description != null && (
          <p id={descId} className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
