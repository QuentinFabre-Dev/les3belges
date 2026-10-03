import { EVENTS } from '../data/events';
import { SCALE, SECTOR_FLOOR, SECTOR_FLOORS, SECTOR_NAMES, TICKS_PER_DAY, TICKS_PER_HOUR, YEAR_DAYS } from '../data/world';
import { remember, soothe } from './years';
import { shakeTrust, trustIn } from './institutions';
import { patrolsUsed } from './patrols';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type {
  Citizen,
  Condition,
  DecisionContext,
  DecisionView,
  Effect,
  EventDefinition,
  OfficeId,
  PendingDecision,
  SectorId,
  WorldState,
} from '../types';
import { addTag, dayOf, floorById, fullName, hasTag, holder, journal, openIncident, resolveIncidents } from '../util';
import { arrestCitizen, killCitizen, propagate, unrestCauses, vacate } from './social';
import { applyVerdict, caseOf, judgeThreshold } from './justice';
import { startRumor } from './rumors';
import { DEMAND_LABELS, STAGE_LABELS, factionAction } from './factions';
import { autonomyDays } from './economy';

const DEFS = new Map(EVENTS.map((e) => [e.id, e]));
export const eventDef = (id: string) => DEFS.get(id);

// ---------------------------------------------------------------------------
// Métriques lisibles par les conditions data-driven

export function metric(ctx: Ctx, key: string): number | string {
  const { w } = ctx;
  const p = key.split('.');
  switch (p[0]) {
    case 'res': {
      const k = p[1] as 'food' | 'water' | 'parts' | 'materials' | 'medicine';
      const stock = w.resources[k];
      if (p[2] === 'days') return autonomyDays(w, ctx)[k as 'food' | 'water'] ?? 99;
      if (p[2] === 'pct') return (stock.declared / stock.capacity) * 100;
      if (p[2] === 'real') return stock.real;
      return stock.declared;
    }
    case 'battery':
      return w.resources.battery;
    case 'asset': {
      const a = w.assets[p[1]];
      return p[2] === 'state' ? a.state : (a as unknown as Record<string, number>)[p[2]];
    }
    case 'floor': {
      if (p[1] === 'min') return Math.min(...w.floors.map((f) => (f as unknown as Record<string, number>)[p[2]]));
      if (p[1] === 'max') return Math.max(...w.floors.map((f) => (f as unknown as Record<string, number>)[p[2]]));
      if (p[1] === 'count') {
        if (p[2] === 'full_lockdown') return w.floors.filter((f) => f.lockdown === 'full').length;
        if (p[2] === 'lockdown') return w.floors.filter((f) => f.lockdown !== 'open').length;
      }
      if (p[1] === 'maxLockdownDays') return Math.max(0, ...w.floors.filter((f) => f.lockdown === 'full').map((f) => (w.tick - (f.lockdownSince ?? w.tick)) / TICKS_PER_DAY));
      const f = floorById(w, p[1]);
      return f ? (f as unknown as Record<string, number>)[p[2]] : 0;
    }
    case 'sector': {
      if (p[1] === 'max') return Math.max(...Object.values(w.sectors).filter((s) => s.id !== 'residential').map((s) => (s as unknown as Record<string, number>)[p[2]]));
      const s = w.sectors[p[1] as SectorId];
      if (p[2] === 'staffing') return ctx.staff[s.id];
      return (s as unknown as Record<string, number>)[p[2]];
    }
    case 'psy':
      return (w.psychology as Record<string, number>)[p[1]];
    case 'policy': {
      const v = (w.policies as unknown as Record<string, unknown>)[p[1]];
      return typeof v === 'boolean' ? (v ? 1 : 0) : (v as number | string);
    }
    case 'office': {
      const h = holder(w, p[1] as OfficeId);
      if (p[2] === 'vacant') return h ? 0 : 1;
      // Défaut caché du titulaire (ouverture) : « bribes », « ambition »…
      if (p[2] === 'secret') return h?.flags.find((f) => f.startsWith('secret:'))?.slice(7) ?? '';
      return h ? (h as unknown as Record<string, number>)[p[2]] : 0;
    }
    case 'mayor':
      if (w.election) return 99;
      return (w.offices.mayor.termEndsDay ?? 999) - dayOf(w);
    case 'supplies': {
      const r = w.resources;
      const declared = r.parts.declared + r.medicine.declared;
      return declared > 0 ? (declared - (r.parts.real + r.medicine.real)) / declared : 0;
    }
    case 'day':
      return dayOf(w);
    case 'stability':
      return w.stability;
    case 'lens':
      return w.lens;
    case 'pop':
      if (p[1] === 'sick') return ctx.sick;
      if (p[1] === 'children') return ctx.children;
      if (p[1] === 'total') return ctx.population;
      return 0;
    case 'crowding':
      return Math.max(...w.floors.filter((f) => f.capacity > 0).map((f) => f.residents / f.capacity));
    case 'tagged':
      return hasTag(w, p[1]) ? 1 : 0;
    case 'prisoners':
      return w.citizens.filter((c) => c.lifeState === 'imprisoned').length;
    case 'count':
      if (p[1] === 'decisions') return w.stats.decisions ?? 0;
      if (p[1] === 'councils') return w.stats.councils ?? 0;
      return 0;
    case 'patrols':
      return patrolsUsed(w);
    case 'inst':
      return trustIn(w, p[1] as Parameters<typeof trustIn>[1]);
  }
  return 0;
}

