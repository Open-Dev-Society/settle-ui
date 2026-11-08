import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Settle, type SettlePalette } from 'settle-ui';
import { abortAll, inboxReducer, initialInbox, startRequest, type InboxItem } from './inbox';
import { isAbortError, sendNote } from './mockBackend';

type MotionChoice = 'system' | 'full' | 'reduced';

const PALETTES: { id: SettlePalette; label: string }[] = [
  { id: 'opal', label: 'Opal' },
  { id: 'amber', label: 'Amber' },
  { id: 'mint', label: 'Mint' },
];

const USAGE = `import { Settle } from 'settle-ui';
import 'settle-ui/style.css';

<Settle
  status={item.status} // 'pending' | 'success' | 'error'
  palette="opal"       // 'opal' | 'amber' | 'mint'
  onSettled={() => markSaved(item.id, item.attempt)}
>
  <p>{item.text}</p>
</Settle>

// Keep the attempt that started the request.
// Drop a result when item.attempt has moved on.`;

export function App() {
  const [state, dispatch] = useReducer(inboxReducer, initialInbox);
  const [latency, setLatency] = useState(1100);
  const [fail, setFail] = useState(false);
  const [palette, setPalette] = useState<SettlePalette>('opal');
  const [motion, setMotion] = useState<MotionChoice>('system');
  const [spoken, setSpoken] = useState('');
  const [hardened, setHardened] = useState<Record<string, number>>({});

  const failRef = useRef(fail);
  const latencyRef = useRef(latency);
  const mounted = useRef(true);
  const savedKey = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const composerRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  failRef.current = fail;
  latencyRef.current = latency;

  useEffect(() => {
    mounted.current = true;
    const controllersAtMount = controllers.current;
    return () => {
      mounted.current = false;
      abortAll(controllersAtMount);
    };
  }, []);

  useEffect(() => {
    if (state.announcement) setSpoken(state.announcement);
  }, [state.announcement]);

  function begin(id: string, attempt: number) {
    const signal = startRequest(controllers.current, id);
    const shouldFail = failRef.current;
    const latencyMs = latencyRef.current;
    sendNote({ latencyMs, fail: shouldFail, signal }).then(
      () => {
        if (!mounted.current || signal.aborted) return;
        dispatch({ type: 'resolve', id, attempt });
      },
      (error: unknown) => {
        if (!mounted.current || signal.aborted || isAbortError(error)) return;
        const message = error instanceof Error ? error.message : 'Failed to send';
        dispatch({ type: 'reject', id, attempt, error: message });
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.draft.trim()) return;
    const id = `note-${state.seq + 1}`;
    dispatch({ type: 'submit' });
    begin(id, 1);
  }

  function onRetry(item: InboxItem) {
    if (item.status !== 'error') return;
    const attempt = item.attempt + 1;
    dispatch({ type: 'retry', id: item.id });
    begin(item.id, attempt);
  }

  function onEdit(item: InboxItem) {
    dispatch({ type: 'edit', id: item.id });
    queueMicrotask(() => composerRef.current?.focus());
  }

  function onDismiss(id: string) {
    const itemsNow = state.items;
    const index = itemsNow.findIndex((item) => item.id === id);
    const item = itemsNow[index];
    if (!item || item.status !== 'error') return;
    const host = itemRefs.current.get(id);
    const active = document.activeElement;
    const inside = !!host && active instanceof Node && host.contains(active);
    dispatch({ type: 'dismiss', id });
    if (!inside) return;
    const remaining = itemsNow.filter((entry) => entry.id !== id);
    const next = remaining[index] ?? remaining[index - 1];
    queueMicrotask(() => {
      const node = next ? itemRefs.current.get(next.id) : undefined;
      if (node) node.focus();
      else composerRef.current?.focus();
    });
  }

  function onSettled(item: InboxItem) {
    const key = `${item.id}:${item.attempt}`;
    if (savedKey.current.has(key)) return;
    savedKey.current.add(key);
    setHardened((current) => ({ ...current, [item.id]: item.attempt }));
    setSpoken(`Saved “${item.text}”.`);
  }

  const reducedMotion = motion === 'system' ? undefined : motion === 'reduced';

  return (
    <>
      <p className="sr-only" role="status">
        {spoken}
      </p>
      <div className="page">
        <header className="mast">
          <p className="kicker">Open Dev Society · prototype for Ravi</p>
          <h1>Settle</h1>
          <p className="lede">
            A new note shows up as liquid glass while it saves, hardens with a light sweep when it
            lands, and flakes apart if it fails. The words stay.
          </p>
          <p className="banner">Not published to npm. This playground imports the source.</p>
        </header>

        <div className="layout">
          <section className="stage" aria-labelledby="notes-heading">
            <div className="stage-head">
              <h2 id="notes-heading">Notes</h2>
              <p>The composer stays available while a note is still in flight.</p>
            </div>
            <form className="composer" onSubmit={onSubmit}>
              <label htmlFor="note">Note</label>
              <div className="composer-row">
                <input
                  id="note"
                  ref={composerRef}
                  name="note"
                  value={state.draft}
                  onChange={(event) => dispatch({ type: 'draft', text: event.target.value })}
                  placeholder="Write a note"
                  autoComplete="off"
                />
                <button type="submit">Send</button>
              </div>
            </form>
            {state.items.length === 0 ? (
              <p className="empty">No notes yet. Send one to see it settle.</p>
            ) : null}
            <ul className="notes" aria-label="Notes">
              {state.items.map((item) => (
                <li
                  key={item.id}
                  tabIndex={-1}
                  ref={(node) => {
                    if (node) itemRefs.current.set(item.id, node);
                    else itemRefs.current.delete(item.id);
                  }}
                >
                  <Settle
                    status={item.status}
                    palette={palette}
                    reducedMotion={reducedMotion}
                    onSettled={() => onSettled(item)}
                  >
                    <p className="note-text">{item.text}</p>
                    <p className="note-meta">
                      <span>{statusLabel(item, hardened[item.id])}</span>
                      <span>Attempt {item.attempt}</span>
                    </p>
                    {item.status === 'error' ? (
                      <div className="note-error">
                        <p>Couldn&apos;t save this note. {item.error}</p>
                        <div className="note-actions">
                          <button type="button" onClick={() => onRetry(item)}>
                            Retry
                            <span className="sr-only"> sending “{item.text}”</span>
                          </button>
                          <button type="button" onClick={() => onEdit(item)}>
                            Edit
                            <span className="sr-only"> “{item.text}”</span>
                          </button>
                          <button type="button" onClick={() => onDismiss(item.id)}>
                            Dismiss
                            <span className="sr-only"> “{item.text}”</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </Settle>
                </li>
              ))}
            </ul>
          </section>

          <aside className="panel">
            <section aria-labelledby="sim-heading">
              <h2 id="sim-heading">Simulated network — no real requests</h2>
              <p className="help">
                Latency and failures are local timers. Nothing is sent over the network.
              </p>
              <div className="control">
                <div className="control-label">
                  <label htmlFor="latency">Latency</label>
                  <output htmlFor="latency">{latency} ms</output>
                </div>
                <input
                  id="latency"
                  type="range"
                  min={0}
                  max={3000}
                  step={50}
                  value={latency}
                  onChange={(event) => setLatency(Number(event.target.value))}
                />
              </div>
              <div className="control">
                <input
                  id="fail-requests"
                  type="checkbox"
                  checked={fail}
                  aria-describedby="fail-help"
                  onChange={(event) => setFail(event.target.checked)}
                />
                <label htmlFor="fail-requests">Fail requests</label>
                <p id="fail-help" className="help">
                  Checked sends and retries fail until you turn this off.
                </p>
              </div>
            </section>

            <fieldset>
              <legend>Palette</legend>
              {PALETTES.map((entry) => (
                <label key={entry.id}>
                  <input
                    type="radio"
                    name="palette"
                    value={entry.id}
                    checked={palette === entry.id}
                    onChange={() => setPalette(entry.id)}
                  />
                  {entry.label}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Motion</legend>
              <label>
                <input
                  type="radio"
                  name="motion"
                  value="system"
                  checked={motion === 'system'}
                  onChange={() => setMotion('system')}
                />
                System
              </label>
              <label>
                <input
                  type="radio"
                  name="motion"
                  value="full"
                  checked={motion === 'full'}
                  onChange={() => setMotion('full')}
                />
                Full motion
              </label>
              <label>
                <input
                  type="radio"
                  name="motion"
                  value="reduced"
                  checked={motion === 'reduced'}
                  onChange={() => setMotion('reduced')}
                />
                Reduced motion
              </label>
            </fieldset>

            <section aria-labelledby="usage-heading">
              <h2 id="usage-heading">Usage</h2>
              <p className="help">
                The library only draws the row. You keep the text, the attempt, and the request.{' '}
                <code>onSettled</code> runs once when the success sweep ends.
              </p>
              <pre>
                <code>{USAGE}</code>
              </pre>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function statusLabel(item: InboxItem, hardenedAttempt: number | undefined): string {
  if (item.status === 'pending') return 'Pending';
  if (item.status === 'error') return 'Failed';
  if (hardenedAttempt === item.attempt) return 'Saved';
  return 'Confirming';
}
