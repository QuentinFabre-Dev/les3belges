import { FLOORS, TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { InfrastructureAsset, Rates, ResourceStock, SectorId, WorldState } from '../types';
import { floorById, hasTag, holder, hourOf, isWorker } from '../util';
import { factionSlowdown } from './factions';

const GENERATOR_CAPACITY = 560;
const BATTERY_POWER = 120;

export function assetFactor(a: InfrastructureAsset | undefined): number {
  if (!a) return 1;
  switch (a.state) {
    case 'running':
      return 0.7 + 0.3 * a.condition;
    case 'degraded':
      return 0.4 + 0.4 * a.condition;
    default:
      return 0;
  }
}

export function countStaff(ctx: Ctx) {
  const { w } = ctx;
  const staff = {} as Record<SectorId, number>;
  for (const s of Object.keys(w.sectors) as SectorId[]) staff[s] = 0;
  let children = 0;
  let adults = 0;
  let sick = 0;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    if (c.age < 16) children++;
    else adults++;
    if (c.health < 50) sick++;
    if (isWorker(c) && c.health > 20) staff[c.sector]++;
  }
  ctx.staff = staff;
  ctx.children = children;
  ctx.adults = adults;
  ctx.population = children + adults;
  ctx.sick = sick;
}

// Efficacité réelle d'un secteur : effectifs × moral × fatigue × responsable × énergie × ordre public.
export function updateEfficiency(ctx: Ctx) {
  const { w } = ctx;
  for (const s of Object.values(w.sectors)) {
    if (s.id === 'residential') continue;
    const target = Math.max(1, s.staffingTarget);
    const staffing = Math.min(1.15, ctx.staff[s.id] / target);
    let eff = Math.pow(staffing, 0.85);
    eff *= 0.75 + (0.3 * s.morale) / 100;
    const floor = floorById(w, workFloorOf(s.id));
    // Sans responsable sectoriel, c'est le responsable d'étage qui encadre (moins efficacement).
    const officeLead = s.officeId ? holder(w, s.officeId) : undefined;
    const floorLead = floor?.managerId !== undefined ? w.citizens[floor.managerId] : undefined;
    if (officeLead) eff *= 0.86 + officeLead.skill * 0.0022 + officeLead.leadership * 0.0008;
    else if (floorLead && floorLead.lifeState === 'alive') eff *= 0.88 + floorLead.leadership * 0.0012 + floorLead.skill * 0.0006;
    else eff *= 0.82;
    if (floor) {
      eff *= 0.3 + 0.7 * floor.power;
      if (floor.lockdown === 'controlled') eff *= 0.88;
      if (floor.lockdown === 'full') eff *= 0.55;
      if (floor.unrest >= 3) eff *= [1, 1, 1, 0.8, 0.45, 0.15][floor.unrest];
    }
    if (w.policies.extendedHours) eff *= 1.15;
    if (hasTag(w, `strike:${s.id}`)) eff *= 0.25;
    eff *= factionSlowdown(ctx, s.id);
    s.efficiency = clamp(eff, 0, 1.5);
  }
}

function workFloorOf(s: SectorId) {
  return FLOORS.find((f) => f.sector === s)?.id ?? 'res_mid';
}

function move(stock: ResourceStock, delta: number) {
  const before = stock.real;
  stock.real = clamp(stock.real + delta, 0, stock.capacity);
  const applied = stock.real - before;
  stock.declared = clamp(stock.declared + applied, 0, stock.capacity);
  return applied;
}

const rationFactor = (w: WorldState) => (w.policies.rations === 'reduced' ? 0.8 : w.policies.rations === 'generous' ? 1.15 : 1);