export function check(ctx: Ctx, c: Condition): boolean {
  if ('all' in c) return c.all.every((x) => check(ctx, x));
  if ('any' in c) return c.any.some((x) => check(ctx, x));
  if ('tag' in c) return hasTag(ctx.w, c.tag);
  if ('notTag' in c) return !hasTag(ctx.w, c.notTag);
  const v = metric(ctx, c.metric);
  switch (c.op) {
    case '<':
      return v < c.value;
    case '<=':
      return v <= c.value;
    case '>':
      return v > c.value;
    case '>=':
      return v >= c.value;
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
  }
}

// ---------------------------------------------------------------------------
// Apparition des décisions

export function evaluateEvents(ctx: Ctx) {
  const { w, rng } = ctx;
  // Événements déclenchés par les systèmes (pannes, accidents, troubles...)
  for (const { id, data } of ctx.scheduled.splice(0)) {
    const def = DEFS.get(id);
    if (def) spawn(ctx, def, data);
  }
  if (w.gameOver) return;
  for (const def of EVENTS) {
    if (def.manual) continue;
    if ((w.cooldowns[def.id] ?? 0) > w.tick) continue;
    if (w.pending.some((p) => p.defId === def.id)) continue;
    if (w.pending.length >= 6) break;
    if (!def.conditions.every((c) => check(ctx, c))) continue;
    const p = def.chancePerDay >= 1 ? Math.min(1, def.chancePerDay / 24) : 1 - Math.pow(1 - def.chancePerDay, 1 / 24);
    if (!rng.chance(p)) continue;
    spawn(ctx, def, {});
  }
}

export function spawn(ctx: Ctx, def: EventDefinition, data: DecisionContext) {
  const { w } = ctx;
  const pctx = resolveContext(ctx, def, data);
  if (pctx === null) return;
  // Pas de doublon : un même événement sur le même étage / équipement ne s'empile pas.
  if (w.pending.some((p) => p.defId === def.id && p.floor === pctx.floor && p.assetId === pctx.assetId && p.subjectId === pctx.subjectId)) return;
  if (w.pending.length >= 10) return;
  const pending: PendingDecision = {
    uid: w.nextUid++,
    defId: def.id,
    createdTick: w.tick,
    expiresTick: w.tick + Math.round(def.expiresDays * TICKS_PER_DAY),
    floor: pctx.floor,
    assetId: pctx.assetId,
    subjectId: pctx.subjectId,
    vars: pctx.vars ?? {},
  };
  w.pending.push(pending);
  w.cooldowns[def.id] = w.tick + Math.round(def.cooldownDays * TICKS_PER_DAY);
  journal(w, `Décision requise : ${interpolate(ctx, def.title, pending)}`, def.severity, pending.floor);
}

