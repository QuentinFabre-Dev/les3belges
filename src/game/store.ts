import { create } from 'zustand';
import type { RenderSettings } from '../render/SiloView';
import type { GameCommand, GameQuery, Severity, Snapshot, WorkerMessage, WorkerRequest } from '../sim/types';

// Pont main thread <-> Web Worker. L'UI n'écrit jamais dans le monde : elle envoie des commandes.
const worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
let nextRequest = 1;
const pending = new Map<number, (data: unknown) => void>();

export type View = 'global' | 'floors' | 'population' | 'resources' | 'infrastructure' | 'incidents' | 'decisions' | 'institutions' | 'policies' | 'messages' | 'journal' | 'settings';

interface Toast {
  id: number;
  text: string;
  severity: Severity;
}

const SETTINGS_KEY = 'silo-01:settings';
function loadSettings(): RenderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { density: 150, secondary: 'standard', lighting: 'medium', adaptive: true, ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible */
  }
  return { density: 150, secondary: 'standard', lighting: 'medium', adaptive: true };
}

interface GameStore {
  snapshot?: Snapshot;
  view: View;
  selectedFloor?: string;
  selectedCitizen?: number;
  focusedDecision?: number;
  focusRequest?: { floor: string; n: number };
  settings: RenderSettings;
  toasts: Toast[];
  setView: (v: View) => void;
  selectFloor: (id?: string, focus?: boolean) => void;
  selectCitizen: (id?: number) => void;
  focusDecision: (uid?: number) => void;
  setSettings: (s: Partial<RenderSettings>) => void;
  toast: (text: string, severity?: Severity) => void;
}

export const useGame = create<GameStore>((set, get) => ({
  view: 'global',
  settings: loadSettings(),
  toasts: [],
  setView: (view) => set({ view }),
  selectFloor: (selectedFloor, focus) => set({ selectedFloor, focusRequest: focus && selectedFloor ? { floor: selectedFloor, n: Date.now() } : get().focusRequest }),
  selectCitizen: (selectedCitizen) => set({ selectedCitizen, view: selectedCitizen !== undefined ? 'population' : get().view }),
  focusDecision: (focusedDecision) => set({ focusedDecision }),
  setSettings: (s) => {
    const settings = { ...get().settings, ...s };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    set({ settings });
  },
  toast: (text, severity = 'info') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, severity }].slice(-4) });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500);
  },
}));

// Les snapshots arrivent ~10 fois/s : on n'en garde qu'un par frame d'affichage.
let latest: Snapshot | undefined;
let scheduled = false;
worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
  const m = ev.data;
  if (m.kind === 'snapshot') {
    latest = m.snapshot;
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        useGame.setState({ snapshot: latest });
      });
    }
  } else if (m.kind === 'reply') {
    pending.get(m.requestId)?.(m.data);
    pending.delete(m.requestId);
  } else if (m.kind === 'toast') {
    useGame.getState().toast(m.text, m.severity);
  }
};

export function send(command: GameCommand) {
  worker.postMessage({ kind: 'command', command } satisfies WorkerRequest);
}

export function query<T>(q: GameQuery): Promise<T> {
  const requestId = nextRequest++;
  return new Promise((resolve) => {
    pending.set(requestId, resolve as (d: unknown) => void);
    worker.postMessage({ kind: 'query', requestId, query: q } satisfies WorkerRequest);
  });
}

export const latestSnapshot = () => latest;
