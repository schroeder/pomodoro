import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExtendMenu, { MINUTE_MS } from './ExtendMenu';

// Tests für die Zeitverlängerung +1/+5/+10 Minuten (Task 9.2, Req 4.7).
describe('ExtendMenu', () => {
  it('zeigt zunächst nur den Toggle-Button und kein Menü', () => {
    render(<ExtendMenu onExtend={() => {}} />);
    expect(screen.getByRole('button', { name: 'Verlängern' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('öffnet das Menü mit den drei Optionen +1/+5/+10', async () => {
    const user = userEvent.setup();
    render(<ExtendMenu onExtend={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '+1 Minuten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '+5 Minuten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '+10 Minuten' })).toBeInTheDocument();
  });

  it('ruft onExtend mit den korrekten Millisekunden für +1 auf', async () => {
    const user = userEvent.setup();
    const onExtend = vi.fn();
    render(<ExtendMenu onExtend={onExtend} />);
    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    await user.click(screen.getByRole('menuitem', { name: '+1 Minuten' }));
    expect(onExtend).toHaveBeenCalledWith(1 * MINUTE_MS);
  });

  it('ruft onExtend mit den korrekten Millisekunden für +5 und +10 auf', async () => {
    const user = userEvent.setup();
    const onExtend = vi.fn();
    render(<ExtendMenu onExtend={onExtend} />);

    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    await user.click(screen.getByRole('menuitem', { name: '+5 Minuten' }));
    expect(onExtend).toHaveBeenLastCalledWith(5 * MINUTE_MS);

    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    await user.click(screen.getByRole('menuitem', { name: '+10 Minuten' }));
    expect(onExtend).toHaveBeenLastCalledWith(10 * MINUTE_MS);
  });

  it('schließt das Menü nach der Auswahl', async () => {
    const user = userEvent.setup();
    render(<ExtendMenu onExtend={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Verlängern' }));
    await user.click(screen.getByRole('menuitem', { name: '+5 Minuten' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('deaktiviert den Toggle, wenn disabled=true', () => {
    render(<ExtendMenu onExtend={() => {}} disabled />);
    expect(screen.getByRole('button', { name: 'Verlängern' })).toBeDisabled();
  });
});
