/// <reference lib="webworker" />
// Web Worker : la simulation tourne ici, découplée du rendu (60 FPS côté main thread).
import { get, set } from 'idb-keyval';
import { Engine } from './engine';
import type { Speed, WorkerMessage, WorkerRequest, WorldState } from './types';

const SAVE_KEY = 'silo-01:save';
const TICKS_PER_SECOND: Record<Speed, number> = { 0: 0, 1: 2, 2: 4, 5: 10, 10: 20 };

let engine = new Engine();
let accumulator = 0;
let last = performance.now();
let lastPublish = 0;

const post = (m: WorkerMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
const publish = () => post({ kind: 'snapshot', snapshot: engine.snapshot() });

async function save(silent = false) {
  try {
    await set(SAVE_KEY, JSON.stringify(engine.serialize()));
    if (!silent) post({ kind: 'toast', text: 'Partie sauvegardée', severity: 'info' });
  } catch {
    post({ kind: 'toast', text: 'Échec de la sauvegarde', severity: 'attention' });
  }
}

async function load() {
  const raw = await get<string>(SAVE_KEY);
  if (!raw) {
    post({ kind: 'toast', text: 'Aucune sauvegarde trouvée', severity: 'attention' });
    return;
  }
  engine.load(JSON.parse(raw) as WorldState);
  post({ kind: 'toast', text: 'Partie chargée', severity: 'info' });
  publish();
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.kind === 'query') {
    post({ kind: 'reply', requestId: msg.requestId, data: engine.query(msg.query) });
    return;
  }
  const cmd = msg.command;
  if (cmd.type === 'SAVE') void save();
  else if (cmd.type === 'LOAD') void load();
  else if (cmd.type === 'NEW_GAME') {
    const speed = engine.speed;
    engine = new Engine();
    engine.speed = speed;
  } else engine.command(cmd);
  publish();
};

// Boucle à pas fixe : le nombre de ticks par seconde dépend de la vitesse.
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  const tps = TICKS_PER_SECOND[engine.speed];
  if (tps === 0) return;
  accumulator += dt * tps;
  let n = 0;
  while (accumulator >= 1 && n < 40) {
    engine.tick();
    accumulator -= 1;
    n++;
    // Sauvegarde automatique chaque jour de jeu.
    if (engine.w.tick % 144 === 0) void save(true);
  }
  if (n > 0 && now - lastPublish > 90) {
    lastPublish = now;
    publish();
  }
}, 25);

publish();
