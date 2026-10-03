/// <reference lib="webworker" />
// Web Worker : la simulation tourne ici, découplée du rendu (60 FPS côté main thread).
import { get, set } from 'idb-keyval';
import { createWorld } from './create';
import { Engine } from './engine';
import type { Speed, WorkerMessage, WorkerRequest, WorldState } from './types';

const SAVE_KEY = 'silo-01:save';
// Un tick de simulation = 10 minutes de jeu ; la vitesse est exprimée en minutes de jeu par seconde.
const TICKS_PER_SECOND: Record<Speed, number> = { 0: 0, 1: 0.1, 5: 0.5, 30: 3, 120: 12 };

let engine = new Engine();
let accumulator = 0;
let last = performance.now();
let lastPublish = 0;

const post = (m: WorkerMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
// Entre deux ticks, l'horloge avance minute par minute (interpolée depuis l'accumulateur).
let shownMinute = -1;
const publish = () => {
  const snapshot = engine.snapshot();
  const extra = Math.min(9, Math.floor(accumulator * 10));
  snapshot.minute = Math.min(59, snapshot.minute + extra);
  shownMinute = engine.w.tick * 10 + extra;
  post({ kind: 'snapshot', snapshot });
};

async function save(silent = false) {
  try {
    await set(SAVE_KEY, JSON.stringify(engine.serialize()));
    if (!silent) post({ kind: 'toast', text: 'Partie sauvegardée', severity: 'info' });
  } catch {
    post({ kind: 'toast', text: 'Échec de la sauvegarde', severity: 'attention' });
  }
}

async function load(silent = false) {
  try {
    const raw = await get<string>(SAVE_KEY);
    if (!raw) {
      if (!silent) post({ kind: 'toast', text: 'Aucune sauvegarde trouvée', severity: 'attention' });
      return;
    }
    const speed = engine.speed;
    engine.load(JSON.parse(raw) as WorldState);
    engine.speed = speed;
    post({ kind: 'toast', text: silent ? 'Partie reprise là où vous l’aviez laissée' : 'Partie chargée', severity: 'info' });
    publish();
  } catch {
    if (!silent) post({ kind: 'toast', text: 'Sauvegarde illisible', severity: 'attention' });
  }
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
    engine = new Engine(createWorld(cmd.seed, cmd.difficulty));
    engine.speed = speed;
    void save(true);
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
  const minuteNow = engine.w.tick * 10 + Math.min(9, Math.floor(accumulator * 10));
  if ((n > 0 || minuteNow !== shownMinute) && now - lastPublish > 90) {
    lastPublish = now;
    publish();
  }
}, 25);

publish();
// Reprise automatique de la dernière partie (sauvegardée chaque jour de jeu).
void load(true);
