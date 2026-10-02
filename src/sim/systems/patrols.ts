// Adjoints du shérif affectés aux étages (§43–44 bis) : la présence rassure et dissuade,
// mais un étage quadrillé finit par se sentir occupé.
import type { Ctx } from '../context';
import { TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { FloorState, WorldState } from '../types';
import { floorById, journal } from '../util';

export const PATROL_SIZE = 6; // adjoints par patrouille
export const MAX_PATROLS_PER_FLOOR = 3;

export const patrolOf = (f: FloorState | undefined) => f?.patrol ?? 0;

/** La moitié des effectifs de sécurité peut patrouiller ; l'autre garde le tribunal et les cellules. */
export function patrolCapacity(ctx: Ctx) {
  return Math.floor((ctx.staff.security * 0.5) / PATROL_SIZE);
}

export const patrolsUsed = (w: WorldState) => w.floors.reduce((s, f) => s + patrolOf(f), 0);

export function setPatrol(ctx: Ctx, floorId: string, units: number) {
  const { w } = ctx;
  const f = floorById(w, floorId);
  if (!f) return;
  const cur = patrolOf(f);
  const want = clamp(Math.round(units), 0, MAX_PATROLS_PER_FLOOR);
  const free = patrolCapacity(ctx) - (patrolsUsed(w) - cur);
  const next = Math.min(want, Math.max(0, free));
  if (next === cur) {
    if (want > cur) journal(w, 'Plus aucune patrouille disponible : le shérif manque d’adjoints.', 'attention');
    return;
  }
  f.patrol = next;
  f.patrolSince = next > 0 ? (cur > 0 ? f.patrolSince : w.tick) : undefined;
  journal(w, next > cur ? `${f.label} ${f.name} : ${next} patrouille${next > 1 ? 's' : ''} d’adjoints.` : next ? `${f.label} ${f.name} : patrouilles réduites (${next}).` : `${f.label} ${f.name} : les adjoints se retirent.`, 'info', f.id);
  if (next > cur) w.psychology.authority = clamp(w.psychology.authority + (next - cur) * 0.5);
}

export function patrolHour(ctx: Ctx) {
  const { w } = ctx;
  // Moins d'adjoints (morts, grèves, réaffectations) : les patrouilles les plus lourdes sont rappelées.
  let excess = patrolsUsed(w) - patrolCapacity(ctx);
  while (excess > 0) {
    const f = [...w.floors].sort((a, b) => patrolOf(b) - patrolOf(a))[0];
    if (!patrolOf(f)) break;
    f.patrol = patrolOf(f) - 1;
    if (!f.patrol) f.patrolSince = undefined;
    excess--;
    journal(w, `Faute d’adjoints, une patrouille quitte ${f.label} ${f.name}.`, 'attention', f.id);
  }
  // Une présence lourde et durable devient une occupation aux yeux des habitants.
  for (const f of w.floors) {
    if (patrolOf(f) < 2) f.patrolWarned = false;
    else if (!f.patrolWarned && f.patrolSince !== undefined && w.tick - f.patrolSince >= TICKS_PER_DAY * 3) {
      f.patrolWarned = true;
      journal(w, `${f.label} ${f.name} vit sous surveillance depuis trois jours : on parle d’occupation.`, 'attention', f.id);
    }
  }
}
