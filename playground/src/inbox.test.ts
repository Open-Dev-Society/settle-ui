import { describe, expect, it } from 'vitest';
import { abortAll, inboxReducer, initialInbox, startRequest, type InboxState } from './inbox';

function submit(state: InboxState, text: string): InboxState {
  return inboxReducer(inboxReducer(state, { type: 'draft', text }), { type: 'submit' });
}

describe('inboxReducer', () => {
  it('adds a pending note and clears the composer without trimming the text', () => {
    const next = submit(initialInbox, '  hello  ');
    expect(next.draft).toBe('');
    expect(next.items).toEqual([
      { id: 'note-1', text: '  hello  ', status: 'pending', attempt: 1 },
    ]);
  });

  it('ignores an empty draft and keeps it', () => {
    const drafted = inboxReducer(initialInbox, { type: 'draft', text: '   ' });
    expect(inboxReducer(drafted, { type: 'submit' })).toBe(drafted);
  });

  it('keeps the text on failure and ignores a stale resolution', () => {
    const pending = submit(initialInbox, 'hello');
    const failed = inboxReducer(pending, {
      type: 'reject',
      id: 'note-1',
      attempt: 1,
      error: 'Simulated network failure',
    });
    expect(failed.items[0]).toMatchObject({
      text: 'hello',
      status: 'error',
      attempt: 1,
      error: 'Simulated network failure',
    });
    expect(failed.announcement).toContain('hello');
    expect(failed.announcement).toContain('Retry available');

    const retried = inboxReducer(failed, { type: 'retry', id: 'note-1' });
    expect(retried.items[0]).toMatchObject({ text: 'hello', status: 'pending', attempt: 2 });
    const stale = inboxReducer(retried, {
      type: 'reject',
      id: 'note-1',
      attempt: 1,
      error: 'late',
    });
    expect(stale).toBe(retried);
    const saved = inboxReducer(retried, { type: 'resolve', id: 'note-1', attempt: 2 });
    expect(saved.items[0]).toMatchObject({ text: 'hello', status: 'success', attempt: 2 });
  });

  it('resolves concurrent notes out of order without mixing them', () => {
    const first = submit(initialInbox, 'one');
    const second = submit(first, 'two');
    const twoFirst = inboxReducer(second, { type: 'resolve', id: 'note-2', attempt: 1 });
    const both = inboxReducer(twoFirst, { type: 'resolve', id: 'note-1', attempt: 1 });
    expect(both.items.map((item) => [item.id, item.text, item.status])).toEqual([
      ['note-1', 'one', 'success'],
      ['note-2', 'two', 'success'],
    ]);
  });

  it('edits a failed draft back into the composer and dismisses only errors', () => {
    const failed = inboxReducer(submit(initialInbox, 'keep me'), {
      type: 'reject',
      id: 'note-1',
      attempt: 1,
      error: 'nope',
    });
    const edited = inboxReducer(failed, { type: 'edit', id: 'note-1' });
    expect(edited.draft).toBe('keep me');
    expect(edited.items).toHaveLength(1);

    const saved = inboxReducer(submit(initialInbox, 'stay'), {
      type: 'resolve',
      id: 'note-1',
      attempt: 1,
    });
    expect(inboxReducer(saved, { type: 'dismiss', id: 'note-1' })).toBe(saved);
    expect(inboxReducer(saved, { type: 'retry', id: 'note-1' }).items[0]?.status).toBe('success');
    expect(inboxReducer(failed, { type: 'dismiss', id: 'note-1' }).items).toEqual([]);
  });

  it('ignores a second settlement for the same attempt', () => {
    const pending = submit(initialInbox, 'once');
    const saved = inboxReducer(pending, { type: 'resolve', id: 'note-1', attempt: 1 });
    expect(inboxReducer(saved, { type: 'reject', id: 'note-1', attempt: 1, error: 'late' })).toBe(saved);
  });
});

describe('request controllers', () => {
  it('aborts the previous attempt and every controller on cleanup', () => {
    const controllers = new Map<string, AbortController>();
    const first = startRequest(controllers, 'note-1');
    const second = startRequest(controllers, 'note-1');
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    abortAll(controllers);
    expect(second.aborted).toBe(true);
    expect(controllers.size).toBe(0);
  });
});
