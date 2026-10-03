// Conseil du silo : le sujet le plus pressant est débattu. Chaque titulaire prend position selon son
// secteur, ses traits et sa loyauté ; le joueur tranche. Les responsables suivis gagnent en loyauté,
// les autres en perdent, et les alliances entre institutions évoluent.

import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../data/world';
import { clamp } from '../rng';
import type { Ctx } from '../context';
import type { CouncilSession, CouncilView, Effect, OfficeId } from '../types';
import { addTag, fullName, holder, journal } from '../util';
import { applyEffects } from './events';
import { autonomyDays } from './economy';

interface ProposalDef {
  id: string;
  label: string;
  hint: string;
  effects: Effect[];
  support: Partial<Record<OfficeId, number>>; // -2..+2
  tags: ('tech' | 'social' | 'order' | 'production')[];
  argue: Partial<Record<OfficeId, string>>;
}

interface TopicDef {
  id: string;
  title: string;
  summary: (ctx: Ctx) => string;
  urgency: (ctx: Ctx) => number;
  proposals: ProposalDef[];
}

const ASSET_BOOST: Effect[] = ['generator', 'pump_main', 'water_filters', 'hydro_array', 'ventilation', 'mine_supports'].map((assetId) => ({ type: 'asset' as const, assetId, field: 'condition' as const, amount: 0.1 }));

