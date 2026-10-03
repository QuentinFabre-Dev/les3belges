// Progression sur plusieurs années : calendrier, démographie, mémoire collective (§116),
// bilans annuels et fins de partie.
import type { Ctx } from '../context';
import { diff } from '../data/difficulty';
import { POPULATION_START, START_YEAR, TICKS_PER_DAY, YEAR_DAYS } from '../data/world';
import { clamp } from '../rng';
import type { ChronicleEntry, ChronicleKind, FloorId, GameOver, SectorId, WorldState, YearReport } from '../types';
import { dayOf, hasTag, journal } from '../util';
import { eventDef, rebalanceStaff, spawn } from './events';
import { killCitizen } from './social';

export function calendar(w: WorldState) {
  const d = dayOf(w) - 1;
  const yearIndex = Math.floor(d / YEAR_DAYS);
  return { yearIndex, year: START_YEAR + yearIndex, dayOfYear: (d % YEAR_DAYS) + 1 };
}

// ---------------------------------------------------------------------------
// Mémoire collective

const KIND_TITLES: Record<ChronicleKind, string> = {
  mine_accident: 'L’accident des galeries',
  blackout: 'La Grande Panne',
  famine: 'La Faim',
  thirst: 'La Soif',
  epidemic: 'La Fièvre',
  riot: 'Les Émeutes',
  insurrection: 'Le Soulèvement',
  lockdown: 'Le Blocus',
  forced_verdict: 'Le Procès imposé',
  death_key: 'Le Deuil',
  truth: 'La Révélation',
};

interface RememberOpts {
  floors?: FloorId[];
  sectors?: SectorId[];
  responsibility?: string;
  title?: string;
}

/** Inscrit une crise dans la mémoire du silo, ou renforce un souvenir en cours. Réveille les souvenirs anciens du même type. */
export function remember(ctx: Ctx, kind: ChronicleKind, severity: number, opts: RememberOpts = {}): ChronicleEntry {
  const { w } = ctx;
  const cal = calendar(w);
  const base = opts.title ?? KIND_TITLES[kind];
  const recent = w.chronicle.find((e) => e.kind === kind && e.title.startsWith(base) && w.tick - e.tick < TICKS_PER_DAY * 4);
  if (recent) {
    recent.severity = Math.min(100, recent.severity + severity * 0.5);
    recent.peak = Math.max(recent.peak, recent.severity);
    for (const f of opts.floors ?? []) if (!recent.floors.includes(f)) recent.floors.push(f);
    for (const s of opts.sectors ?? []) if (!recent.sectors.includes(s)) recent.sectors.push(s);
    return recent;
  }
  // Une nouvelle crise du même type rouvre la plaie (« une nouvelle baisse de sécurité dans les mines… »).
  const old = w.chronicle.filter((e) => e.kind === kind && w.tick - e.tick >= TICKS_PER_DAY * 8 && e.severity >= 12).sort((a, b) => b.severity - a.severity)[0];
  if (old) reactivate(ctx, old);
  const sameYear = w.chronicle.filter((e) => e.title.startsWith(base) && e.year === cal.year).length;
  const entry: ChronicleEntry = {
    id: (w.chronicle.at(-1)?.id ?? 0) + 1,
    kind,
    title: `${base}${sameYear ? ` (${sameYear + 1})` : ''} de l’an ${cal.year}`,
    tick: w.tick,
    year: cal.year,
    severity: Math.min(100, severity),
    peak: Math.min(100, severity),
    floors: opts.floors ?? [],
    sectors: opts.sectors ?? [],
    responsibility: opts.responsibility,
    reactivations: 0,
  };
  w.chronicle.push(entry);
  if (w.chronicle.length > 60) w.chronicle.splice(0, w.chronicle.length - 60);
  return entry;
}

