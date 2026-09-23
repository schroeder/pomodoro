// Tests für useKeyboardShortcuts (Req 16.1–16.3).
//
// Abgedeckt:
// - Jede Taste ruft den korrekten Handler auf (Space, R, S, F, Esc) (Req 16.1).
// - Buchstaben sind case-insensitiv (r/R, s/S, f/F).
// - Space unterdrückt das Standardverhalten (preventDefault → kein Scrollen).
// - KEIN Handler feuert, wenn das Ziel ein Eingabefeld ist
//   (input/textarea/select/[contenteditable]) (Req 16.2).
// - Der Listener wird beim Unmount entfernt.
// - Das `enabled: false`-Flag unterdrückt die Behandlung.
//
// Die reine Zuordnungslogik wird über `dispatchShortcut`/`isEditableTarget` direkt
// getestet; die Registrierung/Aufräumung des Listeners über `renderHook` mit echten
// DOM-Events (jsdom).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  dispatchShortcut,
  isEditableTarget,
  type KeyboardShortcutHandlers,
} from './useKeyboardShortcuts';

/** Erzeugt einen Satz gemockter Handler. */
function makeHandlers(): Required<KeyboardShortcutHandlers> & {
  [K in keyof KeyboardShortcutHandlers]: ReturnType<typeof vi.fn>;
} {
  return {
    onToggleStartPause: vi.fn(),
    onRestart: vi.fn(),
    onSkip: vi.fn(),
    onEnterFocusMode: vi.fn(),
    onEscape: vi.fn(),
  };
}

/** Feuert ein echtes keydown-Event am document (bubbelt vom Ziel). */
function fireKeyDown(
  init: KeyboardEventInit,
  target: EventTarget = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  // dispatchEvent auf dem gewünschten Ziel, damit event.target korrekt gesetzt ist.
  target.dispatchEvent(event);
  return event;
}

describe('isEditableTarget', () => {
  it('erkennt input, textarea und select als editierbar', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
  });

  it('erkennt contenteditable-Elemente als editierbar', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('behandelt contenteditable="false" als nicht editierbar', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'false');
    expect(isEditableTarget(div)).toBe(false);
  });

  it('behandelt gewöhnliche Elemente und null als nicht editierbar', () => {
    const button = document.createElement('button');
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('dispatchShortcut', () => {
  it('ruft für die Leertaste onToggleStartPause auf und verhindert das Standardverhalten', () => {
    const handlers = makeHandlers();
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');

    const handled = dispatchShortcut(event, handlers);

    expect(handled).toBe(true);
    expect(handlers.onToggleStartPause).toHaveBeenCalledTimes(1);
    expect(preventSpy).toHaveBeenCalled();
  });

  it('ordnet R, S, F, Esc den korrekten Handlern zu', () => {
    const handlers = makeHandlers();

    dispatchShortcut(new KeyboardEvent('keydown', { key: 'r' }), handlers);
    dispatchShortcut(new KeyboardEvent('keydown', { key: 's' }), handlers);
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'f' }), handlers);
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }), handlers);

    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
    expect(handlers.onEnterFocusMode).toHaveBeenCalledTimes(1);
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  it('behandelt Buchstaben case-insensitiv (R/S/F)', () => {
    const handlers = makeHandlers();

    dispatchShortcut(new KeyboardEvent('keydown', { key: 'R' }), handlers);
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'S' }), handlers);
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'F' }), handlers);

    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
    expect(handlers.onEnterFocusMode).toHaveBeenCalledTimes(1);
  });

  it('löst KEINE Aktion aus, wenn das Ziel ein Eingabefeld ist (Req 16.2)', () => {
    const handlers = makeHandlers();
    const input = document.createElement('input');
    document.body.appendChild(input);

    // Echtes dispatchEvent setzt event.target auf das input-Element.
    const event = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
    input.dispatchEvent(event);
    const handled = dispatchShortcut(event, handlers);
    input.remove();

    expect(handled).toBe(false);
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('gibt false zurück und feuert nichts für unbekannte Tasten', () => {
    const handlers = makeHandlers();
    const handled = dispatchShortcut(new KeyboardEvent('keydown', { key: 'x' }), handlers);
    expect(handled).toBe(false);
  });
});

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registriert einen keydown-Listener und leitet Tasten an Handler weiter', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    fireKeyDown({ key: ' ' });
    fireKeyDown({ key: 'r' });
    fireKeyDown({ key: 's' });
    fireKeyDown({ key: 'f' });
    fireKeyDown({ key: 'Escape' });

    expect(handlers.onToggleStartPause).toHaveBeenCalledTimes(1);
    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
    expect(handlers.onEnterFocusMode).toHaveBeenCalledTimes(1);
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  it('feuert keinen Handler, wenn das Ereignis von einem input stammt (Req 16.2)', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKeyDown({ key: 'r' }, input);
    input.remove();

    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('entfernt den Listener beim Unmount', () => {
    const handlers = makeHandlers();
    const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));

    unmount();
    fireKeyDown({ key: 'r' });

    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('unterdrückt die Behandlung, wenn enabled=false ist', () => {
    const handlers = makeHandlers();
    renderHook(() => useKeyboardShortcuts(handlers, { enabled: false }));

    fireKeyDown({ key: 'r' });
    fireKeyDown({ key: ' ' });

    expect(handlers.onRestart).not.toHaveBeenCalled();
    expect(handlers.onToggleStartPause).not.toHaveBeenCalled();
  });
});
