import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TextureSource, TilingSprite } from 'pixi.js';
import type { FloorView, LockdownLevel, SectorId, Snapshot } from '../sim/types';
import { Ambient } from './ambient';
import { SPOTS, type RoomSpots } from './hotspots';
import { NavigationGraph } from './navigation';
import { CHAR_H, CHAR_W, FRAMES, FRAME_COUNT, atlasRow, buildCitizenAtlas, type Anim } from './sprites';
import {
  FEET_Y,
  FLOOR_H,
  LANDING_X,
  ROOM_H,
  ROOM_W,
  SHAFT_W,
  SHAFT_X,
  SCREENS,
  SILO_W,
  WALL_W,
  grimeCanvas,
  alertBubbleCanvas,
  bubbleCanvas,
  rockCanvas,
  shaftCanvas,
  slabCanvas,
  wallCanvas,
} from './textures';

export interface RenderSettings {
  density: number; // PNJ visibles max
  secondary: 'min' | 'standard' | 'max';
  lighting: 'low' | 'medium' | 'high';
  adaptive: boolean;
  volume: number; // 0-1
  muted: boolean;
}

const SURFACE_H = 300;
const ROOM_TEXTURES = ['court', 'council', 'school', 'bazaar', 'quarters', 'laundry', 'greenhouse', 'admin', 'servers', 'security', 'canteen', 'residential', 'hydroponics', 'medical', 'workshop', 'water', 'generator', 'depot', 'mine', 'cafe_main', 'cafe_mid', 'cafe_main_screen', 'cafe_mid_screen'];
const WORK_FLOORS_24H = new Set<SectorId>(['water', 'energy', 'medical', 'security']);

type Mode = 'idle' | 'walk' | 'act' | 'stairs';
type Task = 'wander' | 'post' | 'repair' | 'protest' | 'clean' | 'queue' | 'eat' | 'home' | 'shop' | 'bed' | 'school' | 'gather' | 'seat' | 'patrol';

interface Npc {
  sp: Sprite;
  bubble: Sprite;
  active: boolean;
  floor: number;
  x: number;
  y: number;
  facing: 1 | -1;
  sector: SectorId;
  row: number;
  anim: Anim;
  ft: number;
  fi: number;
  mode: Mode;
  task: Task;
  timer: number;
  tx: number;
  act: Anim;
  route: number[];
  stair: { from: number; to: number; t: number } | null;
  leaving: boolean;
  authorized: boolean;
  speed: number;
  fade: number;
  bubbleT: number;
  child: boolean;
  spot?: string; // point d'intérêt réservé
  after?: { act: Anim | 'vanish'; t: number; facing?: 1 | -1; bubble?: boolean };
  vanish: boolean;
  eating: boolean;
  yOff: number; // assis sur une couchette
}

interface Queue {
  floor: number;
  head: number;
  dir: 1 | -1;
  list: Npc[];
  timer: number;
}

interface FloorGfx {
  index: number;
  id: string;
  root: Container;
  dark: Sprite;
  red: Sprite;
  lock: Graphics;
  highlight: Graphics;
  label: Text;
  name: Text;
  badge: Graphics;
  lockText: Text;
  lockdown: LockdownLevel;
  flicker: number;
  tags: Text[];
}

export class SiloView {
  app!: Application;
  private world = new Container();
  private bg = new Container();
  private floorLayer = new Container();
  private npcLayer = new Container();
  private fxLayer = new Container();
  private ui = new Container();
  private floors: FloorGfx[] = [];
  private npcs: Npc[] = [];
  private frames: Texture[][] = [];
  private bubbleTex!: Texture;
  private alertTex!: Texture;
  private sparks: { sp: Sprite; vx: number; vy: number; life: number }[] = [];
  private ambient = new Ambient();
  private taken = new Set<string>();
  private queues = new Map<string, Queue>();
  private screens: { floor: number; feed: TilingSprite; grime: Sprite; noise: Sprite; base: number }[] = [];
  private elevator = new Graphics();
  private elevatorY = 0;
  private elevatorTarget = 0;
  private elevatorWait = 0;
  private nav = new NavigationGraph();
  private snap?: Snapshot;
  private selected?: string;
  private zoom = 1;
  private camX = SILO_W / 2;
  private camY = 0;
  private reconcileT = 0;
  private fpsT = 0;
  private fpsFrames = 0;
  fps = 60;
  private effDensity: number;
  private effSecondary: RenderSettings['secondary'];
  private drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  onSelectFloor?: (id: string) => void;
  onSelectRoom?: (id: string, side: 'left' | 'right') => void;
  // Habitant suivi (vue Personne)
  private follow: {
    id: number;
    sp: Sprite;
    label: Text;
    row: number;
    floor: number;
    x: number;
    y: number;
    targetFloor: number;
    act: string;
    route: number[];
    stair: { from: number; to: number; t: number } | null;
    tx: number;
    facing: 1 | -1;
    ft: number;
    anim: Anim;
  } | null = null;
  private followCam = true;
  onSelectNpc?: (floorId: string, sector: SectorId) => void;
  onCamera?: (visible: string[]) => void;

  private constructor(private settings: RenderSettings) {
    this.effDensity = settings.density;
    this.effSecondary = settings.secondary;
  }

  static async create(el: HTMLElement, settings: RenderSettings) {
    const v = new SiloView(settings);
    await v.init(el);
    return v;
  }

  private async init(el: HTMLElement) {
    TextureSource.defaultOptions.scaleMode = 'nearest';
    this.app = new Application();
    await this.app.init({ resizeTo: el, background: '#0a0c0f', antialias: false, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), roundPixels: true });
    el.appendChild(this.app.canvas);
    this.app.canvas.style.imageRendering = 'pixelated';

    const base = import.meta.env.BASE_URL;
    const urls = [...ROOM_TEXTURES.map((t) => `${base}assets/rooms/${t}.png`), `${base}assets/surface.png`];
    await Assets.load(urls);
    for (const t of ROOM_TEXTURES) this.ambient.analyze(t, Texture.from(`${base}assets/rooms/${t}.png`));

    // Atlas des habitants
    const atlas = Texture.from(buildCitizenAtlas());
    const rows = atlas.height / CHAR_H;
    for (let r = 0; r < rows; r++) {
      const row: Texture[] = [];
      for (let f = 0; f < FRAME_COUNT; f++) row.push(new Texture({ source: atlas.source, frame: new Rectangle(f * CHAR_W, r * CHAR_H, CHAR_W, CHAR_H) }));
      this.frames.push(row);
    }
    this.bubbleTex = Texture.from(bubbleCanvas());
    this.alertTex = Texture.from(alertBubbleCanvas());

