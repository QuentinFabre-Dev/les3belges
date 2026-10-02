import type { Difficulty, WorldState } from '../types';

// §198 — La difficulté ne se résume pas aux pénuries : elle joue sur l'information,
// la fiabilité des responsables, la vitesse des rumeurs, la tolérance et la mémoire sociale.
export interface DifficultyDef {
  label: string;
  summary: string;
  clauses: string[];
  info: number; // décalage de fiabilité des données
  managerBias: number; // tendance des responsables d'étage à minimiser
  rumorSpeed: number;
  tolerance: number; // multiplicateur des gains de rancœur/colère
  memoryDecay: number; // part de la mémoire collective effacée chaque année
  politicalSpeed: number; // vitesse de structuration des factions
  mandateYears: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  accessible: {
    label: 'Accessible',
    summary: 'Le silo vous fait confiance et vous voit clair.',
    clauses: ['Données plus fiables', 'Responsables plus francs', 'Rumeurs plus lentes', 'Population plus tolérante', 'Mandat de 3 ans'],
    info: 0.14,
    managerBias: 0.5,
    rumorSpeed: 0.65,
    tolerance: 0.8,
    memoryDecay: 0.5,
    politicalSpeed: 0.8,
    mandateYears: 3,
  },
  standard: {
    label: 'Standard',
    summary: 'L’équilibre voulu par le Pacte.',
    clauses: ['Information imparfaite', 'Responsables humains', 'Mémoire collective ordinaire', 'Mandat de 4 ans'],
    info: 0,
    managerBias: 1,
    rumorSpeed: 1,
    tolerance: 1,
    memoryDecay: 0.3,
    politicalSpeed: 1,
    mandateYears: 4,
  },
  hard: {
    label: 'Difficile',
    summary: 'Le silo se souvient de tout et ne dit pas tout.',
    clauses: ['Information très imparfaite', 'Responsables imprévisibles', 'Mémoire sociale longue', 'Crises politiques rapides', 'Mandat de 5 ans'],
    info: -0.1,
    managerBias: 1.5,
    rumorSpeed: 1.3,
    tolerance: 1.12,
    memoryDecay: 0.12,
    politicalSpeed: 1.25,
    mandateYears: 5,
  },
};

export const diff = (w: WorldState) => DIFFICULTY[w.difficulty ?? 'standard'];
