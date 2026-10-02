// Factions : elles émergent d'une rancœur commune autour d'un leader, recrutent par les relations,
// montent par paliers et laissent des signaux avant-coureurs. Le joueur peut négocier, coopter,
// infiltrer, arrêter le leader ou dissoudre (pouvoirs d'urgence).

import { SECTOR_FLOOR, SECTOR_NAMES, TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { Citizen, DemandKind, Faction, SectorId } from '../types';
import { addTag, avg, floorById, fullName, holder, journal, openIncident } from '../util';
import { arrestCitizen } from './social';
import { schedule } from './infrastructure';
import { applyVerdict, caseOf } from './justice';

export const STAGE_LABELS = ['Cercle discret', 'Mouvement', 'Organisation', 'Préparation', 'Insurrection'];

const NAMES: Partial<Record<SectorId, [string, string]>> = {
  mines: ['Les Fils de la Roche', '⛏'],
  mechanical: ['Le Cercle des Machines', '⚙'],
  agriculture: ['Les Racines', '✿'],
  sanitation: ['Les Invisibles', '◆'],
  supplies: ['La Main du Dépôt', '✋'],
  water: ['Le Courant', '≈'],
  energy: ['Les Gardiens de la Flamme', '✶'],
  security: ['Les Insignes Noirs', '★'],
  medical: ['Le Serment Blanc', '✚'],
  admin: ['Le Registre', '§'],
  residential: ['Le Comité des Étages', '▲'],
};

export const DEMAND_LABELS: Record<DemandKind, string> = {
  lower_quota: 'Baisser le quota minier',
  more_rations: 'Augmenter les rations',
  release_member: 'Libérer un membre détenu',
  replace_chief: 'Remplacer le responsable du secteur',
  end_lockdown: 'Lever le blocus de leurs étages',
  inquiry: 'Ouvrir une enquête sur l’accident',
  more_staff: 'Renforcer les effectifs',
};

const STAGE_THRESHOLDS = [0, 30, 40, 50, 62];

function leaderOf(_ctx: Ctx, pool: Citizen[]) {
  return pool.find((c) => c.flags.includes('informal_leader') || c.flags.includes('agitator')) ?? pool.slice().sort((a, b) => b.influence + b.grievance - (a.influence + a.grievance))[0];
}

function computeDemands(ctx: Ctx, f: Faction): DemandKind[] {
  const { w } = ctx;
  const out: DemandKind[] = [];
  if (f.sector === 'mines' && w.policies.mineQuota > 1) out.push('lower_quota');
  if (f.sector === 'mines' && w.tags['mine_negligence'] !== undefined) out.push('inquiry');
  if (w.policies.rations === 'reduced') out.push('more_rations');
  if (f.members.some((id) => w.citizens[id].lifeState === 'imprisoned') || w.citizens[f.leaderId].lifeState === 'imprisoned') out.push('release_member');
  const office = w.sectors[f.sector]?.officeId;
  const chief = office ? holder(w, office) : undefined;
  if (chief && chief.popularity < 50) out.push('replace_chief');
  if (f.floorIds.some((id) => floorById(w, id)?.lockdown !== 'open')) out.push('end_lockdown');
  if (w.sectors[f.sector] && w.sectors[f.sector].staffingTarget > 0 && avg(f.members.map((id) => w.citizens[id].fatigue)) > 50) out.push('more_staff');
  if (!out.length) out.push(f.sector === 'residential' ? 'more_rations' : 'more_staff');
  return out.slice(0, 3);
}

export function factionsDay(ctx: Ctx) {
  const { w, rng } = ctx;
  // Émergence : un secteur rancunier + un leader = un cercle.
  for (const s of Object.values(w.sectors)) {
    if (s.id === 'residential') continue;
    if (w.factions.some((f) => f.sector === s.id && f.status === 'active')) continue;
    if (s.grievance < 22) continue;
    const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === s.id && !c.officeId && c.grievance > 20);
    if (pool.length < 6 || !rng.chance(0.3)) continue;
    const leader = leaderOf(ctx, pool);
    if (!leader) continue;
    const [name, symbol] = NAMES[s.id] ?? ['Le Comité', '▲'];
    const f: Faction = {
      id: w.nextUid++,
      name,
      symbol,
      sector: s.id,
      floorIds: Array.from(new Set([SECTOR_FLOOR[s.id], ...pool.map((c) => c.homeFloor)])).slice(0, 3),
      leaderId: leader.id,
      members: pool.slice(0, 40).map((c) => c.id),
      influence: 10,
      stage: 0,
      demands: [],
      createdTick: w.tick,
      lastStageTick: w.tick,
      detected: false,
      infiltrated: false,
      status: 'active',
    };
    leader.key = true;
    if (!leader.flags.includes('faction_leader')) leader.flags.push('faction_leader');
    w.factions.push(f);
  }

  for (const f of w.factions) {
    if (f.status !== 'active') continue;
    // Leader arrêté ou mort : un autre prend la place (ou le mouvement s'éteint).
    let leader = w.citizens[f.leaderId];
    if (leader.lifeState !== 'alive') {
      const pool = f.members.map((id) => w.citizens[id]).filter((c) => c.lifeState === 'alive');
      const next = leaderOf(ctx, pool);
      if (!next || pool.length < 4) {
        f.status = 'dissolved';
        journal(w, `« ${f.name} » s’est dispersé.`, 'info');
        continue;
      }
      f.leaderId = next.id;
      next.key = true;
      if (!next.flags.includes('faction_leader')) next.flags.push('faction_leader');
      leader = next;
    }
    // Recrutement par les relations
    const memberSet = new Set(f.members);
    for (const id of [...f.members]) {
      for (const e of w.relations[id]) {
        const c = w.citizens[e.to];
        if (memberSet.has(c.id) || c.lifeState !== 'alive' || c.officeId || c.age < 16) continue;
        if (c.grievance > 20 && e.strength > 0.4 && rng.chance(0.08)) {
          memberSet.add(c.id);
          if (memberSet.size > 160) break;
        }
      }
    }
    // Départs : ceux qui n'ont plus de grief s'éloignent
    f.members = [...memberSet].filter((id) => {
      const c = w.citizens[id];
      return c.lifeState !== 'dead' && (c.grievance > 12 || id === f.leaderId);
    });
    const members = f.members.map((id) => w.citizens[id]);
    const alive = members.filter((c) => c.lifeState === 'alive');
    const sectorSize = Math.max(10, w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === f.sector).length);
    f.influence = clamp((alive.length / sectorSize) * 60 + leader.influence * 0.4);
    const score = avg(alive.map((c) => c.grievance)) + f.influence * 0.3 - (avg(alive.map((c) => c.trust)) - 50) * 0.3 + (f.infiltrated ? -6 : 0);
    const sinceStage = (w.tick - f.lastStageTick) / TICKS_PER_DAY;
    if (f.stage < 4 && score > STAGE_THRESHOLDS[f.stage + 1] && sinceStage >= 2) setStage(ctx, f, (f.stage + 1) as Faction['stage']);
    else if (f.stage > 0 && score < STAGE_THRESHOLDS[f.stage] - 10 && sinceStage >= 2) setStage(ctx, f, (f.stage - 1) as Faction['stage']);
    if ((f.stage === 0 && score < 18 && sinceStage > 4) || alive.length < 5) {
      f.status = 'dissolved';
      journal(w, `« ${f.name} » s’est éteint de lui-même.`, 'info');
      continue;
    }
    // Détection : DSI, shérif, responsables d'étage
    if (!f.detected && f.stage >= 1) {
      const sheriff = holder(w, 'sheriff');
      const p = 0.15 + ctx.infoAccuracy * 0.25 + (sheriff ? sheriff.skill / 400 : 0) + f.stage * 0.1;
      if (f.stage >= 2 || rng.chance(p)) {
        f.detected = true;
        journal(w, `Le shérif identifie un groupe organisé : « ${f.name} » (${SECTOR_NAMES[f.sector]}), mené par ${fullName(leader)}.`, 'important', f.floorIds[0]);
      }
    }
    f.demands = f.stage >= 1 ? computeDemands(ctx, f) : [];
    // Sabotage
    if (f.stage >= 3 && rng.chance(0.25)) {
      const targets = Object.values(w.assets).filter((a) => f.floorIds.includes(a.floor) || a.sector === f.sector);
      const a = targets.length ? rng.pick(targets) : rng.pick(Object.values(w.assets));
      a.condition = clamp(a.condition - rng.range(0.08, 0.18), 0, 1);
      openIncident(w, 'sabotage', `Sabotage suspecté : ${a.name}`, 'important', [`Faction active : ${f.detected ? f.name : 'groupe non identifié'}`, `Étape : ${STAGE_LABELS[f.stage]}`], a.floor, a.id);
    }
  }
}

