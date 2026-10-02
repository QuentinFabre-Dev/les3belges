import type { OfficeId, RoomTexture, SectorId, Trait } from '../types';

export const TICK_MINUTES = 10;
export const TICKS_PER_HOUR = 60 / TICK_MINUTES;
export const TICKS_PER_DAY = 24 * TICKS_PER_HOUR;
export const START_HOUR = 6;

export interface FloorDef {
  id: string;
  label: string;
  name: string;
  sector: SectorId;
  left: RoomTexture;
  right: RoomTexture;
  capacity: number; // places résidentielles
  basePower: number; // demande énergétique (kW)
  cafeteria?: 'main' | 'relay'; // réfectoire : 'main' = grand écran sur l'extérieur, 'relay' = écran relais
}

// Le silo : 14 étages, du haut vers le bas. Une cafétéria environ tous les 8 étages
// (on visera une tous les 10 étages quand le silo s'agrandira).
export const FLOORS: FloorDef[] = [
  { id: 'cafeteria', label: '-01', name: 'Grand réfectoire', sector: 'residential', left: 'cafe_main', right: 'cafe_main', capacity: 40, basePower: 30, cafeteria: 'main' },
  { id: 'admin', label: '-02', name: 'Administration', sector: 'admin', left: 'admin', right: 'servers', capacity: 50, basePower: 40 },
  { id: 'security', label: '-03', name: 'Sécurité & justice', sector: 'security', left: 'security', right: 'court', capacity: 50, basePower: 20 },
  { id: 'res_high', label: '-04', name: 'Résidentiel haut', sector: 'residential', left: 'residential', right: 'residential', capacity: 260, basePower: 25 },
  { id: 'agriculture', label: '-05', name: 'Agriculture', sector: 'agriculture', left: 'hydroponics', right: 'hydroponics', capacity: 60, basePower: 70 },
  { id: 'res_mid', label: '-06', name: 'Résidentiel', sector: 'residential', left: 'residential', right: 'residential', capacity: 280, basePower: 30 },
  { id: 'medical', label: '-07', name: 'Médical', sector: 'medical', left: 'medical', right: 'medical', capacity: 50, basePower: 35 },
  { id: 'mechanical', label: '-08', name: 'Mécanique', sector: 'mechanical', left: 'workshop', right: 'workshop', capacity: 80, basePower: 45 },
  { id: 'cafeteria_mid', label: '-09', name: 'Cafétéria des profondeurs', sector: 'residential', left: 'cafe_mid', right: 'residential', capacity: 150, basePower: 25, cafeteria: 'relay' },
  { id: 'water', label: '-10', name: 'Eau', sector: 'water', left: 'water', right: 'water', capacity: 40, basePower: 55 },
  { id: 'energy', label: '-11', name: 'Énergie', sector: 'energy', left: 'generator', right: 'generator', capacity: 40, basePower: 15 },
  { id: 'supplies', label: '-12', name: 'Fournitures', sector: 'supplies', left: 'depot', right: 'depot', capacity: 60, basePower: 15 },
  { id: 'res_low', label: '-13', name: 'Résidentiel bas', sector: 'residential', left: 'residential', right: 'canteen', capacity: 300, basePower: 25 },
  { id: 'mines', label: '-14', name: 'Mines', sector: 'mines', left: 'mine', right: 'mine', capacity: 50, basePower: 40 },
];

export const CAFETERIAS = FLOORS.filter((f) => f.cafeteria).map((f) => f.id);

export const SECTOR_NAMES: Record<SectorId, string> = {
  admin: 'Administration & DSI',
  security: 'Sécurité',
  agriculture: 'Agriculture',
  medical: 'Médical',
  mechanical: 'Mécanique',
  water: 'Eau',
  energy: 'Énergie',
  supplies: 'Fournitures',
  mines: 'Mines',
  sanitation: 'Salubrité',
  residential: 'Sans affectation',
};

// Effectifs cibles initiaux par secteur.
export const STAFFING: Record<SectorId, number> = {
  admin: 45,
  security: 28,
  agriculture: 150,
  medical: 40,
  mechanical: 80,
  water: 50,
  energy: 40,
  supplies: 55,
  mines: 90,
  sanitation: 45,
  residential: 0,
};

export const COHESION: Record<SectorId, number> = {
  admin: 0.45,
  security: 0.7,
  agriculture: 0.6,
  medical: 0.55,
  mechanical: 0.88,
  water: 0.62,
  energy: 0.7,
  supplies: 0.5,
  mines: 0.92,
  sanitation: 0.55,
  residential: 0.4,
};

export const SECTOR_FLOOR: Record<SectorId, string> = {
  admin: 'admin',
  security: 'security',
  agriculture: 'agriculture',
  medical: 'medical',
  mechanical: 'mechanical',
  water: 'water',
  energy: 'energy',
  supplies: 'supplies',
  mines: 'mines',
  sanitation: 'res_low',
  residential: 'res_mid',
};

export interface OfficeDef {
  id: OfficeId;
  title: string;
  sector?: SectorId;
  succession: 'election' | 'appointment';
  portrait: string;
}

