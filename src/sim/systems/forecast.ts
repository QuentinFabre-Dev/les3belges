// Anticipation (§34–36) : ce qui va arriver si rien ne change, classé par urgence.
import type { Ctx } from '../context';
import { DIFFICULTY } from '../data/difficulty';
import { TICKS_PER_DAY, TICKS_PER_HOUR, YEAR_DAYS } from '../data/world';
import type { ForecastItem, ResourceView, Severity } from '../types';
import { dayOf, fullName } from '../util';
import { STAGE_LABELS } from './factions';
import { riskPerDay } from './infrastructure';
import { calendar } from './years';

const RANK: Record<Severity, number> = { critical: 0, important: 1, attention: 2, info: 3 };

export function forecast(ctx: Ctx, resources: ResourceView[]): ForecastItem[] {
  const { w } = ctx;
  const out: ForecastItem[] = [];
  const h = (ticks: number) => Math.max(0, ticks / TICKS_PER_HOUR);

  // Stocks qui baissent
  for (const r of resources) {
    if (r.key === 'energy' || r.days > 12 || (r.trend >= 0 && r.days >= 3)) continue;
    const sev: Severity = r.days < 3 ? 'critical' : r.days < 6 ? 'important' : 'attention';
    const when = r.days < 1 ? 'moins d’un jour' : `${Math.round(r.days)} j`;
    out.push({ id: `res_${r.key}`, text: r.trend < 0 ? `${r.label} : épuisement dans ≈ ${when} (selon les registres)` : `${r.label} : réserve faible (≈ ${when})`, inHours: r.days * 24, severity: sev, view: 'resources' });
  }
  // Pannes probables
  for (const a of Object.values(w.assets)) {
    if (a.state === 'failed' || a.state === 'maintenance') continue;
    const risk = riskPerDay(a);
    if (risk < 0.07) continue;
    out.push({ id: `asset_${a.id}`, text: `Panne probable : ${a.name} (≈ ${Math.round(risk * 100)} % par jour)`, inHours: 24 / Math.max(0.05, risk), severity: a.critical && risk > 0.15 ? 'critical' : a.critical ? 'important' : 'attention', floor: a.floor, view: 'infrastructure' });
  }
  // Batteries pendant une panne
  if (w.assets.generator.state === 'failed') out.push({ id: 'battery', text: `Génératrice à l’arrêt : batteries à ${Math.round(w.resources.battery)} %`, inHours: 0, severity: 'critical', view: 'infrastructure' });
  // Procès
  for (const k of w.cases.filter((x) => x.status === 'detention').slice(0, 3)) {
    out.push({ id: `trial_${k.id}`, text: `Procès de ${fullName(w.citizens[k.defendantId])} (${k.charge.toLowerCase()})`, inHours: h(k.trialTick - w.tick), severity: 'info', view: 'justice' });
  }
  // Promesses
  for (const p of w.promises.filter((x) => x.resolved === undefined)) {
    out.push({ id: `promise_${p.id}`, text: `Promesse à tenir : ${p.text}`, inHours: h(p.deadlineTick - w.tick), severity: p.deadlineTick - w.tick < TICKS_PER_DAY ? 'important' : 'attention' });
  }
  // Élection, fin de mandat du maire
  if (w.election && !w.election.winnerId) out.push({ id: 'election', text: `Résultat de l’élection : ${w.offices[w.election.officeId].title}`, inHours: h(w.election.endTick - w.tick), severity: 'info', view: 'institutions' });
  const termLeft = (w.offices.mayor.termEndsDay ?? 999) - dayOf(w);
  if (termLeft >= 0 && termLeft <= 5 && !w.election) out.push({ id: 'term', text: 'Fin du mandat du maire : élection à venir', inHours: termLeft * 24, severity: 'info', view: 'institutions' });
  // Factions qui se radicalisent
  for (const f of w.factions.filter((x) => x.status === 'active' && x.detected && x.stage >= 2)) {
    out.push({ id: `faction_${f.id}`, text: `« ${f.name} » : ${STAGE_LABELS[f.stage].toLowerCase()}${(f.truceUntil ?? 0) > w.tick ? ' (trêve en cours)' : ''}`, inHours: 24, severity: f.stage >= 3 ? 'critical' : 'important', view: 'opinion' });
  }
  // Blocus qui s'éternisent
  for (const f of w.floors.filter((x) => x.lockdown === 'full' && x.lockdownSince !== undefined && w.tick - x.lockdownSince > TICKS_PER_DAY * 3)) {
    out.push({ id: `lock_${f.id}`, text: `Blocus de ${f.label} depuis ${Math.floor((w.tick - f.lockdownSince!) / TICKS_PER_DAY)} j : la rancœur s’accumule`, inHours: 0, severity: 'attention', floor: f.id });
  }
  // Calendrier
  const cal = calendar(w);
  const toYear = YEAR_DAYS - cal.dayOfYear + 1;
  const lastYear = !w.freeMode && cal.yearIndex === DIFFICULTY[w.difficulty].mandateYears - 1;
  if (toYear <= 5) out.push({ id: 'year', text: lastYear ? 'Fin de votre mandat : le silo jugera votre administration' : `Jour de la Fondation : bilan de l’an ${cal.year}`, inHours: toYear * 24, severity: lastYear ? 'important' : 'info' });

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.inHours - b.inHours).slice(0, 7);
}
