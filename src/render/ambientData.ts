// Analyse des images de salles : on retrouve dans les pixels les lampes, les voyants et les plantes,
// pour animer le décor sans avoir à placer chaque élément à la main.

export interface Pixels {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Lamp {
  x: number;
  y: number;
  size: number;
}

export type EmitterKind = 'steam' | 'smoke' | 'drip' | 'spark' | 'dust';

export interface EmitterSpec {
  kind: EmitterKind;
  x: number;
  y: number;
  w?: number; // largeur de la zone d'émission
  h?: number;
  rate: number; // particules par seconde à pleine intensité
  when?: 'always' | 'work' | 'meal' | 'overload';
}

export interface RoomAmbience {
  emitters?: EmitterSpec[];
  plants?: { top: number; bottom: number; fill?: 'above' };
  gauges?: { x: number; y: number }[];
  leds?: boolean;
  lampTint?: number;
}

// Points mesurés sur les images 256×104 (repère de l'aile gauche, avant miroir).
export const AMBIENCE: Record<string, RoomAmbience> = {
  generator: {
    gauges: [
      { x: 59, y: 81 },
      { x: 85, y: 81 },
      { x: 107, y: 81 },
      { x: 131, y: 81 },
      { x: 156, y: 81 },
    ],
    emitters: [
      { kind: 'smoke', x: 18, y: 30, w: 10, h: 6, rate: 2.5, when: 'overload' },
      { kind: 'steam', x: 180, y: 50, w: 6, rate: 0.5, when: 'always' },
    ],
    leds: true,
  },
  laundry: {
    emitters: [
      { kind: 'steam', x: 14, y: 66, w: 12, rate: 1.6, when: 'work' },
      { kind: 'steam', x: 64, y: 58, w: 12, rate: 1.6, when: 'work' },
      { kind: 'steam', x: 98, y: 62, w: 12, rate: 1.6, when: 'work' },
      { kind: 'steam', x: 152, y: 56, w: 14, rate: 1.6, when: 'work' },
    ],
  },
  water: {
    emitters: [
      { kind: 'drip', x: 128, y: 69, rate: 0.7, when: 'always' },
      { kind: 'drip', x: 214, y: 92, rate: 0.25, when: 'always' },
      { kind: 'steam', x: 150, y: 40, w: 4, rate: 0.25, when: 'overload' },
    ],
    leds: true,
  },
  canteen: { emitters: [{ kind: 'steam', x: 176, y: 22, w: 8, rate: 1.4, when: 'meal' }] },
  cafe_mid: { emitters: [{ kind: 'steam', x: 232, y: 58, w: 8, rate: 1.4, when: 'meal' }] },
  cafe_main: { emitters: [{ kind: 'steam', x: 230, y: 66, w: 10, rate: 1, when: 'meal' }] },
  mine: {
    emitters: [
      { kind: 'dust', x: 10, y: 10, w: 236, h: 80, rate: 3, when: 'always' },
      { kind: 'dust', x: 90, y: 64, w: 60, h: 12, rate: 2, when: 'work' },
    ],
  },
  workshop: { emitters: [{ kind: 'spark', x: 100, y: 58, w: 4, rate: 1.2, when: 'work' }], leds: true },
  hydroponics: { plants: { top: 58, bottom: 87, fill: 'above' }, lampTint: 0xfff2b8 },
  greenhouse: { plants: { top: 16, bottom: 92 }, lampTint: 0xfff6a0 },
  servers: { leds: true, lampTint: 0xbfe8ff },
  admin: { leds: true },
  security: { leds: true },
  medical: { leds: true, lampTint: 0xfff0d8 },
  depot: { emitters: [{ kind: 'dust', x: 20, y: 30, w: 216, h: 60, rate: 0.8, when: 'work' }] },
};

const at = (p: Pixels, x: number, y: number) => {
  const i = (y * p.width + x) * 4;
  return [p.data[i], p.data[i + 1], p.data[i + 2], p.data[i + 3]];
};

const lum = (c: number[]) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const isBulb = (r: number, g: number, b: number) => r >= 205 && g >= 160 && r * 0.3 + g * 0.59 + b * 0.11 > 195;
const RING = [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]];
/** Un pixel clair n'est une ampoule que s'il tranche nettement avec ce qui l'entoure. */
const contrast = (p: Pixels, x: number, y: number) => {
  let sum = 0;
  let n = 0;
  for (const [dx, dy] of RING) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= p.width || yy >= p.height) continue;
    sum += lum(at(p, xx, yy));
    n++;
  }
  return lum(at(p, x, y)) - sum / Math.max(1, n);
};

