// useKeyboardShortcuts – globale Tastatursteuerung der App (Req 16.1–16.3).
//
// Design (.kiro/specs/pomodoro/design.md, Abschnitt „Tastatursteuerung"):
//
//   | Taste | Aktion                                   |
//   |-------|------------------------------------------|
//   | Space | Start/Pause (kontextabhängig)            |
//   | R     | Neustart (mit Bestätigung)               |
//   | S     | Überspringen                             |
//   | F     | Fokusmodus an                            |
//   | Esc   | Fokusmodus aus / Vollbild verlassen      |
//
// Leitprinzipien:
// - Der Hook ist BEWUSST unabhängig von `useTimer()`: Er nimmt reine Handler-Callbacks
//   entgegen und ist dadurch ohne Provider testbar. Die Verdrahtung mit dem Timer und
//   dem Fokusmodus-Zustand geschieht im aufrufenden `TimerView`.
// - Wenn der Fokus in einem Eingabeelement liegt (`input`, `textarea`, `select` oder
//   `[contenteditable]`), werden KEINE Shortcuts ausgelöst (Req 16.2). Ein separater,
//   exportierter Helfer `isEditableTarget` kapselt diese Erkennung testbar.
// - Buchstaben-Shortcuts sind Groß-/Kleinschreibung-unabhängig (r/R, s/S, f/F).
// - Für die Leertaste wird `preventDefault()` aufgerufen, damit die Seite nicht scrollt.
// - Über `enabled` (oder fehlende Handler) lässt sich der Hook abschalten – z. B. während
//   der Fokusmodus aktiv ist (dieser behandelt sein eigenes Esc) oder ein Dialog offen ist.
// - Der Listener wird beim Unmount sauber entfernt.

import { useEffect, useRef } from 'react';

/**
 * Handler-Callbacks für die unterstützten Shortcuts. Alle sind optional: Fehlt ein
 * Handler, wird die zugehörige Taste ignoriert (nützlich, um einzelne Shortcuts je nach
 * Kontext zu deaktivieren).
 */
export interface KeyboardShortcutHandlers {
  /** Leertaste: Start/Pause (kontextabhängig vom Timer-Status). */
  onToggleStartPause?: () => void;
  /** R: Neustart (der Aufrufer stellt die Sicherheitsabfrage bereit, Req 4.4). */
  onRestart?: () => void;
  /** S: Aktuelle Phase überspringen. */
  onSkip?: () => void;
  /** F: Fokusmodus aktivieren. */
  onEnterFocusMode?: () => void;
  /** Esc: Fokusmodus verlassen / Vollbild beenden. */
  onEscape?: () => void;
}

/** Optionen des Hooks. */
export interface UseKeyboardShortcutsOptions {
  /**
   * Ob die Shortcuts aktiv sind. Standard: true. Auf `false` gesetzt, wird kein
   * Listener registriert bzw. keine Aktion ausgelöst (z. B. im Fokusmodus oder bei
   * geöffnetem Dialog).
   */
  enabled?: boolean;
}

/**
 * Prüft, ob das Ereignisziel ein editierbares Element ist, in dem Shortcuts NICHT
 * ausgelöst werden sollen (Req 16.2): `input`, `textarea`, `select` oder ein Element
 * mit aktivem `contenteditable`.
 *
 * Reine, DOM-nahe Funktion – ohne React-Abhängigkeit und damit direkt testbar.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target == null) return false;

  // Nur echte Elemente können editierbar sein.
  const el = target as Partial<HTMLElement> & { tagName?: string };
  const tagName = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';

  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  // contenteditable: Das Property `isContentEditable` ist am zuverlässigsten; als
  // Fallback wird das Attribut ausgewertet (jsdom setzt `isContentEditable` nicht immer).
  const htmlEl = target as Partial<HTMLElement> & {
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };
  if (htmlEl.isContentEditable === true) {
    return true;
  }
  if (typeof htmlEl.getAttribute === 'function') {
    const attr = htmlEl.getAttribute('contenteditable');
    if (attr != null && attr !== 'false') {
      return true;
    }
  }

  return false;
}

/**
 * Ordnet ein Tastatur-Ereignis dem passenden Handler zu und führt ihn aus. Kapselt die
 * Tastenzuordnung (inkl. `preventDefault` für die Leertaste) und die Groß-/Klein-
 * schreibungs-Unabhängigkeit der Buchstaben. Exportiert für gezielte Unit-Tests.
 *
 * @returns true, wenn ein Handler ausgelöst wurde, sonst false.
 */
export function dispatchShortcut(
  event: KeyboardEvent,
  handlers: KeyboardShortcutHandlers,
): boolean {
  // In Eingabefeldern niemals auslösen (Req 16.2).
  if (isEditableTarget(event.target)) {
    return false;
  }

  const key = event.key;

  // Leertaste: `event.key` ist ' ' (Space); manche Umgebungen liefern 'Spacebar'.
  if (key === ' ' || key === 'Spacebar' || event.code === 'Space') {
    // Standard-Scrollverhalten der Leertaste unterdrücken.
    event.preventDefault();
    if (handlers.onToggleStartPause) {
      handlers.onToggleStartPause();
      return true;
    }
    return false;
  }

  if (key === 'Escape' || key === 'Esc') {
    if (handlers.onEscape) {
      handlers.onEscape();
      return true;
    }
    return false;
  }

  // Buchstaben-Shortcuts case-insensitiv behandeln.
  const lower = typeof key === 'string' ? key.toLowerCase() : '';
  switch (lower) {
    case 'r':
      if (handlers.onRestart) {
        handlers.onRestart();
        return true;
      }
      return false;
    case 's':
      if (handlers.onSkip) {
        handlers.onSkip();
        return true;
      }
      return false;
    case 'f':
      if (handlers.onEnterFocusMode) {
        handlers.onEnterFocusMode();
        return true;
      }
      return false;
    default:
      return false;
  }
}

/**
 * Registriert einen globalen `keydown`-Listener, der die unterstützten Shortcuts auf die
 * übergebenen Handler abbildet (Req 16.1). Ignoriert Eingabefelder (Req 16.2) und lässt
 * sich über `enabled` abschalten. Der Listener wird beim Unmount entfernt.
 *
 * Die Handler werden über eine Ref gehalten, damit der Listener bei sich ändernden
 * Callbacks stabil bleibt und nicht bei jedem Render neu registriert werden muss.
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  options: UseKeyboardShortcutsOptions = {},
): void {
  const { enabled = true } = options;

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      dispatchShortcut(event, handlersRef.current);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