export function setStage(ctx: Ctx, f: Faction, stage: Faction['stage']) {
  const { w } = ctx;
  const up = stage > f.stage;
  f.stage = stage;
  f.lastStageTick = w.tick;
  if (stage >= 1) f.demands = computeDemands(ctx, f);
  if (stage >= 2 && !f.detected) f.detected = true; // une organisation agit au grand jour
  const name = f.detected ? `« ${f.name} »` : 'Un groupe non identifié';
  if (!up) {
    if (f.detected) journal(w, `${name} perd de son élan (${STAGE_LABELS[stage]}).`, 'info');
    return;
  }
  const where = f.floorIds[0];
  if (stage === 1) journal(w, `${name} : des tags « ${f.symbol} » apparaissent dans les escaliers.`, 'attention', where);
  if (stage === 2) {
    journal(w, `${name} s’organise : absentéisme et ralentissements chez les ${SECTOR_NAMES[f.sector].toLowerCase()}.`, 'important', where);
    schedule(ctx, 'faction_demands', { floor: where });
  }
  if (stage === 3) {
    journal(w, `${name} prépare une action d’ampleur. Des sabotages sont à craindre.`, 'critical', where);
    schedule(ctx, 'faction_demands', { floor: where });
  }
  if (stage === 4) {
    journal(w, `${name} passe à l’insurrection !`, 'critical', where);
    for (const id of f.floorIds) {
      const fl = floorById(w, id);
      if (!fl) continue;
      for (const c of w.citizens) if (c.lifeState === 'alive' && c.homeFloor === id) c.anger = clamp(c.anger + 35);
      openIncident(w, 'unrest', `Insurrection : ${fl.label} ${fl.name}`, 'critical', [`Faction : ${f.name}`, ...f.demands.map((d) => `Revendication ignorée : ${DEMAND_LABELS[d]}`)], id);
    }
    schedule(ctx, 'riot', { floor: where });
  }
  w.memories.push({ tick: w.tick, type: 'faction_stage', text: `${f.name} : ${STAGE_LABELS[stage]}`, severity: stage / 5, perceivedLegitimacy: 50 });
}

