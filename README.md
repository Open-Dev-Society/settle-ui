# Settle

Optimistic React rows that look like soft iridescent glass while they save, harden with a light sweep when the save lands, and flake apart if it fails. The words stay put, with Retry, Edit, and Dismiss.

This is an initial prototype for Ravi to take over. It is **not yet published to npm**. `npm install settle-ui` will not work. Clone this repo and install the workspace.

The library is visual only. Your app owns the note, the attempt number, and the request. Settle does not store data or talk to a server.

## Setup

From the repo root, with Node 22:

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite playground at <http://127.0.0.1:5173>. The inbox is a simulated network: a latency slider and a **Fail requests** switch. Nothing is sent over the network.

```bash
npm test
npx playwright install chromium && npm run test:e2e
npm run typecheck
npm run build
npm run size
```

`npm run build` writes the library to `packages/settle-ui/dist` and a static site to `playground/dist`. That folder is what you would point Cloudflare Pages at later. This repo does not deploy it.

## Lifecycle

`pending` is not a boolean you flip off. Success and failure are different statuses.

```text
submit ──► pending ──resolve (matching attempt)──► success
                 │                                    │
                 │                              sweep, then onSettled once
                 │
                 └──reject (matching attempt)──► error
                                                    │
                          text kept, Retry / Edit / Dismiss
                                                    │
                     Retry bumps attempt and returns to pending
                     a late result from the old attempt is ignored
                     Dismiss removes the failed row only
```

```tsx
import { Settle } from 'settle-ui';
import 'settle-ui/style.css';

<Settle
  status={item.status} // 'pending' | 'success' | 'error'
  palette="opal" // 'opal' | 'amber' | 'mint'
  onSettled={() => markSaved(item.id, item.attempt)}
>
  <p>{item.text}</p>
</Settle>
```

`onSettled` runs once when a transition into `success` finishes its sweep (about 560ms), or immediately when reduced motion is on. It does not run if you mount a row that is already successful, and it does not run if `status` changes before the sweep ends. A later success, after pending again, can fire it once more.

Reduced motion follows `prefers-reduced-motion` unless you pass `reducedMotion`. `true` skips the rim spin, the sweep, and the particles. `false` forces motion.

The decorative layers are `aria-hidden` and `pointer-events: none`. Pending rows set `aria-busy` and include visually hidden “Sending…”. Put the error message and buttons in your own markup so they stay in the accessibility tree while the glass flakes.

Keep the attempt that started the request. When a response arrives, ignore it unless the row is still `pending` on that same attempt. The playground reducer in `playground/src/inbox.ts` does this. Retry aborts the previous controller for that id.

## Where to edit

| What | File |
| --- | --- |
| Look, palettes, reduced motion | `packages/settle-ui/src/settle.css` |
| Failure flakes | `packages/settle-ui/src/particles.ts` |
| Sweep, phases, `onSettled` | `packages/settle-ui/src/Settle.tsx` |
| Notes, attempts, focus | `playground/src/inbox.ts` and `playground/src/App.tsx` |
| Simulated latency and failure | `playground/src/mockBackend.ts` |

## Size

Measured from this build with `npm run size` (minified ES module, React and `react/jsx-runtime` external):

| File | Bytes | Gzip |
| --- | ---: | ---: |
| `packages/settle-ui/dist/index.js` | 4725 | 1768 |
| `packages/settle-ui/dist/settle.css` | 3658 | 1230 |

The JavaScript bundle does not inject the CSS. Import `settle-ui/style.css` yourself. The playground aliases the TypeScript source, so `npm run dev` does not need the library build.

These numbers will change when the source changes. Re-run `npm run build && npm run size`.

## Known limits

- Not on npm, and not deployed. The playground is local or a static `playground/dist` you host yourself.
- No data layer, no accounts, no persistence. Refreshing the page drops the notes.
- The rim spin uses a CSS `@property` angle. Without that, the border stays iridescent and simply doesn’t travel.
- Glass is a border, an outer glow, and a sweep. Text sits on an opaque surface, so contrast does not depend on `backdrop-filter`.
- Failure throws about 20 flakes with the Web Animations API, then deletes them. It is not a physics simulation. The row’s text and actions are real DOM the whole time.
- Dismiss has no exit animation. Focus moves to the next row, or the previous one, or the composer, only when the focused control was inside the row you removed. A failure does not move focus. Edit focuses the composer because that is the control you pressed.
- One `Settle` per row. A long list of pending rows each paints a glow. There is no virtualization.
- No TanStack Query or `useOptimistic` adapter. Add one in the app when a real caller needs it.
- Browser tests ran in Chromium only.

## License

MIT. Initial prototype for Ravi.
