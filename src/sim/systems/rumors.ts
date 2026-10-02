// Rumeurs : nées de faits (vrais, partiels ou inventés), elles se propagent d'étage en étage,
// s'accélèrent dans les réfectoires aux heures de repas et pèsent sur la peur, la colère et la confiance.
// L'administration ne connaît pas leur vérité sans enquête de la DSI.

import { CAFETERIAS, FLOORS, TICKS_PER_DAY, TICKS_PER_HOUR } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { Citizen, FloorId, Rumor, RumorTruth } from '../types';
import { fullName, hasTag, holder, hourOf, journal } from '../util';

interface Template {
  id: string;
  text: (ctx: Ctx) => string;
  // Renvoie la vérité si la rumeur peut naître maintenant, sinon null.
  truth: (ctx: Ctx) => RumorTruth | null;
  chancePerDay: number;
  origin: (ctx: Ctx) => FloorId;
  fear: number;
  anger: number;
  trust: number;
}

const lowTrust = (ctx: Ctx) => ctx.w.psychology.trust < 50;

export const RUMOR_TEMPLATES: Template[] = [
  {
    id: 'depot_vide',
    text: () => 'Le dépôt se vide en douce : quelqu’un revend les pièces et les médicaments.',
    truth: (ctx) => (hasTag(ctx.w, 'theft_ongoing') ? 'true' : lowTrust(ctx) ? 'false' : null),
    chancePerDay: 0.25,
    origin: () => 'supplies',
    fear: 2,
    anger: 6,
    trust: -6,
  },
  {
    id: 'gen_lache',
    text: () => 'La génératrice ne tiendra pas un mois de plus. Les mécaniciens le savent.',
    truth: (ctx) => (ctx.w.assets.generator.condition < 0.45 ? 'true' : ctx.w.psychology.fear > 25 ? 'false' : null),
    chancePerDay: 0.2,
    origin: () => 'mechanical',
    fear: 9,
    anger: 1,
    trust: -3,
  },
  {
    id: 'alertes_ignorees',
    text: () => 'Les alertes de sécurité des mines avaient été ignorées avant l’accident.',
    truth: (ctx) => (hasTag(ctx.w, 'mine_negligence') ? 'true' : null),
    chancePerDay: 0.6,
    origin: () => 'mines',
    fear: 3,
    anger: 10,
    trust: -8,
  },
  {
    id: 'rations_secretes',
    text: () => 'L’administration garde des rations secrètes pour ses proches.',
    truth: (ctx) => (ctx.w.memories.some((m) => m.type === 'elite_privileges') ? 'true' : ctx.w.policies.rations === 'reduced' ? 'false' : null),
    chancePerDay: 0.3,
    origin: () => 'res_low',
    fear: 1,
    anger: 9,
    trust: -7,
  },
  {
    id: 'arrestations',
    text: () => 'Le shérif dresse des listes : une vague d’arrestations se prépare.',
    truth: (ctx) => (hasTag(ctx.w, 'arbitrary_arrests') || ctx.w.citizens.filter((c) => c.lifeState === 'imprisoned').length > 6 ? 'partial' : null),
    chancePerDay: 0.4,
    origin: () => 'res_mid',
    fear: 8,
    anger: 4,
    trust: -4,
  },
  {
    id: 'eau_contaminee',
    text: () => 'L’eau des étages du bas serait contaminée. Des enfants seraient malades.',
    truth: (ctx) => (ctx.w.floors.some((f) => f.cleanliness < 25) ? 'partial' : ctx.w.assets.water_filters.condition < 0.4 ? 'partial' : null),
    chancePerDay: 0.35,
    origin: () => 'res_low',
    fear: 8,
    anger: 3,
    trust: -3,
  },
  {
    id: 'dehors_bouge',
    text: () => 'Quelqu’un aurait vu bouger quelque chose dehors, sur l’écran du grand réfectoire.',
    truth: (ctx) => (ctx.w.lens > 0.75 ? 'false' : null),
    chancePerDay: 0.06,
    origin: () => 'cafeteria',
    fear: 4,
    anger: 0,
    trust: -3,
  },
  {
    id: 'faction',
    text: (ctx) => {
      const f = ctx.w.factions.find((x) => x.status === 'active' && x.stage >= 1);
      return f ? `On dit que « ${f.name} » prépare quelque chose.` : 'On dit qu’un groupe prépare quelque chose dans les étages du bas.';
    },
    truth: (ctx) => (ctx.w.factions.some((x) => x.status === 'active' && x.stage >= 1) ? 'true' : null),
    chancePerDay: 0.3,
    origin: (ctx) => ctx.w.factions.find((x) => x.status === 'active')?.floorIds[0] ?? 'res_low',
    fear: 6,
    anger: 2,
    trust: -2,
  },
  {
    id: 'candidat',
    text: (ctx) => {
      const e = ctx.w.election;
      const id = e?.candidateIds[e.candidateIds.length - 1];
      return id !== undefined ? `${fullName(ctx.w.citizens[id])} aurait détourné des rations quand il·elle travaillait au dépôt.` : 'Un candidat aurait détourné des rations.';
    },
    truth: (ctx) => (ctx.w.election && !ctx.w.election.winnerId ? 'false' : null),
    chancePerDay: 0.5,
    origin: () => 'res_mid',
    fear: 0,
    anger: 4,
    trust: -2,
  },
];

