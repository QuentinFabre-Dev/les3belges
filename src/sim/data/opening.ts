import type { Condition, Effect, OfficeId, OpeningSecret, SectorId, Trait } from '../types';

// Ouverture narrative : le joueur vient d'être nommé DSI du Silo 01. Son premier acte est de
// former la direction du silo. Chaque siège propose trois habitants tirés de la population,
// façonnés selon un archétype (statistiques, traits, biographie, défaut caché éventuel).
//
// Gabarits de texte : {first} prénom, {sector} secteur d'origine, {floor} étage de résidence,
// {masculin/féminin} accord selon le sexe du candidat.

export interface ArchetypeDef {
  key: string;
  label: string;
  sectors: SectorId[]; // viviers préférés (le premier qui a des candidats l'emporte)
  age: [number, number];
  skill: [number, number];
  leadership: [number, number];
  integrity: [number, number];
  popularity: [number, number];
  trust: [number, number]; // loyauté envers la DSI
  traits: Trait[];
  bio: string;
  file: string; // dossier de la DSI quand il n'y a rien à cacher (ou que rien n'a été trouvé)
  secret?: { kind: OpeningSecret; p: number; file: string; found: number }; // found : chance que le dossier le trahisse
  pledge?: { text: string; days: number; check: Condition };
  onSeat?: Effect[]; // conséquences immédiates de son installation
}

export interface SeatDef {
  officeId: OfficeId;
  mode: 'election' | 'appointment';
  role: string;
  weighs: string;
  keepIncumbent?: { archetype: ArchetypeDef }; // le titulaire sortant fait partie des choix
  archetypes: ArchetypeDef[];
}

/** Ce qui s'est passé avant l'arrivée du joueur. */
export const OPENING_STORY = {
  predecessor: 'Anselme Cort',
  paragraphs: [
    'Il y a neuf jours, Anselme Cort, directeur des systèmes d’information depuis trente et un ans, est tombé dans l’escalier entre le -03 et le -04. Personne n’a vu sa chute.',
    'La même semaine, la maire Ruth Jahns, malade, a rendu son écharpe. Le juge Aldous Meadows s’est retiré dans ses appartements. Et le shérif Holston Becker a prononcé les mots que nul ne retire : « Je veux sortir. »',
    'Cort vous avait choisi·e pour lui succéder. Ce matin, la clé du coffre est à votre cou. Le silo attend de savoir qui le gouvernera à visage découvert — et ne sait pas encore que c’est vous qui en déciderez.',
  ],
};

const ARCH_SUPPLY_INCUMBENT: ArchetypeDef = {
  key: 'incumbent',
  label: 'Le sortant',
  sectors: ['supplies'],
  age: [40, 60],
  skill: [64, 64],
  leadership: [45, 45],
  integrity: [34, 34],
  popularity: [40, 40],
  trust: [55, 55],
  traits: ['corruptible', 'pragmatic'],
  bio: '{first} Billings tient le dépôt depuis neuf ans. Il connaît chaque caisse — et chaque façon d’en faire disparaître une.',
  file: 'Écarts d’inventaire récurrents, toujours expliqués après coup.',
  secret: { kind: 'skims', p: 1, file: 'Écarts d’inventaire récurrents, toujours expliqués après coup.', found: 1 },
};