function resolveContext(ctx: Ctx, def: EventDefinition, data: DecisionContext): DecisionContext | null {
  const { w, rng } = ctx;
  const out: DecisionContext = { ...data, vars: { ...(data.vars ?? {}) } };
  const cx = def.context;
  if (cx?.floorFrom && !out.floor) {
    if (cx.floorFrom === 'worst_cleanliness') out.floor = [...w.floors].sort((a, b) => a.cleanliness - b.cleanliness)[0].id;
    else if (cx.floorFrom === 'max_unrest') out.floor = [...w.floors].sort((a, b) => b.unrestPressure - a.unrestPressure)[0].id;
    else if (cx.floorFrom === 'max_crowding') out.floor = [...w.floors].sort((a, b) => b.residents / Math.max(1, b.capacity) - a.residents / Math.max(1, a.capacity))[0].id;
    else if (cx.floorFrom === 'random_residential') out.floor = rng.pick(w.floors.filter((f) => f.sector === 'residential' && !f.cafeteria)).id;
    else if (cx.floorFrom === 'max_anger') out.floor = [...w.floors].sort((a, b) => b.anger - a.anger)[0].id;
    else if (cx.floorFrom === 'locked') out.floor = [...w.floors].filter((f) => f.lockdown !== 'open').sort((a, b) => (a.lockdown === 'full' ? -1 : 1) - (b.lockdown === 'full' ? -1 : 1))[0]?.id;
    else out.floor = cx.floorFrom;
  }
  if (cx?.assetFrom && !out.assetId) out.assetId = cx.assetFrom;
  if (out.assetId && !out.floor) out.floor = w.assets[out.assetId]?.floor;
  if (cx?.subjectFrom && out.subjectId === undefined) {
    const alive = (c: Citizen) => c.lifeState === 'alive';
    let subject: Citizen | undefined;
    if (cx.subjectFrom === 'thief') {
      subject = w.citizens.find((c) => alive(c) && c.flags.includes('thief'));
      if (!subject) subject = w.citizens.filter((c) => alive(c) && c.sector === 'supplies' && !c.officeId).sort((a, b) => a.integrity - b.integrity)[0];
    } else if (cx.subjectFrom === 'agitator') {
      const pool = w.citizens.filter((c) => alive(c) && c.homeFloor === out.floor && c.age >= 18 && !c.officeId);
      subject = pool.find((c) => c.flags.includes('informal_leader') || c.flags.includes('agitator')) ?? pool.sort((a, b) => b.influence + b.grievance - (a.influence + a.grievance))[0];
    } else if (cx.subjectFrom === 'leader_of_max_grievance' || cx.subjectFrom === 'leader_of_max_strike') {
      const key = cx.subjectFrom === 'leader_of_max_grievance' ? 'grievance' : 'strikeRisk';
      const sector = Object.values(w.sectors).filter((s) => s.id !== 'residential').sort((a, b) => b[key] - a[key])[0];
      const pool = w.citizens.filter((c) => alive(c) && c.sector === sector.id && !c.officeId);
      subject = pool.find((c) => c.flags.includes('informal_leader')) ?? pool.sort((a, b) => b.influence + b.leadership - (a.influence + a.leadership))[0];
      out.vars!.sector = sector.id;
      out.vars!.sectorName = SECTOR_NAMES[sector.id].toLowerCase();
      out.vars!.grievance = Math.round(sector.grievance);
      out.vars!.morale = Math.round(sector.morale);
      out.floor = out.floor ?? SECTOR_FLOOR[sector.id];
    } else if (cx.subjectFrom === 'child') {
      subject = rng.pick(w.citizens.filter((c) => alive(c) && c.age >= 6 && c.age <= 12));
    } else if (cx.subjectFrom.startsWith('random:')) {
      const sector = cx.subjectFrom.slice(7);
      const pool = w.citizens.filter((c) => alive(c) && c.age >= 18 && !c.officeId && (sector === 'any' || c.sector === sector));
      subject = pool.length ? rng.pick(pool) : undefined;
      if (subject) out.floor = out.floor ?? subject.homeFloor;
    } else if (cx.subjectFrom === 'oldest_expert') {
      subject = w.citizens.filter((c) => alive(c) && c.flags.includes('specialist') && !c.officeId).sort((a, b) => b.age - a.age)[0];
    } else if (cx.subjectFrom.startsWith('office:')) {
      subject = holder(w, cx.subjectFrom.slice(7) as OfficeId);
    } else if (cx.subjectFrom.startsWith('flag:')) {
      // Habitant marqué (ex. « opening_rival » : le candidat battu à l'élection d'ouverture).
      const flag = cx.subjectFrom.slice(5);
      subject = w.citizens.find((c) => alive(c) && !c.officeId && c.flags.includes(flag));
      if (subject) out.floor = out.floor ?? subject.homeFloor;
    }
    if (!subject) return null;
    out.subjectId = subject.id;
    if (cx.subjectFrom === 'agitator' || cx.subjectFrom.startsWith('leader_of')) {
      if (!subject.flags.includes('agitator')) subject.flags.push('agitator');
      subject.key = true;
      subject.influence = clamp(subject.influence + 15);
    }
    void rng;
  }
  if (out.floor) {
    const f = floorById(w, out.floor);
    if (f) out.vars!.causes = unrestCauses(w, f).slice(0, 3).join(', ').toLowerCase();
  }
  return out;
}

export function interpolate(ctx: Ctx, text: string, p: { floor?: string; assetId?: string; subjectId?: number; vars?: Record<string, string | number> }) {
  const { w } = ctx;
  return text.replace(/\{([a-zA-Z0-9_:]+)\}/g, (_, key: string) => {
    if (key === 'floor') {
      const f = p.floor ? floorById(w, p.floor) : undefined;
      return f ? `${f.label} ${f.name}` : 'l’étage';
    }
    if (key === 'asset') return p.assetId ? w.assets[p.assetId]?.name ?? '' : '';
    if (key === 'assetId') return p.assetId ?? '';
    if (key === 'subject') return p.subjectId !== undefined ? fullName(w.citizens[p.subjectId]) : 'un habitant';
    if (key === 'subjectAge') return p.subjectId !== undefined ? String(Math.floor(w.citizens[p.subjectId].age)) : '?';
    if (key === 'sick') return String(ctx.sick);
    if (key.startsWith('office:')) {
      const h = holder(w, key.slice(7) as OfficeId);
      return h ? `${w.offices[key.slice(7) as OfficeId].title} ${fullName(h)}` : w.offices[key.slice(7) as OfficeId]?.title ?? '';
    }
    const days = autonomyDays(w, ctx);
    if (key === 'foodDays') return days.food.toFixed(1);
    if (key === 'waterDays') return days.water.toFixed(1);
    if (key === 'parts') return String(Math.round(w.resources.parts.declared));
    if (key === 'materialsPct') return String(Math.round((w.resources.materials.declared / w.resources.materials.capacity) * 100));
    if (key === 'supportsPct') return String(Math.round(w.assets.mine_supports.condition * 100));
    if (key === 'charge' || key === 'evidence' || key === 'judgeView' || key === 'sentence') {
      const k = caseOf(ctx, p.subjectId);
      if (!k) return '';
      if (key === 'charge') return k.charge.toLowerCase();
      if (key === 'evidence') return String(k.evidence);
      if (key === 'sentence') return String([0, 4, 9, 16][k.severity]);
      const t = judgeThreshold(ctx);
      return k.evidence >= t ? 'Le juge estime le dossier solide.' : k.evidence >= t - 15 ? 'Le juge hésite : le dossier est fragile.' : 'Le juge juge le dossier très insuffisant.';
    }
    if (key === 'faction' || key === 'demands' || key === 'demand1' || key === 'leader' || key === 'stage') {
      const f = factionAt(w, p.floor);
      if (!f) return '';
      if (key === 'faction') return f.name;
      if (key === 'leader') return fullName(w.citizens[f.leaderId]);
      if (key === 'stage') return STAGE_LABELS[f.stage].toLowerCase();
      if (key === 'demand1') return f.demands[0] ? DEMAND_LABELS[f.demands[0]].toLowerCase() : 'leurs revendications';
      return f.demands.map((d) => DEMAND_LABELS[d].toLowerCase()).join(' ; ');
    }
    if (key === 'population') return String(ctx.population);
    if (key === 'capacity') return String(w.floors.reduce((a, f) => a + f.capacity, 0));
    if (key === 'lensPct') return String(Math.round(w.lens * 100));
    if (key === 'accuracy') return String(Math.round(ctx.infoAccuracy * 100));
    if (p.vars && key in p.vars) return String(p.vars[key]);
    return '';
  });
}