    this.world.addChild(this.bg, this.floorLayer, this.npcLayer, this.ambient.layer, this.fxLayer);
    this.app.stage.addChild(this.world, this.ui);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.bindInput();
    this.app.ticker.add((t) => this.update(Math.min(0.1, t.deltaMS / 1000)));
  }

  // -------------------------------------------------------------------------
  // Construction du silo

  private build(floors: FloorView[]) {
    const totalH = floors.length * FLOOR_H;
    const rock = new TilingSprite({ texture: Texture.from(rockCanvas()), width: SILO_W + 2400, height: totalH + 400 });
    rock.position.set(-1200, -10);
    rock.tint = 0xb0a8a0;
    this.bg.addChild(rock);

    const surface = new Sprite(Texture.from(`${import.meta.env.BASE_URL}assets/surface.png`));
    surface.anchor.set(0.5, 1);
    surface.position.set(SILO_W / 2, 6);
    surface.scale.set(SURFACE_H / surface.texture.height);
    this.bg.addChild(surface);
    // Le sol coupe la surface du silo
    const soil = new Graphics().rect(-1200, -4, SILO_W + 2400, 12).fill(0x2a221c).rect(-1200, -4, SILO_W + 2400, 2).fill(0x4a3a2c);
    this.bg.addChild(soil);
    // Ombre extérieure du fût
    const shell = new Graphics().rect(-WALL_W - 6, 0, SILO_W + 2 * WALL_W + 12, totalH + 20).fill({ color: 0x000000, alpha: 0.45 });
    this.bg.addChild(shell);

    const shaftA = Texture.from(shaftCanvas(false));
    const shaftB = Texture.from(shaftCanvas(true));
    const slab = Texture.from(slabCanvas(ROOM_W));
    const wallL = Texture.from(wallCanvas(true));
    const wallR = Texture.from(wallCanvas(false));

    for (const f of floors) {
      const root = new Container();
      root.y = f.index * FLOOR_H;
      const roomTex = (n: string) => this.ambient.base(n) ?? Texture.from(`${import.meta.env.BASE_URL}assets/rooms/${n}.png`);
      const left = new Sprite(roomTex(f.left));
      const right = new Sprite(roomTex(f.right));
      right.x = SHAFT_X + SHAFT_W;
      if (f.left === f.right) {
        right.scale.x = -1;
        right.x += ROOM_W;
      }
      const shaft = new Sprite(f.index % 2 ? shaftB : shaftA);
      shaft.x = SHAFT_X;
      const slabL = new Sprite(slab);
      slabL.y = ROOM_H;
      const slabR = new Sprite(slab);
      slabR.position.set(SHAFT_X + SHAFT_W, ROOM_H);
      const wl = new Sprite(wallL);
      wl.x = -WALL_W;
      const wr = new Sprite(wallR);
      wr.x = SILO_W;
      const dark = new Sprite(Texture.WHITE);
      dark.tint = 0x05070a;
      dark.width = SILO_W;
      dark.height = ROOM_H;
      dark.alpha = 0;
      const red = new Sprite(Texture.WHITE);
      red.tint = 0xff2a1a;
      red.width = SILO_W;
      red.height = ROOM_H;
      red.alpha = 0;
      red.blendMode = 'add';
      const lock = new Graphics();
      const highlight = new Graphics().rect(-2, -2, SILO_W + 4, ROOM_H + 4).stroke({ color: 0xe8a33c, width: 2, alpha: 0.9 });
      highlight.visible = false;
      root.addChild(left, right, shaft, slabL, slabR, wl, wr);
      // Ambiance animée (plantes, voyants, cadrans sous l'ombre ; halos des lampes au-dessus).
      const ambL = this.ambient.buildWing(f.index, f.left, 0, false);
      const ambR = this.ambient.buildWing(f.index, f.right, SHAFT_X + SHAFT_W, f.left === f.right);
      root.addChild(ambL.under, ambR.under);
      // Écrans des réfectoires : la vue de la surface, en direct, à travers des capteurs plus ou moins sales.
      const wings: [string, number, boolean][] = [
        [f.left, 0, false],
        [f.right, SHAFT_X + SHAFT_W, f.left === f.right],
      ];
      for (const [tex, wx, mirrored] of wings) {
        const rect = SCREENS[tex];
        if (!rect) continue;
        root.addChild(this.buildScreen(tex, rect, wx, mirrored, f.index));
      }
      // Tags d'une faction : signal avant-coureur visible dans le décor.
      const tags: Text[] = [];
      for (let k = 0; k < 3; k++) {
        const t = new Text({ text: '', style: { fontFamily: 'serif', fontSize: 14, fontWeight: '700', fill: 0xb02a20 } });
        t.resolution = 4;
        t.alpha = 0.75;
        t.rotation = (k - 1) * 0.12;
        t.position.set([40, SHAFT_X + SHAFT_W + 150, 190][k], [34, 46, 58][k]);
        t.visible = false;
        tags.push(t);
        root.addChild(t);
      }
      root.addChild(dark, ambL.over, ambR.over, red, lock, highlight);
      this.floorLayer.addChild(root);

      const label = new Text({ text: f.label, style: { fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: '700', fill: 0xd8dde3 } });
      const name = new Text({ text: f.name, style: { fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: '500', fill: 0x9aa5b1 } });
      const lockText = new Text({ text: 'BLOCUS', style: { fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xff5a4a, letterSpacing: 2 } });
      lockText.visible = false;
      const badge = new Graphics();
      label.anchor.set(1, 0);
      name.anchor.set(1, 0);
      lockText.anchor.set(1, 0);
      this.ui.addChild(badge, label, name, lockText);
      this.floors.push({ index: f.index, id: f.id, root, dark, red, lock, highlight, label, name, badge, lockText, lockdown: 'open', flicker: 0, tags });
    }

    this.elevator.rect(0, 0, 9, 16).fill(0x3a3f45).rect(1, 2, 7, 9).fill(0xffd27a).rect(0, 15, 9, 1).fill(0x1a1c1f);
    this.elevator.x = SHAFT_X + 61;
    this.fxLayer.addChild(this.elevator);

    // Pool de PNJ : créés une fois, jamais détruits.
    for (let i = 0; i < 400; i++) {
      const sp = new Sprite(this.frames[0][0]);
      sp.anchor.set(0.5, 1);
      sp.visible = false;
      const bubble = new Sprite(this.bubbleTex);
      bubble.anchor.set(0.5, 1);
      bubble.visible = false;
      this.npcLayer.addChild(sp);
      this.fxLayer.addChild(bubble);
      this.npcs.push({ sp, bubble, active: false, floor: 0, x: 0, y: 0, facing: 1, sector: 'residential', row: 0, anim: 'idle', ft: 0, fi: 0, mode: 'idle', task: 'wander', timer: 0, tx: 0, act: 'idle', route: [], stair: null, leaving: false, authorized: false, speed: 16, fade: 1, bubbleT: 0, child: false, vanish: false, eating: false, yOff: 0 });
    }
    for (let i = 0; i < 80; i++) {
      const sp = new Sprite(Texture.WHITE);
      sp.width = 1;
      sp.height = 1;
      sp.visible = false;
      this.fxLayer.addChild(sp);
      this.sparks.push({ sp, vx: 0, vy: 0, life: 0 });
    }

    this.fit();
    this.camY = -SURFACE_H * 0.55;
  }

  private buildScreen(tex: string, rect: { x: number; y: number; w: number; h: number }, wx: number, mirrored: boolean, floor: number) {
    const base = import.meta.env.BASE_URL;
    const holder = new Container();
    holder.x = mirrored ? wx + ROOM_W : wx;
    holder.scale.x = mirrored ? -1 : 1;
    const surface = Texture.from(`${base}assets/surface.png`);
    const feed = new TilingSprite({ texture: surface, width: rect.w, height: rect.h });
    feed.position.set(rect.x, rect.y);
    const scale = (rect.h * 1.35) / surface.height;
    feed.tileScale.set(scale);
    feed.tilePosition.y = -surface.height * scale * 0.18;
    feed.tint = 0xb8b0a8;
    const grime = new Sprite(Texture.from(grimeCanvas()));
    grime.position.set(rect.x, rect.y);
    grime.width = rect.w;
    grime.height = rect.h;
    const noise = new Sprite(Texture.WHITE);
    noise.position.set(rect.x, rect.y);
    noise.width = rect.w;
    noise.height = rect.h;
    noise.tint = 0x9fb0a0;
    noise.alpha = 0;
    const mask = new Sprite(Texture.from(`${base}assets/rooms/${tex}_screen.png`));
    const content = new Container();
    content.addChild(feed, grime, noise);
    content.mask = mask;
    holder.addChild(content, mask);
    // Point de départ de la vue : la ville en ruine à l'horizon.
    const start = -surface.width * scale * 0.62;
    feed.tilePosition.x = start;
    this.screens.push({ floor, feed, grime, noise, base: start });
    return holder;
  }

  // -------------------------------------------------------------------------
  // API

  setSnapshot(s: Snapshot) {
    const first = !this.snap;
    this.snap = s;
    if (first) this.build(s.floors);
    this.nav.rebuild(s.floors.map((f) => f.lockdown));
    for (const g of this.floors) {
      const f = s.floors[g.index];
      if (g.lockdown !== f.lockdown) {
        g.lockdown = f.lockdown;
        this.drawLock(g);
      }
    }
  }

  setSettings(settings: RenderSettings) {
    this.settings = settings;
    this.effDensity = settings.density;
    this.effSecondary = settings.secondary;
  }

  setSelected(id?: string) {
    this.selected = id;
    for (const g of this.floors) g.highlight.visible = g.id === id;
  }

  focusFloor(id: string) {
    const g = this.floors.find((x) => x.id === id);
    if (!g) return;
    const viewH = this.app.screen.height / this.zoom;
    this.camY = g.index * FLOOR_H + ROOM_H / 2 - viewH / 2;
    this.clampCam();
  }

  focusRoom(id: string, side: 'left' | 'right') {
    const g = this.floors.find((x) => x.id === id);
    if (!g) return;
    this.zoom = Math.min(4, Math.max(1.5, (this.app.screen.width * 0.85) / ROOM_W));
    this.camX = side === 'left' ? ROOM_W / 2 : SHAFT_X + SHAFT_W + ROOM_W / 2;
    this.camY = g.index * FLOOR_H + ROOM_H / 2 - this.app.screen.height / this.zoom / 2;
    this.followCam = false;
  }

  // Vue Personne : un habitant réel, rendu par un sprite dédié qui suit sa routine.
  setFollow(t: { id: number; name: string; sector: SectorId; look: number; floorIndex: number; act: string } | null) {
    if (!t) {
      if (this.follow) {
        this.follow.sp.destroy();
        this.follow.label.destroy();
      }
      this.follow = null;
      return;
    }
    if (this.follow && this.follow.id !== t.id) this.setFollow(null);
    if (!this.follow) {
      const row = atlasRow(t.sector, t.look);
      const sp = new Sprite(this.frames[row][0]);
      sp.anchor.set(0.5, 1);
      this.fxLayer.addChild(sp);
      const label = new Text({ text: t.name, style: { fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: '700', fill: 0xe8a33c, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 1);
      this.ui.addChild(label);
      const x = this.randomSpotSafe(t.floorIndex);
      this.follow = { id: t.id, sp, label, row, floor: t.floorIndex, x, y: t.floorIndex * FLOOR_H + FEET_Y, targetFloor: t.floorIndex, act: t.act, route: [], stair: null, tx: x, facing: 1, ft: 0, anim: 'idle' };
      this.followCam = true;
    }
    const f = this.follow;
    f.act = t.act;
    if (t.floorIndex !== f.targetFloor) {
      f.targetFloor = t.floorIndex;
      const path = this.nav.path(f.floor, t.floorIndex, true) ?? [f.floor, t.floorIndex];
      f.route = path.slice(1);
      f.tx = LANDING_X;
    } else if (!f.stair && !f.route.length) f.tx = this.randomSpotSafe(f.floor);
  }

  recenterFollow() {
    this.followCam = true;
  }

  private randomSpotSafe(floor: number) {
    return this.snap ? this.randomSpot(floor) : 60;
  }

  private updateFollow(dt: number) {
    const f = this.follow;
    if (!f) return;
    if (f.stair) {
      f.stair.t += dt / 2.6;
      const p = this.stairPoint(f.stair.from, f.stair.to, Math.min(1, f.stair.t));
      f.x = p.x;
      f.y = p.y;
      f.facing = p.dir > 0 ? 1 : -1;
      f.anim = 'walk';
      if (f.stair.t >= 1) {
        f.floor = f.stair.to;
        f.stair = null;
        if (f.route.length) f.stair = { from: f.floor, to: f.route.shift()!, t: 0 };
        else f.tx = this.randomSpotSafe(f.floor);
      }
    } else {
      f.y = f.floor * FLOOR_H + FEET_Y;
      const d = f.tx - f.x;
      if (Math.abs(d) > 1.5) {
        f.facing = d > 0 ? 1 : -1;
        f.x += Math.sign(d) * Math.min(Math.abs(d), 22 * dt);
        f.anim = 'walk';
      } else if (f.route.length && Math.abs(f.x - LANDING_X) < 2) {
        f.stair = { from: f.floor, to: f.route.shift()!, t: 0 };
      } else {
        f.anim = f.act === 'work' ? 'work' : f.act === 'eat' || f.act === 'sleep' ? 'sit' : f.act === 'walk' ? 'idle' : 'talk';
        if (f.act === 'walk' && Math.random() < dt * 0.4) f.tx = this.randomSpotSafe(f.floor);
      }
    }
    const fr = FRAMES[f.anim];
    f.ft += dt * (f.anim === 'walk' ? 7 : 2);
    f.sp.texture = this.frames[f.row][fr[Math.floor(f.ft) % fr.length]];
    f.sp.position.set(Math.round(f.x), Math.round(f.y));
    f.sp.scale.x = f.facing;
    f.sp.tint = f.act === 'sleep' ? 0x9090a0 : 0xffffff;
    f.label.position.set(this.world.x + f.x * this.zoom, this.world.y + (f.y - CHAR_H - 3) * this.zoom);
    if (this.followCam) {
      const viewH = this.app.screen.height / this.zoom;
      const wantY = f.y - viewH / 2;
      this.camY += (wantY - this.camY) * Math.min(1, dt * 3);
      this.clampCam();
    }
  }

  zoomBy(factor: number, sx = this.app.screen.width / 2, sy = this.app.screen.height / 2) {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.min(4, Math.max(0.45, this.zoom * factor));
    this.camY = before.y - sy / this.zoom;
    this.camX = before.x - (sx - this.app.screen.width / 2) / this.zoom;
    this.clampCam();
  }

  fit() {
    const w = this.app.screen.width;
    this.zoom = Math.max(0.45, Math.min(3, (w - 150) / (SILO_W + 2 * WALL_W + 20)));
    this.camX = SILO_W / 2 - 60 / this.zoom;
    this.clampCam();
  }

  destroy() {
    this.app.destroy(true, { children: true });
  }

  // -------------------------------------------------------------------------
  // Caméra & entrées

  private toWorld(sx: number, sy: number) {
    return { x: this.camX + (sx - this.app.screen.width / 2) / this.zoom, y: this.camY + sy / this.zoom };
  }

  private clampCam() {
    const totalH = (this.snap?.floors.length ?? 12) * FLOOR_H;
    const viewH = this.app.screen.height / this.zoom;
    this.camY = Math.max(-SURFACE_H - 40, Math.min(totalH + 60 - viewH, this.camY));
    const viewW = this.app.screen.width / this.zoom;
    const minX = Math.min(SILO_W / 2, viewW / 2 - 180);
    const maxX = Math.max(SILO_W / 2, SILO_W - viewW / 2 + 60);
    this.camX = Math.max(minX, Math.min(maxX, this.camX));
  }

  private bindInput() {
    const canvas = this.app.canvas;
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey) this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
        else {
          this.camY += e.deltaY / this.zoom;
          this.camX += e.deltaX / this.zoom;
          this.clampCam();
        }
      },
      { passive: false },
    );
    this.app.stage.on('pointerdown', (e) => {
      this.drag = { x: e.global.x, y: e.global.y, cx: this.camX, cy: this.camY, moved: false };
    });
    this.app.stage.on('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.global.x - this.drag.x;
      const dy = e.global.y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        this.drag.moved = true;
        this.followCam = false;
      }
      this.camX = this.drag.cx - dx / this.zoom;
      this.camY = this.drag.cy - dy / this.zoom;
      this.clampCam();
    });
    const up = (e: { global: { x: number; y: number } }) => {
      if (this.drag && !this.drag.moved) this.click(e.global.x, e.global.y);
      this.drag = null;
    };
    this.app.stage.on('pointerup', up);
    this.app.stage.on('pointerupoutside', () => (this.drag = null));
  }

  private click(sx: number, sy: number) {
    const p = this.toWorld(sx, sy);
    if (!this.snap) return;
    // PNJ cliqué ?
    for (const n of this.npcs) {
      if (!n.active || n.mode === 'stairs') continue;
      if (Math.abs(n.x - p.x) < 6 && p.y < n.y && p.y > n.y - CHAR_H) {
        this.onSelectNpc?.(this.snap.floors[n.floor].id, n.sector);
        return;
      }
    }
    const i = Math.floor(p.y / FLOOR_H);
    if (i >= 0 && i < this.snap.floors.length && p.x > -200 && p.x < SILO_W + WALL_W) {
      const id = this.snap.floors[i].id;
      // Zoomé : un clic dans une salle ouvre la vue Salle.
      if (this.zoom >= 2 && p.y - i * FLOOR_H < ROOM_H && (p.x < SHAFT_X || p.x > SHAFT_X + SHAFT_W) && p.x > 0 && p.x < SILO_W) {
        this.onSelectRoom?.(id, p.x < SHAFT_X ? 'left' : 'right');
      } else this.onSelectFloor?.(id);
    }
  }

  // -------------------------------------------------------------------------
  // Boucle de rendu

  private visibleRange(): [number, number] {
    const top = this.camY;
    const bottom = this.camY + this.app.screen.height / this.zoom;
    const n = this.floors.length;
    return [Math.max(0, Math.floor(top / FLOOR_H)), Math.min(n - 1, Math.floor(bottom / FLOOR_H))];
  }

  private update(dt: number) {
    if (!this.snap || !this.floors.length) return;
    const s = this.snap;
    const W = this.app.screen.width;
    this.world.scale.set(this.zoom);
    this.world.position.set(Math.round(W / 2 - this.camX * this.zoom), Math.round(-this.camY * this.zoom));

    const [v0, v1] = this.visibleRange();
    const time = performance.now() / 1000;
    const secondary = this.effSecondary !== 'min';
    const blackout = s.energy.generatorState === 'failed';

    for (const g of this.floors) {
      const f = s.floors[g.index];
      const vis = g.index >= v0 - 1 && g.index <= v1 + 1;
      g.root.visible = vis;
      // Étiquettes en espace écran (texte net quel que soit le zoom)
      const sy = this.world.y + (g.index * FLOOR_H + 10) * this.zoom;
      // Étiquettes à gauche du silo ; si le bord gauche sort de l'écran, elles s'accrochent au bord.
      const edge = this.world.x - (WALL_W + 10) * this.zoom;
      const inside = edge < 120;
      const sx = inside ? 10 : edge;
      for (const t of [g.label, g.name, g.lockText]) t.anchor.set(inside ? 0 : 1, 0);
      const showLabel = vis && sy > -40 && sy < this.app.screen.height + 10;
      g.label.visible = g.name.visible = showLabel;
      g.label.position.set(sx, sy);
      g.name.position.set(sx, sy + 24);
      g.label.style.fill = this.selected === g.id ? 0xe8a33c : f.alert === 'critical' ? 0xff6b5a : f.alert === 'warning' ? 0xf0c060 : 0xd8dde3;
      g.badge.clear();
      if (showLabel && inside) {
        const w = Math.max(g.label.width, g.name.width) + 12;
        g.badge.roundRect(sx - 6, sy - 2, w, f.lockdown !== 'open' ? 58 : 42, 4).fill({ color: 0x0b0e12, alpha: 0.78 });
      }
      if (showLabel && f.incidentCount > 0) {
        g.badge.circle(inside ? sx + g.label.width + 9 : sx - g.label.width - 9, sy + 12, 5).fill(f.alert === 'critical' ? 0xd9443a : 0xe0a030);
      }
      g.lockText.visible = showLabel && f.lockdown !== 'open';
      g.lockText.text = f.lockdown === 'full' ? 'BLOCUS' : 'CONTRÔLE';
      g.lockText.position.set(sx, sy + 40);
      if (!vis) continue;

      // Éclairage : heure, énergie disponible, urgence
      let darkness = 0;
      const h = s.hour;
      const night = h >= 22 || h < 6;
      if (f.sector === 'residential' && night) darkness += 0.42;
      else if (f.sector !== 'residential' && !WORK_FLOORS_24H.has(f.sector) && (h >= 18 || h < 7)) darkness += 0.3;
      darkness += (1 - f.power) * 0.62;
      if (this.settings.lighting === 'low') darkness *= 0.8;
      let flick = 0;
      if (secondary && (f.power < 0.75 || f.alert === 'critical')) {
        g.flicker -= dt;
        if (g.flicker < 0) g.flicker = Math.random() < 0.08 ? 0.12 : 0.6 * Math.random();
        flick = g.flicker > 0 && g.flicker < 0.12 ? 0.25 : 0;
      }
      g.dark.alpha = Math.min(0.85, darkness + flick);
      this.ambient.updateFloor(g.index, f, s, dt, time, flick, { secondary: this.effSecondary, lighting: this.settings.lighting, zoom: this.zoom });
      let redA = 0;
      if (blackout && f.power < 0.5) redA = 0.1 + 0.06 * Math.sin(time * 3);
      if (f.unrest >= 4) redA = Math.max(redA, 0.12 + 0.05 * Math.sin(time * 5));
      if (f.lockdown === 'full') redA = Math.max(redA, 0.05 + 0.03 * Math.sin(time * 2));
      g.red.alpha = this.settings.lighting === 'low' ? redA * 0.6 : redA;
      if (g.lockdown !== 'open') g.lock.alpha = 0.75 + 0.25 * Math.sin(time * 4);
      g.tags.forEach((t, k) => {
        t.visible = !!f.factionSymbol && (k === 0 || f.unrest >= 1 || k < 2);
        if (t.visible && t.text !== f.factionSymbol) t.text = f.factionSymbol!;
      });
    }

    // Écrans : lente dérive de la caméra extérieure, saleté, parasites, coupure.
    const screensOff = s.tags.includes('screens_off');
    for (const sc of this.screens) {
      const f = s.floors[sc.floor];
      const off = screensOff || f.power < 0.25;
      sc.feed.visible = sc.grime.visible = !off;
      if (off) continue;
      sc.feed.tilePosition.x = sc.base + Math.sin(time * 0.05 + sc.floor) * 40;
      sc.grime.alpha = Math.min(0.92, (1 - s.lens) * 1.1);
      sc.feed.alpha = 0.55 + s.lens * 0.45;
      sc.noise.alpha = secondary && Math.random() < 0.03 ? 0.08 + Math.random() * 0.12 : Math.max(0, sc.noise.alpha - dt);
    }
    this.updateElevator(dt, v0, v1);
    this.reconcileT -= dt;
    if (this.reconcileT <= 0) {
      this.reconcileT = 1.2;
      this.reconcile(v0, v1);
    }
    const mul = s.speed === 0 ? 0.35 : 1 + Math.log2(Math.max(1, s.speed)) * 0.25;
    this.updateQueues(dt * mul);
    for (const n of this.npcs) if (n.active) this.updateNpc(n, dt * mul, time);
    if (secondary) this.updateSparks(dt);
    this.ambient.updateParticles(dt, time);
    this.updateFollow(dt * mul);
    this.adaptive(dt);
  }

  private drawLock(g: FloorGfx) {
    g.lock.clear();
    if (g.lockdown === 'open') return;
    const color = g.lockdown === 'full' ? 0xd9443a : 0xe0a030;
    for (const x of [SHAFT_X - 4, SHAFT_X + SHAFT_W]) {
      const h = g.lockdown === 'full' ? 34 : 14;
      for (let y = 0; y < h; y += 6) {
        g.lock.rect(x, FEET_Y - h + y, 4, 3).fill(color);
        g.lock.rect(x, FEET_Y - h + y + 3, 4, 3).fill(0x1a1a1a);
      }
      g.lock.rect(x + 1, FEET_Y - h - 4, 2, 2).fill(0xff3020);
    }
  }

  private updateElevator(dt: number, v0: number, v1: number) {
    const s = this.snap!;
    const broken = s.assets.find((a) => a.id === 'elevator')?.state === 'failed' || s.energy.generatorState === 'failed';
    this.elevator.alpha = broken ? 0.5 : 1;
    if (broken) return;
    if (this.elevatorWait > 0) {
      this.elevatorWait -= dt;
      return;
    }
    const d = this.elevatorTarget - this.elevatorY;
    if (Math.abs(d) < 1) {
      this.elevatorWait = 1 + Math.random() * 2.5;
      const target = Math.floor(v0 + Math.random() * (v1 - v0 + 1));
      this.elevatorTarget = target * FLOOR_H + FEET_Y - 16;
    } else this.elevatorY += Math.sign(d) * Math.min(Math.abs(d), 60 * dt);
    this.elevator.y = this.elevatorY;
  }

  // -------------------------------------------------------------------------
  // PNJ : allocation statistique (la population réelle est dans le Worker)

  private desiredCounts(v0: number, v1: number) {
    const s = this.snap!;
    const counts = new Map<number, number>();
    let total = 0;
    const weights: number[] = [];
    for (let i = Math.max(0, v0 - 1); i <= Math.min(this.floors.length - 1, v1 + 1); i++) {
      const f = s.floors[i];
      const a = f.activity;
      let w = a.work + a.walk * 1.2 + a.eat + a.leisure * 0.6 + a.sleep * 0.03;
      if (this.gathering(f) && this.hasSpots(i, 'screen')) w *= 1.8;
      // La nuit, les dortoirs et l'infirmerie montrent leurs dormeurs.
      if (this.hasSpots(i, 'beds')) w += a.sleep * 0.12;
      weights[i] = w;
      total += w;
    }
    const cap = this.effDensity;
    const perFloorMax = Math.max(8, Math.min(46, Math.round(cap / Math.max(1, v1 - v0 + 1)) + 6));
    const k = total > 0 ? Math.min(0.25, cap / total) : 0;
    for (let i = Math.max(0, v0 - 1); i <= Math.min(this.floors.length - 1, v1 + 1); i++) {
      counts.set(i, Math.min(perFloorMax, Math.max(weights[i] > 0 ? 2 : 0, Math.round(weights[i] * k))));
    }
    return counts;
  }

  private reconcile(v0: number, v1: number) {
    const s = this.snap!;
    const want = this.desiredCounts(v0, v1);
    const have = new Map<number, Npc[]>();
    for (const n of this.npcs) {
      if (!n.active) continue;
      if (!want.has(n.floor) && n.mode !== 'stairs') {
        this.release(n);
        continue;
      }
      if (n.leaving) continue;
      if (!have.has(n.floor)) have.set(n.floor, []);
      have.get(n.floor)!.push(n);
    }
    for (const [i, target] of want) {
      const list = have.get(i) ?? [];
      const f = s.floors[i];
      // Adjoints postés aux accès des étages bloqués
      if (f.lockdown !== 'open') {
        const posts = list.filter((n) => n.task === 'post').length;
        for (let k = posts; k < 2; k++) {
          const n = this.spawn(i, 'security');
          if (!n) break;
          n.task = 'post';
          n.x = LANDING_X + (k === 0 ? -28 : 28);
          n.facing = k === 0 ? -1 : 1;
          n.authorized = true;
        }
      }
      // Adjoints en patrouille (deux silhouettes par patrouille)
      const wantPatrol = Math.min(4, (f.patrol ?? 0) * 2);
      const patrolling = list.filter((n) => n.task === 'patrol');
      for (let k = patrolling.length; k < wantPatrol; k++) {
        const n = this.spawn(i, 'security');
        if (!n) break;
        n.task = 'patrol';
        n.authorized = true;
        n.speed = 10 + Math.random() * 3;
      }
      for (const n of patrolling.slice(wantPatrol)) {
        n.task = 'wander';
        this.leave(n);
      }
      if (list.length > target + 3) {
        // Surplus : ils prennent l'escalier
        const night = s.hour >= 21 || s.hour < 6;
        const doors = this.spotsOf(i, 'doors');
        for (const n of list.slice(0, list.length - target)) {
          if (n.task === 'post' || n.task === 'patrol' || n.task === 'home') continue;
          if (night && doors.length) this.goHome(n, doors);
          else this.leave(n);
        }
      } else if (list.length < target) {
        for (let k = list.length; k < target; k++) {
          const sector = this.pickSector(f);
          const n = this.spawn(i, sector);
          if (!n) break;
        }
      }
    }
  }

  private pickSector(f: FloorView): SectorId {
    const h = this.snap!.hour;
    const working = (h >= 7 && h < 12) || (h >= 13 && h < 17);
    const r = Math.random();
    if (f.sector !== 'residential' && working && r < 0.78) return f.sector;
    if (f.cleanliness < 45 && r > 0.88) return 'sanitation';
    if (r < 0.55) return 'residential';
    const all: SectorId[] = ['mechanical', 'agriculture', 'supplies', 'mines', 'admin', 'medical', 'water', 'energy', 'security', 'sanitation'];
    return all[Math.floor(Math.random() * all.length)];
  }

  private spawn(floor: number, sector: SectorId): Npc | null {
    const n = this.npcs.find((x) => !x.active);
    const activeCount = this.npcs.reduce((a, x) => a + (x.active ? 1 : 0), 0);
    if (!n || activeCount >= this.effDensity + 8) return null;
    n.active = true;
    n.floor = floor;
    n.sector = sector;
    n.row = atlasRow(sector, Math.floor(Math.random() * 1000));
    n.task = 'wander';
    n.leaving = false;
    n.route = [];
    n.stair = null;
    n.authorized = sector === 'security' || sector === 'medical' || sector === 'mechanical';
    n.speed = 13 + Math.random() * 8;
    n.mode = 'idle';
    n.timer = Math.random() * 2;
    n.fade = 0;
    n.facing = Math.random() < 0.5 ? 1 : -1;
    n.x = this.randomSpot(floor);
    n.y = floor * FLOOR_H + FEET_Y;
    n.after = undefined;
    n.vanish = false;
    n.eating = false;
    n.spot = undefined;
    // Enfants : nombreux à l'école en journée, quelques-uns ailleurs (jamais la nuit).
    const h = this.snap!.hour;
    const schoolTime = h >= 6 && h < 16 && this.snap!.floors[floor].left === 'school';
    n.child = sector === 'residential' && h >= 7 && h < 21 && Math.random() < (schoolTime ? 0.85 : 0.12);
    if (n.child) n.speed += 4;
    // Le matin, on sort de chez soi.
    const doors = this.spotsOf(floor, 'doors');
    if (doors.length && h >= 6 && h < 9 && Math.random() < 0.6) {
      n.x = doors[Math.floor(Math.random() * doors.length)].x;
      n.sp.visible = true;
      n.sp.alpha = 0;
      return n;
    }
    // Parfois ils arrivent par l'escalier
    const lock = this.snap!.floors[floor].lockdown;
    if (Math.random() < 0.35 && lock === 'open') {
      const from = floor + (Math.random() < 0.5 ? -1 : 1);
      if (from >= 0 && from < this.floors.length) {
        n.stair = { from, to: floor, t: 0.45 };
        n.mode = 'stairs';
        n.x = LANDING_X;
      }
    }
    n.sp.visible = true;
    n.sp.alpha = 0;
    return n;
  }

  private release(n: Npc) {
    this.unclaim(n);
    n.after = undefined;
    n.vanish = false;
    n.eating = false;
    n.active = false;
    n.sp.visible = false;
    n.bubble.visible = false;
  }

  private leave(n: Npc) {
    const s = this.snap!;
    this.unclaim(n);
    n.after = undefined;
    n.eating = false;
    n.yOff = 0;
    if (n.task !== 'post' && n.task !== 'patrol') n.task = 'wander';
    const dir = Math.random() < 0.5 ? -1 : 1;
    const to = Math.min(this.floors.length - 1, Math.max(0, n.floor + dir));
    const path = this.nav.path(n.floor, to, n.authorized);
    if (!path || path.length < 2 || s.floors[n.floor].lockdown === 'full') {
      n.mode = 'walk';
      n.tx = this.randomSpot(n.floor);
      n.leaving = true;
      n.timer = 4;
      return;
    }
    n.leaving = true;
    n.route = path.slice(1);
    n.mode = 'walk';
    n.tx = LANDING_X;
  }

  private randomSpot(floor: number) {
    const f = this.snap!.floors[floor];
    const avoidLanding = f.lockdown !== 'open';
    for (let k = 0; k < 6; k++) {
      const x = Math.random() < 0.5 ? 14 + Math.random() * (ROOM_W - 30) : SHAFT_X + SHAFT_W + 14 + Math.random() * (ROOM_W - 30);
      if (!avoidLanding || Math.abs(x - LANDING_X) > 70) return x;
    }
    return 60;
  }

  private setAnim(n: Npc, a: Anim) {
    if (n.anim !== a) {
      n.anim = a;
      n.fi = 0;
      n.ft = 0;
    }
  }

  private decide(n: Npc) {
    const s = this.snap!;
    const f = s.floors[n.floor];
    const h = s.hour;
    const r = Math.random();
    n.bubble.visible = false;
    // Arrivé·e à destination : on fait ce qu'on était venu faire.
    if (n.after) {
      const a = n.after;
      n.after = undefined;
      n.mode = 'act';
      if (a.act === 'vanish') {
        n.vanish = true;
        n.act = 'idle';
        n.timer = 99;
        return;
      }
      n.act = a.act;
      n.timer = a.t;
      if (a.facing) n.facing = a.facing;
      n.eating = n.task === 'eat';
      n.yOff = n.task === 'bed' && a.act === 'sit' ? -17 : 0;
      if (a.bubble && this.effSecondary !== 'min') this.showBubble(n, Math.random() < 0.4);
      return;
    }
    if (n.task === 'queue') {
      n.mode = 'act';
      n.act = 'idle';
      n.timer = 99;
      return;
    }
    // Activité terminée : on libère sa place.
    n.eating = false;
    n.yOff = 0;
    if (n.task !== 'post' && n.task !== 'patrol') {
      this.unclaim(n);
      if (n.task !== 'repair' && n.task !== 'protest') n.task = 'wander';
    }
    if (n.task === 'patrol') {
      this.patrolStep(n);
      return;
    }
    if (n.task === 'post') {
      this.setAnim(n, 'idle');
      n.mode = 'act';
      n.act = Math.random() < 0.2 ? 'talk' : 'idle';
      n.timer = 3 + Math.random() * 4;
      return;
    }
    // Panne générale : on s'arrête, on regarde, on chuchote
    if (f.power < 0.3) {
      n.mode = 'act';
      n.act = r < 0.35 ? 'talk' : 'idle';
      n.timer = 2 + Math.random() * 5;
      if (r < 0.15 && this.effSecondary !== 'min') this.showBubble(n, true);
      return;
    }
    if (f.repairing && n.sector === 'mechanical' && r < 0.8) {
      n.task = 'repair';
      const spot = n.x < LANDING_X ? 150 + Math.random() * 40 : SHAFT_X + SHAFT_W + 130 + Math.random() * 40;
      if (Math.abs(n.x - spot) > 6) {
        n.mode = 'walk';
        n.tx = spot;
      } else {
        n.mode = 'act';
        n.act = 'repair';
        n.timer = 4 + Math.random() * 4;
      }
      return;
    }
    if (f.unrest >= 3 && n.sector === 'residential') {
      n.task = 'protest';
      const spot = LANDING_X + (n.x < LANDING_X ? -50 : 50) + (Math.random() - 0.5) * 40;
      if (Math.abs(n.x - spot) > 10) {
        n.mode = 'walk';
        n.tx = spot;
      } else {
        n.mode = 'act';
        n.act = r < 0.5 ? 'talk' : 'idle';
        n.facing = n.x < LANDING_X ? 1 : -1;
        n.timer = 2 + Math.random() * 3;
        if (r < 0.3 && this.effSecondary !== 'min') this.showBubble(n, true);
      }
      return;
    }
    const working = (h >= 7 && h < 12) || (h >= 13 && h < (s.policies.extendedHours ? 20 : 17));
    if (this.dailyLife(n, f, h, r)) return;
    if (working && n.sector === f.sector && r < 0.6) {
      n.mode = 'act';
      n.act = this.workAnim(n.sector);
      n.timer = 3 + Math.random() * 6;
      if (n.act === 'carry') {
        n.mode = 'walk';
        n.tx = this.randomSpot(n.floor);
      }
      return;
    }
    if (r < 0.45) {
      n.mode = 'walk';
      n.tx = this.randomSpot(n.floor);
      if (Math.random() < 0.05 && !n.leaving) this.leave(n);
    } else if (r < 0.65 + f.rumor * 0.15) {
      // Discussion avec un voisin (plus fréquente quand une rumeur circule sur l'étage)
      const other = this.npcs.find((o) => o !== n && o.active && o.floor === n.floor && o.mode !== 'stairs' && o.task === 'wander' && Math.abs(o.x - n.x) < 30);
      n.mode = 'act';
      n.act = 'talk';
      n.timer = 2 + Math.random() * 3;
      if (other) {
        n.facing = other.x > n.x ? 1 : -1;
        other.facing = n.x > other.x ? 1 : -1;
        other.mode = 'act';
        other.act = 'idle';
        other.timer = n.timer;
        if (this.effSecondary !== 'min' && Math.random() < 0.4 + f.rumor * 0.6) this.showBubble(n, f.rumor > 0.5 && Math.random() < 0.3);
      }
    } else if (r < 0.75) {
      n.mode = 'act';
      n.act = 'sit';
      n.timer = 3 + Math.random() * 5;
    } else {
      n.mode = 'act';
      n.act = 'idle';
      n.timer = 1 + Math.random() * 3;
    }
  }

  // -------------------------------------------------------------------------
  // Vie quotidienne : points d'intérêt des salles

  private wingsOf(fi: number) {
    const f = this.snap!.floors[fi];
    return [
      { tex: f.left, x0: 0, mirrored: false },
      { tex: f.right, x0: SHAFT_X + SHAFT_W, mirrored: f.left === f.right },
    ];
  }

  private spotsOf(fi: number, kind: keyof RoomSpots): { x: number; key: string }[] {
    if (!this.snap || !this.snap.floors[fi]) return [];
    const out: { x: number; key: string }[] = [];
    this.wingsOf(fi).forEach((w, wi) => {
      const sp = SPOTS[w.tex]?.[kind];
      if (sp === undefined || kind === 'queue') return;
      const list = Array.isArray(sp) ? sp : [sp as number];
      for (const lx of list) out.push({ x: w.mirrored ? w.x0 + ROOM_W - lx : w.x0 + lx, key: `${fi}:${wi}:${kind}:${lx}` });
    });
    return out;
  }

  private hasSpots(fi: number, kind: keyof RoomSpots) {
    return this.spotsOf(fi, kind).length > 0;
  }

  /** Réserve le point libre le plus proche (parmi les trois plus proches, au hasard). */
  private claim(n: Npc, kind: keyof RoomSpots): number | undefined {
    const free = this.spotsOf(n.floor, kind).filter((p) => !this.taken.has(p.key));
    if (!free.length) return undefined;
    free.sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
    const p = free[Math.floor(Math.random() * Math.min(3, free.length))];
    this.unclaim(n);
    this.taken.add(p.key);
    n.spot = p.key;
    return p.x;
  }

  private unclaim(n: Npc) {
    if (n.spot) this.taken.delete(n.spot);
    n.spot = undefined;
  }

  private goDo(n: Npc, x: number, task: Task, after: NonNullable<Npc['after']>) {
    n.task = task;
    n.after = after;
    if (Math.abs(n.x - x) > 1.5) {
      n.mode = 'walk';
      n.tx = x;
    } else {
      n.mode = 'idle';
      n.timer = 0;
    }
  }

  /** Rentrer chez soi : marcher jusqu'à une porte et disparaître derrière. */
  private goHome(n: Npc, doors: { x: number }[]) {
    const d = doors.reduce((a, b) => (Math.abs(b.x - n.x) < Math.abs(a.x - n.x) ? b : a));
    this.unclaim(n);
    n.leaving = true;
    this.goDo(n, d.x + (Math.random() - 0.5) * 4, 'home', { act: 'vanish', t: 0 });
  }

  private isCanteen(f: FloorView) {
    return !!f.cafeteria || f.left === 'canteen' || f.right === 'canteen';
  }

  /** Moments où l'on se rassemble devant l'écran : panne, commémoration, rumeur sur le dehors. */
  private crisisCache?: { snap: Snapshot; value: boolean };
  private gathering(_f: FloorView) {
    const s = this.snap!;
    if (this.crisisCache?.snap === s) return this.crisisCache.value;
    const value =
      s.energy.generatorState === 'failed' ||
      s.decisions.some((d) => d.defId === 'commemoration' || d.defId === 'founding_day' || d.defId === 'archive_decoded' || d.defId === 'truth_leak') ||
      s.rumors.some((r) => r.templateId === 'dehors_bouge' && r.status === 'spreading');
    this.crisisCache = { snap: s, value };
    return value;
  }

  private queueList(fi: number) {
    const out: Queue[] = [];
    this.wingsOf(fi).forEach((w, wi) => {
      const q = SPOTS[w.tex]?.queue;
      if (!q) return;
      const key = `${fi}:${wi}`;
      let entry = this.queues.get(key);
      if (!entry) {
        entry = { floor: fi, head: w.mirrored ? w.x0 + ROOM_W - q.head : w.x0 + q.head, dir: (w.mirrored ? -q.dir : q.dir) as 1 | -1, list: [], timer: 2 };
        this.queues.set(key, entry);
      }
      out.push(entry);
    });
    return out;
  }

  private joinQueue(n: Npc) {
    const qs = this.queueList(n.floor).filter((q) => q.list.length < 7);
    if (!qs.length) return false;
    const q = qs.reduce((a, b) => (b.list.length < a.list.length ? b : a));
    this.unclaim(n);
    n.task = 'queue';
    n.after = undefined;
    q.list.push(n);
    n.mode = 'walk';
    n.tx = q.head - q.dir * (q.list.length - 1) * 7;
    return true;
  }

  /** Files d'attente aux comptoirs : on avance d'un cran à chaque plateau servi. */
  private updateQueues(dt: number) {
    if (!this.snap) return;
    const h = this.snap.hour;
    const meal = h === 7 || (h >= 11 && h < 14) || (h >= 18 && h < 21);
    for (const q of this.queues.values()) {
      q.list = q.list.filter((n) => n.active && n.task === 'queue' && n.floor === q.floor && n.mode !== 'stairs');
      if (!q.list.length) continue;
      if (!meal) {
        for (const n of q.list) {
          n.task = 'wander';
          n.mode = 'idle';
          n.timer = Math.random();
        }
        q.list = [];
        continue;
      }
      q.timer -= dt;
      const head = q.list[0];
      if (q.timer <= 0 && Math.abs(head.x - q.head) < 2) {
        q.list.shift();
        q.timer = 2.5 + Math.random() * 2;
        head.task = 'eat';
        const seat = this.claim(head, 'seats');
        if (seat !== undefined) this.goDo(head, seat, 'eat', { act: 'sit', t: 9 + Math.random() * 7 });
        else {
          head.task = 'wander';
          head.mode = 'walk';
          head.tx = this.randomSpot(head.floor);
        }
      }
      q.list.forEach((n, i) => {
        const slot = q.head - q.dir * i * 7;
        if (Math.abs(n.x - slot) > 1.5) {
          if (n.mode !== 'walk' || Math.abs(n.tx - slot) > 1) {
            n.mode = 'walk';
            n.tx = slot;
          }
        } else if (n.mode !== 'act') {
          n.mode = 'act';
          n.act = 'idle';
          n.timer = 99;
          n.facing = q.dir;
        }
      });
    }
  }

  /** Adjoints en patrouille : ils arpentent l'étage, s'arrêtent, observent. */
  private patrolStep(n: Npc) {
    if (Math.random() < 0.55) {
      n.mode = 'walk';
      n.tx = this.randomSpot(n.floor);
    } else {
      n.mode = 'act';
      n.act = Math.random() < 0.25 ? 'talk' : 'idle';
      n.timer = 1.5 + Math.random() * 2.5;
    }
  }

  /** Journée type selon l'heure et la salle : repas, école, marché, sommeil, soins, assemblée. */
  private dailyLife(n: Npc, f: FloorView, h: number, r: number): boolean {
    const fi = n.floor;
    const night = h >= 21 || h < 6;
    const meal = h === 7 || (h >= 11 && h < 14) || (h >= 18 && h < 21);
    const screens = this.spotsOf(fi, 'screen');
    if (screens.length && this.gathering(f) && r < 0.7) {
      const sc = screens[Math.floor(Math.random() * screens.length)];
      const x = sc.x + (Math.random() - 0.5) * 90;
      this.goDo(n, x, 'gather', { act: Math.random() < 0.5 ? 'talk' : 'idle', t: 4 + Math.random() * 5, facing: x < sc.x ? 1 : -1, bubble: Math.random() < 0.35 });
      return true;
    }
    if (meal && this.isCanteen(f) && !n.child) {
      if (r < 0.45 && this.joinQueue(n)) return true;
      if (r < 0.8) {
        const seat = this.claim(n, 'seats');
        if (seat !== undefined) {
          this.goDo(n, seat, 'eat', { act: 'sit', t: 8 + Math.random() * 6 });
          return true;
        }
      }
    }
    if (night) {
      if (r < 0.9) {
        const bed = this.claim(n, 'beds');
        if (bed !== undefined) {
          this.goDo(n, bed, 'bed', { act: 'sit', t: 15 + Math.random() * 15 });
          return true;
        }
      }
      const doors = this.spotsOf(fi, 'doors');
      if (doors.length && r < 0.4) {
        this.goHome(n, doors);
        return true;
      }
    }
    // Infirmerie : des patients dans les lits, le personnel passe de lit en lit.
    if (this.hasSpots(fi, 'beds') && f.sector === 'medical') {
      if (n.sector !== 'medical' && r < 0.55) {
        const bed = this.claim(n, 'beds');
        if (bed !== undefined) {
          this.goDo(n, bed, 'bed', { act: 'sit', t: 10 + Math.random() * 12 });
          return true;
        }
      } else if (n.sector === 'medical' && r < 0.5) {
        const beds = this.spotsOf(fi, 'beds');
        const b = beds[Math.floor(Math.random() * beds.length)];
        this.goDo(n, b.x + (Math.random() < 0.5 ? -8 : 8), 'seat', { act: 'work', t: 3 + Math.random() * 3, facing: undefined });
        return true;
      }
    }
    // École : les enfants aux pupitres, un·e adulte au tableau.
    if (h >= 8 && h < 16 && this.hasSpots(fi, 'desks') && f.left === 'school') {
      if (n.child && r < 0.85) {
        const desk = this.claim(n, 'desks');
        if (desk !== undefined) {
          this.goDo(n, desk, 'school', { act: 'sit', t: 10 + Math.random() * 10 });
          return true;
        }
      } else if (!n.child && r < 0.5) {
        const lec = this.claim(n, 'lectern');
        if (lec !== undefined) {
          this.goDo(n, lec, 'school', { act: 'talk', t: 6 + Math.random() * 6 });
          return true;
        }
        // Les adultes laissent la place aux élèves.
        if (r < 0.35 && !n.leaving) {
          this.leave(n);
          return true;
        }
      }
    }
    // Bazar : on flâne devant les étals, surtout le soir.
    const stalls = this.spotsOf(fi, 'stalls');
    if (stalls.length && !night && r < (h >= 17 && h < 21 ? 0.75 : 0.35)) {
      const st = stalls[Math.floor(Math.random() * stalls.length)];
      this.goDo(n, st.x + (Math.random() - 0.5) * 14, 'shop', { act: Math.random() < 0.4 ? 'talk' : 'idle', t: 4 + Math.random() * 4, facing: Math.random() < 0.5 ? 1 : -1, bubble: Math.random() < 0.2 });
      return true;
    }
    // Salles d'assemblée (conseil, tribunal), canapés des coursives.
    if (!this.isCanteen(f) && this.hasSpots(fi, 'seats')) {
      const assembly = f.left === 'council' || f.right === 'council' || f.left === 'court' || f.right === 'court';
      if ((assembly && h >= 8 && h < 18 && r < 0.45) || (!assembly && r < 0.12)) {
        const seat = this.claim(n, 'seats');
        if (seat !== undefined) {
          this.goDo(n, seat, 'seat', { act: 'sit', t: 6 + Math.random() * 8 });
          return true;
        }
      }
      if (assembly && r > 0.92) {
        const lec = this.claim(n, 'lectern');
        if (lec !== undefined) {
          this.goDo(n, lec, 'seat', { act: 'talk', t: 5 + Math.random() * 5 });
          return true;
        }
      }
    }
    return false;
  }

  private workAnim(sector: SectorId): Anim {
    switch (sector) {
      case 'mechanical':
      case 'water':
      case 'energy':
        return Math.random() < 0.5 ? 'repair' : 'work';
      case 'supplies':
      case 'sanitation':
        return Math.random() < 0.6 ? 'carry' : 'work';
      case 'mines':
        return Math.random() < 0.4 ? 'carry' : 'repair';
      default:
        return 'work';
    }
  }

  private showBubble(n: Npc, alert: boolean) {
    n.bubble.texture = alert ? this.alertTex : this.bubbleTex;
    n.bubble.visible = true;
    n.bubbleT = 1.6;
  }

  private stairPoint(from: number, to: number, t: number) {
    // Le segment d'escalier dessiné dans l'étage inférieur relie les deux paliers.
    const lower = Math.max(from, to);
    const flip = lower % 2 === 1;
    const topX = SHAFT_X + (flip ? 52 : 6);
    const botX = SHAFT_X + (flip ? 6 : 52);
    const yUpper = Math.min(from, to) * FLOOR_H + FEET_Y;
    const yTop = lower * FLOOR_H + 2;
    const yBot = lower * FLOOR_H + ROOM_H - 12;
    const yLower = lower * FLOOR_H + FEET_Y;
    const pts: [number, number][] = [
      [LANDING_X, yUpper],
      [topX, yTop],
      [botX, yBot],
      [LANDING_X, yLower],
    ];
    const seq = from < to ? pts : pts.slice().reverse();
    const seg = [0.12, 0.88, 1];
    let i = 0;
    while (i < 2 && t > seg[i]) i++;
    const t0 = i === 0 ? 0 : seg[i - 1];
    const lt = (t - t0) / (seg[i] - t0);
    const a = seq[i];
    const b = seq[i + 1];
    return { x: a[0] + (b[0] - a[0]) * lt, y: a[1] + (b[1] - a[1]) * lt, dir: Math.sign(b[0] - a[0]) || 1 };
  }

  private updateNpc(n: Npc, dt: number, time: number) {
    const s = this.snap!;
    if (n.vanish) {
      n.fade -= dt * 2.5;
      if (n.fade <= 0) {
        this.release(n);
        return;
      }
    } else n.fade = Math.min(1, n.fade + dt * 2.5);
    if (n.mode === 'stairs' && n.stair) {
      n.stair.t += dt / 3.2;
      const p = this.stairPoint(n.stair.from, n.stair.to, Math.min(1, n.stair.t));
      n.x = p.x;
      n.y = p.y;
      n.facing = p.dir > 0 ? 1 : -1;
      this.setAnim(n, n.sector === 'supplies' && n.leaving ? 'carry' : 'walk');
      if (n.stair.t >= 1) {
        n.floor = n.stair.to;
        n.stair = null;
        const [v0, v1] = this.visibleRange();
        if (n.floor < v0 - 1 || n.floor > v1 + 1) {
          this.release(n);
          return;
        }
        if (n.route.length) {
          const next = n.route.shift()!;
          n.stair = { from: n.floor, to: next, t: 0 };
        } else {
          n.mode = 'walk';
          n.leaving = false;
          n.tx = this.randomSpot(n.floor);
        }
      }
    } else {
      n.y = n.floor * FLOOR_H + FEET_Y;
      if (n.mode === 'walk') {
        const d = n.tx - n.x;
        if (Math.abs(d) < 1.5) {
          if (n.leaving && n.route.length && Math.abs(n.x - LANDING_X) < 2) {
            const next = n.route.shift()!;
            n.mode = 'stairs';
            n.stair = { from: n.floor, to: next, t: 0 };
          } else if (n.leaving && !n.route.length) {
            n.leaving = false;
            n.mode = 'idle';
          } else {
            n.mode = 'idle';
            n.timer = 0;
          }
        } else {
          n.facing = d > 0 ? 1 : -1;
          n.x += Math.sign(d) * Math.min(Math.abs(d), n.speed * dt);
          this.setAnim(n, n.act === 'carry' ? 'carry' : 'walk');
        }
      } else if (n.mode === 'act') {
        this.setAnim(n, n.act);
        n.timer -= dt;
        if (n.act === 'repair' && n.task === 'repair' && Math.random() < dt * 3) this.emitSpark(n.x + n.facing * 6, n.y - 18);
        if (n.timer <= 0) {
          n.mode = 'idle';
          n.timer = 0;
          if (n.act === 'carry') n.act = 'idle';
        }
      } else {
        this.setAnim(n, 'idle');
        n.timer -= dt;
        if (n.timer <= 0) this.decide(n);
      }
    }
    // Animation
    const fr = FRAMES[n.anim];
    const fps = n.anim === 'walk' || n.anim === 'carry' ? 7 : n.anim === 'repair' || n.anim === 'work' ? 3 : 1.2;
    n.ft += dt * fps;
    n.fi = Math.floor(n.ft) % fr.length;
    n.sp.texture = this.frames[n.row][fr[n.fi]];
    n.sp.position.set(Math.round(n.x), Math.round(n.y));
    // On mange : petit mouvement de cuillère.
    if (n.eating && n.mode === 'act' && n.act === 'sit') n.sp.y -= Math.floor(time * 2.2 + n.x * 0.37) % 2;
    if (n.yOff && n.mode === 'act') n.sp.y += n.yOff;
    const k = n.child ? 0.72 : 1;
    n.sp.scale.set(n.facing * k, k);
    // Ombre & lumière : les PNJ s'assombrissent avec leur étage
    const f = s.floors[n.floor];
    const light = 1 - Math.min(0.75, (1 - f.power) * 0.6);
    const v = Math.round(255 * light);
    n.sp.tint = (v << 16) | (v << 8) | v;
    n.sp.alpha = n.fade;
    if (n.bubble.visible) {
      n.bubbleT -= dt;
      n.bubble.position.set(Math.round(n.x + 3), Math.round(n.y - CHAR_H * k - 2 + Math.sin(time * 4)));
      if (n.bubbleT <= 0) n.bubble.visible = false;
    }
  }

  private emitSpark(x: number, y: number) {
    const sp = this.sparks.find((p) => p.life <= 0);
    if (!sp) return;
    sp.life = 0.4 + Math.random() * 0.3;
    sp.vx = (Math.random() - 0.5) * 40;
    sp.vy = -20 - Math.random() * 30;
    sp.sp.position.set(x, y);
    sp.sp.tint = Math.random() < 0.5 ? 0xffd34a : 0xffffff;
    sp.sp.visible = true;
  }

  private updateSparks(dt: number) {
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += 90 * dt;
      p.sp.x += p.vx * dt;
      p.sp.y += p.vy * dt;
      if (p.life <= 0) p.sp.visible = false;
    }
  }

  // Dégradation adaptative : on réduit d'abord les animations secondaires, puis la densité.
  private adaptive(dt: number) {
    this.fpsT += dt;
    this.fpsFrames++;
    if (this.fpsT < 2) return;
    this.fps = this.fpsFrames / this.fpsT;
    this.fpsT = 0;
    this.fpsFrames = 0;
    if (!this.settings.adaptive) return;
    if (this.fps < 40 && this.effSecondary !== 'min') this.effSecondary = 'min';
    else if (this.fps < 34) this.effDensity = Math.max(50, Math.round(this.effDensity * 0.75));
    else if (this.fps > 56) {
      this.effDensity = Math.min(this.settings.density, this.effDensity + 20);
      if (this.effDensity === this.settings.density) this.effSecondary = this.settings.secondary;
    }
  }

  get visibleFloorIds() {
    const [a, b] = this.visibleRange();
    return this.floors.slice(a, b + 1).map((f) => f.id);
  }

  get activeNpcs() {
    return this.npcs.reduce((a, n) => a + (n.active ? 1 : 0), 0);
  }
}