// Effet de la faction sur l'efficacité de son secteur (ralentissements à partir du stade 2).
export function factionSlowdown(ctx: Ctx, sector: SectorId) {
  const f = ctx.w.factions.find((x) => x.status === 'active' && x.sector === sector);
  if (!f || f.stage < 2) return 1;
  return f.stage === 2 ? 0.9 : f.stage === 3 ? 0.78 : 0.5;
}

// Pression d'agitation ajoutée aux étages où vivent les membres.
export function factionPressure(ctx: Ctx, floorId: string) {
  let p = 0;
  for (const f of ctx.w.factions) if (f.status === 'active' && f.floorIds.includes(floorId)) p += f.stage * 3.5;
  return p;
}

function concede(ctx: Ctx, f: Faction, d: DemandKind) {
  const { w } = ctx;
  switch (d) {
    case 'lower_quota':
      w.policies.mineQuota = Math.min(w.policies.mineQuota, 0.85);
      break;
    case 'more_rations':
      w.policies.rations = 'generous';
      w.delayed.push({ dueTick: w.tick + TICKS_PER_DAY * 4, note: 'Fin des rations accordées', effects: [{ type: 'policy', key: 'rations', value: 'normal' }] });
      break;
    case 'release_member': {
      const ids = [f.leaderId, ...f.members].filter((id) => w.citizens[id].lifeState === 'imprisoned');
      for (const id of ids.slice(0, 3)) if (caseOf(ctx, id)) applyVerdict(ctx, id, 'pardon');
      break;
    }
    case 'replace_chief': {
      const office = w.sectors[f.sector]?.officeId;
      if (office) {
        w.delayed.push({ dueTick: w.tick + 1, effects: [{ type: 'dismiss', officeId: office }] });
      }
      break;
    }
    case 'end_lockdown':
      for (const id of f.floorIds) {
        const fl = floorById(w, id);
        if (fl) fl.lockdown = 'open';
      }
      break;
    case 'inquiry':
      schedule(ctx, 'mine_inquiry_result', { floor: 'mines' });
      break;
    case 'more_staff':
      if (w.sectors[f.sector]) w.sectors[f.sector].staffingTarget += 10;
      break;
  }
}