// ---------------------------------------------------------------------------
// Résolution d'un choix

export function decide(ctx: Ctx, uid: number, choiceId: string) {
  const { w } = ctx;
  const idx = w.pending.findIndex((p) => p.uid === uid);
  if (idx < 0) return;
  const p = w.pending[idx];
  const def = DEFS.get(p.defId);
  const choice = def?.choices.find((c) => c.id === choiceId);
  if (!def || !choice) return;
  if (choice.requires && !choice.requires.every((c) => check(ctx, c))) return;
  w.pending.splice(idx, 1);
  w.stats.decisions = (w.stats.decisions ?? 0) + 1;
  journal(w, `${interpolate(ctx, def.title, p)} → ${choice.label}`, 'info', p.floor);
  applyEffects(ctx, choice.effects, p);
}

export function expireDecisions(ctx: Ctx) {
  const { w } = ctx;
  for (const p of [...w.pending]) {
    if (p.expiresTick > w.tick) continue;
    w.pending.splice(w.pending.indexOf(p), 1);
    const def = DEFS.get(p.defId);
    if (!def) continue;
    journal(w, `Sans décision : ${interpolate(ctx, def.title, p)} — les responsables ont agi par défaut.`, 'attention', p.floor);
    if (def.onExpire) applyEffects(ctx, def.onExpire, p);
  }
}

function citizenBySelector(ctx: Ctx, sel: string, p: DecisionContext): Citizen | undefined {
  const { w, rng } = ctx;
  if (sel === 'subject') return p.subjectId !== undefined ? w.citizens[p.subjectId] : undefined;
  if (sel.startsWith('office:')) return holder(w, sel.slice(7) as OfficeId);
  if (sel.startsWith('random_worker:')) {
    const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === sel.slice(14) && !c.officeId);
    return pool.length ? rng.pick(pool) : undefined;
  }
  if (sel === 'prisoner') {
    const pool = w.citizens.filter((c) => c.lifeState === 'imprisoned');
    return pool.length ? rng.pick(pool) : undefined;
  }
  if (sel.startsWith('random_resident:')) {
    const floor = sel.endsWith('ctx') ? p.floor : sel.slice(16);
    const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.homeFloor === floor && c.age >= 16);
    return pool.length ? rng.pick(pool) : undefined;
  }
  return undefined;
}

function socialTargets(ctx: Ctx, target: string, p: DecisionContext): Citizen[] {
  const { w } = ctx;
  const alive = w.citizens.filter((c) => c.lifeState === 'alive');
  if (target === 'all') return alive;
  if (target.startsWith('floor:')) {
    const f = target === 'floor:ctx' ? p.floor : target.slice(6);
    return alive.filter((c) => c.homeFloor === f);
  }
  if (target.startsWith('sector:')) {
    let s = target.slice(7);
    if (s === 'subject') s = (p.vars?.sector as string) ?? (p.subjectId !== undefined ? w.citizens[p.subjectId].sector : 'residential');
    return alive.filter((c) => c.sector === s);
  }
  if ((target === 'subject' || target === 'subject_reward') && p.subjectId !== undefined) {
    const c = w.citizens[p.subjectId];
    return c.lifeState === 'alive' ? [c] : [];
  }
  if (target === 'household:subject' && p.subjectId !== undefined) {
    const h = w.citizens[p.subjectId].householdId;
    return alive.filter((c) => c.householdId === h);
  }
  return [];
}

const tpl = (s: string, p: DecisionContext) => s.replace('{assetId}', p.assetId ?? '').replace('{sector}', String(p.vars?.sector ?? '')).replace('{floor}', p.floor ?? '');