export function energyStep(ctx: Ctx) {
  const { w } = ctx;
  const night = hourOf(w) >= 22 || hourOf(w) < 6;
  const gen = w.assets.generator;
  let genFactor = 0;
  if (gen.state === 'running') genFactor = 0.55 + 0.45 * gen.condition;
  else if (gen.state === 'degraded') genFactor = 0.35 + 0.4 * gen.condition;
  const energyEff = Math.min(1.05, 0.55 + 0.45 * w.sectors.energy.efficiency);
  const production = GENERATOR_CAPACITY * genFactor * energyEff;

  const demands = w.floors.map((f) => {
    const def = FLOORS[f.index];
    let d = def.basePower * (night && f.sector !== 'water' && f.sector !== 'medical' ? 0.72 : 1);
    if (f.lockdown === 'full') d *= 0.7;
    if (f.id === 'agriculture' && hasTag(w, 'agri_boost')) d += 45;
    if (f.id === 'mines') d *= w.policies.mineQuota;
    return d;
  });
  const demand = demands.reduce((a, b) => a + b, 0);
  let available = production;
  if (production < demand && w.resources.battery > 0) {
    const cover = Math.min(demand - production, BATTERY_POWER);
    available += cover;
    w.resources.battery = clamp(w.resources.battery - (cover / BATTERY_POWER) * (100 / 36));
  } else if (production > demand) {
    w.resources.battery = clamp(w.resources.battery + (Math.min(production - demand, 80) / 80) * (100 / 72));
  }
  // Délestage selon les priorités du joueur.
  const prio = w.policies.powerPriority;
  const order = w.floors.map((_, i) => i).sort((a, b) => {
    const pa = prio.indexOf(w.floors[a].sector);
    const pb = prio.indexOf(w.floors[b].sector);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });
  let remaining = available;
  for (const i of order) {
    const f = w.floors[i];
    const share = demands[i] > 0 ? Math.min(1, remaining / demands[i]) : 1;
    f.power = clamp(share, 0, 1);
    remaining = Math.max(0, remaining - demands[i]);
  }
  w.resources.energyProduction = production;
  w.resources.energyDemand = demand;
}

export function resourceStep(ctx: Ctx) {
  const { w } = ctx;
  const r = w.resources;
  const day = TICKS_PER_DAY;
  const f = (id: string) => floorById(w, id)!;
  const deltas: Rates = { food: 0, water: 0, parts: 0, materials: 0, medicine: 0 };

  // Eau
  const restrict = hasTag(w, 'water_restrictions') ? 0.78 : 1;
  const pump = w.assets.pump_main;
  const pumpFactor = pump.state === 'failed' ? 0.22 : assetFactor(pump);
  const waterProd = 2250 * Math.min(1.1, w.sectors.water.efficiency) * pumpFactor * (0.6 + 0.4 * assetFactor(w.assets.water_filters)) * (0.25 + 0.75 * f('water').power);
  const agriWater = hasTag(w, 'irrigation_cut') ? 120 : 360;
  const waterUse = ctx.population * 1.0 * restrict + agriWater + 110;
  deltas.water = move(r.water, (waterProd - waterUse) / day);
  const waterOk = r.water.real > 50 ? 1 : clamp(waterProd / waterUse, 0, 1);
  ctx.waterSupplyRatio = clamp(waterProd / waterUse, 0, 1);
  for (const fl of w.floors) fl.water = fl.id === 'agriculture' && hasTag(w, 'irrigation_cut') ? 0.5 * waterOk : waterOk;

  // Nourriture
  const boost = hasTag(w, 'agri_boost') ? 1.2 : 1;
  const foodProd = 1560 * w.sectors.agriculture.efficiency * assetFactor(w.assets.hydro_array) * (0.2 + 0.8 * f('agriculture').water) * (0.25 + 0.75 * f('agriculture').power) * boost;
  const foodUse = (ctx.adults + ctx.children * 0.7) * rationFactor(w);
  deltas.food = move(r.food, (foodProd - foodUse) / day);

  // Mines -> fer
  const minesEff = w.sectors.mines.efficiency * w.policies.mineQuota * assetFactor(w.assets.mine_drill);
  const ore = 2.8 * (w.sectors.mines.staffingTarget || 1) * minesEff * (0.3 + 0.7 * f('mines').power);
  // Ateliers -> pièces
  const partsWanted = 15 * w.sectors.mechanical.efficiency * assetFactor(w.assets.forge) * (0.3 + 0.7 * f('mechanical').power);
  const partsMade = r.materials.real > 30 ? partsWanted : partsWanted * 0.15;
  deltas.materials = move(r.materials, (ore - partsMade * 3 - 190) / day);
  deltas.parts = move(r.parts, partsMade / day);

  // Médical
  const medProd = 0.45 * ctx.staff.medical * w.sectors.medical.efficiency;
  const medUse = 6 + ctx.sick * 0.12;
  deltas.medicine = move(r.medicine, (medProd - medUse) / day);

  // Taux nets lissés (unités / jour)
  for (const k of Object.keys(deltas) as (keyof Rates)[]) {
    w.rates[k] = w.rates[k] * 0.97 + deltas[k] * day * 0.03;
  }
}

// Jours d'autonomie estimés à partir des stocks déclarés (ce que voit l'administration), si la production s'arrêtait.
export function autonomyDays(w: WorldState, ctx: Ctx) {
  return {
    food: w.resources.food.declared / Math.max(1, (ctx.adults + ctx.children * 0.7) * rationFactor(w)),
    water: w.resources.water.declared / Math.max(1, ctx.population + 470),
  };
}