const TEMPLATES = new Map(RUMOR_TEMPLATES.map((t) => [t.id, t]));

export function startRumor(ctx: Ctx, templateId: string, forced?: RumorTruth) {
  const { w } = ctx;
  const t = TEMPLATES.get(templateId);
  if (!t) return;
  if (w.rumors.some((r) => r.templateId === templateId && (r.status === 'spreading' || r.status === 'fading'))) return;
  const truth = forced ?? t.truth(ctx);
  if (!truth) return;
  const origin = t.origin(ctx);
  const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.homeFloor === origin && c.age >= 16);
  const originCitizen: Citizen | undefined = pool.sort((a, b) => b.influence + b.grievance - (a.influence + a.grievance))[Math.floor(ctx.rng.next() * Math.min(6, pool.length))];
  const reach: Record<FloorId, number> = {};
  for (const f of w.floors) reach[f.id] = 0;
  reach[origin] = 0.08;
  const r: Rumor = {
    id: w.nextUid++,
    templateId,
    text: t.text(ctx),
    truth,
    known: false,
    originFloor: origin,
    originId: originCitizen?.id,
    reach,
    createdTick: w.tick,
    fear: t.fear,
    anger: t.anger,
    trust: t.trust,
    status: 'spreading',
  };
  w.rumors.push(r);
  if (originCitizen && !originCitizen.flags.includes('rumor_source')) originCitizen.flags.push('rumor_source');
}

export function rumorsHour(ctx: Ctx) {
  const { w, rng } = ctx;
  // Naissance
  for (const t of RUMOR_TEMPLATES) {
    if (w.rumors.filter((r) => r.status === 'spreading').length >= 4) break;
    if (!rng.chance(t.chancePerDay / 24)) continue;
    startRumor(ctx, t.id);
  }
  const hour = hourOf(w);
  const meal = hour === 12 || (hour >= 18 && hour < 20);
  const index = new Map(FLOORS.map((f, i) => [f.id, i]));
  const cafIdx = CAFETERIAS.map((id) => index.get(id)!);
  const nearestCaf = (i: number) => cafIdx.reduce((best, c) => (Math.abs(c - i) < Math.abs(best - i) ? c : best), cafIdx[0]);

  for (const r of w.rumors) {
    if (r.status === 'gone') continue;
    const age = (w.tick - r.createdTick) / TICKS_PER_DAY;
    if (r.status === 'spreading' && age > 4 + (r.truth === 'true' ? 2 : 0)) r.status = 'fading';
    const before = { ...r.reach };
    const n = w.floors.length;
    for (let i = 0; i < n; i++) {
      const f = w.floors[i];
      let x = r.reach[f.id] ?? 0;
      if (r.status === 'spreading') {
        const cohesion = w.sectors[f.sector]?.cohesion ?? 0.5;
        const rate = 0.05 * (0.5 + f.fear / 100 + (1 - f.trust / 100) + cohesion * 0.3) * (f.lockdown === 'full' ? 0.4 : 1);
        x += rate * x * (1 - x);
        const up = i > 0 ? r.reach[w.floors[i - 1].id] : 0;
        const down = i < n - 1 ? r.reach[w.floors[i + 1].id] : 0;
        x += 0.012 * (up + down) * (f.lockdown === 'full' ? 0.3 : 1);
      } else {
        x -= r.status === 'debunked' ? 0.04 : 0.012;
      }
      r.reach[f.id] = clamp(x, 0, 1);
    }
    // Les réfectoires mélangent les étages qu'ils servent aux heures de repas.
    if (meal && r.status === 'spreading') {
      const groups = new Map<number, string[]>();
      w.floors.forEach((f, i) => {
        const c = nearestCaf(i);
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(f.id);
      });
      for (const ids of groups.values()) {
        const avg = ids.reduce((s, id) => s + r.reach[id], 0) / ids.length;
        for (const id of ids) r.reach[id] = r.reach[id] + (avg - r.reach[id]) * 0.12;
      }
    }
    // Effets : proportionnels à la nouvelle portée sur chaque étage.
    if (r.status === 'spreading' || r.status === 'confirmed') {
      const deltas = new Map<string, number>();
      for (const f of w.floors) deltas.set(f.id, Math.max(0, r.reach[f.id] - before[f.id]));
      for (const c of w.citizens) {
        if (c.lifeState !== 'alive') continue;
        const d = deltas.get(c.homeFloor) ?? 0;
        if (d <= 0) continue;
        const k = d * (c.traits.includes('skeptical') ? 1.3 : c.traits.includes('calm') ? 0.7 : 1) * 10;
        c.fear = clamp(c.fear + r.fear * k * 0.1);
        c.anger = clamp(c.anger + r.anger * k * 0.1);
        c.trust = clamp(c.trust + r.trust * k * 0.1);
        if (r.templateId === 'arrestations') c.trustSecurity = clamp(c.trustSecurity - 2 * k * 0.1);
      }
    }
    if (r.status === 'fading' || r.status === 'debunked') {
      if (Object.values(r.reach).every((v) => v < 0.02)) r.status = 'gone';
    }
    // Fin d'enquête DSI
    if (r.investigating && w.tick >= r.investigating) {
      r.investigating = undefined;
      const it = holder(w, 'it_director');
      const accuracy = ctx.infoAccuracy * (it ? 0.6 + it.skill / 250 : 0.5);
      if (rng.chance(accuracy)) {
        r.known = true;
        const label = { true: 'vraie', false: 'fausse', partial: 'en partie vraie' }[r.truth];
        journal(w, `Enquête DSI : la rumeur « ${short(r.text)} » est ${label}.`, 'info');
        if (r.originId !== undefined && rng.chance(0.5)) {
          const o = w.citizens[r.originId];
          if (!o.flags.includes('suspect')) o.flags.push('suspect');
          journal(w, `La DSI remonte la rumeur jusqu’à ${fullName(o)}.`, 'attention', o.homeFloor);
        }
      } else journal(w, `Enquête DSI non concluante sur la rumeur « ${short(r.text)} ».`, 'info');
    }
  }
  // Mensonges démentis qui éclatent au grand jour
  for (const r of w.rumors) {
    if (!r.denied || r.truth === 'false' || r.status === 'gone') continue;
    if (rng.chance(0.15 / 24)) {
      r.denied = false;
      r.status = 'confirmed';
      for (const c of w.citizens) if (c.lifeState === 'alive') c.trust = clamp(c.trust - 6);
      w.psychology.legitimacy = clamp(w.psychology.legitimacy - 6);
      journal(w, `Le démenti de l’administration est contredit par les faits : « ${short(r.text)} ».`, 'important');
      w.memories.push({ tick: w.tick, type: 'lie_exposed', text: 'Un démenti officiel s’est révélé mensonger', severity: 0.5, perceivedLegitimacy: 20 });
    }
  }
  w.rumors = w.rumors.filter((r) => r.status !== 'gone' || w.tick - r.createdTick < TICKS_PER_DAY * 2);
}

