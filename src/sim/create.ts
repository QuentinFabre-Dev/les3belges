import { Rng, clamp } from './rng';
import {
  COHESION,
  FIRST_F,
  FIRST_M,
  FLOORS,
  LAST,
  OFFICES,
  OFFICE_HOLDERS,
  POPULATION_START,
  SCALE,
  SECTOR_FLOOR,
  SECTOR_FLOORS,
  SECTOR_NAMES,
  STAFFING,
  TRAITS,
} from './data/world';
import type {
  Citizen,
  FloorState,
  InfrastructureAsset,
  Office,
  OfficeId,
  RelationType,
  RelationshipEdge,
  SectorId,
  SectorState,
  Trait,
  WorldState,
  Difficulty,
} from './types';
import { journal, message } from './util';

export const WORLD_VERSION = 1;

const ASSETS: Omit<InfrastructureAsset, 'specialistIds' | 'state' | 'failureRisk' | 'repairProgress' | 'ignoredWarnings'>[] = [
  { id: 'generator', name: 'Génératrice principale', floor: 'energy', sector: 'energy', condition: 0.78, wearPerDay: 0.012, partsPerRepair: 30, critical: true },
  { id: 'pump_main', name: 'Pompe principale', floor: 'water', sector: 'water', condition: 0.66, wearPerDay: 0.011, partsPerRepair: 18, critical: true },
  { id: 'water_filters', name: 'Filtres à eau', floor: 'water', sector: 'water', condition: 0.8, wearPerDay: 0.013, partsPerRepair: 10, critical: false },
  { id: 'hydro_array', name: 'Rampes hydroponiques', floor: 'agriculture', sector: 'agriculture', condition: 0.74, wearPerDay: 0.009, partsPerRepair: 12, critical: false },
  { id: 'ventilation', name: 'Ventilation centrale', floor: 'mechanical', sector: 'mechanical', condition: 0.82, wearPerDay: 0.008, partsPerRepair: 16, critical: true },
  { id: 'elevator', name: 'Ascenseur central', floor: 'res_mid', sector: 'mechanical', condition: 0.7, wearPerDay: 0.01, partsPerRepair: 10, critical: false },
  { id: 'servers', name: 'Serveurs DSI', floor: 'admin', sector: 'admin', condition: 0.85, wearPerDay: 0.006, partsPerRepair: 8, critical: false },
  { id: 'forge', name: 'Forge & ateliers', floor: 'mechanical', sector: 'mechanical', condition: 0.76, wearPerDay: 0.009, partsPerRepair: 12, critical: false },
  { id: 'mine_drill', name: 'Foreuses minières', floor: 'mines', sector: 'mines', condition: 0.69, wearPerDay: 0.016, partsPerRepair: 14, critical: false },
  { id: 'mine_supports', name: 'Étais & galeries', floor: 'mines', sector: 'mines', condition: 0.72, wearPerDay: 0.006, partsPerRepair: 10, critical: false },
];

function makeName(rng: Rng, sex: 'f' | 'm') {
  return rng.pick(sex === 'f' ? FIRST_F : FIRST_M);
}

