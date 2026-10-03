import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { FloorView, Snapshot } from '../sim/types';
import type { Light } from './lighting';
import { AMBIENCE, detectLamps, detectLeds, inpaintPlants, isFruit, normalMap, plantChunks, plantMask, type EmitterKind, type EmitterSpec, type Lamp, type Pixels } from './ambientData';
import { FEET_Y, FLOOR_H, ROOM_H, ROOM_W } from './textures';

// Couche « ambiance » : lampes qui respirent, voyants qui clignotent, plantes qui poussent et ondulent,
// vapeur, fumée, poussière, gouttes. Tout est piloté par l'état simulé de l'étage.

interface Analysis {
  lamps: Lamp[];
  ledMasks: Texture[];
  plants: { x0: number; x1: number; leaf: Texture; fruit?: Texture }[];
  base?: Texture;
  gaugeFace: number[];
  normal?: Texture;
  normalMirror?: Texture;
}

interface Wing {
  name: string;
  wx: number;
  mirrored: boolean;
  side: number;
  glows: { sp: Sprite; phase: number; size: number; x: number; y: number; ray?: Sprite }[];
  leds: { sp: Sprite; t: number; fast: boolean }[];
  plants: { leaf: Sprite; fruit?: Sprite; phase: number; k: number }[];
  gauges?: Graphics;
  emitters: { spec: EmitterSpec; acc: number }[];
  drips: number;
}

interface Particle {
  sp: Sprite;
  kind: EmitterKind | 'splash';
  vx: number;
  vy: number;
  life: number;
  max: number;
  top: number;
  bottom: number;
  alpha: number;
  grow: number;
}

export interface AmbientOptions {
  secondary: 'min' | 'standard' | 'max';
  lighting: 'low' | 'medium' | 'high';
  zoom: number;
  lit: boolean; // éclairage par pixel actif
}

const GROWTH_DAYS = 6;
const MEALS = new Set([6, 7, 11, 12, 13, 18, 19]);

function readPixels(tex: Texture): Pixels | null {
  const src = tex.source.resource as CanvasImageSource | undefined;
  if (!src) return null;
  const c = document.createElement('canvas');
  c.width = tex.width;
  c.height = tex.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function nearest(tex: Texture) {
  tex.source.scaleMode = 'nearest';
  return tex;
}

/** Halo en anneaux (pas de dégradé lisse : on reste dans l'esthétique pixel). */
/** Cône de lumière sous une lampe : dégradé par paliers (pas de flou, on reste en pixel art). */
function rayTexture() {
  const W = 40;
  const H = 72;
  const c = canvasOf(W, H);
  const g = c.getContext('2d')!;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const half = 3 + t * (W / 2 - 3);
    const a = Math.round((1 - t) * 5) / 5 * 0.55;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.fillRect(Math.round(W / 2 - half), y, Math.round(half * 2), 1);
  }
  return nearest(Texture.from(c));
}

function glowTexture() {
  const c = canvasOf(24, 24);
  const g = c.getContext('2d')!;
  for (const [r, a] of [
    [12, 0.08],
    [9, 0.16],
    [6, 0.3],
    [3, 0.55],
  ] as const) {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(12, 12, r, 0, Math.PI * 2);
    g.fill();
  }
  return nearest(Texture.from(c));
}

function puffTexture() {
  const c = canvasOf(6, 6);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(1, 0, 4, 6);
  g.fillRect(0, 1, 6, 4);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(1, 1, 4, 4);
  return nearest(Texture.from(c));
}

export class Ambient {
  readonly layer = new Container();
  private info = new Map<string, Analysis>();
  private wings: Wing[][] = [];
  private pool: Particle[] = [];
  private glowTex = glowTexture();
  private puffTex = puffTexture();
  private rayTex = rayTexture();
  /** Lumières des lampes, par étage (coordonnées monde), mises à jour à chaque image. */
  readonly lights = new Map<number, Light[]>();