/** Lampes : amas de pixels très clairs et chauds dans la moitié haute de la salle. */
export function detectLamps(p: Pixels, maxY = 42): Lamp[] {
  const pts: [number, number][] = [];
  for (let y = 0; y < Math.min(maxY, p.height); y++)
    for (let x = 0; x < p.width; x++) {
      const [r, g, b, a] = at(p, x, y);
      if (a > 200 && isBulb(r, g, b) && contrast(p, x, y) > 38) pts.push([x, y]);
    }
  const cell = 6;
  const cells = new Map<string, { n: number; cx: number; cy: number }>();
  for (const [x, y] of pts) {
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const c = cells.get(k) ?? { n: 0, cx: 0, cy: 0 };
    c.n++;
    c.cx += x;
    c.cy += y;
    cells.set(k, c);
  }
  const sorted = [...cells.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n);
  const lamps: Lamp[] = [];
  for (const c of sorted) {
    const x = c.cx / c.n;
    const y = c.cy / c.n;
    if (lamps.some((l) => Math.abs(l.x - x) < 11 && Math.abs(l.y - y) < 9)) continue;
    const near = pts.filter(([px, py]) => Math.abs(px - x) <= 8 && Math.abs(py - y) <= 6).length;
    lamps.push({ x, y, size: Math.min(1.6, 0.55 + Math.sqrt(near) * 0.12) });
    if (lamps.length >= 14) break;
  }
  return lamps;
}

/** Voyants : petits pixels saturés (vert, rouge, orange, cyan) isolés. */
export function detectLeds(p: Pixels): { x: number; y: number; color: number }[] {
  const cls = (x: number, y: number) => {
    const [r, g, b, a] = at(p, x, y);
    if (a < 200) return 0;
    if (g > 140 && r < 120 && b < 150 && g - r > 50) return 1; // vert
    if (r > 190 && g < 120 && b < 100) return 2; // rouge / orange
    if (g > 170 && b > 170 && r < 130) return 3; // cyan
    if (r > 220 && g > 140 && g < 200 && b < 80) return 2; // ambre
    return 0;
  };
  const out: { x: number; y: number; color: number }[] = [];
  for (let y = 1; y < p.height - 1; y++)
    for (let x = 1; x < p.width - 1; x++) {
      const c = cls(x, y);
      if (!c) continue;
      // Seuls les petits éléments clignotent (pas les grandes surfaces colorées).
      let same = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (y + dy >= 0 && y + dy < p.height && x + dx >= 0 && x + dx < p.width && cls(x + dx, y + dy) === c) same++;
      if (same <= 6) out.push({ x, y, color: c });
    }
  return out;
}

export const isPlant = (r: number, g: number, b: number) => (g > r + 10 && g > b + 14) || (r > 150 && g < 95 && b < 90);
export const isFruit = (r: number, g: number, b: number) => r > 150 && g < 95 && b < 90;