export function applyEffects(ctx: Ctx, effects: Effect[], p: DecisionContext) {
  const { w, rng } = ctx;
  for (const e of effects) {
    switch (e.type) {
      case 'resource': {
        if (e.resource === 'battery') {
          w.resources.battery = clamp(w.resources.battery + e.amount);
          break;
        }
        const s = w.resources[e.resource];
        // Les montants des données sont calibrés pour 1 400 habitants.
        const amount = e.resource === 'food' || e.resource === 'water' || e.resource === 'materials' ? e.amount * SCALE : e.amount;
        if (!e.declaredOnly) s.real = clamp(s.real + amount, 0, s.capacity);
        if (!e.realOnly) s.declared = clamp(s.declared + amount, 0, s.capacity);
        break;
      }
      case 'asset': {
        const a = w.assets[e.assetId === 'ctx' ? p.assetId ?? '' : e.assetId];
        if (!a) break;
        if (e.field === 'condition') a.condition = clamp(a.condition + (e.amount ?? 0), 0, 1);
        else if (e.value) {
          a.state = e.value;
          if (e.value === 'maintenance') a.repairProgress = 0.01;
        }
        if (a.state === 'degraded' && a.condition >= 0.5) a.state = 'running';
        break;
      }
      case 'floor': {
        const floors = e.floor === 'all' ? w.floors : w.floors.filter((f) => f.id === (e.floor === 'ctx' ? p.floor : e.floor));
        for (const f of floors) {
          if (e.field === 'condition') f.condition = clamp(f.condition + e.amount, 0, 1);
          else if (e.field === 'waste') {
            f.waste = clamp(f.waste + e.amount);
            if (e.amount < 0) f.cleanliness = clamp(f.cleanliness - e.amount * 0.8);
          } else f.cleanliness = clamp(f.cleanliness + e.amount);
        }
        break;
      }
      case 'social':
        for (const c of socialTargets(ctx, e.target, p)) {
          (c as unknown as Record<string, number>)[e.stat] = clamp((c as unknown as Record<string, number>)[e.stat] + e.amount * (0.7 + rng.next() * 0.6));
        }
        break;
      case 'sector': {
        const sid = e.sector === 'subject' ? ((p.vars?.sector as SectorId) ?? (p.subjectId !== undefined ? w.citizens[p.subjectId].sector : 'residential')) : e.sector;
        const s = w.sectors[sid];
        if (!s || sid === 'residential') break;
        if (e.field === 'cohesion') s.cohesion = clamp(s.cohesion + e.amount, 0, 1);
        else s.staffingTarget = Math.max(0, s.staffingTarget + e.amount);
        rebalanceStaff(ctx);
        break;
      }
      case 'tag':
        if (e.remove) delete w.tags[tpl(e.tag, p)];
        else addTag(w, tpl(e.tag, p), e.days);
        break;
      case 'schedule':
        if (e.delayDays <= 0) {
          const def = DEFS.get(e.eventId);
          if (def) spawn(ctx, def, p);
        } else w.delayed.push({ dueTick: w.tick + Math.round(e.delayDays * TICKS_PER_DAY), effects: [{ ...e, delayDays: 0 }], pctx: p });
        break;
      case 'delayed':
        w.delayed.push({ dueTick: w.tick + Math.round(e.delayDays * TICKS_PER_DAY), effects: e.effects, note: e.note, pctx: p });
        break;
      case 'incident':
        openIncident(w, e.incidentType, e.title, e.severity, [], e.floor === 'ctx' ? p.floor : e.floor, e.assetId);
        break;
      case 'resolve_incident':
        resolveIncidents(w, { type: e.incidentType, floor: e.floor === 'ctx' ? p.floor : e.floor, assetId: e.assetId });
        break;
      case 'kill': {
        const c = citizenBySelector(ctx, e.selector, p);
        if (c) killCitizen(ctx, c.id, e.cause, e.perceived);
        break;
      }
      case 'arrest': {
        const c = citizenBySelector(ctx, e.selector, p);
        const sheriff = holder(w, 'sheriff');
        if (c && c.lifeState === 'alive') arrestCitizen(ctx, c.id, e.reason, clamp(e.legitimacy + (sheriff ? (sheriff.integrity - 60) / 4 : -10) + (c.flags.includes('thief') ? 15 : 0)));
        break;
      }
      case 'release': {
        const c = citizenBySelector(ctx, e.selector, p);
        if (c && c.lifeState === 'imprisoned') {
          if (caseOf(ctx, c.id)) applyVerdict(ctx, c.id, 'pardon');
          else c.lifeState = 'alive';
        }
        break;
      }
      case 'dismiss':
        dismissOffice(ctx, e.officeId);
        break;
      case 'make_manager': {
        const c = citizenBySelector(ctx, e.selector, p);
        if (!c) break;
        const f = floorById(w, c.homeFloor)!;
        const prev = f.managerId !== undefined ? w.citizens[f.managerId] : undefined;
        if (prev) prev.flags = prev.flags.filter((x) => x !== 'floor_manager');
        f.managerId = c.id;
        f.reportingAccuracy = clamp(0.5 + c.integrity / 220 + c.skill / 600, 0, 1);
        c.flags = c.flags.filter((x) => x !== 'agitator');
        c.flags.push('floor_manager');
        c.trust = clamp(c.trust + 25);
        c.grievance = clamp(c.grievance - 25);
        break;
      }
      case 'policy':
        (w.policies as unknown as Record<string, unknown>)[e.key] = e.value;
        if (e.key === 'cleaning') rebalanceStaff(ctx);
        break;
      case 'legitimacy':
        w.psychology.legitimacy = clamp(w.psychology.legitimacy + e.amount);
        break;
      case 'authority':
        w.psychology.authority = clamp(w.psychology.authority + e.amount);
        break;
      case 'office_legitimacy':
        w.offices[e.officeId].legitimacy = clamp(w.offices[e.officeId].legitimacy + e.amount);
        break;
      case 'lockdown': {
        const f = floorById(w, e.floor === 'ctx' ? p.floor ?? '' : e.floor);
        if (f) setLockdown(ctx, f.id, e.level);
        break;
      }
      case 'promise':
        w.promises.push({ id: w.nextUid++, text: e.text, deadlineTick: w.tick + Math.round(e.days * TICKS_PER_DAY), check: e.check, tag: e.tag });
        journal(w, `Promesse publique : ${e.text}`, 'info');
        break;
      case 'journal':
        journal(w, e.text, e.severity ?? 'info', p.floor);
        break;
      case 'memory':
        w.memories.push({ tick: w.tick, type: e.memoryType, text: e.text, severity: e.severity, perceivedLegitimacy: e.legitimacy });
        break;
      case 'reveal_stocks': {
        const r = w.resources;
        const lost = Math.round(r.parts.declared - r.parts.real + r.medicine.declared - r.medicine.real);
        for (const k of ['food', 'water', 'parts', 'materials', 'medicine'] as const) r[k].declared = r[k].real;
        journal(w, `Audit : registres corrigés (${lost} unités manquantes).`, lost > 10 ? 'important' : 'info');
        break;
      }
      case 'chance':
        if (rng.chance(e.p)) applyEffects(ctx, e.then, p);
        else if (e.else) applyEffects(ctx, e.else, p);
        break;
      case 'start_election':
        startElection(ctx, e.officeId);
        break;
      case 'clean_lens':
        cleanLens(ctx);
        break;
      case 'chronicle':
        soothe(ctx, Number(p.vars?.memoryId), e.factor, e.mark);
        break;
      case 'remember':
        remember(ctx, e.kind, e.severity, { title: e.title });
        break;
      case 'verdict':
        applyVerdict(ctx, p.subjectId, e.mode);
        break;
      case 'rumor':
        startRumor(ctx, e.templateId);
        break;
      case 'faction': {
        const f = factionAt(w, p.floor);
        if (f) factionAction(ctx, f.id, e.action);
        break;
      }
    }
  }
}

