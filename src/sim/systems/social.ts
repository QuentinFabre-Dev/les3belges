import { TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { Citizen, CitizenId, FloorState, Trait, UnrestLevel, WorldState } from '../types';
import { CAFETERIAS, FLOORS } from '../data/world';
import { avg, dayOf, fullName, hasTag, holder, hourOf, journal, message, openIncident, resolveIncidents } from '../util';
import { schedule } from './infrastructure';
import { openCase } from './justice';
import { factionPressure } from './factions';

const SENSITIVITY: Partial<Record<Trait, number>> = { solidary: 1.35, altruistic: 1.2, impulsive: 1.25, calm: 0.75, individualistic: 0.7, pragmatic: 0.9 };
const sensitivity = (c: Citizen) => c.traits.reduce((m, t) => m * (SENSITIVITY[t] ?? 1), 1);

// ---------------------------------------------------------------------------
// Besoins individuels (horaire)

export function populationHour(ctx: Ctx) {
  const { w } = ctx;
  const r = w.resources;
  const hungry = r.food.real <= 1;
  const thirsty = r.water.real <= 1;
  // Quand les citernes sont vides, chacun ne reçoit que la part produite.
  const waterShare = thirsty ? clamp(ctx.waterSupplyRatio, 0, 1) : 1;
  const rationMood = w.policies.rations === 'reduced' ? -12 : w.policies.rations === 'generous' ? 6 : 0;
  const gen = w.assets.generator;
  const blackout = gen.state === 'failed' && r.battery <= 0;
  const fearBase = gen.state === 'failed' ? (blackout ? 72 : 48) : 12;
  const legit = w.psychology.legitimacy;
  const medCapacity = ctx.staff.medical * w.sectors.medical.efficiency * (r.medicine.real > 5 ? 1 : 0.3);
  const healPerSick = ctx.sick > 0 ? Math.min(1.2, (medCapacity / ctx.sick) * 0.35) : 0;
  const floorMap = new Map<string, FloorState>(w.floors.map((f) => [f.id, f]));

  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    const home = floorMap.get(c.homeFloor)!;
    const work = floorMap.get(c.workFloor)!;
    const working = c.sector !== 'residential' && c.age >= 16;

    // Fatigue
    let fatigueTarget = working ? 32 : 20;
    if (working && w.policies.extendedHours) fatigueTarget += 22;
    if (c.sector === 'mines') fatigueTarget += 10 * w.policies.mineQuota;
    if (hasTag(w, `overtime:${c.sector}`)) fatigueTarget += 25;
    if (work.lockdown === 'full' || home.lockdown === 'full') fatigueTarget += 8;
    c.fatigue += (fatigueTarget + c.fear * 0.15 - c.fatigue) * 0.04;

    // Moral
    let moraleTarget = 62 + rationMood;
    if (home.cleanliness < 40) moraleTarget -= (40 - home.cleanliness) * 0.35;
    if (home.power < 0.6) moraleTarget -= 10;
    if (home.water < 0.5) moraleTarget -= 12;
    if (home.lockdown === 'full') moraleTarget -= 14;
    else if (home.lockdown === 'controlled') moraleTarget -= 5;
    if (c.fatigue > 60) moraleTarget -= (c.fatigue - 60) * 0.4;
    if (hungry) moraleTarget -= 25;
    if (thirsty) moraleTarget -= 30 * (1 - waterShare) + 8;
    if (c.flags.includes('rewarded')) moraleTarget += 8;
    moraleTarget -= c.grievance * 0.15;
    moraleTarget -= hasTag(w, 'screens_off') ? 4 : (1 - w.lens) * 9; // un écran sale assombrit tout le silo
    moraleTarget -= home.residents > home.capacity ? 6 : 0;
    c.morale += (moraleTarget - c.morale) * 0.05;

    // Peur : danger immédiat, retombe lentement
    const fearTarget = fearBase + (home.unrest >= 4 ? 20 : 0) + (home.cleanliness < 22 ? 12 : 0);
    c.fear += (fearTarget - c.fear) * (c.fear > fearTarget ? 0.02 : 0.12) * (c.traits.includes('calm') ? 0.7 : 1);

    // Colère -> retombe vers une fraction de la rancœur
    c.anger += (c.grievance * 0.35 + (hungry ? 30 : 0) + (home.lockdown === 'full' ? 15 : 0) - c.anger) * 0.03;
    // La rancœur s'accumule lentement (fatigue, surpeuplement, rationnement) et ne retombe que lentement.
    let grievanceGain = 0;
    if (c.fatigue > 55) grievanceGain += (c.fatigue - 55) * 0.004;
    if (home.residents > home.capacity) grievanceGain += 0.05;
    if (w.policies.rations === 'reduced') grievanceGain += 0.06;
    if (home.cleanliness < 40) grievanceGain += 0.04;
    if (home.lockdown === 'full') grievanceGain += 0.12;
    // Mécontentement de fond : la rancœur ne retombe que jusqu'à ce niveau, propre à chaque vie.
    let baseline = 8;
    if (c.sector === 'mines') baseline += 10 * w.policies.mineQuota;
    if (c.sector === 'sanitation' || c.sector === 'supplies') baseline += 5;
    if (c.fatigue > 40) baseline += (c.fatigue - 40) * 0.5;
    if (home.residents > home.capacity * 0.95) baseline += 6;
    if (w.policies.rations === 'reduced') baseline += 8;
    baseline += (1 - w.lens) * 8;
    if (c.flags.includes('ex_prisoner')) baseline += 10;
    const decay = c.grievance > baseline ? 0.03 : 0;
    c.grievance = clamp(c.grievance + grievanceGain - decay + (c.grievance < baseline ? 0.02 : 0));

    // Confiance : dérive vers la légitimité, plombée par la colère
    const trustTarget = legit * 0.85 - c.anger * 0.25 + (c.traits.includes('loyal') ? 10 : 0) - (c.traits.includes('skeptical') ? 8 : 0);
    c.trust += (trustTarget - c.trust) * 0.01;

    // Santé
    let dh = 0;
    // Les plus vulnérables (enfants, anciens, malades) souffrent d'abord des pénuries.
    const frailty = (c.age < 10 || c.age > 65 ? 1.6 : 0.75) * (0.7 + ((c.id * 7919) % 100) / 166);
    if (hungry) dh -= 0.25 * frailty;
    if (thirsty) dh -= (1 - waterShare) * 0.6 * frailty;
    if (home.cleanliness < 22) dh -= 0.15;
    if (c.age > 70) dh -= 0.04;
    if (c.fatigue > 75) dh -= 0.2;
    if (hasTag(w, 'flu') && (c.id + Math.floor(w.tick / 144)) % 9 === 0) dh -= c.age > 65 || c.age < 8 ? 0.9 : 0.5;
    if (c.health < 60) dh += healPerSick;
    else dh += 0.08;
    c.health = clamp(c.health + dh);
    if (c.flags.includes('injured') && c.health > 70) c.flags = c.flags.filter((f) => f !== 'injured');

    c.morale = clamp(c.morale);
    c.fatigue = clamp(c.fatigue);
    c.fear = clamp(c.fear);
    c.anger = clamp(c.anger);
    c.trust = clamp(c.trust);
  }
}