  constructor() {
    for (let i = 0; i < 420; i++) {
      const sp = new Sprite(this.puffTex);
      sp.anchor.set(0.5);
      sp.visible = false;
      this.layer.addChild(sp);
      this.pool.push({ sp, kind: 'dust', vx: 0, vy: 0, life: 0, max: 1, top: 0, bottom: 0, alpha: 1, grow: 0 });
    }
  }

  /** Analyse une fois chaque image de salle (lampes, voyants, plantes). */
  analyze(name: string, tex: Texture) {
    if (this.info.has(name)) return;
    const spec = AMBIENCE[name] ?? {};
    const p = readPixels(tex);
    const a: Analysis = { lamps: [], ledMasks: [], plants: [], gaugeFace: [200, 200, 190] };
    this.info.set(name, a);
    if (!p) return;
    a.lamps = detectLamps(p);
    // Relief : cartes de normales (aile normale et aile retournée).
    const toTex = (data: Uint8ClampedArray<ArrayBuffer>) => {
      const c = canvasOf(p.width, p.height);
      c.getContext('2d')!.putImageData(new ImageData(data, p.width, p.height), 0, 0);
      return nearest(Texture.from(c));
    };
    a.normal = toTex(normalMap(p));
    a.normalMirror = toTex(normalMap(p, 3.6, true));
    if (spec.leds) {
      const leds = detectLeds(p);
      const groups = [0, 1, 2].map(() => {
        const c = canvasOf(p.width, p.height);
        return { c, g: c.getContext('2d')!, n: 0 };
      });
      leds.forEach((l, k) => {
        const grp = groups[(l.x * 7 + l.y * 13 + k) % 3];
        const i = (l.y * p.width + l.x) * 4;
        grp.g.fillStyle = `rgb(${p.data[i] * 0.28},${p.data[i + 1] * 0.28},${p.data[i + 2] * 0.3})`;
        grp.g.fillRect(l.x, l.y, 1, 1);
        grp.n++;
      });
      a.ledMasks = groups.filter((g) => g.n > 0).map((g) => nearest(Texture.from(g.c)));
    }
    if (spec.plants) {
      const { top, bottom, fill } = spec.plants;
      const mask = plantMask(p, top, bottom, fill);
      const base = canvasOf(p.width, p.height);
      base.getContext('2d')!.putImageData(new ImageData(inpaintPlants(p, top, bottom, mask, fill), p.width, p.height), 0, 0);
      a.base = nearest(Texture.from(base));
      for (const ch of plantChunks(p, top, bottom, mask)) {
        const w = ch.x1 - ch.x0;
        const h = bottom - top;
        const leaf = canvasOf(w, h);
        const fruit = canvasOf(w, h);
        const lg = leaf.getContext('2d')!;
        const fg = fruit.getContext('2d')!;
        const li = lg.createImageData(w, h);
        const fi = fg.createImageData(w, h);
        let fruits = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const s = ((top + y) * p.width + ch.x0 + x) * 4;
            const r = p.data[s];
            const g = p.data[s + 1];
            const b = p.data[s + 2];
            if (!mask[(top + y) * p.width + ch.x0 + x]) continue;
            const target = isFruit(r, g, b) ? fi : li;
            if (target === fi) fruits++;
            const d = (y * w + x) * 4;
            target.data[d] = r;
            target.data[d + 1] = g;
            target.data[d + 2] = b;
            target.data[d + 3] = 255;
          }
        lg.putImageData(li, 0, 0);
        fg.putImageData(fi, 0, 0);
        a.plants.push({ x0: ch.x0, x1: ch.x1, leaf: nearest(Texture.from(leaf)), fruit: fruits > 2 ? nearest(Texture.from(fruit)) : undefined });
      }
    }
    if (spec.gauges?.length) {
      // Couleur du cadran : le pixel le plus clair autour du centre.
      const gz = spec.gauges[0];
      let best = -1;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const i = ((gz.y + dy) * p.width + gz.x + dx) * 4;
          const l = p.data[i] + p.data[i + 1] + p.data[i + 2];
          if (l > best) {
            best = l;
            a.gaugeFace = [p.data[i], p.data[i + 1], p.data[i + 2]];
          }
        }
    }
  }

  /** Image de fond à utiliser (sans les plantes, qui sont animées à part). */
  normalTex(name: string, mirrored: boolean) {
    const a = this.info.get(name);
    return mirrored ? a?.normalMirror : a?.normal;
  }

  base(name: string) {
    return this.info.get(name)?.base;
  }

  /** Construit l'ambiance d'une aile : `under` va sous l'ombre de l'étage, `over` au-dessus (lumières). */
  buildWing(floor: number, name: string, wx: number, mirrored: boolean) {
    const a = this.info.get(name);
    const spec = AMBIENCE[name] ?? {};
    const under = new Container();
    const over = new Container();
    for (const c of [under, over]) {
      c.x = mirrored ? wx + ROOM_W : wx;
      c.scale.x = mirrored ? -1 : 1;
    }
    const wing: Wing = { name, wx, mirrored, side: wx > 0 ? 1 : 0, glows: [], leds: [], plants: [], emitters: (spec.emitters ?? []).map((s) => ({ spec: s, acc: Math.random() })), drips: Math.random() };
    if (a) {
      a.plants.forEach((pl, k) => {
        const leaf = new Sprite(pl.leaf);
        leaf.anchor.set(0.5, 1);
        leaf.position.set((pl.x0 + pl.x1) / 2, spec.plants!.bottom);
        under.addChild(leaf);
        let fruit: Sprite | undefined;
        if (pl.fruit) {
          fruit = new Sprite(pl.fruit);
          fruit.anchor.set(0.5, 1);
          fruit.position.copyFrom(leaf.position);
          under.addChild(fruit);
        }
        wing.plants.push({ leaf, fruit, phase: Math.random() * 6, k });
      });
      for (const m of a.ledMasks) {
        const sp = new Sprite(m);
        sp.alpha = 0;
        under.addChild(sp);
        wing.leds.push({ sp, t: Math.random() * 2, fast: name === 'servers' });
      }
      for (const l of a.lamps) {
        const sp = new Sprite(this.glowTex);
        sp.anchor.set(0.5);
        sp.position.set(Math.round(l.x), Math.round(l.y + 3));
        sp.scale.set(l.size * 1.35);
        sp.blendMode = 'add';
        sp.tint = spec.lampTint ?? 0xffb35a;
        sp.alpha = 0;
        // Rayon de lumière vers le sol
        const ray = new Sprite(this.rayTex);
        ray.anchor.set(0.5, 0);
        ray.position.set(Math.round(l.x), Math.round(l.y + 4));
        ray.scale.set(0.7 + l.size * 0.35, Math.min(1.2, (ROOM_H - l.y - 6) / 72));
        ray.blendMode = 'add';
        ray.tint = spec.lampTint ?? 0xffb35a;
        ray.alpha = 0;
        over.addChild(ray, sp);
        wing.glows.push({ sp, phase: Math.random() * 6, size: l.size, x: mirrored ? wx + ROOM_W - l.x : wx + l.x, y: l.y, ray });
      }
      if (spec.gauges) {
        wing.gauges = new Graphics();
        under.addChild(wing.gauges);
      }
    }
    (this.wings[floor] ??= []).push(wing);
    return { under, over };
  }

  updateFloor(index: number, f: FloorView, s: Snapshot, dt: number, time: number, flick: number, o: AmbientOptions) {
    const wings = this.wings[index];
    if (!wings) return;
    const blackout = s.energy.generatorState === 'failed' && f.power < 0.5;
    const night = s.hour >= 22 || s.hour < 6;
    const lightMul = o.lighting === 'low' ? 0.5 : o.lighting === 'high' ? 1.15 : 0.85;
    const days = s.tick / 144;
    const load = s.energy.production > 0 ? s.energy.demand / s.energy.production : 1.5;
    const tags = s.tags;
    const particles = o.secondary !== 'min';
    const rateMul = (o.secondary === 'max' ? 1 : 0.6) * (o.zoom < 0.6 ? 0.35 : 1);
    const top = index * FLOOR_H;

    const lights: Light[] = [];
    this.lights.set(index, lights);
    for (const w of wings) {
      const spec = AMBIENCE[w.name] ?? {};
      // Lampes : respiration lente, vacillement quand le courant faiblit, secours rouges en panne.
      for (const g of w.glows) {
        let a: number;
        if (blackout) {
          a = 0.16 + 0.1 * Math.sin(time * 3 + g.phase);
          g.sp.tint = 0xff3a28;
        } else {
          g.sp.tint = spec.lampTint ?? 0xffb35a;
          const on = f.power < 0.2 ? 0 : 0.35 + 0.65 * f.power;
          a = 0.3 * on * (1 + 0.1 * Math.sin(time * 1.6 + g.phase));
          if (night && f.sector === 'residential') a *= 0.35;
          if (flick > 0) a *= 0.15;
          else if (f.power < 0.75 && Math.sin(time * 23 + g.phase * 7) > 0.97) a *= 0.3;
        }
        g.sp.alpha = Math.max(0, a * lightMul) * (o.lit ? 0.7 : 1);
        if (g.ray) g.ray.alpha = o.lit && o.lighting === 'high' ? Math.max(0, a) * 0.35 * (1 + 0.15 * Math.sin(time * 0.7 + g.phase)) : 0;
        // Chaque lampe éclaire réellement son entourage (carte de lumière).
        if (o.lit) lights.push({ x: g.x, y: top + g.y + 2, r: 60 + g.size * 40, i: Math.max(0, a) * 4.6, color: blackout ? 0xff3a28 : spec.lampTint ?? 0xffc27a, h: 12 });
      }
      // Salle sans lampe visible (machines, mines…) : plafonniers hors champ.
      if (o.lit && !w.glows.length && !blackout && f.power >= 0.2) {
        const on = (0.35 + 0.65 * f.power) * (night && f.sector === 'residential' ? 0.4 : 1);
        for (const lx of [64, 192]) lights.push({ x: w.wx + lx, y: top + 6, r: 110, i: 1.1 * on, color: 0xf2e6d0, h: 14 });
      }
      // Voyants : groupes qui s'éteignent et se rallument, frénétiques dans les serveurs.
      for (const l of w.leds) {
        if (f.power < 0.25) {
          l.sp.alpha = 1;
          continue;
        }
        l.t -= dt;
        if (l.t <= 0) {
          const off = l.sp.alpha > 0.5;
          l.sp.alpha = off ? 0 : 1;
          l.t = off ? (l.fast ? 0.15 + Math.random() * 0.9 : 1 + Math.random() * 3) : l.fast ? 0.05 + Math.random() * 0.25 : 0.3 + Math.random() * 0.8;
        }
      }
      // Plantes : cycle de culture (pousse, mûrit, récolte en vague) et léger balancement.
      if (w.plants.length) {
        const blight = tags.includes('blight');
        const dry = f.water < 0.45;
        const bumper = tags.includes('bumper_harvest');
        for (const p of w.plants) {
          const ph = (((days / GROWTH_DAYS + index * 0.37 + w.side * 0.5 + p.k * 0.012) % 1) + 1) % 1;
          let g = ph < 0.05 ? 0.14 : Math.min(1, 0.14 + 0.86 * smooth((ph - 0.05) / 0.75));
          if (bumper) g = Math.min(1.08, g * 1.08);
          const sway = Math.sin(time * 0.9 + p.phase) * 0.035 + Math.sin(time * 2.3 + p.phase * 2) * 0.01;
          const droop = dry ? 0.06 : 0;
          p.leaf.scale.set(0.8 + 0.2 * g, g * (dry ? 0.93 : 1));
          p.leaf.skew.x = particles ? sway * (dry ? 0.4 : 1) + droop : 0;
          p.leaf.tint = blight ? 0xc9b25a : dry ? 0xc8bc8a : 0xffffff;
          if (p.fruit) {
            p.fruit.scale.copyFrom(p.leaf.scale);
            p.fruit.skew.x = p.leaf.skew.x;
            p.fruit.alpha = blight ? 0.25 : Math.max(0, (g - 0.72) / 0.28);
          }
        }
      }
      // Cadrans de la génératrice : aiguilles qui suivent la charge.
      if (w.gauges && spec.gauges) {
        const a = this.info.get(w.name)!;
        const face = (a.gaugeFace[0] << 16) | (a.gaugeFace[1] << 8) | a.gaugeFace[2];
        const g = w.gauges;
        g.clear();
        const failed = s.energy.generatorState === 'failed';
        spec.gauges.forEach((gz, k) => {
          const v = failed ? 0 : [load, s.energy.battery / 100, load * 0.9, f.condition / 100, load * 1.1][k % 5];
          const ang = -Math.PI + 0.45 + Math.min(1.25, Math.max(0, v)) * ((Math.PI - 0.9) / 1.25) + (failed ? 0 : Math.sin(time * 6 + k) * 0.04);
          g.circle(gz.x, gz.y, 5).fill(face);
          // Aiguille dessinée pixel par pixel (nette au rendu natif).
          for (let t = 1; t <= 5; t++) g.rect(Math.round(gz.x + Math.cos(ang) * t), Math.round(gz.y + Math.sin(ang) * t), 1, 1).fill(v > 1 ? 0xd9302a : 0x2a2a2a);
          g.rect(gz.x - 0.5, gz.y - 0.5, 1, 1).fill(0x1a1a1a);
        });
      }
      if (!particles) continue;
      // Émetteurs de particules.
      for (const e of w.emitters) {
        const sp = e.spec;
        let k = 1;
        if (sp.when === 'work') k = f.activity.work > 0 ? Math.min(1, 0.3 + f.activity.work / 10) : 0.05;
        else if (sp.when === 'meal') k = MEALS.has(s.hour) ? 1 : 0.08;
        else if (sp.when === 'overload') {
          if (w.name === 'generator') k = Math.max(0, (load - 0.85) * 4) + (s.energy.generatorState === 'degraded' ? 0.6 : 0) + (s.energy.generatorState === 'failed' ? 1.6 : 0);
          else k = f.condition < 55 ? (55 - f.condition) / 25 : 0;
        }
        if (sp.kind === 'dust' && w.name === 'mine' && tags.includes('gas_leak')) k *= 2;
        if (f.power < 0.2 && sp.kind === 'steam') k *= 0.2;
        e.acc += sp.rate * k * rateMul * dt;
        while (e.acc >= 1) {
          e.acc -= 1;
          const lx = sp.x + Math.random() * (sp.w ?? 0);
          const ly = sp.y + Math.random() * (sp.h ?? 0);
          this.emit(sp.kind, w.mirrored ? w.wx + ROOM_W - lx : w.wx + lx, top + ly, top, top + FEET_Y + 1, w.name === 'mine' && tags.includes('gas_leak'), s.energy.generatorState === 'failed');
        }
      }
      // Usure : des gouttes tombent du plafond quand l'étage se dégrade.
      if (f.condition < 50) {
        w.drips += ((50 - f.condition) / 50) * 0.9 * rateMul * dt;
        while (w.drips >= 1) {
          w.drips -= 1;
          this.emit('drip', w.wx + 10 + Math.random() * (ROOM_W - 20), top + 6, top, top + FEET_Y + 1, false, false);
        }
      }
    }
  }

  private emit(kind: EmitterKind, x: number, y: number, top: number, bottom: number, gas: boolean, black: boolean) {
    if (kind === 'spark') {
      for (let i = 0; i < 3; i++) this.spawn('spark', x, y, top, bottom, 0xffd34a);
      return;
    }
    const tint = kind === 'steam' ? 0xdfe7ea : kind === 'smoke' ? (black ? 0x5a5550 : 0x4a4644) : kind === 'drip' ? 0x8fd0ff : gas ? 0x9acb5c : 0xcdb894;
    this.spawn(kind, x, y, top, bottom, tint);
  }

  private spawn(kind: Particle['kind'], x: number, y: number, top: number, bottom: number, tint: number) {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    const sp = p.sp;
    p.kind = kind;
    p.top = top;
    p.bottom = bottom;
    sp.position.set(x, y);
    sp.tint = tint;
    sp.visible = true;
    sp.rotation = 0;
    switch (kind) {
      case 'steam':
      case 'smoke':
        sp.texture = this.puffTex;
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = kind === 'steam' ? -9 - Math.random() * 6 : -6 - Math.random() * 5;
        p.max = p.life = kind === 'steam' ? 1.8 + Math.random() : 2.8 + Math.random() * 1.2;
        p.alpha = kind === 'steam' ? 0.4 : 0.55;
        p.grow = kind === 'steam' ? 1.1 : 1.6;
        sp.scale.set(0.45);
        break;
      case 'dust':
        sp.texture = Texture.WHITE;
        p.vx = (Math.random() - 0.5) * 5;
        p.vy = (Math.random() - 0.5) * 3;
        p.max = p.life = 3 + Math.random() * 3;
        p.alpha = 0.55;
        p.grow = 0;
        sp.width = 1;
        sp.height = 1;
        break;
      case 'drip':
        sp.texture = Texture.WHITE;
        p.vx = 0;
        p.vy = 0;
        p.max = p.life = 3;
        p.alpha = 0.9;
        p.grow = 0;
        sp.width = 1;
        sp.height = 2;
        break;
      case 'spark':
      case 'splash':
        sp.texture = Texture.WHITE;
        p.vx = (Math.random() - 0.5) * (kind === 'spark' ? 40 : 18);
        p.vy = kind === 'spark' ? -20 - Math.random() * 30 : -10 - Math.random() * 8;
        p.max = p.life = kind === 'spark' ? 0.35 + Math.random() * 0.3 : 0.25;
        p.alpha = 1;
        p.grow = 0;
        sp.width = 1;
        sp.height = 1;
        break;
    }
    sp.alpha = kind === 'steam' || kind === 'smoke' || kind === 'dust' ? 0 : p.alpha;
  }

  updateParticles(dt: number, time: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const sp = p.sp;
      const t = 1 - p.life / p.max; // 0 → 1
      switch (p.kind) {
        case 'steam':
        case 'smoke': {
          sp.x += (p.vx + Math.sin(time * 2 + sp.y * 0.2) * 2) * dt;
          sp.y += p.vy * dt;
          p.vy *= 1 - 0.25 * dt;
          if (sp.y < p.top + 5) {
            // S'écrase contre le plafond et s'étale.
            sp.y = p.top + 5;
            p.vy = 0;
            p.vx += (p.vx >= 0 ? 1 : -1) * 8 * dt;
            p.life -= dt * 0.5;
          }
          sp.scale.set(0.45 + p.grow * t);
          sp.alpha = p.alpha * Math.min(1, t * 6) * (1 - t);
          break;
        }
        case 'dust':
          sp.x += p.vx * dt;
          sp.y += (p.vy + Math.sin(time + sp.x) * 0.8) * dt;
          sp.alpha = p.alpha * Math.sin(Math.PI * t);
          break;
        case 'drip':
          p.vy += 170 * dt;
          sp.y += p.vy * dt;
          if (sp.y >= p.bottom) {
            p.life = 0;
            for (let i = 0; i < 2; i++) this.spawn('splash', sp.x, p.bottom - 1, p.top, p.bottom, 0xa8dcff);
          }
          break;
        case 'spark':
        case 'splash':
          p.vy += 110 * dt;
          sp.x += p.vx * dt;
          sp.y = Math.min(p.bottom, sp.y + p.vy * dt);
          sp.alpha = 1 - t * 0.6;
          break;
      }
      if (sp.y < p.top - 2 || sp.y > p.top + ROOM_H) p.life = 0;
      if (p.life <= 0) sp.visible = false;
    }
  }
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
