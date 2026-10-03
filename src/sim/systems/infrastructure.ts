import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { InfrastructureAsset } from '../types';
import { remember } from './years';
import { shakeTrust } from './institutions';
import { floorById, hasTag, holder, hourOf, journal, message, openIncident, resolveIncidents } from '../util';

export function schedule(ctx: Ctx, eventId: string, data: { floor?: string; assetId?: string; subjectId?: number } = {}) {
  ctx.scheduled.push({ id: eventId, data });
}

export function riskPerDay(a: InfrastructureAsset) {
  return 0.003 + Math.pow(Math.max(0, 0.62 - a.condition), 2) * 3;
}

export function riskLabel(a: { condition: number; state: string }): 'faible' | 'moyen' | 'élevé' | 'critique' {
  if (a.state === 'failed') return 'critique';
  if (a.condition > 0.65) return 'faible';
  if (a.condition > 0.48) return 'moyen';
  if (a.condition > 0.32) return 'élevé';
  return 'critique';
}

// Chaîne causale expliquant une panne (lisible par le joueur).
export function failureCauses(ctx: Ctx, a: InfrastructureAsset): string[] {
  const { w } = ctx;
  const causes: string[] = [];
  causes.push(`Usure : état ${Math.round(a.condition * 100)} %`);
  if (hasTag(w, `ignored_${a.id}`)) causes.push('Maintenance reportée par l’administration');
  if (a.ignoredWarnings > 0) causes.push(`${a.ignoredWarnings} alerte(s) de maintenance restée(s) sans suite`);
  if (w.resources.parts.real < 40) causes.push('Stock de pièces insuffisant');
  if (w.resources.parts.declared - w.resources.parts.real > 15) causes.push('Écart entre stock déclaré et stock réel de pièces');
  const mech = w.sectors.mechanical;
  if (ctx.staff.mechanical < mech.staffingTarget * 0.85) causes.push('Mécanique en sous-effectif');
  const lost = a.specialistIds.filter((id) => w.citizens[id].lifeState !== 'alive').length;
  if (lost > 0) causes.push(`${lost} spécialiste(s) de l’équipement perdu(s)`);
  const chief = holder(w, 'mechanic_chief');
  if (!chief) causes.push('Poste de chef mécanique vacant');
  if (a.id.startsWith('mine') && w.policies.mineQuota > 1.05) causes.push(`Quota minier élevé (×${w.policies.mineQuota.toFixed(2)})`);
  if (w.policies.extendedHours) causes.push('Heures prolongées : usure accélérée');
  return causes;
}

