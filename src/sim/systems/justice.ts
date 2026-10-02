// Justice : arrestation → détention → procès → verdict → (appel) → peine.
// Le joueur peut laisser le juge trancher, imposer un verdict ou gracier : chaque voie a un prix institutionnel.

import { TICKS_PER_DAY } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { Case, CitizenId } from '../types';
import { addTag, fullName, hasTag, holder, journal } from '../util';
import { schedule } from './infrastructure';
import { killCitizen, propagate } from './social';
import { remember } from './years';
import { shakeTrust } from './institutions';

export const CELL_CAPACITY = 10;

// Gravité selon le motif (1 = délit, 3 = crime grave).
function severityOf(charge: string) {
  const c = charge.toLowerCase();
  if (c.includes('mort') || c.includes('sabotage') || c.includes('insurrection') || c.includes('falsification')) return 3;
  if (c.includes('vol') || c.includes('contrebande') || c.includes('relique') || c.includes('réseau')) return 2;
  return 1;
}

export function openCase(ctx: Ctx, defendantId: CitizenId, charge: string, legitimacy: number) {
  const { w } = ctx;
  const c = w.citizens[defendantId];
  let evidence = legitimacy * 0.7;
  if (c.flags.includes('thief')) evidence += 25;
  if (c.flags.includes('investigated')) evidence += 12;
  if (c.flags.includes('suspect')) evidence += 10;
  if (c.flags.includes('infiltrated_evidence')) evidence += 25;
  const kase: Case = {
    id: w.nextUid++,
    defendantId,
    charge,
    severity: severityOf(charge),
    evidence: Math.round(clamp(evidence + ctx.rng.range(-8, 8))),
    openedTick: w.tick,
    trialTick: w.tick + Math.round(TICKS_PER_DAY * 2),
    status: 'detention',
    notes: [`Arrêté·e : ${charge}`],
  };
  w.cases.push(kase);
  return kase;
}

export function judgeThreshold(ctx: Ctx) {
  const judge = holder(ctx.w, 'judge');
  if (!judge) return 60;
  let t = 55;
  if (judge.traits.includes('rigorous')) t += 6;
  if (judge.traits.includes('skeptical')) t += 4;
  if (judge.traits.includes('loyal')) t -= 6;
  if (judge.integrity < 40) t -= 10; // juge complaisant
  return t;
}

export function justiceHour(ctx: Ctx) {
  const { w } = ctx;
  for (const k of w.cases) {
    const c = w.citizens[k.defendantId];
    if (k.status === 'detention' && w.tick >= k.trialTick) {
      if (c.lifeState !== 'imprisoned') {
        k.status = 'closed';
        continue;
      }
      k.status = 'trial';
      schedule(ctx, 'trial', { subjectId: k.defendantId, floor: 'security' });
    }
    // Filet de sécurité : si le procès n'a pas pu être présenté, le juge tranche seul.
    if (k.status === 'trial' && w.tick > k.trialTick + TICKS_PER_DAY * 2 && !w.pending.some((p) => p.defId === 'trial' && p.subjectId === k.defendantId)) {
      applyVerdict(ctx, k.defendantId, 'judge');
    }
    if (k.status === 'serving' && k.sentenceEndTick !== undefined && w.tick >= k.sentenceEndTick) {
      k.status = 'closed';
      if (c.lifeState === 'imprisoned') {
        c.lifeState = 'alive';
        c.flags.push('ex_prisoner');
        journal(w, `${fullName(c)} a purgé sa peine et retrouve son étage.`, 'info', c.homeFloor);
        k.notes.push('Peine purgée');
      }
    }
  }
}