export function processDelayed(ctx: Ctx) {
  const { w } = ctx;
  if (!w.delayed.length) return;
  const due = w.delayed.filter((d) => d.dueTick <= w.tick);
  if (!due.length) return;
  w.delayed = w.delayed.filter((d) => d.dueTick > w.tick);
  for (const d of due) {
    if (d.note) journal(w, `Conséquence : ${d.note}`, 'attention', d.pctx?.floor);
    applyEffects(ctx, d.effects, d.pctx ?? {});
  }
}

export function processPromises(ctx: Ctx) {
  const { w } = ctx;
  for (const pr of w.promises) {
    if (pr.resolved !== undefined) continue;
    const ok = check(ctx, pr.check);
    if (ok || w.tick >= pr.deadlineTick) {
      pr.resolved = ok;
      if (pr.tag) addTag(w, `${pr.tag}_${ok ? 'kept' : 'broken'}`);
      for (const c of w.citizens) {
        if (c.lifeState !== 'alive') continue;
        c.trust = clamp(c.trust + (ok ? 5 : -9));
        if (!ok) c.grievance = clamp(c.grievance + 5);
      }
      w.psychology.legitimacy = clamp(w.psychology.legitimacy + (ok ? 4 : -8));
      w.memories.push({ tick: w.tick, type: ok ? 'promise_kept' : 'promise_broken', text: pr.text, severity: 0.4, perceivedLegitimacy: ok ? 80 : 20 });
      shakeTrust(w, 'mayor', ok ? 4 : -8);
      journal(w, ok ? `Promesse tenue : ${pr.text}` : `Promesse non tenue : ${pr.text}`, ok ? 'info' : 'important');
    }
  }
  w.promises = w.promises.filter((p) => p.resolved === undefined || w.tick - p.deadlineTick < TICKS_PER_DAY * 3);
}

// ---------------------------------------------------------------------------
// Commandes de gouvernance partagées avec engine

export function rebalanceStaff(ctx: Ctx) {
  const { w } = ctx;
  w.sectors.sanitation.staffingTarget = Math.max(w.sectors.sanitation.staffingTarget, 0);
  // Retire les surplus vers le pool sans affectation, puis remplit les manques depuis ce pool.
  for (const s of Object.values(w.sectors)) {
    if (s.id === 'residential') continue;
    const members = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === s.id && !c.officeId);
    const officeCount = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === s.id && c.officeId).length;
    let excess = members.length + officeCount - s.staffingTarget;
    members.sort((a, b) => a.skill - b.skill);
    for (const c of members) {
      if (excess <= 0) break;
      c.sector = 'residential';
      c.workFloor = c.homeFloor;
      c.morale = clamp(c.morale - 4);
      excess--;
    }
  }
  const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === 'residential' && c.age >= 16 && c.age <= 64 && !c.officeId && !c.flags.includes('retired'));
  pool.sort((a, b) => b.skill - a.skill);
  for (const s of Object.values(w.sectors)) {
    if (s.id === 'residential') continue;
    let missing = s.staffingTarget - w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === s.id).length;
    while (missing > 0 && pool.length) {
      const c = pool.shift()!;
      c.sector = s.id;
      c.workFloor = SECTOR_FLOORS[s.id][c.id % SECTOR_FLOORS[s.id].length] ?? SECTOR_FLOOR[s.id];
      c.skill = Math.max(10, c.skill - 12); // novice dans le métier
      missing--;
    }
  }
}