export const OFFICES: OfficeDef[] = [
  { id: 'mayor', title: 'Maire', sector: 'admin', succession: 'election', portrait: 'mayor' },
  { id: 'judge', title: 'Juge', sector: 'admin', succession: 'appointment', portrait: 'judge' },
  { id: 'sheriff', title: 'Shérif', sector: 'security', succession: 'appointment', portrait: 'sheriff' },
  { id: 'it_director', title: 'Directrice DSI', sector: 'admin', succession: 'appointment', portrait: 'it' },
  { id: 'mechanic_chief', title: 'Chef mécanique', sector: 'mechanical', succession: 'appointment', portrait: 'mechanic' },
  { id: 'mines_chief', title: 'Responsable des mines', sector: 'mines', succession: 'appointment', portrait: 'miner' },
  { id: 'medical_chief', title: 'Responsable médicale', sector: 'medical', succession: 'appointment', portrait: 'doctor' },
  { id: 'agri_chief', title: 'Responsable agriculture', sector: 'agriculture', succession: 'appointment', portrait: 'farmer' },
  { id: 'supply_chief', title: 'Responsable fournitures', sector: 'supplies', succession: 'appointment', portrait: 'supply' },
];

// Titulaires initiaux (identités fixes pour coller aux portraits).
export const OFFICE_HOLDERS: Record<OfficeId, { first: string; last: string; sex: 'f' | 'm'; age: number; skill: number; leadership: number; integrity: number; popularity: number; traits: Trait[] }> = {
  mayor: { first: 'Ruth', last: 'Jahns', sex: 'f', age: 67, skill: 74, leadership: 81, integrity: 78, popularity: 72, traits: ['calm', 'charismatic'] },
  judge: { first: 'Aldous', last: 'Meadows', sex: 'm', age: 71, skill: 80, leadership: 55, integrity: 70, popularity: 48, traits: ['rigorous', 'skeptical'] },
  sheriff: { first: 'Holston', last: 'Becker', sex: 'm', age: 44, skill: 76, leadership: 70, integrity: 82, popularity: 64, traits: ['loyal', 'pragmatic'] },
  it_director: { first: 'Lena', last: 'Sims', sex: 'f', age: 34, skill: 88, leadership: 52, integrity: 44, popularity: 38, traits: ['ambitious', 'rigorous'] },
  mechanic_chief: { first: 'Walker', last: 'Nichols', sex: 'm', age: 52, skill: 93, leadership: 38, integrity: 85, popularity: 79, traits: ['solidary', 'skeptical'] },
  mines_chief: { first: 'Paul', last: 'Knox', sex: 'm', age: 48, skill: 71, leadership: 66, integrity: 55, popularity: 61, traits: ['pragmatic', 'impulsive'] },
  medical_chief: { first: 'Elena', last: 'Voss', sex: 'f', age: 41, skill: 82, leadership: 64, integrity: 72, popularity: 71, traits: ['altruistic', 'ambitious'] },
  agri_chief: { first: 'Gavin', last: 'Hale', sex: 'm', age: 55, skill: 68, leadership: 58, integrity: 66, popularity: 57, traits: ['calm', 'loyal'] },
  supply_chief: { first: 'Rick', last: 'Billings', sex: 'm', age: 46, skill: 64, leadership: 45, integrity: 34, popularity: 40, traits: ['corruptible', 'pragmatic'] },
};

export const FIRST_F = ['Juliette', 'Mara', 'Ada', 'Lucie', 'Nora', 'Camille', 'Inès', 'Sara', 'Léa', 'Alma', 'Rose', 'Zoé', 'Irène', 'Agnès', 'Hélène', 'Martha', 'Gloria', 'Elsa', 'Judith', 'Anna', 'Clara', 'Maud', 'Odile', 'Pia', 'Vera', 'Louise', 'Margot', 'Salomé', 'Yara', 'Lina'];
export const FIRST_M = ['Elias', 'Lukas', 'Jonas', 'Marc', 'Hugo', 'Victor', 'Bernard', 'Samuel', 'Noé', 'Oscar', 'Félix', 'Paul', 'Simon', 'Tomas', 'Gabriel', 'Raoul', 'Henri', 'Joseph', 'Malo', 'Ilan', 'Abel', 'Basile', 'Corentin', 'Damien', 'Émile', 'Gustave', 'Jules', 'Léon', 'Milan', 'Pierre'];
export const LAST = ['Moreau', 'Jensen', 'Nichols', 'Holt', 'Lacroix', 'Wren', 'Fontaine', 'Krüger', 'Dumas', 'Varga', 'Ortiz', 'Blanc', 'Novak', 'Petit', 'Marchand', 'Rousseau', 'Weiss', 'Lambert', 'Garnier', 'Roux', 'Faure', 'Mercier', 'Boyer', 'Dupuis', 'Renard', 'Carlsen', 'Hayes', 'Brandt', 'Ibarra', 'Collins', 'Okafor', 'Lindqvist', 'Mendes', 'Serra', 'Valette', 'Perrin'];

export const TRAITS: Trait[] = ['loyal', 'skeptical', 'pragmatic', 'altruistic', 'ambitious', 'impulsive', 'calm', 'solidary', 'individualistic', 'corruptible', 'rigorous', 'charismatic'];

export const TRAIT_LABELS: Record<Trait, string> = {
  loyal: 'Loyal',
  skeptical: 'Méfiant',
  pragmatic: 'Pragmatique',
  altruistic: 'Altruiste',
  ambitious: 'Ambitieux',
  impulsive: 'Impulsif',
  calm: 'Calme',
  solidary: 'Solidaire',
  individualistic: 'Individualiste',
  corruptible: 'Corruptible',
  rigorous: 'Rigoureux',
  charismatic: 'Charismatique',
};

export const POPULATION_START = 1400;
