export const SIMULATED_FAILURE = 'Simulated network failure';

export type SendOptions = {
  latencyMs: number;
  fail: boolean;
  signal?: AbortSignal;
};

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Local timer. Nothing leaves the browser. */
export function sendNote({ latencyMs, fail, signal }: SendOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      if (fail) reject(new Error(SIMULATED_FAILURE));
      else resolve();
    }, latencyMs);

    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