export function setLockdown(ctx: Ctx, floorId: string, level: 'open' | 'controlled' | 'full') {
  const { w } = ctx;
  const f = floorById(w, floorId);
  if (!f || f.lockdown === level) return;
  const prev = f.lockdown;
  f.lockdown = level;
  f.lockdownSince = level === 'open' ? undefined : prev === 'open' ? w.tick : f.lockdownSince;
  const label = { open: 'levé', controlled: 'accès contrôlés', full: 'blocus complet' }[level];
  journal(w, `${f.label} ${f.name} : ${label}`, level === 'full' ? 'important' : 'info', f.id);
  if (level === 'full') remember(ctx, 'lockdown', 15, { floors: [f.id], title: `Le Blocus du ${f.label}` });
  if (level !== 'open') {
    const justified = f.unrest >= 3 || w.incidents.some((i) => i.status !== 'resolved' && i.floor === f.id && (i.type === 'contamination' || i.type === 'unrest'));
    for (const c of w.citizens) {
      if (c.lifeState !== 'alive' || c.homeFloor !== f.id) continue;
      c.fear = clamp(c.fear + (level === 'full' ? 12 : 4));
      c.anger = clamp(c.anger + (justified ? 3 : 12) * (level === 'full' ? 1 : 0.4));
      if (!justified) c.trust = clamp(c.trust - 6);
    }
    if (!justified) w.psychology.legitimacy = clamp(w.psychology.legitimacy - 3);
  }
}

export function dismissOffice(ctx: Ctx, officeId: OfficeId) {
  const { w } = ctx;
  const h = holder(w, officeId);
  if (!h) return;
  propagate(ctx, h.id, 18 + h.popularity * 0.3, 'dismissal', 100 - h.popularity * 0.6);
  vacate(ctx, officeId, `Révocation de ${fullName(h)}`);
  h.flags.push('dismissed');
  addTag(w, 'chief_replaced', 10);
}

export function appoint(ctx: Ctx, officeId: OfficeId, citizenId: number) {
  const { w } = ctx;
  const office = w.offices[officeId];
  const c = w.citizens[citizenId];
  if (!c || c.lifeState !== 'alive' || c.officeId) return;
  const prev = holder(w, officeId);
  if (prev) {
    prev.officeId = undefined;
    prev.flags.push('replaced');
    propagate(ctx, prev.id, 10 + prev.popularity * 0.25, 'dismissal', 70);
  }
  office.holderId = c.id;
  c.officeId = officeId;
  c.key = true;
  c.flags = c.flags.filter((f) => f !== 'interim');
  if (office.sector && c.sector !== office.sector) {
    c.sector = office.sector;
    c.workFloor = SECTOR_FLOOR[office.sector];
  }
  office.legitimacy = clamp(45 + c.popularity * 0.35 + c.skill * 0.1);
  // Réaction du secteur : une nomination populaire rassure, une nomination impopulaire crispe.
  const delta = (c.popularity - (prev?.popularity ?? 40)) * 0.15;
  for (const m of w.citizens) if (m.lifeState === 'alive' && m.sector === office.sector) m.morale = clamp(m.morale + delta);
  addTag(w, 'chief_replaced', 10);
  journal(w, `${office.title} : ${fullName(c)} nommé·e.`, 'info');
}

export function factionAt(w: WorldState, floor?: string) {
  return w.factions
    .filter((f) => f.status === 'active' && (!floor || f.floorIds.includes(floor)))
    .sort((a, b) => b.stage - a.stage)[0];
}

// Le nettoyage : celui qui sort nettoie les capteurs avant de mourir. Le monde redevient visible.
export function cleanLens(ctx: Ctx) {
  const { w } = ctx;
  const before = w.lens;
  w.lens = 1;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    c.morale = clamp(c.morale + (1 - before) * 10);
  }
  journal(w, 'Le nettoyage a eu lieu. Dans les réfectoires, le monde extérieur est de nouveau net : mort, mais visible.', 'important', 'cafeteria');
  w.memories.push({ tick: w.tick, type: 'cleaning', text: 'Nettoyage des capteurs', severity: 0.6, perceivedLegitimacy: 60 });
}

// ---------------------------------------------------------------------------
// Élections

export function startElection(ctx: Ctx, officeId: OfficeId) {
  const { w } = ctx;
  if (w.election && !w.election.winnerId) return;
  const incumbent = holder(w, officeId);
  const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 28 && !c.officeId && c.id !== incumbent?.id);
  pool.sort((a, b) => b.popularity + b.leadership + b.influence - (a.popularity + a.leadership + a.influence));
  const candidates: number[] = [];
  if (incumbent) candidates.push(incumbent.id);
  const sectors = new Set<string>();
  for (const c of pool) {
    if (candidates.length >= 3) break;
    if (sectors.has(c.sector)) continue;
    sectors.add(c.sector);
    candidates.push(c.id);
    c.key = true;
  }
  w.election = { officeId, candidateIds: candidates, startTick: w.tick, endTick: w.tick + TICKS_PER_DAY * 3 };
  journal(w, `Élection ouverte : ${w.offices[officeId].title}. Candidats : ${candidates.map((id) => fullName(w.citizens[id])).join(', ')}.`, 'important');
}