function pickTraits(rng: Rng): Trait[] {
  const n = rng.chance(0.35) ? 2 : 1;
  const out: Trait[] = [];
  while (out.length < n) {
    const t = rng.pick(TRAITS);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function baseCitizen(id: number, rng: Rng, first: string, last: string, sex: 'f' | 'm', age: number, householdId: number, homeFloor: string): Citizen {
  return {
    id,
    first,
    last,
    age,
    sex,
    lifeState: 'alive',
    householdId,
    homeFloor,
    workFloor: homeFloor,
    sector: 'residential',
    skill: clamp(Math.round(rng.normal(52, 16)), 5, 98),
    leadership: clamp(Math.round(rng.normal(45, 18)), 2, 98),
    integrity: clamp(Math.round(rng.normal(62, 18)), 5, 99),
    traits: pickTraits(rng),
    health: clamp(Math.round(rng.normal(age > 65 ? 64 : 84, 8)), 25, 100),
    fatigue: clamp(Math.round(rng.normal(30, 10))),
    morale: clamp(Math.round(rng.normal(62, 10))),
    fear: clamp(Math.round(rng.normal(14, 6))),
    anger: clamp(Math.round(rng.normal(12, 6))),
    grievance: clamp(Math.round(rng.normal(14, 8))),
    trust: clamp(Math.round(rng.normal(60, 12))),
    trustSecurity: clamp(Math.round(rng.normal(58, 14))),
    popularity: clamp(Math.round(rng.normal(30, 14))),
    influence: clamp(Math.round(rng.normal(20, 12))),
    key: false,
    look: Math.floor(rng.next() * 1000),
    memories: [],
    flags: [],
  };
}

function link(rel: RelationshipEdge[][], a: number, b: number, type: RelationType, back: RelationType, strength: number, affinity: number) {
  if (a === b) return;
  if (rel[a].some((e) => e.to === b)) return;
  rel[a].push({ to: b, type, strength, affinity });
  rel[b].push({ to: a, type: back, strength, affinity });
}

// Stocks initiaux mis à l'échelle de la population (pièces : moins, le parc de machines ne grandit pas autant).
function stock(real: number, capacity: number, exponent = 1) {
  const k = Math.pow(SCALE, exponent);
  return { real: Math.round(real * k), declared: Math.round(real * k), capacity: Math.round(capacity * k) };
}

export function createWorld(seed = Date.now() % 2147483647, difficulty: Difficulty = 'standard'): WorldState {
  const rng = new Rng(seed);
  const citizens: Citizen[] = [];
  const relations: RelationshipEdge[][] = [];

  // Places résidentielles pondérées par la capacité de chaque étage.
  const homeSlots: string[] = [];
  for (const f of FLOORS) for (let i = 0; i < f.capacity; i++) homeSlots.push(f.id);

  const add = (c: Citizen) => {
    citizens.push(c);
    relations.push([]);
    return c;
  };

  // Titulaires des fonctions institutionnelles, chacun dans son propre foyer.
  let householdId = 0;
  const officeHolderIds: Partial<Record<OfficeId, number>> = {};
  for (const def of OFFICES) {
    const h = OFFICE_HOLDERS[def.id];
    const home = def.sector ? SECTOR_FLOOR[def.sector] : 'res_mid';
    const hid = householdId++;
    const c = add(baseCitizen(citizens.length, rng, h.first, h.last, h.sex, h.age, hid, home === 'mines' ? 'res_low' : home));
    Object.assign(c, { skill: h.skill, leadership: h.leadership, integrity: h.integrity, popularity: h.popularity, traits: h.traits, key: true, officeId: def.id, portrait: def.portrait, sector: def.sector ?? 'admin', influence: 55 + Math.round(h.popularity / 3) });
    officeHolderIds[def.id] = c.id;
    // Conjoint·e et enfant(s) pour que leur sort compte socialement.
    const partnerSex = h.sex === 'f' ? 'm' : 'f';
    if (rng.chance(0.8)) {
      const p = add(baseCitizen(citizens.length, rng, makeName(rng, partnerSex), h.last, partnerSex, clamp(h.age + rng.int(-6, 6), 25, 85), hid, c.homeFloor));
      link(relations, c.id, p.id, 'partner', 'partner', 1, 80);
      if (h.age < 60) {
        const k = add(baseCitizen(citizens.length, rng, makeName(rng, rng.chance(0.5) ? 'f' : 'm'), h.last, rng.chance(0.5) ? 'f' : 'm', rng.int(4, 19), hid, c.homeFloor));
        link(relations, c.id, k.id, 'parent', 'child', 0.95, 85);
        link(relations, p.id, k.id, 'parent', 'child', 0.95, 85);
      }
    }
  }

  // Population générale par foyers.
  while (citizens.length < POPULATION_START) {
    const hid = householdId++;
    const last = rng.pick(LAST);
    const home = homeSlots[Math.floor(rng.next() * homeSlots.length)];
    const size = rng.pick([1, 1, 2, 2, 2, 3, 3, 4, 4, 5]);
    const members: Citizen[] = [];
    const adultAge = rng.int(20, 68);
    const sexA = rng.chance(0.5) ? 'f' : 'm';
    members.push(add(baseCitizen(citizens.length, rng, makeName(rng, sexA), last, sexA, adultAge, hid, home)));
    if (size >= 2) {
      const sexB = sexA === 'f' ? 'm' : 'f';
      const b = add(baseCitizen(citizens.length, rng, makeName(rng, sexB), last, sexB, clamp(adultAge + rng.int(-5, 5), 18, 80), hid, home));
      link(relations, members[0].id, b.id, 'partner', 'partner', rng.range(0.7, 1), rng.int(40, 90));
      members.push(b);
    }
    for (let k = 2; k < size && citizens.length < POPULATION_START; k++) {
      const sex = rng.chance(0.5) ? 'f' : 'm';
      const childAge = clamp(adultAge - rng.int(20, 34), 0, 40);
      const ch = add(baseCitizen(citizens.length, rng, makeName(rng, sex), last, sex, childAge, hid, home));
      for (const parent of members.slice(0, 2)) link(relations, parent.id, ch.id, 'parent', 'child', rng.range(0.75, 1), rng.int(50, 95));
      for (const sib of members.slice(2)) link(relations, sib.id, ch.id, 'sibling', 'sibling', rng.range(0.5, 0.9), rng.int(20, 80));
      members.push(ch);
    }
  }

  // Affectation au travail : on remplit les effectifs cibles avec les adultes disponibles.
  const adults = citizens.filter((c) => c.age >= 18 && c.age <= 64 && !c.officeId);
  adults.sort(() => rng.next() - 0.5);
  const sectorIds = Object.keys(STAFFING) as SectorId[];
  let cursor = 0;
  for (const s of sectorIds) {
    const officeCount = citizens.filter((c) => c.officeId && c.sector === s).length;
    for (let i = officeCount; i < STAFFING[s] && cursor < adults.length; i++) {
      const c = adults[cursor++];
      c.sector = s;
      const options = SECTOR_FLOORS[s].length ? SECTOR_FLOORS[s] : [SECTOR_FLOOR[s]];
      c.workFloor = options[c.id % options.length];
    }
  }
  for (const c of citizens) if (c.officeId) c.workFloor = SECTOR_FLOOR[c.sector];

  // Collègues et amis : graphe social léger (3 à 8 liens significatifs).
  const bySector = new Map<SectorId, Citizen[]>();
  for (const c of citizens) {
    if (c.sector === 'residential') continue;
    if (!bySector.has(c.sector)) bySector.set(c.sector, []);
    bySector.get(c.sector)!.push(c);
  }
  for (const [s, list] of bySector) {
    for (const c of list) {
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const o = rng.pick(list);
        link(relations, c.id, o.id, 'coworker', 'coworker', rng.range(0.3, 0.75) * (0.6 + COHESION[s] * 0.5), rng.int(10, 70));
      }
    }
  }
  const byHome = new Map<string, Citizen[]>();
  for (const c of citizens) {
    if (!byHome.has(c.homeFloor)) byHome.set(c.homeFloor, []);
    byHome.get(c.homeFloor)!.push(c);
  }
  for (const c of citizens) {
    if (c.age < 8) continue;
    const pool = byHome.get(c.homeFloor)!;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const o = rng.pick(pool);
      if (Math.abs(o.age - c.age) < 20) link(relations, c.id, o.id, 'friend', 'friend', rng.range(0.35, 0.8), rng.int(20, 90));
    }
    if (rng.chance(0.06)) link(relations, c.id, rng.pick(pool).id, 'rival', 'rival', rng.range(0.3, 0.6), rng.int(-80, -20));
  }

  // Leaders informels dans les secteurs soudés.
  for (const s of ['mines', 'mechanical', 'agriculture', 'sanitation'] as SectorId[]) {
    const list = (bySector.get(s) ?? []).filter((c) => !c.officeId);
    list.sort((a, b) => b.leadership + b.skill - (a.leadership + a.skill));
    const lead = list[0];
    if (lead) {
      lead.key = true;
      lead.popularity = clamp(lead.popularity + 45);
      lead.influence = clamp(lead.influence + 55);
      lead.flags.push('informal_leader');
      lead.traits = Array.from(new Set([...lead.traits, 'charismatic' as Trait]));
      for (const o of list.slice(1, 14)) link(relations, lead.id, o.id, 'coworker', 'coworker', 0.7, 60);
    }
  }

  // Floors + responsables d'étage.
  const floors: FloorState[] = FLOORS.map((def, index) => {
    const pool = citizens.filter((c) => (def.sector === 'residential' ? c.homeFloor === def.id : c.workFloor === def.id) && c.age >= 25 && !c.officeId);
    pool.sort((a, b) => b.leadership - a.leadership);
    const mgr = pool[0];
    if (mgr) {
      mgr.key = true;
      mgr.flags.push('floor_manager');
      mgr.influence = clamp(mgr.influence + 25);
    }
    return {
      id: def.id,
      index,
      label: def.label,
      name: def.name,
      sector: def.sector,
      left: def.left,
      right: def.right,
      cafeteria: def.cafeteria,
      capacity: def.capacity,
      condition: rng.range(0.72, 0.92),
      power: 1,
      water: 1,
      cleanliness: rng.range(62, 85),
      waste: rng.range(15, 35),
      managerId: mgr?.id,
      reportingAccuracy: mgr ? clamp(0.5 + mgr.integrity / 220 + mgr.skill / 600, 0, 1) : 0.6,
      lockdown: 'open',
      unrest: 0,
      unrestPressure: 0,
      morale: 60,
      fear: 15,
      anger: 12,
      grievance: 14,
      trust: 60,
      residents: 0,
      workers: 0,
    };
  });

  const sectors = {} as Record<SectorId, SectorState>;
  for (const s of sectorIds) {
    const office = OFFICES.find((o) => o.sector === s && o.id !== 'mayor' && o.id !== 'judge' && o.id !== 'it_director');
    sectors[s] = {
      id: s,
      name: SECTOR_NAMES[s],
      officeId: s === 'admin' ? 'it_director' : office?.id,
      staffingTarget: STAFFING[s],
      cohesion: COHESION[s],
      morale: 60,
      efficiency: 1,
      grievance: 14,
      strikeRisk: 0,
    };
  }

  const offices = {} as Record<OfficeId, Office>;
  for (const def of OFFICES) {
    offices[def.id] = {
      id: def.id,
      title: def.title,
      sector: def.sector,
      holderId: officeHolderIds[def.id],
      succession: def.succession,
      legitimacy: def.id === 'mayor' ? 68 : 62,
      portrait: def.portrait,
      termEndsDay: def.id === 'mayor' ? 45 : undefined,
    };
  }

  const assets: Record<string, InfrastructureAsset> = {};
  for (const a of ASSETS) {
    const specialists = citizens
      .filter((c) => c.sector === a.sector || (c.sector === 'mechanical' && a.critical))
      .sort((x, y) => y.skill - x.skill)
      .slice(0, 3);
    for (const s of specialists) {
      if (!s.flags.includes('specialist')) s.flags.push('specialist');
      s.key = true;
      s.skill = Math.max(s.skill, 82);
    }
    assets[a.id] = { ...a, state: 'running', failureRisk: 0, repairProgress: 0, ignoredWarnings: 0, specialistIds: specialists.map((s) => s.id) };
  }

  const w: WorldState = {
    version: WORLD_VERSION,
    seed,
    rng: rng.state,
    tick: 0,
    citizens,
    relations,
    floors,
    sectors,
    offices,
    assets,
    resources: {
      food: stock(18000, 25000),
      water: stock(5440, 8000),
      parts: stock(210, 500, 0.6),
      materials: stock(1080, 2000),
      medicine: stock(380, 600),
      battery: 100,
      energyProduction: 0,
      energyDemand: 0,
    },
    rates: { food: 0, water: 0, parts: 0, materials: 0, medicine: 0 },
    policies: {
      rations: 'normal',
      extendedHours: false,
      mineQuota: 1,
      cleaning: 'normal',
      transparency: 'normal',
      powerPriority: ['medical', 'water', 'mechanical', 'admin', 'agriculture', 'security', 'energy', 'supplies', 'mines', 'residential'],
      maintenanceFocus: 'auto',
      emergencyPowers: false,
      births: 'normal',
    },
    incidents: [],
    pending: [],
    delayed: [],
    journal: [],
    messages: [],
    promises: [],
    memories: [],
    tags: {},
    cooldowns: {},
    psychology: { fear: 15, morale: 62, trust: 60, legitimacy: 68, authority: 70 },
    stability: 72,
    cases: [],
    rumors: [],
    factions: [],
    officeAffinity: {},
    lens: 0.78,
    history: [],
    nextUid: 1,
    stats: { deaths: 0, births: 0, arrests: 0 },
    difficulty,
    chronicle: [],
    yearReports: [],
    yearReportSeen: 0,
    yearStart: { population: citizens.length, deaths: 0, births: 0, arrests: 0, tick: 0 },
  };

  journal(w, 'Prise de fonction de l’administration externe du Silo-01.', 'info');
  message(
    w,
    'Maire — Ruth Jahns',
    'Bienvenue',
    'Le silo compte ' + citizens.length + ' habitants. La pompe principale montre des signes d’usure et les mines réclament plus de moyens. Les responsables vous feront remonter leurs problèmes. Gardez à l’esprit que leurs rapports ne sont pas toujours exacts.',
    officeHolderIds.mayor,
  );
  return w;
}