export function reactivate(ctx: Ctx, e: ChronicleEntry) {
  const { w } = ctx;
  e.reactivations++;
  const k = (e.severity / 100) * diff(w).tolerance;
  const everyone = !e.floors.length && !e.sectors.length;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive') continue;
    if (!everyone && !e.floors.includes(c.homeFloor) && !e.sectors.includes(c.sector)) continue;
    c.fear = clamp(c.fear + 10 * k);
    c.grievance = clamp(c.grievance + 12 * k);
    c.trust = clamp(c.trust - 6 * k);
  }
  e.severity = Math.min(100, e.severity + 8);
  journal(w, `Le souvenir de « ${e.title} » ressurgit : la peur et la rancœur remontent.`, 'important', e.floors[0]);
}

/** Effet d'événement sur un souvenir (commémoration, interdiction…). */
export function soothe(ctx: Ctx, id: number | undefined, factor: number, mark?: ChronicleEntry['commemorated']) {
  const e = ctx.w.chronicle.find((x) => x.id === id);
  if (!e) return;
  e.severity = clamp(e.severity * factor, 0, 100);
  if (mark) e.commemorated = mark;
}

// ---------------------------------------------------------------------------
// Démographie quotidienne : vieillesse et loterie des naissances

export function demographyDay(ctx: Ctx, birth: () => void) {
  const { w, rng } = ctx;
  for (const c of w.citizens) {
    if (c.lifeState !== 'alive' || c.age < 55) continue;
    const q = 0.004 * Math.exp((c.age - 50) * 0.085) * (c.health < 50 ? 1.6 : 1);
    if (rng.chance(q / YEAR_DAYS)) killCitizen(ctx, c.id, 'Mort naturelle', 'accident');
  }
  const quota = { restricted: 0.006, normal: 0.014, expanded: 0.024 }[w.policies.births ?? 'normal'];
  const mood = clamp(w.psychology.morale / 60, 0.4, 1.2) * (hasTag(w, 'baby_boom') ? 1.8 : 1);
  const expected = (quota * ctx.population * mood) / YEAR_DAYS;
  const n = Math.floor(expected) + (rng.chance(expected % 1) ? 1 : 0);
  for (let i = 0; i < n; i++) birth();
}

// ---------------------------------------------------------------------------
// Tournant de l'année

export function yearEnd(ctx: Ctx) {
  const { w } = ctx;
  const closing = calendar(w).year - 1;
  let adults = 0;
  let retirees = 0;
  for (const c of w.citizens) {
    if (c.lifeState === 'dead') continue;
    c.age += 1;
    if (c.lifeState !== 'alive') continue;
    if (c.age === 16) {
      adults++;
      c.flags.push('apprentice');
    }
    if (c.age === 65 && c.sector !== 'residential' && !c.officeId) {
      retirees++;
      c.sector = 'residential';
      c.workFloor = c.homeFloor;
      c.flags.push('retired');
      if (c.flags.includes('specialist')) {
        const lost = Object.values(w.assets).filter((a) => a.specialistIds.includes(c.id));
        for (const a of lost) a.specialistIds = a.specialistIds.filter((x) => x !== c.id);
        if (lost.length) journal(w, `Départ à la retraite d’un spécialiste : ${lost.map((a) => a.name).join(', ')} perd une expertise.`, 'attention');
      }
    }
  }
  rebalanceStaff(ctx);
  journal(w, `Jour de la Fondation, an ${closing + 1} : ${adults} jeunes reçoivent leur affectation, ${retirees} travailleurs partent à la retraite.`, 'important');

  // La mémoire s'efface lentement… plus ou moins selon la difficulté.
  const decay = diff(w).memoryDecay;
  for (const e of w.chronicle) e.severity = Math.max(0, e.severity * (1 - decay));

  const yearMem = w.chronicle.filter((e) => e.year === closing).sort((a, b) => b.peak - a.peak);
  const ys = w.yearStart;
  const report: YearReport = {
    year: closing,
    population: ctx.population,
    popDelta: ctx.population - ys.population,
    births: w.stats.births - ys.births,
    deaths: w.stats.deaths - ys.deaths,
    arrests: w.stats.arrests - ys.arrests,
    stability: Math.round(w.stability),
    legitimacy: Math.round(w.psychology.legitimacy),
    trust: Math.round(w.psychology.trust),
    memories: yearMem.slice(0, 5).map((e) => ({ title: e.title, severity: Math.round(e.peak) })),
    notes: [],
  };
  if (adults) report.notes.push(`${adults} jeunes ont reçu leur affectation.`);
  if (retirees) report.notes.push(`${retirees} travailleurs sont partis à la retraite.`);
  const reopened = w.chronicle.filter((e) => e.year < closing && e.reactivations > 0 && w.tick - e.tick < TICKS_PER_DAY * YEAR_DAYS * 3);
  if (reopened.length) report.notes.push(`Des souvenirs anciens ont ressurgi : ${reopened.map((e) => `« ${e.title} »`).join(', ')}.`);
  if (!yearMem.length) report.notes.push('Une année sans crise marquante : le silo s’en souviendra comme d’une année calme.');
  w.yearReports.push(report);
  w.yearStart = { population: ctx.population, deaths: w.stats.deaths, births: w.stats.births, arrests: w.stats.arrests, tick: w.tick };

  // Commémoration de la crise la plus marquante de l'année écoulée.
  const founding = eventDef('founding_day');
  if (founding) spawn(ctx, founding, {});
  const top = yearMem.find((e) => e.peak >= 30 && !e.commemorated);
  const def = eventDef('commemoration');
  if (top && def) spawn(ctx, def, { vars: { memory: top.title, memoryId: top.id } });
}