export function justiceDay(ctx: Ctx) {
  const { w } = ctx;
  const detained = w.citizens.filter((c) => c.lifeState === 'imprisoned').length;
  if (detained > CELL_CAPACITY) {
    // Cellules surpeuplées : tension chez les adjoints et méfiance envers la sécurité.
    const over = detained - CELL_CAPACITY;
    for (const c of w.citizens) {
      if (c.lifeState !== 'alive') continue;
      if (c.sector === 'security') c.morale = clamp(c.morale - over * 0.8);
      c.trustSecurity = clamp(c.trustSecurity - over * 0.15);
    }
    journal(w, `Cellules surpeuplées : ${detained} détenus pour ${CELL_CAPACITY} places.`, 'attention', 'security');
  }
  w.cases = w.cases.filter((k) => k.status !== 'closed' || w.tick - k.openedTick < TICKS_PER_DAY * 15);
}

export const caseOf = (ctx: Ctx, defendantId?: CitizenId) =>
  defendantId === undefined ? undefined : ctx.w.cases.find((k) => k.defendantId === defendantId && k.status !== 'closed');

function release(ctx: Ctx, k: Case, verdict: 'acquitted' | 'pardoned', note: string) {
  const c = ctx.w.citizens[k.defendantId];
  if (c.lifeState === 'imprisoned') c.lifeState = 'alive';
  k.status = 'closed';
  k.verdict = verdict;
  k.notes.push(note);
}

function imprison(ctx: Ctx, k: Case, days: number, note: string) {
  k.status = 'serving';
  k.verdict = 'prison';
  k.sentenceEndTick = ctx.w.tick + Math.round(days * TICKS_PER_DAY);
  k.notes.push(note);
}