const short = (t: string) => (t.length > 60 ? t.slice(0, 57) + '…' : t);

export function rumorAction(ctx: Ctx, rumorId: number, action: 'deny' | 'confirm' | 'investigate') {
  const { w } = ctx;
  const r = w.rumors.find((x) => x.id === rumorId);
  if (!r || r.status === 'gone') return;
  const mayor = holder(w, 'mayor');
  const credibility = mayor ? (mayor.leadership + mayor.popularity) / 200 : 0.3;
  if (action === 'investigate') {
    if (!r.investigating) r.investigating = w.tick + TICKS_PER_HOUR * 18;
    journal(w, `La DSI enquête sur la rumeur « ${short(r.text)} ».`, 'info');
    return;
  }
  if (action === 'deny') {
    r.denied = true;
    const factor = r.truth === 'false' ? 0.35 + (1 - credibility) * 0.3 : 0.75;
    for (const id of Object.keys(r.reach)) r.reach[id] *= factor;
    r.status = 'debunked';
    if (r.truth === 'false') for (const c of w.citizens) if (c.lifeState === 'alive') c.trust = clamp(c.trust + 1.5 * credibility);
    journal(w, `Démenti officiel : « ${short(r.text)} ».`, 'info');
  } else {
    r.status = 'confirmed';
    r.known = true;
    if (r.truth === 'false') {
      // Confirmer une fausse rumeur : panique, puis discrédit quand l'erreur apparaît.
      for (const c of w.citizens) if (c.lifeState === 'alive') c.fear = clamp(c.fear + r.fear * 0.6);
      w.delayed.push({ dueTick: w.tick + TICKS_PER_DAY * 2, note: 'L’administration avait confirmé une rumeur fausse', effects: [{ type: 'legitimacy', amount: -8 }, { type: 'social', target: 'all', stat: 'trust', amount: -6 }] });
    } else {
      for (const c of w.citizens) if (c.lifeState === 'alive') c.trust = clamp(c.trust + 3);
      w.psychology.legitimacy = clamp(w.psychology.legitimacy + 2);
    }
    journal(w, `L’administration confirme : « ${short(r.text)} ».`, 'info');
    r.status = 'fading';
  }
}
