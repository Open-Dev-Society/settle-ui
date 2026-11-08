import { StrictMode, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Settle } from './Settle';
import type { SettleStatus } from './types';

afterEach(() => {
  document.body.innerHTML = '';
});

function StatusHarness({ onSettled }: { onSettled: () => void }) {
  const [status, setStatus] = useState<SettleStatus>('pending');
  return (
    <>
      <button type="button" onClick={() => setStatus('success')}>
        succeed
      </button>
      <button type="button" onClick={() => setStatus('pending')}>
        pend
      </button>
      <button type="button" onClick={() => setStatus('error')}>
        fail
      </button>
      <Settle status={status} reducedMotion onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>
    </>
  );
}

describe('Settle', () => {
  it('marks a pending row busy and leaves the text available', () => {
    render(
      <Settle status="pending">
        <p>Readable note</p>
      </Settle>,
    );

    const row = document.querySelector('.settle');
    if (!row) throw new Error('missing settle row');
    expect(row).toHaveAttribute('aria-busy', 'true');
    expect(row).toHaveAttribute('data-status', 'pending');
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.getByText('Readable note')).toBeInTheDocument();

    for (const node of document.querySelectorAll('.settle-rim, .settle-sweep, .settle-particles')) {
      expect(node).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByText('Readable note').closest('.settle-body')).not.toBeNull();
  });

  it('calls onSettled once per success transition, including reduced motion and strict mode', async () => {
    const onSettled = vi.fn();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <StatusHarness onSettled={onSettled} />
      </StrictMode>,
    );

    expect(onSettled).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'succeed' }));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.settle')?.getAttribute('data-phase')).toBe('settled');

    await user.click(screen.getByRole('button', { name: 'succeed' }));
    expect(onSettled).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'pend' }));
    await user.click(screen.getByRole('button', { name: 'succeed' }));
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it('does not call onSettled when a success sweep is cancelled', async () => {
    const onSettled = vi.fn();
    const { rerender, unmount } = render(
      <Settle status="pending" onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>,
    );

    rerender(
      <Settle status="success" onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>,
    );
    rerender(
      <Settle status="error" onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>,
    );
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onSettled).not.toHaveBeenCalled();
    expect(screen.getByText('Readable note')).toBeInTheDocument();
    unmount();
    expect(document.querySelector('.settle-particle')).toBeNull();
  });

  it('dissolves into particles and removes them', async () => {
    const { rerender, unmount } = render(
      <Settle status="pending" reducedMotion={false}>
        <p>Readable note</p>
      </Settle>,
    );
    rerender(
      <Settle status="error" reducedMotion={false}>
        <p>Readable note</p>
      </Settle>,
    );

    expect(document.querySelectorAll('.settle-particle').length).toBeGreaterThan(0);
    expect(screen.getByText('Readable note')).toBeInTheDocument();
    expect(document.querySelector('.settle')?.getAttribute('data-status')).toBe('error');

    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(document.querySelector('.settle-particle')).toBeNull();
    expect(document.querySelector('.settle')?.getAttribute('data-phase')).toBe('error');

    rerender(
      <Settle status="pending" reducedMotion={false}>
        <p>Readable note</p>
      </Settle>,
    );
    rerender(
      <Settle status="error" reducedMotion={false}>
        <p>Readable note</p>
      </Settle>,
    );
    expect(document.querySelectorAll('.settle-particle').length).toBeGreaterThan(0);
    unmount();
    expect(document.querySelector('.settle-particle')).toBeNull();
  });

  it('skips particles and running animations when motion is reduced', async () => {
    const onSettled = vi.fn();
    const { rerender } = render(
      <Settle status="pending" reducedMotion>
        <p>Readable note</p>
      </Settle>,
    );
    rerender(
      <Settle status="error" reducedMotion>
        <p>Readable note</p>
      </Settle>,
    );
    expect(document.querySelector('.settle-particle')).toBeNull();
    expect(document.querySelector('.settle')?.getAttribute('data-phase')).toBe('error');

    rerender(
      <Settle status="pending" reducedMotion onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>,
    );
    rerender(
      <Settle status="success" reducedMotion onSettled={onSettled}>
        <p>Readable note</p>
      </Settle>,
    );
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.settle-particle')).toBeNull();
  });
});