export function infrastructureHour(ctx: Ctx) {
  const { w, rng } = ctx;
  const assets = Object.values(w.assets);
  const mechEff = w.sectors.mechanical.efficiency;
  const repairing = assets.filter((a) => a.state === 'failed' || a.state === 'maintenance');

  // Usure
  for (const a of assets) {
    if (a.state === 'failed' || a.state === 'offline') continue;
    let usage = 1;
    if (a.sector === 'mines') usage *= Math.pow(w.policies.mineQuota, 1.6);
    if (w.policies.extendedHours) usage *= 1.15;
    const fl = floorById(w, a.floor);
    if (fl && fl.cleanliness < 35) usage *= 1.2;
    if (fl && fl.lockdown === 'full') usage *= 0.7;
    if (hasTag(w, `wear_${a.id}`)) usage *= 2;
    if (a.state === 'maintenance') usage = 0;
    a.condition = clamp(a.condition - (a.wearPerDay / 24) * usage, 0, 1);
  }

  // Chocs : une pièce casse, un joint lâche. L'usure n'est jamais parfaitement linéaire.
  if (rng.chance(0.55 / 24)) {
    const pool = assets.filter((a) => a.state === 'running' || a.state === 'degraded');
    const weights = pool.map((a) => a.wearPerDay * (a.sector === 'mines' ? w.policies.mineQuota : 1));
    let roll = rng.next() * weights.reduce((x, y) => x + y, 0);
    const hit = pool.find((_, i) => (roll -= weights[i]) <= 0) ?? pool[0];
    if (hit) {
      const dmg = rng.range(0.07, 0.2);
      hit.condition = clamp(hit.condition - dmg, 0, 1);
      if (ctx.infoAccuracy > 0.6 || dmg > 0.15) journal(w, `${hit.name} : usure anormale détectée (−${Math.round(dmg * 100)} %)`, 'attention', hit.floor);
    }
  }

  // Maintenance préventive : capacité des mécaniciens, coûte des pièces.
  let capacity = (0.075 * mechEff) / 24;
  if (repairing.length) capacity *= 0.5;
  const parts = w.resources.parts;
  const candidates = assets.filter((a) => (a.state === 'running' || a.state === 'degraded') && a.condition < 0.95).sort((x, y) => x.condition - y.condition);
  const focus = w.policies.maintenanceFocus !== 'auto' ? w.assets[w.policies.maintenanceFocus] : undefined;
  const plan: [InfrastructureAsset, number][] = [];
  if (focus && focus.condition < 0.98 && (focus.state === 'running' || focus.state === 'degraded')) plan.push([focus, 0.6]);
  const rest = candidates.filter((a) => a !== focus).slice(0, 3);
  const share = (1 - (plan.length ? 0.6 : 0)) / Math.max(1, rest.length);
  for (const a of rest) plan.push([a, share]);
  for (const [a, s] of plan) {
    if (hasTag(w, `ignored_${a.id}`)) continue; // l'administration a demandé de ne pas y toucher
    const gain = capacity * s;
    const cost = gain * 120;
    if (parts.real < cost) continue;
    parts.real -= cost;
    parts.declared = Math.max(0, parts.declared - cost);
    a.condition = clamp(a.condition + gain, 0, 1);
  }

  for (const a of assets) {
    // Transitions d'état et alertes
    if (a.state === 'running' && a.condition < 0.45) {
      a.state = 'degraded';
      journal(w, `${a.name} : fonctionnement dégradé`, 'important', a.floor);
    } else if (a.state === 'degraded' && a.condition >= 0.5) {
      a.state = 'running';
    }
    const warnKey = `warn_${a.id}`;
    if (a.condition < 0.58 && (a.state === 'running' || a.state === 'degraded')) {
      if (!hasTag(w, warnKey)) {
        const chief = holder(w, 'mechanic_chief');
        message(
          w,
          chief ? `Chef mécanique — ${chief.first} ${chief.last}` : 'Atelier mécanique',
          `Maintenance recommandée : ${a.name}`,
          `État estimé à ${Math.round(a.condition * 100)} %. Risque de panne ${riskLabel(a)}. Je recommande d’y concentrer la maintenance (Politiques → priorité de maintenance) ou d’envoyer une équipe.`,
          chief?.id,
        );
        w.tags[warnKey] = w.tick + 144 * 3;
        a.ignoredWarnings++;
      }
    } else if (a.condition > 0.7) {
      a.ignoredWarnings = 0;
    }

    // Pannes
    a.failureRisk = riskPerDay(a);
    if ((a.state === 'running' || a.state === 'degraded') && rng.chance(a.failureRisk / 24)) {
      fail(ctx, a);
    }

    // Réparations
    if (a.state === 'failed' || a.state === 'maintenance') {
      if (a.repairProgress === 0) {
        if (parts.real < a.partsPerRepair) {
          openIncident(w, 'failure', `Panne : ${a.name}`, a.critical ? 'critical' : 'important', ['Réparation bloquée : pièces manquantes'], a.floor, a.id);
          continue;
        }
        parts.real -= a.partsPerRepair;
        parts.declared = Math.max(0, parts.declared - a.partsPerRepair);
        a.repairProgress = 0.01;
      }
      const alive = a.specialistIds.filter((id) => w.citizens[id].lifeState === 'alive').length;
      const spec = 0.45 + 0.55 * (alive / Math.max(1, a.specialistIds.length));
      const priority = hasTag(w, `repair_${a.id}`) ? 1.8 : 1;
      // Les mécaniciens réparent à la lampe torche : la panne de courant ralentit sans bloquer.
      a.repairProgress += (a.state === 'maintenance' ? 0.09 : 0.045) * Math.max(0.5, mechEff) * spec * priority;
      if (a.repairProgress >= 1) {
        const planned = a.state === 'maintenance';
        a.state = 'running';
        a.repairProgress = 0;
        a.condition = Math.max(a.condition, planned ? 0.9 : 0.62);
        resolveIncidents(w, { assetId: a.id });
        journal(w, `${a.name} : ${planned ? 'maintenance terminée' : 'réparée et remise en service'}`, 'info', a.floor);
        if (!planned) shakeTrust(w, 'mechanics', a.critical ? 3 : 1);
        if (a.id === 'generator') {
          for (const c of w.citizens) if (c.lifeState === 'alive') c.fear = clamp(c.fear - 15);
        }
      }
    }
  }
}

