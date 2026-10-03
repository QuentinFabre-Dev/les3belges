// Textures procédurales du décor (cage d'escalier, dalles, roche) : dessinées une fois sur canvas.

export const ROOM_W = 256;
export const ROOM_H = 104;
export const SHAFT_W = 72;
export const SLAB_H = 10;
export const FLOOR_H = ROOM_H + SLAB_H;
export const SILO_W = ROOM_W * 2 + SHAFT_W;
export const WALL_W = 16;
export const FEET_Y = ROOM_H - 5; // ligne de marche dans une salle
export const SHAFT_X = ROOM_W;
export const LANDING_X = ROOM_W + SHAFT_W / 2;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Cage d'escalier : un segment d'escalier en colimaçon par étage (sens alterné).
/** `bare` : sans fond ni parois, pour poser l'escalier devant une vue en profondeur. */
export function shaftCanvas(flip: boolean, bare = false) {
  const { c, ctx } = canvas(SHAFT_W, FLOOR_H);
  if (!bare) {
    ctx.fillStyle = '#121519';
    ctx.fillRect(0, 0, SHAFT_W, FLOOR_H);
  }
  // parois
  for (let y = 0; y < FLOOR_H; y += 2) {
    ctx.fillStyle = hash(1, y) > 0.5 ? '#1a1e23' : '#171a1f';
    ctx.fillRect(0, y, 3, 2);
    ctx.fillRect(SHAFT_W - 3, y, 3, 2);
  }
  // pilier central
  ctx.fillStyle = '#2a2e33';
  ctx.fillRect(31, 0, 10, FLOOR_H);
  ctx.fillStyle = '#353a40';
  ctx.fillRect(32, 0, 2, FLOOR_H);
  ctx.fillStyle = '#1e2125';
  ctx.fillRect(39, 0, 2, FLOOR_H);
  // rail d'ascenseur
  ctx.fillStyle = '#23272c';
  ctx.fillRect(60, 0, 2, FLOOR_H);
  ctx.fillRect(69, 0, 2, FLOOR_H);
  ctx.fillStyle = '#4a4f55';
  ctx.fillRect(65, 0, 1, FLOOR_H);
  // marches
  const steps = 13;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const x = flip ? 52 - t * 46 : 6 + t * 46;
    const y = 4 + t * (ROOM_H - 12);
    ctx.fillStyle = '#5c6066';
    ctx.fillRect(Math.round(x) - 4, Math.round(y), 9, 2);
    ctx.fillStyle = '#2b2e32';
    ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 9, 2);
    // rampe
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 7, 1, 7);
  }
  ctx.strokeStyle = '#a07a40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(flip ? 52 : 6, -3);
  ctx.lineTo(flip ? 6 : 52, ROOM_H - 15);
  ctx.stroke();
  // palier
  ctx.fillStyle = '#3d4146';
  ctx.fillRect(0, ROOM_H - 6, SHAFT_W, 6);
  ctx.fillStyle = '#50555b';
  ctx.fillRect(0, ROOM_H - 6, SHAFT_W, 1);
  // lampe de palier
  ctx.fillStyle = 'rgba(255,190,90,0.18)';
  ctx.fillRect(22, 6, 28, 10);
  ctx.fillStyle = '#ffcf7a';
  ctx.fillRect(35, 7, 3, 2);
  // dalle
  slab(ctx, 0, ROOM_H, SHAFT_W);
  return c;
}

function slab(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number) {
  ctx.fillStyle = '#34373c';
  ctx.fillRect(x0, y0, w, SLAB_H);
  ctx.fillStyle = '#4a4e54';
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillStyle = '#1d1f22';
  ctx.fillRect(x0, y0 + SLAB_H - 2, w, 2);
  for (let x = 4; x < w; x += 24) {
    ctx.fillStyle = '#5a5e64';
    ctx.fillRect(x0 + x, y0 + 4, 1, 1);
  }
}

export function slabCanvas(w: number) {
  const { c, ctx } = canvas(w, SLAB_H);
  slab(ctx, 0, 0, w);
  // gaines techniques
  for (let x = 30; x < w; x += 140) {
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(x, 3, 40, 3);
    ctx.fillStyle = '#8a5f3a';
    ctx.fillRect(x, 3, 40, 1);
  }
  return c;
}

export function wallCanvas(left: boolean) {
  const { c, ctx } = canvas(WALL_W, FLOOR_H);
  for (let y = 0; y < FLOOR_H; y++)
    for (let x = 0; x < WALL_W; x++) {
      const n = hash(x + (left ? 0 : 50), y);
      const v = 40 + Math.floor(n * 10) + (left ? x : WALL_W - x);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 1, 1);
    }
  // conduite verticale
  const px = left ? 4 : WALL_W - 8;
  ctx.fillStyle = '#5b3b26';
  ctx.fillRect(px, 0, 4, FLOOR_H);
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(px, 0, 1, FLOOR_H);
  ctx.fillStyle = '#2a2d31';
  ctx.fillRect(px - 1, 30, 6, 3);
  ctx.fillRect(px - 1, 100, 6, 3);
  return c;
}

export function rockCanvas() {
  const size = 128;
  const { c, ctx } = canvas(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = hash(Math.floor(x / 4), Math.floor(y / 4)) * 0.6 + hash(x, y) * 0.4;
      const v = 18 + Math.floor(n * 14);
      ctx.fillStyle = `rgb(${v + 3},${v + 1},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  // quelques fissures
  ctx.fillStyle = '#0c0b0a';
  for (let i = 0; i < 9; i++) {
    let x = Math.floor(hash(i, 3) * size);
    let y = Math.floor(hash(3, i) * size);
    for (let k = 0; k < 14; k++) {
      ctx.fillRect(x, y, 1, 1);
      x = (x + (hash(i, k) > 0.5 ? 1 : 0) + size) % size;
      y = (y + 1) % size;
    }
  }
  return c;
}

export function bubbleCanvas() {
  const { c, ctx } = canvas(9, 7);
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(1, 0, 7, 5);
  ctx.fillRect(0, 1, 9, 3);
  ctx.fillRect(2, 5, 2, 1);
  ctx.fillRect(2, 6, 1, 1);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(4, 2, 1, 1);
  ctx.fillRect(6, 2, 1, 1);
  return c;
}

export function alertBubbleCanvas() {
  const { c, ctx } = canvas(9, 7);
  ctx.fillStyle = '#e04a3a';
  ctx.fillRect(1, 0, 7, 5);
  ctx.fillRect(0, 1, 9, 3);
  ctx.fillRect(2, 5, 2, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(4, 1, 1, 2);
  ctx.fillRect(4, 4 - 0, 1, 1);
  return c;
}

// Saleté des capteurs extérieurs : taches de poussière brune.
export function grimeCanvas() {
  const { c, ctx } = canvas(64, 32);
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 1) * 64;
    const y = hash(1, i) * 32;
    const r = 1 + hash(i, i) * 5;
    ctx.fillStyle = `rgba(${90 + Math.floor(hash(i, 7) * 40)},${70 + Math.floor(hash(7, i) * 25)},${45},${0.35 + hash(i, 3) * 0.5})`;
    ctx.fillRect(Math.round(x - r), Math.round(y - r / 2), Math.round(r * 2), Math.round(r));
  }
  return c;
}

// Zones d'écran dans les textures de salle (coordonnées de la salle 256×104).
export const SCREENS: Record<string, { x: number; y: number; w: number; h: number }> = {
  cafe_main: { x: 42, y: 22, w: 176, h: 39 },
  cafe_mid: { x: 112, y: 25, w: 46, h: 26 },
};
