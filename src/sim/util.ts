import { TICKS_PER_DAY, TICKS_PER_HOUR, START_HOUR } from './data/world';
import type { Citizen, CitizenId, FloorState, Incident, OfficeId, Severity, WorldState } from './types';

export const dayOf = (w: WorldState) => Math.floor((w.tick + START_HOUR * TICKS_PER_HOUR) / TICKS_PER_DAY) + 1;
export const minuteOfDay = (w: WorldState) => ((w.tick + START_HOUR * TICKS_PER_HOUR) % TICKS_PER_DAY) * (1440 / TICKS_PER_DAY);
export const hourOf = (w: WorldState) => Math.floor(minuteOfDay(w) / 60);

export const isActive = (c: Citizen) => c.lifeState === 'alive';
export const isWorker = (c: Citizen) => isActive(c) && c.age >= 16 && c.age <= 70 && c.sector !== 'residential' && !c.flags.includes('injured');

export const fullName = (c: Citizen) => `${c.first} ${c.last}`;

export function floorById(w: WorldState, id: string): FloorState | undefined {
  return w.floors.find((f) => f.id === id);
}

export function holder(w: WorldState, officeId: OfficeId): Citizen | undefined {
  const id = w.offices[officeId]?.holderId;
  if (id === undefined) return undefined;
  const c = w.citizens[id];
  return c && c.lifeState === 'alive' ? c : undefined;
}

export function citizen(w: WorldState, id: CitizenId | undefined): Citizen | undefined {
  return id === undefined ? undefined : w.citizens[id];
}

export function journal(w: WorldState, text: string, severity: Severity = 'info', floor?: string) {
  w.journal.push({ tick: w.tick, severity, text, floor });
  if (w.journal.length > 300) w.journal.splice(0, w.journal.length - 300);
}

export function message(w: WorldState, fromTitle: string, subject: string, body: string, fromId?: CitizenId) {
  w.messages.push({ id: w.nextUid++, tick: w.tick, fromId, fromTitle, subject, body, read: false });
  if (w.messages.length > 60) w.messages.splice(0, w.messages.length - 60);
}

export function hasTag(w: WorldState, tag: string) {
  const exp = w.tags[tag];
  return exp !== undefined && exp > w.tick;
}

export function addTag(w: WorldState, tag: string, days?: number) {
  w.tags[tag] = days === undefined ? Number.MAX_SAFE_INTEGER : w.tick + Math.round(days * TICKS_PER_DAY);
}

export function openIncident(
  w: WorldState,
  type: string,
  title: string,
  severity: Severity,
  causes: string[],
  floor?: string,
  assetId?: string,
): Incident {
  const existing = w.incidents.find((i) => i.status !== 'resolved' && i.type === type && i.floor === floor && i.assetId === assetId);
  if (existing) {
    for (const c of causes) if (!existing.causes.includes(c)) existing.causes.push(c);
    return existing;
  }
  const inc: Incident = { id: w.nextUid++, type, title, floor, assetId, severity, startedTick: w.tick, status: 'active', causes };
  w.incidents.push(inc);
  journal(w, title, severity, floor);
  return inc;
}

export function resolveIncidents(w: WorldState, match: { type?: string; floor?: string; assetId?: string }) {
  for (const i of w.incidents) {
    if (i.status === 'resolved') continue;
    if (match.type && i.type !== match.type) continue;
    if (match.floor && i.floor !== match.floor) continue;
    if (match.assetId && i.assetId !== match.assetId) continue;
    i.status = 'resolved';
    i.resolvedTick = w.tick;
  }
}

export function pruneIncidents(w: WorldState) {
  const limit = w.tick - TICKS_PER_DAY * 4;
  w.incidents = w.incidents.filter((i) => i.status !== 'resolved' || (i.resolvedTick ?? 0) > limit);
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