const TOPICS: TopicDef[] = [
  {
    id: 'energy',
    title: 'La génératrice',
    summary: (ctx) => `Génératrice à ${Math.round(ctx.w.assets.generator.condition * 100)} %, production ${Math.round(ctx.w.resources.energyProduction)} kW pour ${Math.round(ctx.w.resources.energyDemand)} kW demandés.`,
    urgency: (ctx) => (ctx.w.assets.generator.state === 'failed' ? 100 : (0.7 - ctx.w.assets.generator.condition) * 150),
    proposals: [
      {
        id: 'stop',
        label: 'Arrêt préventif et révision complète',
        hint: '−30 pièces · ~12 h sur batteries · génératrice remise à neuf',
        effects: [{ type: 'resource', resource: 'parts', amount: -30 }, { type: 'asset', assetId: 'generator', field: 'state', value: 'maintenance' }, { type: 'social', target: 'all', stat: 'fear', amount: 6 }],
        support: { mechanic_chief: 2, it_director: 1, mayor: -1, mines_chief: -1, medical_chief: -1 },
        tags: ['tech'],
        argue: { mechanic_chief: 'Douze heures dans le noir maintenant, ou des semaines plus tard.', mayor: 'Le silo va paniquer à la première coupure.', medical_chief: 'Mes patients sous assistance ne tiendront pas sur batteries.' },
      },
      {
        id: 'shed',
        label: 'Délester le résidentiel la nuit',
        hint: 'Usure ralentie · étages résidentiels dans le noir · moral −',
        effects: [{ type: 'asset', assetId: 'generator', field: 'condition', amount: 0.06 }, { type: 'social', target: 'sector:residential', stat: 'morale', amount: -6 }],
        support: { supply_chief: 1, mines_chief: 1, medical_chief: 1, mayor: -2, sheriff: -1 },
        tags: ['production'],
        argue: { mayor: 'Couper la lumière aux familles ? On me le reprochera, pas à vous.', supply_chief: 'Le résidentiel consomme sans produire.' },
      },
      {
        id: 'run',
        label: 'Continuer à pleine charge',
        hint: 'Aucun coût immédiat · risque de panne totale',
        effects: [{ type: 'tag', tag: 'ignored_generator', days: 8 }],
        support: { mines_chief: 2, agri_chief: 1, mechanic_chief: -2, judge: -1 },
        tags: ['production'],
        argue: { mines_chief: 'Mes foreuses ne s’arrêtent pas pour un bruit de roulement.', mechanic_chief: 'C’est jouer à la roulette avec le silo entier.' },
      },
    ],
  },
  {
    id: 'food',
    title: 'Les réserves alimentaires',
    summary: (ctx) => `Autonomie déclarée : ${autonomyDays(ctx.w, ctx).food.toFixed(1)} jours de nourriture.`,
    urgency: (ctx) => (12 - autonomyDays(ctx.w, ctx).food) * 10,
    proposals: [
      {
        id: 'ration',
        label: 'Rationner tout le silo',
        hint: 'Consommation −20 % · moral et rancœur',
        effects: [{ type: 'policy', key: 'rations', value: 'reduced' }],
        support: { supply_chief: 2, judge: 1, mayor: -1, medical_chief: -1 },
        tags: ['order'],
        argue: { supply_chief: 'Les chiffres ne mentent pas : il faut serrer.', medical_chief: 'Des rations réduites, ce sont des malades en plus chez moi.' },
      },
      {
        id: 'light',
        label: 'Pousser l’éclairage des fermes',
        hint: 'Nourriture +20 % · énergie +45 kW',
        effects: [{ type: 'tag', tag: 'agri_boost', days: 7 }],
        support: { agri_chief: 2, mayor: 1, mechanic_chief: -1 },
        tags: ['production'],
        argue: { agri_chief: 'Donnez-moi la lumière, je vous rends les récoltes.', mechanic_chief: 'Encore de la charge sur une génératrice fatiguée.' },
      },
      {
        id: 'transfer',
        label: 'Transférer 15 mineurs aux fermes',
        hint: 'Agriculture + · fer −',
        effects: [{ type: 'sector', sector: 'agriculture', field: 'staffingTarget', amount: 15 }, { type: 'sector', sector: 'mines', field: 'staffingTarget', amount: -15 }],
        support: { agri_chief: 1, medical_chief: 1, mines_chief: -2, mechanic_chief: -1 },
        tags: ['social'],
        argue: { mines_chief: 'Et le fer, il viendra d’où ?', medical_chief: 'Moins de mineurs, moins d’accidents.' },
      },
    ],
  },
  {
    id: 'water',
    title: 'L’eau',
    summary: (ctx) => `Pompe principale à ${Math.round(ctx.w.assets.pump_main.condition * 100)} %, autonomie ${autonomyDays(ctx.w, ctx).water.toFixed(1)} jours.`,
    urgency: (ctx) => (ctx.w.assets.pump_main.state === 'failed' ? 95 : (0.6 - ctx.w.assets.pump_main.condition) * 140 + (2 - autonomyDays(ctx.w, ctx).water) * 15),
    proposals: [
      {
        id: 'repair',
        label: 'Réviser la pompe en priorité',
        hint: '−18 pièces · pompe +30 %',
        effects: [{ type: 'resource', resource: 'parts', amount: -18 }, { type: 'asset', assetId: 'pump_main', field: 'condition', amount: 0.3 }],
        support: { mechanic_chief: 2, medical_chief: 1, supply_chief: -1 },
        tags: ['tech'],
        argue: { mechanic_chief: 'Une pompe, ça se répare avant de casser.', supply_chief: 'Dix-huit pièces, c’est une semaine de maintenance ailleurs.' },
      },
      {
        id: 'restrict',
        label: 'Restrictions d’eau',
        hint: 'Consommation −22 % · hygiène et moral −',
        effects: [{ type: 'tag', tag: 'water_restrictions', days: 5 }, { type: 'social', target: 'all', stat: 'morale', amount: -4 }],
        support: { supply_chief: 2, judge: 1, mayor: -1, medical_chief: -1 },
        tags: ['order'],
        argue: { medical_chief: 'Moins d’eau, plus d’infections.' },
      },
      {
        id: 'irrigation',
        label: 'Couper l’irrigation quelques jours',
        hint: 'Eau + · récoltes −',
        effects: [{ type: 'tag', tag: 'irrigation_cut', days: 3 }],
        support: { medical_chief: 1, agri_chief: -2, mayor: 1 },
        tags: ['social'],
        argue: { agri_chief: 'Trois jours sans eau, et c’est un mois de récolte perdu.' },
      },
    ],
  },
  {
    id: 'order',
    title: 'L’ordre public',
    summary: (ctx) => {
      const worst = [...ctx.w.floors].sort((a, b) => b.unrestPressure - a.unrestPressure)[0];
      const f = ctx.w.factions.find((x) => x.status === 'active' && x.detected);
      return `Tensions au ${worst.label} ${worst.name}${f ? `, « ${f.name} » au stade ${f.stage}` : ''}. Confiance moyenne ${Math.round(ctx.w.psychology.trust)}.`;
    },
    urgency: (ctx) => Math.max(...ctx.w.floors.map((f) => f.unrest)) * 22 + Math.max(0, ...ctx.w.factions.filter((f) => f.status === 'active').map((f) => f.stage)) * 18,
    proposals: [
      {
        id: 'listen',
        label: 'Écouter et lâcher du lest',
        hint: 'Rations généreuses 3 j · rancœur −10 · autorité −',
        effects: [{ type: 'policy', key: 'rations', value: 'generous' }, { type: 'delayed', delayDays: 3, effects: [{ type: 'policy', key: 'rations', value: 'normal' }] }, { type: 'social', target: 'all', stat: 'grievance', amount: -10 }, { type: 'authority', amount: -4 }],
        support: { mayor: 2, judge: 1, medical_chief: 1, sheriff: -1, supply_chief: -1 },
        tags: ['social'],
        argue: { mayor: 'On ne gouverne pas un silo contre lui.', sheriff: 'Céder maintenant, c’est leur apprendre que ça marche.' },
      },
      {
        id: 'force',
        label: 'Patrouilles et arrestations ciblées',
        hint: 'Colère −15 · peur + · confiance sécurité −',
        effects: [{ type: 'social', target: 'all', stat: 'anger', amount: -15 }, { type: 'social', target: 'all', stat: 'fear', amount: 8 }, { type: 'social', target: 'all', stat: 'trustSecurity', amount: -6 }, { type: 'authority', amount: 6 }, { type: 'tag', tag: 'arbitrary_arrests', days: 10 }],
        support: { sheriff: 2, mines_chief: 1, judge: -2, mayor: -1, medical_chief: -1 },
        tags: ['order'],
        argue: { sheriff: 'Trois noms, et tout rentre dans l’ordre.', judge: 'Sans dossier, chaque arrestation fabrique dix opposants.' },
      },
      {
        id: 'inquiry',
        label: 'Enquête indépendante et transparence',
        hint: 'Légitimité + · révèle les stocks réels',
        effects: [{ type: 'reveal_stocks' }, { type: 'legitimacy', amount: 4 }, { type: 'policy', key: 'transparency', value: 'high' }],
        support: { judge: 2, it_director: 1, supply_chief: -2, sheriff: -1 },
        tags: ['social'],
        argue: { judge: 'La vérité coûte moins cher que les rumeurs.', supply_chief: 'On va encore fouiller mon dépôt pour rien.' },
      },
    ],
  },
  {
    id: 'parts',
    title: 'Fer et pièces détachées',
    summary: (ctx) => `Pièces : ${Math.round(ctx.w.resources.parts.declared)} · fer : ${Math.round(ctx.w.resources.materials.declared)}.`,
    urgency: (ctx) => (70 - ctx.w.resources.parts.declared) * 0.9 + (500 - ctx.w.resources.materials.declared) * 0.05,
    proposals: [
      {
        id: 'quota',
        label: 'Quota minier +20 %',
        hint: 'Fer + · accidents et fatigue +',
        effects: [{ type: 'policy', key: 'mineQuota', value: 1.2 }],
        support: { mines_chief: 2, mechanic_chief: 1, medical_chief: -2, judge: -1 },
        tags: ['production'],
        argue: { mines_chief: 'Mes gars tiendront.', medical_chief: 'Je compterai les blessés.' },
      },
      {
        id: 'forge',
        label: 'Forge à plein régime',
        hint: '−180 fer · +45 pièces dans 2 jours',
        effects: [{ type: 'resource', resource: 'materials', amount: -180 }, { type: 'delayed', delayDays: 2, note: 'Livraison de la forge', effects: [{ type: 'resource', resource: 'parts', amount: 45 }] }],
        support: { mechanic_chief: 2, mines_chief: 1, supply_chief: -1 },
        tags: ['tech'],
        argue: { mechanic_chief: 'Le fer dort dans les caisses, faisons-en des pièces.' },
      },
      {
        id: 'audit',
        label: 'Audit des stocks',
        hint: 'Stocks réels révélés · dépôt ralenti',
        effects: [{ type: 'reveal_stocks' }, { type: 'tag', tag: 'strike:supplies', days: 0.5 }, { type: 'tag', tag: 'supply_controls', days: 10 }],
        support: { it_director: 2, judge: 1, supply_chief: -2 },
        tags: ['order'],
        argue: { it_director: 'Les registres et mes capteurs ne racontent pas la même histoire.', supply_chief: 'Un audit maintenant paralyserait la distribution.' },
      },
    ],
  },
  {
    id: 'calm',
    title: 'Préparer l’avenir',
    summary: () => 'Aucune crise immédiate. Le conseil débat des priorités des prochaines semaines.',
    urgency: () => 10,
    proposals: [
      {
        id: 'maintenance',
        label: 'Grande campagne de maintenance',
        hint: '−40 pièces · équipements vitaux +10 %',
        effects: [{ type: 'resource', resource: 'parts', amount: -40 }, ...ASSET_BOOST],
        support: { mechanic_chief: 2, it_director: 1, mines_chief: -1, supply_chief: -1 },
        tags: ['tech'],
        argue: { mechanic_chief: 'C’est maintenant, quand tout va bien, qu’on évite les crises.' },
      },
      {
        id: 'festival',
        label: 'Rations généreuses et fête dans les réfectoires',
        hint: 'Moral + · nourriture −600',
        effects: [{ type: 'resource', resource: 'food', amount: -600 }, { type: 'social', target: 'all', stat: 'morale', amount: 8 }, { type: 'social', target: 'all', stat: 'trust', amount: 3 }],
        support: { mayor: 2, medical_chief: 1, supply_chief: -2, agri_chief: -1 },
        tags: ['social'],
        argue: { mayor: 'Un silo qui ne fait jamais la fête finit par se révolter.', supply_chief: 'Six cents rations pour une soirée ?' },
      },
      {
        id: 'reserves',
        label: 'Constituer des réserves',
        hint: 'Quota +10 % · fer et pièces à moyen terme',
        effects: [{ type: 'policy', key: 'mineQuota', value: 1.1 }, { type: 'delayed', delayDays: 7, note: 'Retour au quota normal', effects: [{ type: 'policy', key: 'mineQuota', value: 1 }] }],
        support: { supply_chief: 2, mines_chief: 1, medical_chief: -1 },
        tags: ['production'],
        argue: { supply_chief: 'Un dépôt plein, c’est un silo serein.' },
      },
    ],
  },
];

