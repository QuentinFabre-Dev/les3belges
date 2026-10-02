// Génération procédurale des sprites d'habitants (pixel art 12×24) dans un atlas unique :
// une seule texture GPU pour tous les PNJ = un seul draw call batché.

import type { SectorId } from '../sim/types';

export const CHAR_W = 12;
export const CHAR_H = 24;

export const FRAMES = {
  idle: [0, 1],
  walk: [2, 3, 4, 5],
  work: [6, 7],
  carry: [8, 9, 10, 11],
  repair: [12, 13],
  sit: [14],
  talk: [15],
} as const;
export type Anim = keyof typeof FRAMES;
export const FRAME_COUNT = 16;

// Tenues inspirées de la série : chaque secteur a sa couleur.
export const OUTFITS: Record<SectorId, string> = {
  mechanical: '#2f4a7a',
  admin: '#8a929c',
  agriculture: '#4f7a3a',
  medical: '#d9dde0',
  security: '#6b5236',
  supplies: '#b5793a',
  mines: '#3f4247',
  water: '#2f7a78',
  energy: '#b39a2e',
  sanitation: '#c25a2b',
  residential: '#7a5a4a',
};
const RESIDENT_TONES = ['#7a5a4a', '#5d5f6e', '#7b3f43', '#55654a', '#6d6253', '#4a5568'];
export const SECTOR_ORDER = Object.keys(OUTFITS) as SectorId[];

const SKINS = ['#f1c9a5', '#d9a47c', '#b07850', '#7a4f33'];
const HAIRS = ['#2a1d14', '#5a3a1e', '#9a6a32', '#c9b27a', '#8a8a8a', '#3a2f2a'];
export const VARIANTS_PER_SECTOR = 8;

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export interface Look {
  outfit: string;
  skin: string;
  hair: string;
  longHair: boolean;
  helmet: boolean;
}

export function lookFor(sector: SectorId, variant: number): Look {
  const v = Math.abs(variant);
  const outfit = sector === 'residential' ? RESIDENT_TONES[v % RESIDENT_TONES.length] : OUTFITS[sector];
  return {
    outfit,
    skin: SKINS[(v >> 1) % SKINS.length],
    hair: HAIRS[(v >> 2) % HAIRS.length],
    longHair: v % 3 === 0,
    helmet: sector === 'mines' && v % 2 === 0,
  };
}

