// Confiance par institution (§100–111) : le silo ne juge pas « l'administration » en bloc.
// Chaque institution a sa propre réputation, nourrie par ses actes, et qui pèse en retour.
import type { Ctx } from '../context';
import { TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { InstitutionId, WorldState } from '../types';
import { avg, hasTag, holder } from '../util';

export const INSTITUTION_LABELS: Record<InstitutionId, string> = {
  mayor: 'Mairie',
  judiciary: 'Judiciaire',
  security: 'Sécurité',
  mechanics: 'Mécanique',
  medical: 'Médical',
  it: 'DSI',
};

export const INSTITUTIONS = Object.keys(INSTITUTION_LABELS) as InstitutionId[];

export function trustIn(w: WorldState, id: InstitutionId) {
  return w.institutions?.[id]?.trust ?? 55;
}

const recent = (w: WorldState, days: number, test: (type: string) => boolean) => w.memories.filter((m) => w.tick - m.tick < TICKS_PER_DAY * days && test(m.type)).length;

/** Cible vers laquelle dérive la confiance, et ce qui l'explique. */
function target(ctx: Ctx, id: InstitutionId): { value: number; causes: string[] } {
  const { w } = ctx;
  const causes: string[] = [];
  let v = 50;
  switch (id) {
    case 'mayor': {
      const kept = recent(w, 25, (t) => t === 'promise_kept');
      const broken = recent(w, 25, (t) => t === 'promise_broken');
      v = w.psychology.legitimacy * 0.55 + w.offices.mayor.legitimacy * 0.35 + 8 + kept * 4 - broken * 8;
      if (kept) causes.push(`${kept} promesse${kept > 1 ? 's' : ''} tenue${kept > 1 ? 's' : ''}`);
      if (broken) causes.push(`${broken} promesse${broken > 1 ? 's' : ''} non tenue${broken > 1 ? 's' : ''}`);
      if (w.policies.rations === 'reduced') {
        v -= 6;
        causes.push('rations réduites');
      }
      if (w.policies.emergencyPowers) {
        v -= 6;
        causes.push('pouvoirs d’urgence');
      }
      break;
    }
    case 'judiciary': {
      const forced = w.cases.filter((k) => k.forced && w.tick - k.openedTick < TICKS_PER_DAY * 30).length;
      const waiting = w.cases.filter((k) => k.status === 'detention' && w.tick - k.openedTick > TICKS_PER_DAY * 3).length;
      v = w.offices.judge.legitimacy * 0.75 + 18 - forced * 8 - waiting * 2;
      if (forced) causes.push(`${forced} jugement${forced > 1 ? 's' : ''} imposé${forced > 1 ? 's' : ''} au juge`);
      if (waiting) causes.push(`${waiting} détention${waiting > 1 ? 's' : ''} sans procès`);
      if (hasTag(w, 'judge_bypassed')) {
        v -= 8;
        causes.push('le juge a été contourné');
      }
      if (!holder(w, 'judge')) {
        v -= 10;
        causes.push('pas de juge en fonction');
      }
      break;
    }
    case 'security':
      // Cumul des confiances individuelles envers les adjoints (déjà nourries par les arrestations, rumeurs…).
      v = avg(w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 14).map((c) => c.trustSecurity));
      if (hasTag(w, 'arbitrary_arrests')) causes.push('arrestations arbitraires');
      {
        const heavy = w.floors.filter((f) => (f.patrol ?? 0) >= 2).length;
        if (heavy) causes.push(`${heavy} étage${heavy > 1 ? 's' : ''} quadrillé${heavy > 1 ? 's' : ''}`);
      }
      break;
    case 'mechanics': {
      const crit = Object.values(w.assets).filter((a) => a.critical);
      const cond = avg(crit.map((a) => a.condition));
      const failures = recent(w, 15, (t) => t.startsWith('failure_'));
      const chief = holder(w, 'mechanic_chief');
      v = 32 + cond * 45 - failures * 7 + (chief ? chief.skill * 0.12 : -8);
      if (failures) causes.push(`${failures} panne${failures > 1 ? 's' : ''} récente${failures > 1 ? 's' : ''}`);
      if (cond < 0.5) causes.push('équipements vitaux usés');
      if (w.assets.generator.state === 'failed') {
        v -= 15;
        causes.push('génératrice à l’arrêt');
      }
      break;
    }
    case 'medical': {
      const sickShare = ctx.sick / Math.max(1, ctx.population);
      const neglect = recent(w, 20, (t) => t === 'death_negligence');
      const chief = holder(w, 'medical_chief');
      v = 48 + Math.min(1, w.resources.medicine.real / 400) * 22 - sickShare * 250 - neglect * 1.5 + (chief ? chief.skill * 0.1 : -8);
      if (sickShare > 0.03) causes.push(`${Math.round(sickShare * 100)} % de malades`);
      if (w.resources.medicine.real < 120) causes.push('pénurie de médicaments');
      if (neglect) causes.push(`${neglect} décès évitables`);
      break;
    }
    case 'it': {
      v = 22 + w.lens * 25 + ctx.infoAccuracy * 32;
      if (w.lens < 0.4) causes.push('écrans des réfectoires voilés');
      if (w.assets.servers.state === 'failed') {
        v -= 12;
        causes.push('serveurs en panne');
      }
      if (hasTag(w, 'truth_revealed')) {
        v += 8;
        causes.push('la vérité des archives a été dite');
      }
      if (hasTag(w, 'truth_kept') && !hasTag(w, 'truth_revealed')) causes.push('des archives cachées');
      break;
    }
  }
  return { value: clamp(v), causes };
}

export function initInstitutions(w: WorldState) {
  w.institutions ??= {} as WorldState['institutions'];
  for (const id of INSTITUTIONS) w.institutions[id] ??= { trust: 60, history: [] };
}

/** Dérive quotidienne vers la cible ; historique pour la tendance. */
export function institutionsDay(ctx: Ctx) {
  const { w } = ctx;
  initInstitutions(w);
  for (const id of INSTITUTIONS) {
    const inst = w.institutions[id];
    const t = target(ctx, id).value;
    inst.trust = id === 'security' ? t : clamp(inst.trust + (t - inst.trust) * 0.12);
    inst.history.push(Math.round(inst.trust));
    if (inst.history.length > 10) inst.history.shift();
  }
}

/** Choc ponctuel (une panne, un procès imposé, une promesse tenue…). */
export function shakeTrust(w: WorldState, id: InstitutionId, delta: number) {
  initInstitutions(w);
  if (id === 'security') {
    for (const c of w.citizens) if (c.lifeState === 'alive') c.trustSecurity = clamp(c.trustSecurity + delta);
  }
  w.institutions[id].trust = clamp(w.institutions[id].trust + delta);
}

export function institutionsView(ctx: Ctx) {
  const { w } = ctx;
  initInstitutions(w);
  return INSTITUTIONS.map((id) => {
    const inst = w.institutions[id];
    const past = inst.history.length > 3 ? inst.history[inst.history.length - 4] : inst.history[0] ?? inst.trust;
    return { id, label: INSTITUTION_LABELS[id], trust: Math.round(inst.trust), trend: Math.round(inst.trust - past), causes: target(ctx, id).causes };
  });
}