const TRAIT_BIAS: Record<string, Partial<Record<ProposalDef['tags'][number], number>>> = {
  pragmatic: { tech: 1, production: 0.5 },
  altruistic: { social: 1 },
  ambitious: { production: 0.5 },
  rigorous: { tech: 0.5, order: 0.5 },
  loyal: {},
  skeptical: { order: 0.5 },
  calm: { social: 0.5 },
  impulsive: { order: 0.5 },
  solidary: { social: 1 },
  corruptible: { production: 0.5 },
};

const pairKey = (a: OfficeId, b: OfficeId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function initAffinity(ctx: Ctx) {
  const { w, rng } = ctx;
  const ids = Object.keys(w.offices) as OfficeId[];
  for (const a of ids)
    for (const b of ids) {
      if (a >= b) continue;
      const ha = holder(w, a);
      const hb = holder(w, b);
      const rel = ha && hb ? w.relations[ha.id].find((e) => e.to === hb.id) : undefined;
      w.officeAffinity[pairKey(a, b)] = Math.round((rel ? rel.affinity * 0.5 : 0) + rng.range(-20, 20));
    }
  // Quelques tensions de départ, plausibles
  w.officeAffinity[pairKey('judge', 'sheriff')] = -18;
  w.officeAffinity[pairKey('it_director', 'mayor')] = -12;
  w.officeAffinity[pairKey('mechanic_chief', 'mines_chief')] = 22;
  w.officeAffinity[pairKey('supply_chief', 'it_director')] = -25;
}

export const COUNCIL_COOLDOWN_DAYS = 2;

export function councilReadyIn(ctx: Ctx) {
  const c = ctx.w.council;
  if (!c) return 0;
  return Math.max(0, (c.tick + COUNCIL_COOLDOWN_DAYS * TICKS_PER_DAY - ctx.w.tick) / TICKS_PER_HOUR);
}

function stanceOf(ctx: Ctx, topic: TopicDef, officeId: OfficeId): ProposalDef {
  const h = holder(ctx.w, officeId)!;
  let best = topic.proposals[0];
  let bestScore = -Infinity;
  for (const p of topic.proposals) {
    let s = (p.support[officeId] ?? 0) * 2;
    for (const t of h.traits) for (const tag of p.tags) s += TRAIT_BIAS[t]?.[tag] ?? 0;
    // Un responsable loyal suit le maire ; un responsable méfiant s'en distingue.
    const mayorPick = p.support.mayor ?? 0;
    s += h.trust > 65 ? mayorPick * 0.4 : h.trust < 35 ? -mayorPick * 0.4 : 0;
    s += ctx.rng.range(-0.6, 0.6);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

export function convene(ctx: Ctx) {
  const { w } = ctx;
  if (councilReadyIn(ctx) > 0) return;
  const topic = [...TOPICS].sort((a, b) => b.urgency(ctx) - a.urgency(ctx))[0];
  const statements: CouncilSession['statements'] = [];
  for (const officeId of Object.keys(w.offices) as OfficeId[]) {
    if (!holder(w, officeId)) continue;
    const p = stanceOf(ctx, topic, officeId);
    const text = p.argue[officeId] ?? ((p.support[officeId] ?? 0) > 0 ? `Je soutiens : ${p.label.toLowerCase()}.` : `Je me range à : ${p.label.toLowerCase()}.`);
    statements.push({ officeId, proposalId: p.id, text });
  }
  w.council = {
    tick: w.tick,
    topic: topic.id,
    title: topic.title,
    summary: topic.summary(ctx),
    proposals: topic.proposals.map((p) => ({ id: p.id, label: p.label, hint: p.hint, effects: p.effects })),
    statements,
  };
  journal(w, `Conseil du silo réuni : ${topic.title.toLowerCase()}.`, 'info', 'admin');
}

export function councilChoice(ctx: Ctx, proposalId: string) {
  const { w } = ctx;
  const c = w.council;
  if (!c || c.resolved) return;
  const p = c.proposals.find((x) => x.id === proposalId);
  if (!p) return;
  c.resolved = proposalId;
  w.stats.councils = (w.stats.councils ?? 0) + 1;
  addTag(w, 'council_held');
  applyEffects(ctx, p.effects, {});
  for (const s of c.statements) {
    const h = holder(w, s.officeId);
    if (!h) continue;
    h.trust = clamp(h.trust + (s.proposalId === proposalId ? 6 : -5));
  }
  // Alliances : ceux qui ont défendu la même option se rapprochent.
  for (const a of c.statements)
    for (const b of c.statements) {
      if (a.officeId >= b.officeId) continue;
      const k = pairKey(a.officeId, b.officeId);
      w.officeAffinity[k] = clamp((w.officeAffinity[k] ?? 0) + (a.proposalId === b.proposalId ? 4 : -2), -100, 100);
    }
  w.psychology.legitimacy = clamp(w.psychology.legitimacy + 2);
  journal(w, `Le conseil tranche : ${p.label.toLowerCase()}.`, 'info', 'admin');
}

export function councilView(ctx: Ctx): CouncilView | undefined {
  const { w } = ctx;
  const c = w.council;
  if (!c) return undefined;
  const statements = c.statements
    .map((s) => {
      const h = holder(w, s.officeId);
      if (!h) return null;
      return { officeId: s.officeId, title: w.offices[s.officeId].title, name: fullName(h), portrait: h.portrait, sector: h.sector, look: h.look, proposalId: s.proposalId, text: s.text };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const pairs = Object.entries(w.officeAffinity)
    .map(([k, v]) => {
      const [a, b] = k.split('|') as OfficeId[];
      return { a: w.offices[a]?.title ?? a, b: w.offices[b]?.title ?? b, value: Math.round(v) };
    })
    .sort((x, y) => Math.abs(y.value) - Math.abs(x.value))
    .slice(0, 5);
  return {
    title: c.title,
    summary: c.summary,
    topic: c.topic,
    resolved: c.resolved,
    ageHours: (w.tick - c.tick) / TICKS_PER_HOUR,
    proposals: c.proposals.map((p) => ({
      id: p.id,
      label: p.label,
      hint: p.hint,
      backers: c.statements.filter((s) => s.proposalId === p.id).map((s) => s.officeId),
      opposers: [],
    })),
    statements,
    alliances: pairs,
  };
}
