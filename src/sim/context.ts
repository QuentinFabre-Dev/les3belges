import type { Rng } from './rng';
import type { SectorId, WorldState } from './types';

// Données dérivées recalculées à chaque heure de jeu (jamais sauvegardées).
export interface Ctx {
  w: WorldState;
  rng: Rng;
  staff: Record<SectorId, number>;
  children: number;
  adults: number;
  population: number;
  sick: number;
  waterSupplyRatio: number;
  presence: Record<string, { present: number; work: number; walk: number; eat: number; sleep: number; leisure: number }>;
  infoAccuracy: number;
  scheduled: { id: string; data: { floor?: string; assetId?: string; subjectId?: number } }[]; // événements à déclencher immédiatement
}