export function factionAction(ctx: Ctx, factionId: number, action: 'negotiate' | 'coopt' | 'infiltrate' | 'arrest_leader' | 'dissolve', demand?: DemandKind) {
  const { w, rng } = ctx;
  const f = w.factions.find((x) => x.id === factionId);
  if (!f || f.status !== 'active') return;
  const members = f.members.map((id) => w.citizens[id]).filter((c) => c.lifeState === 'alive');
  const leader = w.citizens[f.leaderId];
  switch (action) {
    case 'negotiate': {
      const d = demand ?? f.demands[0];
      if (!d) return;
      concede(ctx, f, d);
      for (const c of members) {
        c.grievance = clamp(c.grievance - 15);
        c.anger = clamp(c.anger - 10);
        c.trust = clamp(c.trust + 5);
      }
      f.influence = clamp(f.influence + 6); // reconnue comme interlocutrice
      if (f.stage > 0) setStage(ctx, f, (f.stage - 1) as Faction['stage']);
      w.psychology.authority = clamp(w.psychology.authority - 2);
      journal(w, `Négociation avec « ${f.name} » : ${DEMAND_LABELS[d].toLowerCase()}.`, 'info');
      break;
    }
    case 'coopt': {
      const fl = floorById(w, leader.homeFloor);
      if (fl) {
        const prev = fl.managerId !== undefined ? w.citizens[fl.managerId] : undefined;
        if (prev) prev.flags = prev.flags.filter((x) => x !== 'floor_manager');
        fl.managerId = leader.id;
      }
      leader.flags = leader.flags.filter((x) => x !== 'faction_leader' && x !== 'agitator');
      leader.flags.push('floor_manager');
      leader.trust = clamp(leader.trust + 30);
      leader.grievance = clamp(leader.grievance - 30);
      f.members = f.members.filter((id) => id !== leader.id);
      // Une partie y voit une trahison
      for (const c of members) if (rng.chance(0.4)) c.grievance = clamp(c.grievance + 8);
      if (f.stage > 0) setStage(ctx, f, (f.stage - 1) as Faction['stage']);
      f.leaderId = leaderOf(ctx, members.filter((c) => c.id !== leader.id))?.id ?? leader.id;
      journal(w, `${fullName(leader)} quitte « ${f.name} » pour devenir responsable d’étage.`, 'attention');
      break;
    }
    case 'infiltrate': {
      if (!holder(w, 'sheriff')) return;
      f.infiltrated = true;
      f.detected = true;
      for (const c of members) if (!c.flags.includes('infiltrated_evidence')) c.flags.push('infiltrated_evidence');
      if (rng.chance(0.25)) {
        for (const c of members) c.grievance = clamp(c.grievance + 10);
        setStage(ctx, f, Math.min(4, f.stage + 1) as Faction['stage']);
        journal(w, `L’infiltration de « ${f.name} » a été découverte. La colère monte.`, 'important');
      } else journal(w, `Un adjoint infiltre « ${f.name} » : membres et projets connus.`, 'info');
      break;
    }
    case 'arrest_leader': {
      if (leader.lifeState !== 'alive') return;
      arrestCitizen(ctx, leader.id, 'Meneur d’un groupe séditieux', f.infiltrated ? 70 : 40);
      const martyr = leader.popularity > 55;
      for (const c of members) {
        c.fear = clamp(c.fear + 8);
        if (martyr) c.grievance = clamp(c.grievance + 12);
      }
      if (f.stage > 0) setStage(ctx, f, (f.stage - 1) as Faction['stage']);
      if (martyr) addTag(w, `martyr_${f.id}`, 20);
      break;
    }
    case 'dissolve': {
      if (!w.policies.emergencyPowers) return;
      const targets = [leader, ...members.filter((c) => c.id !== leader.id).sort((a, b) => b.influence - a.influence).slice(0, 3)];
      for (const c of targets) if (c.lifeState === 'alive') arrestCitizen(ctx, c.id, 'Appartenance à un groupe dissous', 45);
      for (const c of members) {
        c.fear = clamp(c.fear + 15);
        c.grievance = clamp(c.grievance + 15);
      }
      f.status = 'dissolved';
      w.psychology.legitimacy = clamp(w.psychology.legitimacy - 8);
      w.memories.push({ tick: w.tick, type: 'faction_dissolved', text: `Dissolution forcée de « ${f.name} »`, severity: 0.7, perceivedLegitimacy: 30 });
      addTag(w, `underground_${f.sector}`, 12);
      journal(w, `« ${f.name} » est dissous par décret. Plusieurs arrestations.`, 'important');
      break;
    }
  }
}