// ---------------------------------------------------------------------------
// Fins de partie

const pct = (x: number) => `${Math.round(x)}`;

function gameStats(ctx: Ctx) {
  const { w } = ctx;
  const forced = w.cases.filter((k) => k.forced).length;
  return [
    { label: 'Population', value: `${POPULATION_START.toLocaleString('fr-FR')} → ${ctx.population.toLocaleString('fr-FR')}` },
    { label: 'Naissances', value: String(w.stats.births) },
    { label: 'Décès', value: String(w.stats.deaths) },
    { label: 'Arrestations', value: `${w.stats.arrests}${forced ? ` (dont ${forced} jugement${forced > 1 ? 's' : ''} imposé${forced > 1 ? 's' : ''})` : ''}` },
    { label: 'Stabilité', value: pct(w.stability) },
    { label: 'Légitimité', value: pct(w.psychology.legitimacy) },
    { label: 'Confiance', value: pct(w.psychology.trust) },
    { label: 'Difficulté', value: diff(w).label },
  ];
}

function memoryLines(w: WorldState) {
  const marks = [...w.chronicle].sort((a, b) => b.peak - a.peak).slice(0, 3);
  return marks.map((e) =>
    e.commemorated === 'forbidden'
      ? `On n’a pas eu le droit de pleurer « ${e.title} ». On s’en souvient à voix basse.`
      : e.commemorated
        ? `Chaque année, on se recueille en souvenir de « ${e.title} ».`
        : `« ${e.title} » reste une cicatrice que personne n’a refermée.`,
  );
}

export function endGame(ctx: Ctx, kind: GameOver['kind'], id: string, title: string, reason: string, chain: string[], epilogue: string[]) {
  const { w } = ctx;
  w.gameOver = { day: dayOf(w), year: calendar(w).year, kind, id, title, reason, chain, epilogue: [...epilogue, ...memoryLines(w)], stats: gameStats(ctx) };
  journal(w, `FIN : ${title} — ${reason}`, kind === 'victory' ? 'important' : 'critical');
}