export const OPENING_SEATS: SeatDef[] = [
  {
    officeId: 'mayor',
    mode: 'election',
    role: 'Le visage du silo. Élu·e pour deux ans, le maire parle aux habitants, tient les promesses — ou les brise.',
    weighs: 'Crédibilité des annonces et des démentis, confiance envers la mairie, légitimité de votre gouvernement, avis au conseil.',
    archetypes: [
      {
        key: 'tribune',
        label: '{Le tribun/La tribune}',
        sectors: ['agriculture', 'supplies', 'sanitation'],
        age: [38, 56],
        skill: [56, 68],
        leadership: [72, 84],
        integrity: [42, 58],
        popularity: [70, 82],
        trust: [44, 56],
        traits: ['charismatic', 'ambitious'],
        bio: '{Contremaître/Contremaîtresse} aux {sector}, {first} a tenu tête au conseil pendant la grève de l’an 139. Dans les escaliers, on répète ses phrases ; à la mairie, on les note.',
        file: 'Aucune infraction. Beaucoup de visites tardives au bazar.',
        secret: { kind: 'relic', p: 0.45, file: 'Un terminal de son étage a ouvert trois fois un fichier d’avant la Fondation.', found: 0.6 },
        pledge: { text: 'La pompe principale remise en état sous 8 jours', days: 8, check: { metric: 'asset.pump_main.condition', op: '>=', value: 0.8 } },
        onSeat: [{ type: 'social', target: 'all', stat: 'morale', amount: 3 }],
      },
      {
        key: 'heir',
        label: '{L’héritier/L’héritière}',
        sectors: ['admin'],
        age: [44, 62],
        skill: [70, 80],
        leadership: [58, 68],
        integrity: [76, 88],
        popularity: [50, 60],
        trust: [72, 82],
        traits: ['calm', 'loyal'],
        bio: '{Second/Seconde} de Ruth Jahns pendant douze ans, {first} connaît chaque registre de la mairie. On {le/la} dit honnête jusqu’à l’ennui ; personne ne l’a jamais vu{/e} élever la voix.',
        file: 'Dossier irréprochable. Signe ce que la DSI lui présente, après l’avoir lu deux fois.',
        pledge: { text: 'Le conseil du silo réuni et une décision prise sous 4 jours', days: 4, check: { tag: 'council_held' } },
        onSeat: [{ type: 'social', target: 'all', stat: 'fear', amount: -3 }],
      },
      {
        key: 'depths',
        label: '{Le candidat/La candidate} des profondeurs',
        sectors: ['mines', 'mechanical'],
        age: [36, 54],
        skill: [60, 72],
        leadership: [64, 76],
        integrity: [62, 76],
        popularity: [60, 70],
        trust: [30, 42],
        traits: ['solidary', 'skeptical'],
        bio: '{Né/Née} au -27, {first} a sorti deux mineurs d’une galerie effondrée à mains nues. Les étages du bas voteront pour {lui/elle} comme on serre le poing.',
        file: 'Méfiant{/e} envers la DSI : a demandé deux fois l’accès aux registres des rations.',
        pledge: { text: 'Quota minier abaissé sous 6 jours', days: 6, check: { metric: 'policy.mineQuota', op: '<=', value: 0.9 } },
        onSeat: [
          { type: 'social', target: 'sector:mines', stat: 'grievance', amount: -10 },
          { type: 'social', target: 'sector:mechanical', stat: 'grievance', amount: -6 },
        ],
      },
    ],
  },
  {
    officeId: 'judge',
    mode: 'appointment',
    role: 'Interprète le Pacte et tranche les procès. Nommé·e par la DSI, inamovible sauf scandale.',
    weighs: 'Seuil de preuve des procès, confiance envers le judiciaire, docilité face aux verdicts que vous voudriez imposer.',
    archetypes: [
      {
        key: 'rigorous',
        label: '{Le rigoriste/La rigoriste}',
        sectors: ['admin', 'security'],
        age: [46, 66],
        skill: [76, 86],
        leadership: [50, 60],
        integrity: [82, 94],
        popularity: [40, 52],
        trust: [38, 48],
        traits: ['rigorous', 'skeptical'],
        bio: '{Greffier/Greffière} d’Aldous Meadows pendant vingt ans, {first} connaît le Pacte à la virgule près. {Il/Elle} ne condamne jamais sans preuve — et ne fait jamais de faveur.',
        file: 'Aucune tache. Refusera les verdicts dictés d’en haut.',
        onSeat: [{ type: 'office_legitimacy', officeId: 'judge', amount: 8 }],
      },
      {
        key: 'docile',
        label: '{Le fidèle/La fidèle}',
        sectors: ['admin', 'residential'],
        age: [40, 60],
        skill: [58, 68],
        leadership: [44, 54],
        integrity: [34, 46],
        popularity: [45, 55],
        trust: [82, 92],
        traits: ['loyal', 'pragmatic'],
        bio: 'Arbitre des litiges de voisinage au {floor}, {first} trouve un arrangement à tout. On dit qu’{il/elle} écoute toujours la DSI avant de parler.',
        file: 'Dossier propre. Plusieurs plaintes classées sans suite.',
        secret: { kind: 'complaisant', p: 0.6, file: 'Une famille du bazar se vante d’avoir « réglé » une affaire avec {lui/elle}.', found: 0.5 },
        onSeat: [{ type: 'office_legitimacy', officeId: 'judge', amount: -6 }],
      },
      {
        key: 'ambitious',
        label: '{L’ambitieux/L’ambitieuse}',
        sectors: ['admin', 'security', 'medical'],
        age: [32, 48],
        skill: [80, 90],
        leadership: [66, 76],
        integrity: [60, 72],
        popularity: [55, 65],
        trust: [48, 58],
        traits: ['ambitious', 'charismatic'],
        bio: 'Brillant{/e}, {first} a plaidé au tribunal à vingt-deux ans. {Il/Elle} parle du Pacte comme d’un texte vivant, ce qui inquiète les anciens.',
        file: 'Ambition affichée. Rien d’illégal.',
        secret: { kind: 'ambition', p: 0.85, file: 'A demandé l’accès aux archives scellées de la DSI. Deux fois.', found: 0.7 },
      },
    ],
  },
  {
    officeId: 'sheriff',
    mode: 'appointment',
    role: 'Commande les adjoints et fait respecter le Pacte. Porte l’étoile de Holston Becker.',
    weighs: 'Autorité, détection des factions, vols aux fournitures, légitimité perçue des arrestations, confiance envers la sécurité.',
    archetypes: [
      {
        key: 'veteran',
        label: '{Le vétéran/La vétérane}',
        sectors: ['security'],
        age: [40, 58],
        skill: [74, 84],
        leadership: [64, 74],
        integrity: [72, 86],
        popularity: [52, 62],
        trust: [60, 70],
        traits: ['loyal', 'calm'],
        bio: '{Adjoint/Adjointe} depuis dix-huit ans, {first} était aux côtés de Holston Becker la nuit où il a demandé à sortir. {Il/Elle} n’en parle jamais.',
        file: 'Fiable. Ses rapports concordent avec les capteurs.',
      },
      {
        key: 'iron',
        label: 'La main de fer',
        sectors: ['security'],
        age: [32, 50],
        skill: [80, 90],
        leadership: [70, 80],
        integrity: [38, 52],
        popularity: [30, 42],
        trust: [66, 76],
        traits: ['impulsive', 'rigorous'],
        bio: '{first} a éteint l’émeute du -24 en une nuit, sans un mort — officiellement. Les adjoints {le/la} suivent ; les habitants baissent les yeux.',
        file: 'Aucune plainte enregistrée.',
        secret: { kind: 'brutal', p: 0.65, file: 'Deux plaintes pour violence, retirées le lendemain.', found: 0.7 },
        onSeat: [
          { type: 'authority', amount: 6 },
          { type: 'social', target: 'all', stat: 'fear', amount: 3 },
        ],
      },
      {
        key: 'popular',
        label: '{Le favori/La favorite} des étages',
        sectors: ['security'],
        age: [28, 46],
        skill: [56, 66],
        leadership: [58, 68],
        integrity: [52, 66],
        popularity: [72, 82],
        trust: [50, 60],
        traits: ['charismatic', 'solidary'],
        bio: 'Tout le {floor} connaît {first} : {il/elle} règle les disputes au réfectoire avant qu’elles ne deviennent des dossiers. On l’aime. On lui doit des services.',
        file: 'Rien d’officiel.',
        secret: { kind: 'bribes', p: 0.45, file: 'Ses rondes passent souvent par le bazar à l’heure de la fermeture.', found: 0.5 },
        onSeat: [{ type: 'social', target: 'all', stat: 'trustSecurity', amount: 5 }],
      },
    ],
  },
  {
    officeId: 'supply_chief',
    mode: 'appointment',
    role: 'Tient le dépôt, les registres et la distribution. Le poste est libre de changer de mains — ou non.',
    weighs: 'Vols et écarts d’inventaire, fiabilité des rapports de stock, humeur du secteur des fournitures.',
    keepIncumbent: { archetype: ARCH_SUPPLY_INCUMBENT },
    archetypes: [
      {
        key: 'accountant',
        label: '{Le comptable/La comptable}',
        sectors: ['supplies'],
        age: [30, 58],
        skill: [52, 62],
        leadership: [44, 54],
        integrity: [82, 92],
        popularity: [36, 46],
        trust: [60, 70],
        traits: ['rigorous', 'calm'],
        bio: '{Magasinier/Magasinière} au dépôt, {first} recompte les caisses le soir, seul{/e}, pour le plaisir que les chiffres tombent juste.',
        file: 'Signale des écarts de stock depuis trois ans. Personne n’a répondu.',
        onSeat: [{ type: 'tag', tag: 'supply_controls', days: 20 }],
      },
      {
        key: 'fixer',
        label: '{Le débrouillard/La débrouillarde}',
        sectors: ['supplies'],
        age: [30, 52],
        skill: [76, 86],
        leadership: [60, 70],
        integrity: [46, 58],
        popularity: [54, 64],
        trust: [52, 62],
        traits: ['pragmatic', 'individualistic'],
        bio: '{first} trouve toujours une pièce quand il n’y en a plus. Personne ne lui demande où.',
        file: 'Connaît tout le monde au bazar. Trop, peut-être.',
        onSeat: [{ type: 'resource', resource: 'parts', amount: 12 }],
      },
    ],
  },
];

/** Libellés lisibles des défauts cachés (pour les tests et le debug). */
export const SECRET_LABELS: Record<OpeningSecret, string> = {
  bribes: 'Ferme les yeux contre des services',
  brutal: 'Violent',
  ambition: 'Convoite les archives de la DSI',
  relic: 'Détient une relique',
  complaisant: 'Juge complaisant',
  skims: 'Détourne des fournitures',
};

/** Accord en genre : « {Né/Née} » → « Né » ou « Née ». */
export function genderize(text: string, sex: 'f' | 'm') {
  return text.replace(/\{([^{}/]*)\/([^{}/]*)\}/g, (_, m: string, f: string) => (sex === 'f' ? f : m));
}