/** Masque des plantes dans la bande, contours sombres compris (ils doivent bouger avec la feuille). */
export function plantMask(p: Pixels, top: number, bottom: number, fill?: 'above') {
  const m = new Uint8Array(p.width * p.height);
  if (fill === 'above') {
    // Mur uni derrière les plantes : tout ce qui s'écarte du mur juste au-dessus est végétal.
    for (let x = 0; x < p.width; x++) {
      const ref = at(p, x, top - 1);
      for (let y = top; y < bottom; y++) {
        const c = at(p, x, y);
        if (Math.abs(c[0] - ref[0]) + Math.abs(c[1] - ref[1]) + Math.abs(c[2] - ref[2]) > 60) m[y * p.width + x] = 1;
      }
    }
    return m;
  }
  for (let y = top; y < bottom; y++)
    for (let x = 0; x < p.width; x++) {
      const [r, g, b, a] = at(p, x, y);
      if (a > 200 && isPlant(r, g, b)) m[y * p.width + x] = 1;
    }
  for (let pass = 0; pass < 2; pass++) {
    const add: number[] = [];
    for (let y = top; y < bottom; y++)
      for (let x = 1; x < p.width - 1; x++) {
        const i = y * p.width + x;
        if (m[i]) continue;
        const c = at(p, x, y);
        if (lum(c) > 105) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (y + dy >= top && y + dy < bottom && m[(y + dy) * p.width + x + dx]) n++;
        if (n >= 2) add.push(i);
      }
    for (const i of add) m[i] = 1;
  }
  return m;
}

/**
 * Plantes : masque des feuillages dans la bande donnée, découpé en touffes indépendantes
 * (colonnes séparées par un vide, ou tranches de 16 px pour une haie continue).
 */
export function plantChunks(p: Pixels, top: number, bottom: number, m = plantMask(p, top, bottom)): { x0: number; x1: number }[] {
  const col: number[] = [];
  for (let x = 0; x < p.width; x++) {
    let n = 0;
    for (let y = top; y < bottom; y++) if (m[y * p.width + x]) n++;
    col.push(n);
  }
  const chunks: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let x = 0; x <= p.width; x++) {
    const on = x < p.width && col[x] >= 2;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      for (let s = start; s < x; s += 16) chunks.push({ x0: s, x1: Math.min(x, s + 16) });
      start = -1;
    }
  }
  return chunks.filter((c) => c.x1 - c.x0 >= 2);
}

/**
 * Retire les feuillages de l'image de fond : chaque pixel de plante est remplacé par le décor
 * de la même ligne (interpolé entre les voisins gauche/droite), sinon par celui du dessus.
 */
export function inpaintPlants(p: Pixels, top: number, bottom: number, m = plantMask(p, top, bottom), fill?: 'above') {
  const out = new Uint8ClampedArray(p.data);
  if (fill === 'above') {
    for (let x = 0; x < p.width; x++) {
      const ref = at(p, x, top - 1);
      for (let y = top; y < bottom; y++) {
        const i = (y * p.width + x) * 4;
        // Le mur s'assombrit un peu vers les bacs.
        const k = 1 - ((y - top) / (bottom - top)) * 0.12;
        out[i] = ref[0] * k;
        out[i + 1] = ref[1] * k;
        out[i + 2] = ref[2] * k;
      }
    }
    return out;
  }
  const plant = (x: number, y: number) => m[y * p.width + x] === 1;
  for (let y = top; y < bottom; y++)
    for (let x = 0; x < p.width; x++) {
      if (!plant(x, y)) continue;
      let l = -1;
      let r = -1;
      for (let d = 1; d <= 20 && (l < 0 || r < 0); d++) {
        if (l < 0 && x - d >= 0 && !plant(x - d, y)) l = x - d;
        if (r < 0 && x + d < p.width && !plant(x + d, y)) r = x + d;
      }
      let c: number[];
      if (l >= 0 && r >= 0) {
        const a = at(p, l, y);
        const b = at(p, r, y);
        const t = (x - l) / (r - l);
        c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      } else if (l >= 0 || r >= 0) c = at(p, l >= 0 ? l : r, y);
      else {
        // Haie continue : on reprend la ligne au-dessus déjà reconstruite.
        const i = ((y - 1) * p.width + x) * 4;
        c = y > 0 ? [out[i], out[i + 1], out[i + 2]] : at(p, x, y);
      }
      const i = (y * p.width + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
    }
  return out;
}
