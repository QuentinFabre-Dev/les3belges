import type { Condition, Effect } from '../types';

// Objectifs guidés : après le tutoriel, une courte suite d'étapes concrètes pour savoir par où commencer.
// Chaque objectif est une condition data-driven (mêmes métriques et tags que les événements).

export interface ObjectiveDef {
  id: string;
  title: string;
  hint: string;
  check: Condition;
  reward: Effect[];
  rewardLabel: string;
  view?: string; // panneau à ouvrir au clic
}

export interface ChapterDef {
  id: string;
  title: string;
  intro: string;
  objectives: ObjectiveDef[];
  reward: Effect[];
  outro: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch1',
    title: 'Chapitre 1 — Prendre ses fonctions',
    intro: 'Cort tenait une liste pour ses premiers jours. Elle tient sur une fiche cartonnée.',
    outro: 'Le silo a appris votre nom. Il ne vous aime pas encore, mais il vous écoute.',
    reward: [
      { type: 'legitimacy', amount: 4 },
      { type: 'social', target: 'all', stat: 'trust', amount: 2 },
    ],
    objectives: [
      {
        id: 'investiture',
        title: 'Former la direction du silo',
        hint: 'Maire, juge, shérif : l’investiture est scellée.',
        check: { tag: 'opening_done' },
        reward: [],
        rewardLabel: '',
        view: 'institutions',
      },
      {
        id: 'first_decision',
        title: 'Trancher une première décision',
        hint: 'Les décisions s’affichent à droite. Lisez les avis : ils ne sont pas d’accord.',
        check: { metric: 'count.decisions', op: '>=', value: 1 },
        reward: [{ type: 'authority', amount: 2 }],
        rewardLabel: 'Autorité +2',
        view: 'decisions',
      },
      {
        id: 'council',
        title: 'Réunir le premier conseil et trancher',
        hint: 'Menu Conseil : écoutez vos responsables, puis choisissez une proposition.',
        check: { tag: 'council_held' },
        reward: [{ type: 'office_legitimacy', officeId: 'mayor', amount: 4 }],
        rewardLabel: 'Légitimité du maire +4',
        view: 'council',
      },
      {
        id: 'audit',
        title: 'Ouvrir un audit',
        hint: 'Politiques → Audits. Les registres mentent : seul un audit révèle les stocks réels.',
        check: { tag: 'audit_done' },
        reward: [{ type: 'legitimacy', amount: 2 }],
        rewardLabel: 'Légitimité +2',
        view: 'policies',
      },
      {
        id: 'patrol',
        title: 'Poster des adjoints sur un étage',
        hint: 'Fiche d’un étage → Patrouilles d’adjoints. Choisissez un étage où la colère monte.',
        check: { metric: 'patrols.used', op: '>=', value: 1 },
        reward: [{ type: 'office_legitimacy', officeId: 'sheriff', amount: 4 }],
        rewardLabel: 'Légitimité du shérif +4',
        view: 'floors',
      },
      {
        id: 'campaign',
        title: 'Tenir la promesse de campagne du maire',
        hint: 'Voir le journal : le maire a promis quelque chose aux étages. À vous de le rendre possible.',
        check: { tag: 'campaign_kept' },
        reward: [{ type: 'social', target: 'all', stat: 'trust', amount: 3 }],
        rewardLabel: 'Confiance +3',
        view: 'journal',
      },
      {
        id: 'first_week',
        title: 'Passer la première semaine debout',
        hint: 'Atteindre le jour 8 avec une stabilité d’au moins 45.',
        check: { all: [{ metric: 'day', op: '>=', value: 8 }, { metric: 'stability', op: '>=', value: 45 }] },
        reward: [{ type: 'legitimacy', amount: 3 }],
        rewardLabel: 'Légitimité +3',
      },
    ],
  },
  {
    id: 'ch2',
    title: 'Chapitre 2 — Tenir l’an 142',
    intro: 'La liste de Cort s’arrête là. La suite, c’est à vous de l’écrire.',
    outro: 'Le Jour de la Fondation est passé. Le silo tient — pour l’instant.',
    reward: [{ type: 'legitimacy', amount: 5 }],
    objectives: [
      {
        id: 'generator',
        title: 'Remettre la génératrice à plus de 85 %',
        hint: 'Infrastructure → Focus de maintenance sur la génératrice, avec assez de pièces.',
        check: { metric: 'asset.generator.condition', op: '>=', value: 0.85 },
        reward: [{ type: 'social', target: 'all', stat: 'fear', amount: -3 }],
        rewardLabel: 'Peur −3',
        view: 'infrastructure',
      },
      {
        id: 'mayor_trust',
        title: 'Une mairie crédible',
        hint: 'Confiance envers la mairie d’au moins 60 (Opinion). Les promesses tenues comptent.',
        check: { metric: 'inst.mayor', op: '>=', value: 60 },
        reward: [{ type: 'office_legitimacy', officeId: 'mayor', amount: 5 }],
        rewardLabel: 'Légitimité du maire +5',
        view: 'opinion',
      },
      {
        id: 'second_council',
        title: 'Gouverner avec le conseil',
        hint: 'Réunir le conseil et trancher trois fois au total.',
        check: { metric: 'count.councils', op: '>=', value: 3 },
        reward: [{ type: 'authority', amount: 3 }],
        rewardLabel: 'Autorité +3',
        view: 'council',
      },
      {
        id: 'foundation',
        title: 'Atteindre le Jour de la Fondation',
        hint: 'Tenir jusqu’au jour 49 : le bilan de l’an 142 vous attend.',
        check: { metric: 'day', op: '>=', value: 49 },
        reward: [],
        rewardLabel: '',
      },
    ],
  },
];
