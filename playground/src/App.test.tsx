import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function setLatency(value: string) {
  const latency = screen.getByLabelText('Latency');
  fireEvent.input(latency, { target: { value } });
  fireEvent.change(latency, { target: { value } });
}

describe('playground inbox', () => {
  it('keeps a failed note, restores it with Edit, and can retry into Saved', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(screen.getByLabelText('Reduced motion'));
    setLatency('0');

    await user.click(screen.getByLabelText('Fail requests'));
    const note = screen.getByLabelText('Note');
    await user.type(note, 'draft note{Enter}');

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('draft note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry sending “draft note”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit “draft note”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss “draft note”' })).toBeInTheDocument();
    expect(note).toHaveValue('');
    expect(note).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Edit “draft note”' }));
    expect(note).toHaveValue('draft note');
    expect(note).toHaveFocus();
    expect(screen.getByText('draft note')).toBeInTheDocument();

    await user.clear(note);
    await user.click(screen.getByLabelText('Fail requests'));
    await user.click(screen.getByRole('button', { name: 'Retry sending “draft note”' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(screen.getByText('draft note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry sending/ })).not.toBeInTheDocument();
  });

  it('leaves the composer usable during a pending note and moves focus when dismiss removes it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Reduced motion'));
    setLatency('4000');
    await user.click(screen.getByLabelText('Fail requests'));

    const note = screen.getByLabelText('Note');
    await user.type(note, 'while pending');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Pending')).toBeInTheDocument();
    await user.type(note, 'still here');
    expect(note).toHaveValue('still here');

    setLatency('0');
    await user.clear(note);
    await user.type(note, 'gone{Enter}');
    const dismiss = await screen.findByRole('button', { name: 'Dismiss “gone”' });
    dismiss.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('listitem')).toHaveFocus());
    expect(screen.queryByText('gone')).not.toBeInTheDocument();
    expect(screen.getByText('while pending')).toBeInTheDocument();
  });
});