/** Fin de mandat : le récit dépend de la manière dont le silo a été gouverné. */
export function checkVictory(ctx: Ctx) {
  const { w } = ctx;
  if (w.gameOver || w.freeMode) return;
  const years = diff(w).mandateYears;
  if (calendar(w).yearIndex < years) return;
  const p = w.psychology;
  const forced = w.cases.filter((k) => k.forced).length;
  const lines: string[] = [`Votre mandat de ${years} ans s’achève. Le Pacte est transmis à la prochaine administration.`];
  let id = 'fragile';
  let title = 'Le silo tient';
  if (hasTag(w, 'truth_revealed') && w.stability >= 45) {
    id = 'truth';
    title = 'La Vérité';
    lines.push('Le silo connaît désormais ce que ses fondateurs avaient caché. La peur n’a pas tout emporté : on parle du dehors à voix haute, dans les réfectoires, devant l’écran.');
  } else if (w.stability >= 62 && p.trust >= 55 && p.legitimacy >= 55) {
    id = 'golden';
    title = 'L’Âge du Pacte';
    lines.push('Les étages se parlent, les responsables rendent des comptes, et les enfants nés sous votre mandat ne connaissent la peur que par les récits.');
  } else if (p.authority >= 62 && (p.fear >= 40 || p.trust < 45)) {
    id = 'iron';
    title = 'L’Ordre de fer';
    lines.push('Le silo fonctionne. Les machines tournent, les rations arrivent à l’heure. Mais on baisse les yeux quand passent les adjoints, et on ne parle plus fort dans les escaliers.');
  } else {
    lines.push('Le silo a survécu, sans éclat. Les crises ont laissé des traces, les institutions ont plié sans rompre. C’est déjà beaucoup.');
  }
  if (hasTag(w, 'truth_kept')) lines.push('Le secret des archives repose toujours dans un tiroir du conseil. Pour combien de temps ?');
  if (hasTag(w, 'truth_destroyed')) lines.push('Le fichier des archives a été détruit. Seule la DSI se souvient qu’il a existé.');
  if (forced >= 3) lines.push(`${forced} jugements ont été imposés au juge : on parle encore de « la justice de l’administration ».`);
  if (w.stats.births > w.stats.deaths) lines.push('Il y a plus de berceaux que de tombes : le silo a de l’avenir.');
  endGame(ctx, 'victory', id, title, 'Fin du mandat', [], lines);
}

/** Défaites : chaque effondrement raconte une histoire différente. */
export function checkDefeat(ctx: Ctx, chain: () => string[]) {
  const { w } = ctx;
  if (w.gameOver) return;
  const insurgent = w.floors.filter((f) => f.unrest >= 5).length;
  if (ctx.population < POPULATION_START * 0.5)
    endGame(ctx, 'defeat', 'collapse', 'Le silo se vide', 'La population du silo s’est effondrée.', chain(), [
      'Les étages se sont vidés un à un. Les survivants se sont regroupés près des fermes, et plus personne ne tient les registres.',
    ]);
  else if (insurgent >= 5)
    endGame(ctx, 'defeat', 'uprising', 'Le Soulèvement', 'Une insurrection a pris le contrôle de plusieurs étages.', chain(), [
      'Les insurgés ont pris l’escalier central. Le nouveau pouvoir réécrit le Pacte, et votre nom n’y figure pas.',
    ]);
  else if (w.stability < 8 && w.psychology.legitimacy < 15)
    endGame(ctx, 'defeat', 'deposed', 'Destitution', 'L’administration a perdu toute légitimité : le silo ne vous obéit plus.', chain(), [
      'Les ordres ne descendent plus. Chaque étage s’administre seul, et le conseil a voté votre destitution.',
    ]);
  else if ((w.blackoutDays ?? 0) >= 4)
    endGame(ctx, 'defeat', 'darkness', 'Le Silence', 'La génératrice ne s’est jamais rallumée.', chain(), [
      'Le silence a duré trop longtemps. Sans lumière ni ventilation, les habitants ont commencé à remonter… vers le sas.',
    ]);
}