// Dessine une frame dans un buffer 12×24 puis ajoute un contour sombre.
export function drawFrame(ctx: CanvasRenderingContext2D, ox: number, oy: number, look: Look, frame: number) {
  const px: (string | null)[][] = Array.from({ length: CHAR_H }, () => Array(CHAR_W).fill(null));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < CHAR_W && y >= 0 && y < CHAR_H) px[y][x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
  };

  const outfit = look.outfit;
  const dark = shade(outfit, 0.68);
  const light = shade(outfit, 1.18);
  const pants = shade(outfit, 0.55);
  const shoe = '#1b1b1d';
  const skinS = shade(look.skin, 0.82);

  const sit = frame === 14;
  const bob = frame === 1 || frame === 3 || frame === 5 || frame === 9 || frame === 11 ? 1 : 0;
  const top = (sit ? 3 : 0) + bob;

  // Jambes
  if (sit) {
    rect(4, 16 + 2, 6, 2, pants);
    rect(8, 20, 2, 3, pants);
    rect(9, 23, 2, 1, shoe);
    rect(3, 16, 2, 4, pants);
  } else {
    let back = 0;
    let front = 0;
    let liftB = 0;
    let liftF = 0;
    const walkFrame = frame >= 2 && frame <= 5 ? frame - 2 : frame >= 8 && frame <= 11 ? frame - 8 : -1;
    if (walkFrame === 0) [back, front] = [-1, 1];
    if (walkFrame === 1) [liftB] = [1];
    if (walkFrame === 2) [back, front] = [1, -1];
    if (walkFrame === 3) [liftF] = [1];
    rect(4 + back, 16, 2, 7 - liftB, pants);
    rect(4 + back, 23 - liftB, 3, 1, shoe);
    rect(6 + front, 16, 2, 7 - liftF, shade(pants, 1.15));
    rect(6 + front, 23 - liftF, 3, 1, shoe);
  }

  // Torse
  rect(3, 9 + top, 6, 7, outfit);
  rect(3, 9 + top, 1, 7, dark);
  rect(8, 10 + top, 1, 5, light);
  rect(3, 14 + top, 6, 1, dark); // ceinture
  if (look.outfit === OUTFITS.medical) rect(5, 10 + top, 1, 4, '#9aa3ab');
  if (look.outfit === OUTFITS.security) set(7, 11 + top, '#d8c25a'); // étoile

  // Tête
  rect(5, 8 + top, 2, 1, skinS); // cou
  rect(4, 2 + top, 5, 6, look.skin);
  rect(4, 7 + top, 5, 1, skinS);
  set(7, 4 + top, '#1a1410'); // œil (profil droit)
  set(8, 5 + top, skinS); // nez
  // Cheveux / casque
  if (look.helmet) {
    rect(3, 1 + top, 7, 2, '#c9a227');
    set(9, 2 + top, '#fff2a0');
  } else {
    rect(4, 1 + top, 5, 1, look.hair);
    rect(3, 2 + top, 5, 1, look.hair);
    rect(3, 3 + top, 2, 2, look.hair);
    if (look.longHair) rect(3, 5 + top, 2, 4, look.hair);
  }

  // Bras selon la pose
  const arm = (x: number, y: number, h: number) => {
    rect(x, y + top, 2, h, light);
    rect(x, y + top + h, 2, 1, look.skin);
  };
  if (frame === 6 || frame === 7) {
    // travail : bras tendu vers l'avant (établi, terminal)
    rect(6, 11 + top, 4, 2, light);
    rect(10, 11 + top + (frame === 7 ? 1 : 0), 1, 2, look.skin);
  } else if (frame >= 8 && frame <= 11) {
    // porte une caisse
    rect(7, 10 + top, 5, 5, '#8a5a2b');
    rect(7, 10 + top, 5, 1, '#b07a3e');
    rect(6, 12 + top, 2, 2, look.skin);
  } else if (frame === 12 || frame === 13) {
    // répare : bras levé avec un outil
    rect(7, 6 + top + (frame === 13 ? 1 : 0), 2, 4, light);
    rect(8, 5 + top + (frame === 13 ? 1 : 0), 1, 1, look.skin);
    rect(8, 2 + top + (frame === 13 ? 1 : 0), 2, 3, '#a8adb3');
  } else if (frame === 15) {
    rect(6, 9 + top, 2, 3, light);
    rect(8, 8 + top, 1, 2, look.skin);
  } else if (sit) {
    arm(6, 10, 4);
  } else {
    const swing = frame === 2 ? 1 : frame === 4 ? -1 : 0;
    arm(5 + swing, 10, 4);
  }

  // Contour
  const out: (string | null)[][] = px.map((r) => r.slice());
  for (let y = 0; y < CHAR_H; y++)
    for (let x = 0; x < CHAR_W; x++) {
      if (px[y][x]) continue;
      const n = (px[y - 1]?.[x] ?? null) || (px[y + 1]?.[x] ?? null) || px[y][x - 1] || px[y][x + 1];
      if (n) out[y][x] = 'rgba(12,10,9,0.85)';
    }
  for (let y = 0; y < CHAR_H; y++)
    for (let x = 0; x < CHAR_W; x++) {
      const c = out[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
}

// Atlas : une ligne par (secteur, variante), une colonne par frame.
export function buildCitizenAtlas(): HTMLCanvasElement {
  const rows = SECTOR_ORDER.length * VARIANTS_PER_SECTOR;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_COUNT * CHAR_W;
  canvas.height = rows * CHAR_H;
  const ctx = canvas.getContext('2d')!;
  SECTOR_ORDER.forEach((sector, si) => {
    for (let v = 0; v < VARIANTS_PER_SECTOR; v++) {
      const look = lookFor(sector, v * 7 + si);
      const row = si * VARIANTS_PER_SECTOR + v;
      for (let f = 0; f < FRAME_COUNT; f++) drawFrame(ctx, f * CHAR_W, row * CHAR_H, look, f);
    }
  });
  return canvas;
}

export const atlasRow = (sector: SectorId, variant: number) => SECTOR_ORDER.indexOf(sector) * VARIANTS_PER_SECTOR + (Math.abs(variant) % VARIANTS_PER_SECTOR);
export const atlasLook = (sector: SectorId, variant: number) => lookFor(sector, (Math.abs(variant) % VARIANTS_PER_SECTOR) * 7 + SECTOR_ORDER.indexOf(sector));