export function fail(ctx: Ctx, a: InfrastructureAsset) {
  const { w } = ctx;
  const causes = failureCauses(ctx, a);
  a.state = 'failed';
  a.repairProgress = 0;
  shakeTrust(w, 'mechanics', a.critical ? -8 : -3);
  a.condition = Math.min(a.condition, 0.25);
  openIncident(w, 'failure', `Panne : ${a.name}`, a.critical ? 'critical' : 'important', causes, a.floor, a.id);
  w.memories.push({ tick: w.tick, type: `failure_${a.id}`, text: `Panne de ${a.name}`, severity: a.critical ? 0.7 : 0.4, perceivedLegitimacy: 50 });
  if (a.id === 'generator') {
    remember(ctx, 'blackout', 35);
    schedule(ctx, 'generator_failure', { assetId: a.id, floor: a.floor });
  }
  else if (a.id === 'pump_main') schedule(ctx, 'pump_failure', { assetId: a.id, floor: a.floor });
  else schedule(ctx, 'asset_failure', { assetId: a.id, floor: a.floor });
}

// Accidents miniers : produits par le quota, la fatigue, l'état des étais et la supervision.
export function minesHour(ctx: Ctx, kill: (id: number, cause: string, perceived: 'accident' | 'negligence') => void) {
  const { w, rng } = ctx;
  if (ctx.staff.mines === 0) return;
  const hour = hourOf(w);
  if (hour < 8 || hour >= 17) return; // pas de poste de nuit
  const supports = w.assets.mine_supports;
  const miners = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === 'mines' && !c.flags.includes('injured'));
  const fatigue = miners.reduce((s, c) => s + c.fatigue, 0) / Math.max(1, miners.length);
  const chief = holder(w, 'mines_chief');
  const risk =
    0.035 *
    Math.pow(w.policies.mineQuota, 2.2) *
    (1.65 - supports.condition) *
    (0.6 + fatigue / 100) *
    (w.policies.extendedHours ? 1.3 : 1) *
    (chief ? 1.15 - chief.skill / 250 : 1.25) *
    (floorById(w, 'mines')!.power < 0.6 ? 1.6 : 1);
  if (!rng.chance(risk / 9 / 6)) return; // par tick, sur 9 h de poste
  const roll = rng.next();
  const causes: string[] = [];
  if (w.policies.mineQuota > 1.05) causes.push(`Quota à ×${w.policies.mineQuota.toFixed(2)}`);
  if (supports.condition < 0.55) causes.push(`Étais usés (${Math.round(supports.condition * 100)} %)`);
  if (fatigue > 55) causes.push(`Fatigue des mineurs (${Math.round(fatigue)})`);
  if (hasTag(w, 'ignored_mine_safety')) causes.push('Alertes de sécurité ignorées');
  if (!causes.length) causes.push('Risque inhérent au travail minier');
  const negligent = causes.length >= 2 || hasTag(w, 'ignored_mine_safety');

  if (roll < 0.55) {
    const victims = [rng.pick(miners)];
    for (const v of victims) {
      v.flags.push('injured');
      v.health = clamp(v.health - 45);
    }
    openIncident(w, 'mine_accident', 'Accident minier : blessé grave', 'important', causes, 'mines');
    w.resources.medicine.real = Math.max(0, w.resources.medicine.real - 8);
    for (const c of miners) c.fear = clamp(c.fear + 6);
  } else {
    // Victime : souvent un mineur expérimenté et apprécié (les plus exposés).
    const sorted = [...miners].sort((a, b) => b.popularity + b.skill - (a.popularity + a.skill));
    const victim = rng.chance(0.5) ? sorted[rng.int(0, Math.min(8, sorted.length - 1))] : rng.pick(miners);
    const collapse = roll > 0.9;
    kill(victim.id, collapse ? 'Effondrement de galerie' : 'Accident minier', negligent ? 'negligence' : 'accident');
    if (collapse) {
      supports.condition = clamp(supports.condition - 0.2, 0, 1);
      for (let i = 0; i < 2; i++) {
        const v = rng.pick(miners);
        if (v.lifeState === 'alive' && v.id !== victim.id) kill(v.id, 'Effondrement de galerie', negligent ? 'negligence' : 'accident');
      }
    }
    openIncident(w, 'mine_accident', collapse ? 'Effondrement dans les mines' : 'Accident mortel dans les mines', 'critical', causes, 'mines');
    schedule(ctx, 'mine_accident', { floor: 'mines', subjectId: victim.id });
    if (negligent) w.tags['mine_negligence'] = w.tick + 144 * 30;
  }
}
