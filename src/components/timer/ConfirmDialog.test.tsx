import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

// Tests für den wiederverwendbaren Bestätigungsdialog (Task 9.2, Req 4.4, 4.8, 18.1).
describe('ConfirmDialog', () => {
  it('rendert nichts, solange open=false ist', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Frage?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rendert einen modalen Dialog mit Titel und Beschreibung (Req 18.1)', () => {
    render(
      <ConfirmDialog
        open
        title="Phase neu starten?"
        description="Die Phase wird zurückgesetzt."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Phase neu starten?')).toBeInTheDocument();
    expect(screen.getByText('Die Phase wird zurückgesetzt.')).toBeInTheDocument();
  });

  it('ruft onConfirm beim Klick auf Bestätigen auf', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Frage?"
        confirmLabel="Bestätigen"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ruft onCancel beim Klick auf Abbrechen auf', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Frage?"
        cancelLabel="Abbrechen"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('bricht bei Esc über onCancel ab', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Frage?" onConfirm={() => {}} onCancel={onCancel} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fokussiert beim Öffnen den Abbrechen-Button (sichere Standardaktion)', () => {
    render(
      <ConfirmDialog
        open
        title="Frage?"
        cancelLabel="Abbrechen"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });
});