// Verdict d'un procès (effet data-driven `verdict`).
export function applyVerdict(ctx: Ctx, defendantId: CitizenId | undefined, mode: 'judge' | 'convict' | 'pardon' | 'cleaning' | 'reduce' | 'annul' | 'confirm') {
  const { w } = ctx;
  const k = caseOf(ctx, defendantId);
  if (!k) return;
  const c = w.citizens[k.defendantId];
  const threshold = judgeThreshold(ctx);
  const guiltyByJudge = k.evidence >= threshold;
  const name = fullName(c);
  const sentence = [0, 4, 9, 16][k.severity];
  const judgeOffice = w.offices.judge;

  switch (mode) {
    case 'judge': {
      if (guiltyByJudge) {
        imprison(ctx, k, sentence, `Le juge condamne à ${sentence} jours de cellule.`);
        journal(w, `Procès de ${name} : coupable (${sentence} j de cellule).`, 'info', 'security');
        propagate(ctx, c.id, 8 + c.popularity * 0.15, 'arrest', 75);
        maybeAppeal(ctx, k);
      } else {
        release(ctx, k, 'acquitted', 'Acquitté·e faute de preuves suffisantes.');
        journal(w, `Procès de ${name} : acquitté·e faute de preuves.`, 'info', 'security');
        propagate(ctx, c.id, 8 + c.popularity * 0.15, 'reward', 80);
      }
      judgeOffice.legitimacy = clamp(judgeOffice.legitimacy + 2);
      break;
    }
    case 'convict': {
      imprison(ctx, k, sentence + 3, `Condamnation imposée par l’administration (${sentence + 3} j).`);
      k.forced = !guiltyByJudge;
      if (!guiltyByJudge) {
        shakeTrust(ctx.w, 'judiciary', -8);
        remember(ctx, 'forced_verdict', 22, { title: `Le procès de ${fullName(ctx.w.citizens[k.defendantId])}`, responsibility: 'administration' });
        // Contre l'avis du juge : précédent, colère de l'entourage, juge humilié.
        judgeOffice.legitimacy = clamp(judgeOffice.legitimacy - 10);
        addTag(w, 'judge_bypassed', 25);
        w.psychology.legitimacy = clamp(w.psychology.legitimacy - 4);
        propagate(ctx, c.id, 20 + c.popularity * 0.35, 'arrest', 20);
        w.memories.push({ tick: w.tick, type: 'forced_verdict', text: `Condamnation imposée de ${name} malgré un dossier faible`, severity: 0.6, perceivedLegitimacy: 20 });
        journal(w, `${name} condamné·e sur ordre de l’administration, contre l’avis du juge.`, 'important', 'security');
      } else {
        journal(w, `${name} condamné·e à une peine alourdie.`, 'attention', 'security');
        propagate(ctx, c.id, 10 + c.popularity * 0.2, 'arrest', 60);
      }
      maybeAppeal(ctx, k);
      break;
    }
    case 'pardon': {
      release(ctx, k, 'pardoned', 'Grâce de l’administration.');
      const sheriff = w.offices.sheriff;
      if (guiltyByJudge) {
        sheriff.legitimacy = clamp(sheriff.legitimacy - 6);
        for (const x of w.citizens) if (x.sector === 'security' && x.lifeState === 'alive') x.morale = clamp(x.morale - 5);
      }
      propagate(ctx, c.id, 10 + c.popularity * 0.3, 'reward', 85);
      journal(w, `${name} est gracié·e.`, 'info', 'security');
      break;
    }
    case 'cleaning': {
      k.status = 'closed';
      k.verdict = 'cleaning';
      k.forced = !guiltyByJudge || k.evidence < 75;
      k.notes.push('Condamné·e au nettoyage.');
      killCitizen(ctx, c.id, 'Condamné·e au nettoyage', k.evidence >= 75 ? 'legal' : 'controversial');
      if (k.forced) {
        judgeOffice.legitimacy = clamp(judgeOffice.legitimacy - 12);
        addTag(w, 'judge_bypassed', 30);
      }
      w.lens = 1;
      journal(w, 'Après le nettoyage, les écrans des réfectoires montrent de nouveau le dehors.', 'important', 'cafeteria');
      break;
    }
    case 'confirm':
      k.notes.push('Appel rejeté : la peine est confirmée.');
      judgeOffice.legitimacy = clamp(judgeOffice.legitimacy + 3);
      for (const x of w.citizens) if (x.lifeState === 'alive' && x.householdId === c.householdId) x.grievance = clamp(x.grievance + 10);
      break;
    case 'reduce':
      if (k.sentenceEndTick) k.sentenceEndTick = w.tick + Math.max(TICKS_PER_DAY, (k.sentenceEndTick - w.tick) / 2);
      k.notes.push('Appel : peine réduite de moitié.');
      propagate(ctx, c.id, 6 + c.popularity * 0.1, 'reward', 75);
      break;
    case 'annul':
      release(ctx, k, 'pardoned', 'Appel : condamnation annulée.');
      judgeOffice.legitimacy = clamp(judgeOffice.legitimacy - 5);
      propagate(ctx, c.id, 10 + c.popularity * 0.2, 'reward', 80);
      break;
  }
}

function maybeAppeal(ctx: Ctx, k: Case) {
  const { w } = ctx;
  const c = w.citizens[k.defendantId];
  const inFaction = w.factions.some((f) => f.status === 'active' && f.members.includes(c.id));
  if (k.appealed) return;
  if (c.popularity > 45 || inFaction || k.forced) {
    if (ctx.rng.chance(k.forced ? 0.8 : 0.45)) {
      k.appealed = true;
      w.delayed.push({ dueTick: w.tick + Math.round(TICKS_PER_DAY * 1.5), effects: [{ type: 'schedule', eventId: 'appeal', delayDays: 0 }], pctx: { subjectId: c.id, floor: 'security' } });
    }
  }
}

// Commandes directes depuis le panneau Justice.
export function caseAction(ctx: Ctx, caseId: number, action: 'release' | 'expedite') {
  const { w } = ctx;
  const k = w.cases.find((x) => x.id === caseId);
  if (!k || k.status === 'closed') return;
  if (action === 'release') applyVerdict(ctx, k.defendantId, 'pardon');
  else if (k.status === 'detention') {
    k.trialTick = w.tick + 1;
    k.notes.push('Procès avancé à la demande de l’administration.');
  }
}

export const hasJudgeBypass = (ctx: Ctx) => hasTag(ctx.w, 'judge_bypassed');
