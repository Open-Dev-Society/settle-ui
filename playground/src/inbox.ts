export type RowStatus = 'pending' | 'success' | 'error';

export type InboxItem = {
  id: string;
  text: string;
  status: RowStatus;
  attempt: number;
  error?: string;
};

export type InboxState = {
  draft: string;
  items: InboxItem[];
  seq: number;
  /** Spoken failure text. Success is announced when the sweep finishes. */
  announcement: string;
};

export type InboxAction =
  | { type: 'draft'; text: string }
  | { type: 'submit' }
  | { type: 'resolve'; id: string; attempt: number }
  | { type: 'reject'; id: string; attempt: number; error: string }
  | { type: 'retry'; id: string }
  | { type: 'dismiss'; id: string }
  | { type: 'edit'; id: string };

export const initialInbox: InboxState = {
  draft: '',
  items: [],
  seq: 0,
  announcement: '',
};

export function inboxReducer(state: InboxState, action: InboxAction): InboxState {
  switch (action.type) {
    case 'draft':
      return { ...state, draft: action.text };
    case 'submit': {
      if (!state.draft.trim()) return state;
      const seq = state.seq + 1;
      const item: InboxItem = {
        id: `note-${seq}`,
        text: state.draft,
        status: 'pending',
        attempt: 1,
      };
      return { ...state, seq, draft: '', items: [...state.items, item] };
    }
    case 'resolve':
      return mapPending(state, action.id, action.attempt, (item) => ({
        ...item,
        status: 'success',
        error: undefined,
      }));
    case 'reject': {
      const next = mapPending(state, action.id, action.attempt, (item) => ({
        ...item,
        status: 'error',
        error: action.error,
      }));
      if (next === state) return state;
      const item = next.items.find((entry) => entry.id === action.id);
      return {
        ...next,
        announcement: `Failed to send “${item?.text ?? ''}” (attempt ${action.attempt}): ${action.error}. Retry available.`,
      };
    }
    case 'retry': {
      let changed = false;
      const items = state.items.map((item) => {
        if (item.id !== action.id || item.status !== 'error') return item;
        changed = true;
        return { ...item, status: 'pending' as const, attempt: item.attempt + 1, error: undefined };
      });
      return changed ? { ...state, items } : state;
    }
    case 'dismiss': {
      const items = state.items.filter((item) => !(item.id === action.id && item.status === 'error'));
      return items.length === state.items.length ? state : { ...state, items };
    }
    case 'edit': {
      const item = state.items.find((entry) => entry.id === action.id && entry.status === 'error');
      if (!item) return state;
      return { ...state, draft: item.text };
    }
    default:
      return state;
  }
}

function mapPending(
  state: InboxState,
  id: string,
  attempt: number,
  update: (item: InboxItem) => InboxItem,
): InboxState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id || item.attempt !== attempt || item.status !== 'pending') return item;
    changed = true;
    return update(item);
  });
  return changed ? { ...state, items } : state;
}

export function startRequest(controllers: Map<string, AbortController>, id: string): AbortSignal {
  controllers.get(id)?.abort();
  const controller = new AbortController();
  controllers.set(id, controller);
  return controller.signal;
}

export function abortAll(controllers: Map<string, AbortController>): void {
  controllers.forEach((controller) => controller.abort());
  controllers.clear();
}