export function tallyVotes(ctx: Ctx, final: boolean): Record<number, number> {
  const { w, rng } = ctx;
  const e = w.election!;
  const incumbentId = w.offices[e.officeId].holderId;
  const votes: Record<number, number> = {};
  for (const id of e.candidateIds) votes[id] = 0;
  const relIndex = new Map<number, Map<number, number>>();
  for (const id of e.candidateIds) relIndex.set(id, new Map(w.relations[id].map((r) => [r.to, r.strength * (r.affinity >= 0 ? 1 : -1)])));
  for (const v of w.citizens) {
    if (v.lifeState !== 'alive' || v.age < 16) continue;
    let best = -1e9;
    let bestId = e.candidateIds[0];
    for (const id of e.candidateIds) {
      const c = w.citizens[id];
      if (c.lifeState !== 'alive') continue;
      let s = id === incumbentId ? v.trust * 0.6 : (100 - v.trust) * 0.45 + 18;
      s += c.popularity * 0.3 + c.leadership * 0.12;
      if (c.sector === v.sector && c.sector !== 'residential') s += 12;
      if (c.homeFloor === v.homeFloor) s += 6;
      s += (relIndex.get(id)!.get(v.id) ?? 0) * 40;
      if (e.supportedId === id) s += 5;
      s += final ? rng.normal(0, 9) : ((v.id * 31 + id * 17) % 19) - 9;
      if (s > best) {
        best = s;
        bestId = id;
      }
    }
    votes[bestId]++;
  }
  return votes;
}

export function electionHour(ctx: Ctx) {
  const { w } = ctx;
  const e = w.election;
  if (!e) return;
  if (e.winnerId !== undefined) {
    if (w.tick > e.endTick + TICKS_PER_DAY) w.election = undefined;
    return;
  }
  if (w.tick % (TICKS_PER_HOUR * 6) === 0) e.results = tallyVotes(ctx, false);
  if (w.tick < e.endTick) return;
  const results = tallyVotes(ctx, true);
  e.results = results;
  const total = Object.values(results).reduce((a, b) => a + b, 0) || 1;
  const [winnerId, winVotes] = Object.entries(results).sort((a, b) => b[1] - a[1])[0];
  const winner = w.citizens[Number(winnerId)];
  e.winnerId = winner.id;
  const office = w.offices[e.officeId];
  const prev = holder(w, e.officeId);
  if (prev && prev.id !== winner.id) {
    prev.officeId = undefined;
    prev.flags.push('lost_election');
  }
  office.holderId = winner.id;
  winner.officeId = e.officeId;
  winner.key = true;
  office.legitimacy = clamp(40 + (winVotes / total) * 70);
  office.termEndsDay = dayOf(w) + YEAR_DAYS * 2;
  w.psychology.legitimacy = clamp(w.psychology.legitimacy + 6);
  for (const c of w.citizens) if (c.lifeState === 'alive') c.trust = clamp(c.trust + 3);
  // Le soutien de l'administration peut fuiter.
  if (e.supportedId !== undefined && ctx.rng.chance(w.policies.transparency === 'high' ? 0.6 : 0.3)) {
    w.psychology.legitimacy = clamp(w.psychology.legitimacy - 8);
    journal(w, 'Le soutien de l’administration à un candidat a été rendu public.', 'important');
  }
  w.memories.push({ tick: w.tick, type: 'election', text: `${fullName(winner)} élu·e ${office.title}`, severity: 0.4, perceivedLegitimacy: office.legitimacy });
  journal(w, `${fullName(winner)} remporte l’élection (${Math.round((winVotes / total) * 100)} %).`, 'important');
}

// ---------------------------------------------------------------------------
// Vue UI

const ADVICE_DEFAULT_TITLE: Record<OfficeId, string> = {
  mayor: 'Maire',
  judge: 'Juge',
  sheriff: 'Shérif',
  it_director: 'Adjointe DSI',
  mechanic_chief: 'Mécanique',
  mines_chief: 'Mines',
  medical_chief: 'Médical',
  agri_chief: 'Agriculture',
  supply_chief: 'Fournitures',
};

export function decisionView(ctx: Ctx, p: PendingDecision): DecisionView | null {
  const { w } = ctx;
  const def = DEFS.get(p.defId);
  if (!def) return null;
  const advice: DecisionView['advice'] = [];
  for (const [officeId, text] of Object.entries(def.advice ?? {}) as [OfficeId, string][]) {
    const h = holder(w, officeId);
    if (!h) continue;
    advice.push({ title: `${ADVICE_DEFAULT_TITLE[officeId]} — ${fullName(h)}`, portrait: h.portrait, sector: h.sector, look: h.look, text });
  }
  return {
    uid: p.uid,
    defId: p.defId,
    title: interpolate(ctx, def.title, p),
    description: interpolate(ctx, def.description, p),
    severity: def.severity,
    category: def.category,
    image: def.image,
    floor: p.floor,
    hoursLeft: Math.max(0, (p.expiresTick - w.tick) / TICKS_PER_HOUR),
    advice,
    choices: def.choices.map((c) => ({
      id: c.id,
      label: interpolate(ctx, c.label, p),
      hint: c.hint,
      enabled: !c.requires || c.requires.every((r) => check(ctx, r)),
      advisor: c.advisor ? ADVICE_DEFAULT_TITLE[c.advisor] : undefined,
    })),
  };
}

export type { WorldState };
