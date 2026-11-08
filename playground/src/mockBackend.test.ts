import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIMULATED_FAILURE, isAbortError, sendNote } from './mockBackend';

afterEach(() => {
  vi.useRealTimers();
});

describe('sendNote', () => {
  it('resolves or rejects from the fail flag, not from chance', async () => {
    vi.useFakeTimers();
    const ok = sendNote({ latencyMs: 400, fail: false });
    const bad = sendNote({ latencyMs: 400, fail: true });
    const okDone = expect(ok).resolves.toBeUndefined();
    const badDone = expect(bad).rejects.toThrow(SIMULATED_FAILURE);
    await vi.advanceTimersByTimeAsync(400);
    await okDone;
    await badDone;
  });

  it('clears the timer when aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sendNote({ latencyMs: 5000, fail: false, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toSatisfy(isAbortError);
    await vi.advanceTimersByTimeAsync(5000);
  });
});