export function healthDeaths(ctx: Ctx) {
  const { w, rng } = ctx;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    if (c.health <= 0) {
      const r = ctx.w.resources;
      killCitizen(ctx, c.id, r.water.real <= 1 ? 'Conditions de vie (déshydratation)' : r.food.real <= 1 ? 'Conditions de vie (famine)' : 'Conditions de vie', 'negligence');
    }
    else if (c.age > 72 && rng.chance(0.0004)) killCitizen(ctx, c.id, 'Mort naturelle', 'accident');
  }
}

// ---------------------------------------------------------------------------
// Salubrité (horaire)

export function sanitationHour(ctx: Ctx) {
  const { w } = ctx;
  const crew = { low: 0.6, normal: 1, high: 1.45 }[w.policies.cleaning];
  const capacity = ctx.staff.sanitation * w.sectors.sanitation.efficiency * 0.16 * crew * (hasTag(w, 'overtime:sanitation') ? 1.5 : 1);
  const totalWaste = w.floors.reduce((s, f) => s + f.waste, 0) || 1;
  const hour = hourOf(w);
  for (const f of w.floors) {
    const p = ctx.presence[f.id]?.present ?? 0;
    let produced = p * 0.0035;
    if (f.cafeteria || f.left === 'canteen' || f.right === 'canteen') produced *= hour >= 11 && hour <= 13 ? 2.4 : 1.2;
    if (f.sector === 'mines' || f.sector === 'mechanical') produced *= 1.4;
    if (f.water < 0.5 || f.power < 0.5) produced *= 1.5; // évacuations dégradées
    if (f.unrest >= 4) produced *= 2;
    f.waste = clamp(f.waste + produced - capacity * (f.waste / totalWaste) * (f.lockdown === 'full' ? 0.4 : 1));
    f.cleanliness += (100 - f.waste * 1.15 - f.cleanliness) * 0.08;
    f.cleanliness = clamp(f.cleanliness);
    if (f.cleanliness < 22) {
      openIncident(w, 'contamination', `Risque sanitaire : ${f.label} ${f.name}`, 'important', [`Propreté ${Math.round(f.cleanliness)} %`, `Équipes de nettoyage : ${ctx.staff.sanitation}`], f.id);
    } else if (f.cleanliness > 40) {
      resolveIncidents(w, { type: 'contamination', floor: f.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Présence par étage selon les routines quotidiennes

export type Activity = 'work' | 'walk' | 'eat' | 'sleep' | 'leisure';

const FLOOR_INDEX = new Map(FLOORS.map((f, i) => [f.id, i]));
const CAF_IDX = CAFETERIAS.map((id) => FLOOR_INDEX.get(id)!);

// Chacun mange au réfectoire le plus proche de chez lui.
export function canteenFor(c: Citizen) {
  const h = FLOOR_INDEX.get(c.homeFloor) ?? 0;
  let best = CAFETERIAS[0];
  let d = Infinity;
  CAF_IDX.forEach((ci, k) => {
    if (Math.abs(ci - h) < d) {
      d = Math.abs(ci - h);
      best = CAFETERIAS[k];
    }
  });
  return best;
}

// Où se trouve un habitant à une heure donnée, et ce qu'il y fait (routine quotidienne).
export function locationOf(w: WorldState, c: Citizen, h: number): { floor: string; act: Activity; label: string } | null {
  if (c.lifeState === 'dead' || c.lifeState === 'missing') return null;
  if (c.lifeState === 'imprisoned') return { floor: 'security', act: 'sleep', label: 'En cellule' };
  if (c.flags.includes('injured') || c.health < 35) return { floor: 'medical', act: 'sleep', label: 'Soigné·e à l’infirmerie' };
  const extended = w.policies.extendedHours;
  const working = c.sector !== 'residential' && c.age >= 16;
  if (h >= 22 || h < 6) return { floor: c.homeFloor, act: 'sleep', label: 'Dort' };
  if (h === 6 || h === 17) return { floor: c.homeFloor, act: 'walk', label: h === 6 ? 'Se prépare, trajet' : 'Rentre chez soi' };
  if (h === 12) return { floor: canteenFor(c), act: 'eat', label: 'Repas au réfectoire' };
  if ((h >= 7 && h < 12) || (h >= 13 && h < (extended ? 20 : 17))) {
    if (working) {
      const floor = c.sector === 'sanitation' ? (c.id % 3 === 0 ? c.workFloor : FLOORS[(c.id * 7 + h) % FLOORS.length].id) : c.workFloor;
      return { floor, act: 'work', label: c.sector === 'sanitation' ? 'Tournée de nettoyage' : 'Au travail' };
    }
    if (c.age >= 6 && c.age < 16) return { floor: 'school', act: 'work', label: 'À l’école' };
    return { floor: c.homeFloor, act: 'leisure', label: c.age < 6 ? 'Garde des enfants' : 'Sans affectation, chez soi' };
  }
  if (h >= 18 && h < 20) {
    if (c.id % 3 === 0) return { floor: canteenFor(c), act: 'leisure', label: 'Soirée au réfectoire' };
    if (c.id % 5 === 1) return { floor: 'bazaar', act: 'leisure', label: 'Troc au bazar' };
  }
  return { floor: c.homeFloor, act: 'leisure', label: 'Temps libre' };
}

export function computePresence(ctx: Ctx) {
  const { w } = ctx;
  const h = hourOf(w);
  const presence: Ctx['presence'] = {};
  for (const f of w.floors) presence[f.id] = { present: 0, work: 0, walk: 0, eat: 0, sleep: 0, leisure: 0 };
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    const loc = locationOf(w, c, h);
    if (!loc) continue;
    const p = presence[loc.floor];
    if (!p) continue;
    p.present++;
    p[loc.act]++;
  }
  ctx.presence = presence;
}

// ---------------------------------------------------------------------------
// Agrégats sociaux, agitation (horaire)

const UNREST_LABELS = ['Calme', 'Mécontentement', 'Plaintes', 'Protestation', 'Émeute', 'Insurrection'];
export const unrestLabel = (l: number) => UNREST_LABELS[l];

export function socialHour(ctx: Ctx) {
  const { w } = ctx;
  const byFloor = new Map<string, Citizen[]>();
  const bySector = new Map<string, Citizen[]>();
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive' || c.age < 14) continue;
    if (!byFloor.has(c.homeFloor)) byFloor.set(c.homeFloor, []);
    byFloor.get(c.homeFloor)!.push(c);
    if (c.sector !== 'residential') {
      if (!bySector.has(c.sector)) bySector.set(c.sector, []);
      bySector.get(c.sector)!.push(c);
    }
  }
  for (const f of w.floors) {
    const list = byFloor.get(f.id) ?? [];
    f.residents = list.length;
    f.workers = w.citizens.filter((c) => c.lifeState === 'alive' && c.workFloor === f.id && c.sector !== 'residential').length;
    f.morale = avg(list.map((c) => c.morale));
    f.fear = avg(list.map((c) => c.fear));
    f.anger = avg(list.map((c) => c.anger));
    f.grievance = avg(list.map((c) => c.grievance));
    f.trust = avg(list.map((c) => c.trust));
    const leader = list.filter((c) => c.flags.includes('informal_leader') || c.flags.includes('agitator')).reduce((m, c) => Math.max(m, c.influence), 0);
    const cohesion = w.sectors[f.sector]?.cohesion ?? 0.5;
    const security = w.floors.find((x) => x.id === 'security')!;
    const patrol = f.lockdown === 'full' ? 14 : f.lockdown === 'controlled' ? 7 : 0;
    const pressure = f.anger * 0.3 + f.grievance * 0.3 + f.fear * 0.1 + cohesion * 12 + leader * 0.12 - f.trust * 0.22 - patrol - (security.power > 0.5 ? 2 : 0);
    f.unrestPressure = pressure + factionPressure(ctx, f.id);
    const target: UnrestLevel = f.unrestPressure < 16 ? 0 : pressure < 24 ? 1 : pressure < 32 ? 2 : pressure < 40 ? 3 : pressure < 48 ? 4 : 5;
    // L'escalade est progressive (un palier à la fois), la désescalade aussi.
    if (target > f.unrest && ctx.rng.chance(0.25)) setUnrest(ctx, f, (f.unrest + 1) as UnrestLevel);
    else if (target < f.unrest && ctx.rng.chance(0.2)) setUnrest(ctx, f, (f.unrest - 1) as UnrestLevel);
  }
  for (const s of Object.values(w.sectors)) {
    const list = bySector.get(s.id) ?? [];
    if (!list.length) continue;
    s.morale = avg(list.map((c) => c.morale));
    s.grievance = avg(list.map((c) => c.grievance));
    s.strikeRisk = clamp((s.grievance * 0.6 + (100 - s.morale) * 0.3) * s.cohesion - 20, 0, 100);
  }
  const all = w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 14);
  w.psychology.fear = avg(all.map((c) => c.fear));
  w.psychology.morale = avg(all.map((c) => c.morale));
  w.psychology.trust = avg(all.map((c) => c.trust));
  // Légitimité : dérive lente vers trust + résultats (pas de pénurie, peu de troubles).
  const shortages = (w.resources.food.real < 500 ? 15 : 0) + (w.resources.water.real < 150 ? 15 : 0);
  const unrestTotal = w.floors.reduce((s, f) => s + f.unrest, 0);
  const legitTarget = w.psychology.trust * 0.7 + 25 - shortages - unrestTotal * 1.5 - (w.policies.emergencyPowers ? 8 : 0) - (hasTag(w, 'judge_bypassed') ? 8 : 0);
  w.psychology.legitimacy = clamp(w.psychology.legitimacy + (legitTarget - w.psychology.legitimacy) * 0.01);
  const sheriff = holder(w, 'sheriff');
  const authTarget = 40 + (sheriff ? sheriff.skill * 0.25 : 0) + w.psychology.legitimacy * 0.2 - unrestTotal * 2 + (w.policies.emergencyPowers ? 12 : 0);
  w.psychology.authority = clamp(w.psychology.authority + (authTarget - w.psychology.authority) * 0.02);

  const foodDays = w.resources.food.real / Math.max(1, ctx.population);
  const waterDays = w.resources.water.real / Math.max(1, ctx.population + 470);
  w.stability = clamp(
    w.psychology.morale * 0.25 + w.psychology.trust * 0.2 + w.psychology.legitimacy * 0.2 + (100 - w.psychology.fear) * 0.15 + Math.min(20, foodDays * 2) + Math.min(10, waterDays * 4) - unrestTotal * 3,
  );
}

function setUnrest(ctx: Ctx, f: FloorState, level: UnrestLevel) {
  const { w } = ctx;
  const up = level > f.unrest;
  f.unrest = level;
  if (up && level >= 2) journal(w, `${f.label} ${f.name} : ${unrestLabel(level)}`, level >= 4 ? 'critical' : level >= 3 ? 'important' : 'attention', f.id);
  if (up && level === 3) {
    openIncident(w, 'unrest', `Protestation : ${f.label} ${f.name}`, 'important', unrestCauses(w, f), f.id);
    schedule(ctx, 'protest', { floor: f.id });
  }
  if (up && level === 4) {
    openIncident(w, 'unrest', `Émeute : ${f.label} ${f.name}`, 'critical', unrestCauses(w, f), f.id);
    schedule(ctx, 'riot', { floor: f.id });
  }
  if (level <= 2) resolveIncidents(w, { type: 'unrest', floor: f.id });
}

export function unrestCauses(w: WorldState, f: FloorState): string[] {
  const out: string[] = [];
  if (f.anger > 30) out.push(`Colère élevée (${Math.round(f.anger)})`);
  if (f.grievance > 30) out.push(`Rancœur accumulée (${Math.round(f.grievance)})`);
  if (f.trust < 45) out.push(`Confiance faible envers l’administration (${Math.round(f.trust)})`);
  if (f.lockdown === 'full') out.push('Blocus prolongé');
  if (w.policies.rations === 'reduced') out.push('Rationnement');
  if (f.cleanliness < 35) out.push('Insalubrité');
  if (hasTag(w, 'mine_negligence') && f.sector === 'mines') out.push('Accident minier jugé évitable');
  const leader = w.citizens.find((c) => c.lifeState === 'alive' && c.homeFloor === f.id && (c.flags.includes('agitator') || c.flags.includes('informal_leader')));
  if (leader) out.push(`Leader influent : ${fullName(leader)}`);
  return out.length ? out : ['Tensions diffuses'];
}

// ---------------------------------------------------------------------------
// Propagation sociale (mort, arrestation, récompense...)

export type SocialEventKind = 'death' | 'arrest' | 'reward' | 'dismissal' | 'execution';

export function propagate(ctx: Ctx, sourceId: CitizenId, severity: number, kind: SocialEventKind, legitimacy: number, broad = true) {
  const { w } = ctx;
  const src = w.citizens[sourceId];
  const visited = new Map<number, number>();
  const queue: [number, number, number][] = [[sourceId, 0, 1]];
  const unjust = (100 - legitimacy) / 100;
  while (queue.length) {
    const [id, depth, strength] = queue.shift()!;
    if (depth >= 3) continue;
    for (const e of w.relations[id]) {
      if (e.to === sourceId) continue;
      const s = strength * e.strength * (depth === 0 ? 1 : 0.45);
      if ((visited.get(e.to) ?? 0) >= s || s < 0.05) continue;
      visited.set(e.to, s);
      queue.push([e.to, depth + 1, s]);
    }
  }
  for (const [id, s] of visited) {
    const c = w.citizens[id];
    if (c.lifeState !== 'alive') continue;
    const k = severity * s * sensitivity(c) * (w.relations[sourceId].find((e) => e.to === id)?.type === 'rival' ? -0.3 : 1);
    applyReaction(c, kind, k, unjust);
    if (c.key && k > 6) {
      c.memories.push({ day: dayOf(w), text: memoryText(kind, src), trustDelta: -Math.round(k * unjust), angerDelta: Math.round(k * 0.6) });
      if (c.memories.length > 12) c.memories.shift();
    }
  }
  if (!broad) return;
  // Effet de corps : tout le secteur réagit selon sa cohésion.
  if (src.sector !== 'residential') {
    const sector = w.sectors[src.sector];
    for (const c of w.citizens) {
      if (c.lifeState !== 'alive' || c.sector !== src.sector || visited.has(c.id) || c.id === sourceId) continue;
      applyReaction(c, kind, severity * sector.cohesion * 0.4 * (0.6 + src.popularity / 150), unjust);
    }
  }
  // Toute la population, faiblement, selon la notoriété et la transparence.
  const visibility = (src.popularity + src.influence) / 200 + (src.officeId ? 0.3 : 0);
  const transparency = w.policies.transparency === 'high' ? 1.2 : w.policies.transparency === 'low' ? 0.6 : 1;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive' || visited.has(c.id)) continue;
    applyReaction(c, kind, severity * 0.06 * visibility * transparency, unjust);
  }
}

function applyReaction(c: Citizen, kind: SocialEventKind, k: number, unjust: number) {
  switch (kind) {
    case 'death':
      c.morale = clamp(c.morale - k * 0.6);
      c.fear = clamp(c.fear + k * 0.25);
      c.anger = clamp(c.anger + k * 0.5 * unjust);
      c.grievance = clamp(c.grievance + k * 0.55 * unjust);
      c.trust = clamp(c.trust - k * 0.3 * unjust);
      break;
    case 'execution':
      c.fear = clamp(c.fear + k * 0.4);
      c.anger = clamp(c.anger + k * (0.3 + unjust));
      c.grievance = clamp(c.grievance + k * (0.2 + unjust * 0.6));
      c.trust = clamp(c.trust - k * (0.15 + unjust * 0.6));
      c.trustSecurity = clamp(c.trustSecurity - k * 0.5);
      break;
    case 'arrest':
      c.anger = clamp(c.anger + k * 0.7 * unjust);
      c.grievance = clamp(c.grievance + k * 0.45 * unjust);
      c.trust = clamp(c.trust - k * 0.4 * unjust + k * 0.05 * (1 - unjust));
      c.trustSecurity = clamp(c.trustSecurity - k * 0.5 * unjust);
      c.fear = clamp(c.fear + k * 0.15);
      break;
    case 'dismissal':
      c.morale = clamp(c.morale - k * 0.3);
      c.anger = clamp(c.anger + k * 0.4 * unjust);
      c.trust = clamp(c.trust - k * 0.3 * unjust);
      break;
    case 'reward':
      c.morale = clamp(c.morale + k * 0.4);
      c.trust = clamp(c.trust + k * 0.25);
      break;
  }
}

function memoryText(kind: SocialEventKind, src: Citizen) {
  const n = fullName(src);
  switch (kind) {
    case 'death':
      return `Décès de ${n}`;
    case 'execution':
      return `Exécution de ${n}`;
    case 'arrest':
      return `Arrestation de ${n}`;
    case 'dismissal':
      return `Révocation de ${n}`;
    default:
      return `${n} récompensé·e`;
  }
}

// ---------------------------------------------------------------------------
// Mort / arrestation / vacance de poste

export function killCitizen(ctx: Ctx, id: CitizenId, cause: string, perceived: 'accident' | 'negligence' | 'legal' | 'controversial' | 'heroic') {
  const { w } = ctx;
  const c = w.citizens[id];
  if (!c || c.lifeState === 'dead') return;
  c.lifeState = 'dead';
  c.flags.push(`death:${cause}`);
  w.stats.deaths++;
  const legitimacy = { accident: 85, negligence: 30, legal: 60, controversial: 25, heroic: 90 }[perceived];
  const severity = 30 + c.popularity * 0.35 + c.influence * 0.2 + (c.key ? 10 : 0);
  // Les morts « anonymes » (conditions de vie, mort naturelle) ne touchent que leurs proches.
  const broad = c.key || c.popularity > 55 || perceived === 'legal' || perceived === 'controversial' || cause.includes('mine') || cause.includes('Accident');
  propagate(ctx, id, severity, perceived === 'legal' || perceived === 'controversial' ? 'execution' : 'death', legitimacy, broad);
  w.memories.push({ tick: w.tick, type: `death_${perceived}`, text: `${fullName(c)} : ${cause}`, severity: severity / 100, perceivedLegitimacy: legitimacy });
  journal(w, `Décès de ${fullName(c)} (${c.age} ans) — ${cause}`, c.key ? 'important' : 'attention', c.workFloor);
  if (c.officeId) vacate(ctx, c.officeId, `Décès de ${fullName(c)}`);
  if (c.flags.includes('specialist')) {
    const lost = Object.values(w.assets).filter((a) => a.specialistIds.includes(id));
    if (lost.length) journal(w, `Perte d’expertise : ${lost.map((a) => a.name).join(', ')}`, 'important');
  }
}

export function arrestCitizen(ctx: Ctx, id: CitizenId, reason: string, legitimacy: number) {
  const { w } = ctx;
  const c = w.citizens[id];
  if (!c || c.lifeState !== 'alive') return;
  c.lifeState = 'imprisoned';
  c.flags.push(`arrested:${reason}`);
  w.stats.arrests++;
  const severity = 22 + c.popularity * 0.35 + c.influence * 0.25;
  propagate(ctx, id, severity, 'arrest', legitimacy);
  w.memories.push({ tick: w.tick, type: 'arrest', text: `Arrestation de ${fullName(c)} : ${reason}`, severity: severity / 100, perceivedLegitimacy: legitimacy });
  journal(w, `Arrestation de ${fullName(c)} — ${reason}`, 'attention', c.homeFloor);
  openCase(ctx, id, reason, legitimacy);
  if (c.officeId) vacate(ctx, c.officeId, `Arrestation de ${fullName(c)}`);
}

export function vacate(ctx: Ctx, officeId: keyof WorldState['offices'], reason: string) {
  const { w } = ctx;
  const office = w.offices[officeId];
  const prev = office.holderId !== undefined ? w.citizens[office.holderId] : undefined;
  if (prev) prev.officeId = undefined;
  // Intérim : le plus compétent du secteur, légitimité réduite.
  const pool = w.citizens.filter((c) => c.lifeState === 'alive' && !c.officeId && c.age >= 25 && (office.sector ? c.sector === office.sector : true));
  pool.sort((a, b) => b.skill + b.leadership - (a.skill + a.leadership));
  const interim = pool[0];
  office.holderId = interim?.id;
  office.legitimacy = 35;
  if (interim) {
    interim.officeId = officeId;
    interim.key = true;
    interim.flags.push('interim');
  }
  journal(w, `${office.title} : poste vacant (${reason}). Intérim : ${interim ? fullName(interim) : 'personne'}.`, 'important');
  schedule(ctx, 'succession', { subjectId: interim?.id });
}

// ---------------------------------------------------------------------------
// Vol de fournitures (quotidien) : émerge de la rareté, de la corruption et de la sécurité.

export function supplyTheftDay(ctx: Ctx) {
  const { w, rng } = ctx;
  const chief = holder(w, 'supply_chief');
  const sheriff = holder(w, 'sheriff');
  const scarcity = 1 - Math.min(1, w.resources.parts.real / 250) * 0.5 - Math.min(1, w.resources.medicine.real / 400) * 0.5;
  const corruption = chief ? (100 - chief.integrity) / 100 : 0.6;
  const security = (sheriff ? sheriff.skill / 100 : 0.3) * (ctx.staff.security / Math.max(1, w.sectors.security.staffingTarget)) * (hasTag(w, 'supply_controls') ? 1.6 : 1);
  const tension = w.psychology.fear / 200 + (100 - w.psychology.morale) / 200;
  const p = clamp(0.05 + scarcity * 0.25 + corruption * 0.3 + tension * 0.2 - security * 0.35, 0.01, 0.8);
  if (!rng.chance(p)) return;
  const item = rng.chance(0.6) ? 'parts' : 'medicine';
  const stock = w.resources[item];
  const qty = Math.round(rng.range(4, 14) * (1 + corruption));
  stock.real = Math.max(0, stock.real - qty);
  // Les registres ne voient rien : le stock déclaré reste inchangé.
  const thief = rng.pick(w.citizens.filter((c) => c.lifeState === 'alive' && (c.sector === 'supplies' || c.sector === 'mechanical' || c.sector === 'security') && c.integrity < 45));
  if (thief && !thief.flags.includes('thief')) thief.flags.push('thief');
  w.tags['theft_ongoing'] = w.tick + TICKS_PER_DAY * 10;
}

export function reportsDay(ctx: Ctx) {
  const { w } = ctx;
  if (dayOf(w) % 3 !== 0) return;
  const chief = holder(w, 'supply_chief');
  if (chief) {
    const r = w.resources;
    const days = Math.round(r.parts.declared / 12);
    message(w, `Fournitures — ${fullName(chief)}`, 'Rapport des stocks', `Pièces : ${Math.round(r.parts.declared)} (≈ ${days} jours). Médicaments : ${Math.round(r.medicine.declared)}. Aucune anomalie à signaler.`, chief.id);
  }
  const worst = [...w.floors].sort((a, b) => b.unrestPressure - a.unrestPressure)[0];
  const mgr = worst.managerId !== undefined ? w.citizens[worst.managerId] : undefined;
  if (mgr && mgr.lifeState === 'alive' && worst.unrestPressure > 14) {
    const minimizes = mgr.integrity < 50;
    message(
      w,
      `Responsable ${worst.label} — ${fullName(mgr)}`,
      minimizes ? 'Situation sous contrôle' : 'Tensions sur l’étage',
      minimizes
        ? 'Quelques plaintes isolées, rien d’inquiétant. Je gère.'
        : `La colère monte sur l’étage (${unrestCauses(w, worst).slice(0, 2).join(', ').toLowerCase()}). Il faudrait agir avant que cela dégénère.`,
      mgr.id,
    );
  }
}
