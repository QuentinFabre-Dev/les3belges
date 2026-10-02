// Ambiance sonore procédurale (Web Audio, aucun fichier) — §70 : « l'événement doit être visible, audible et systémique ».
// Couches : bourdonnement de la génératrice (le cœur du silo), ventilation, rumeur de foule,
// gouttes, alarmes ; plus quelques signaux d'interface.
import type { Snapshot } from '../sim/types';

type Ramp = { param: AudioParam; value: number; time?: number };

function noiseBuffer(ctx: AudioContext, seconds: number, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = white;
  }
  return buf;
}

export class SoundEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private humGain?: GainNode;
  private humOsc: OscillatorNode[] = [];
  private humLfo?: OscillatorNode;
  private ventGain?: GainNode;
  private crowdGain?: GainNode;
  private crowdLfo?: OscillatorNode;
  private noise?: AudioBuffer;
  private volume = 0.6;
  private muted = false;
  private focusGenerator = false;
  // État observé pour détecter les transitions
  private genState?: string;
  private incidentIds = new Set<number>();
  private decisionCount = 0;
  private yearReport?: number;
  private gameOver?: string;
  private alarmUntil = 0;
  private nextAlarm = 0;
  private nextDrip = 0;
  private dripRate = 0;
  private timer?: number;

  /** Le navigateur exige un geste de l'utilisateur avant de produire du son. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.noise = noiseBuffer(ctx, 4, true);

    // Génératrice : fondamentale grave + harmoniques, filtrées, avec une pulsation lente.
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.85;
    this.humLfo = ctx.createOscillator();
    this.humLfo.frequency.value = 0.35;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.15;
    this.humLfo.connect(lfoDepth).connect(pulse.gain);
    this.humLfo.start();
    for (const [type, f, g] of [
      ['sawtooth', 50, 0.35],
      ['sine', 100, 0.6],
      ['sine', 150, 0.25],
      ['triangle', 201, 0.12],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
      this.humOsc.push(o);
    }
    lp.connect(pulse).connect(this.humGain).connect(this.master);

    // Ventilation : bruit brun filtré, en boucle.
    this.ventGain = ctx.createGain();
    this.ventGain.gain.value = 0;
    const vent = ctx.createBufferSource();
    vent.buffer = this.noise;
    vent.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.6;
    vent.connect(bp).connect(this.ventGain).connect(this.master);
    vent.start();

    // Rumeur de foule : bruit dans la bande de la voix, modulé — monte avec les troubles.
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    const crowd = ctx.createBufferSource();
    crowd.buffer = noiseBuffer(ctx, 3);
    crowd.loop = true;
    const voice = ctx.createBiquadFilter();
    voice.type = 'bandpass';
    voice.frequency.value = 700;
    voice.Q.value = 1.4;
    const wobble = ctx.createGain();
    wobble.gain.value = 0.6;
    this.crowdLfo = ctx.createOscillator();
    this.crowdLfo.frequency.value = 2.3;
    const cd = ctx.createGain();
    cd.gain.value = 0.4;
    this.crowdLfo.connect(cd).connect(wobble.gain);
    this.crowdLfo.start();
    crowd.connect(voice).connect(wobble).connect(this.crowdGain).connect(this.master);
    crowd.start();

    this.timer = window.setInterval(() => this.tickAmbient(), 250);
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : volume, this.ctx.currentTime, 0.1);
  }

  /** La caméra regarde-t-elle la génératrice ? Elle couvre alors tout le reste. */
  setFocus(visibleFloorIds: string[]) {
    this.focusGenerator = visibleFloorIds.includes('energy');
  }

  private ramp(list: Ramp[]) {
    const t = this.ctx!.currentTime;
    for (const r of list) r.param.setTargetAtTime(r.value, t, r.time ?? 0.4);
  }

  update(s: Snapshot) {
    if (!this.ctx || !this.humGain) return;
    const ctx = this.ctx;
    const gen = s.energy.generatorState;
    const load = s.energy.demand > 0 ? Math.min(1.4, s.energy.demand / Math.max(1, s.energy.production || 1)) : 0;
    const running = gen !== 'failed';
    const base = this.focusGenerator ? 0.16 : 0.07;
    // Le cœur du silo : plus il force, plus il gronde ; une machine usée tremble.
    const pitch = running ? 1 + (load - 0.8) * 0.06 + (gen === 'degraded' ? Math.sin(ctx.currentTime * 3) * 0.02 : 0) : 0.35;
    if (this.genState !== undefined && this.genState !== 'failed' && gen === 'failed') {
      // Arrêt : la machine ralentit puis le silence tombe. Puis l'alarme.
      for (const o of this.humOsc) o.frequency.setTargetAtTime(o.frequency.value * 0.3, ctx.currentTime, 0.8);
      this.humGain.gain.setTargetAtTime(0, ctx.currentTime + 0.4, 0.7);
      this.alarmUntil = ctx.currentTime + 30;
      this.nextAlarm = ctx.currentTime + 2.6;
    } else {
      [50, 100, 150, 201].forEach((f, i) => this.humOsc[i].frequency.setTargetAtTime(f * pitch, ctx.currentTime, running && this.genState === 'failed' ? 1.5 : 0.5));
      this.ramp([{ param: this.humGain.gain, value: running ? base * (0.6 + Math.min(1, load) * 0.5) : 0, time: this.genState === 'failed' && running ? 1.5 : 0.5 }]);
    }
    if (this.genState === 'failed' && running) this.chime([196, 294, 392], 0.08, 1.4); // retour du courant
    this.genState = gen;

    const power = s.floors.reduce((a, f) => a + f.power, 0) / Math.max(1, s.floors.length);
    this.ramp([{ param: this.ventGain!.gain, value: running ? 0.05 * power : 0.004, time: 1 }]);
    const unrest = Math.max(0, ...s.floors.map((f) => f.unrest));
    this.ramp([{ param: this.crowdGain!.gain, value: unrest >= 2 ? 0.012 * (unrest - 1) : 0, time: 1.5 }]);
    this.crowdLfo!.frequency.setTargetAtTime(1.5 + unrest * 0.6, ctx.currentTime, 1);
    // Les gouttes s'entendent surtout dans le silence.
    const worn = s.floors.filter((f) => f.condition < 50).length;
    this.dripRate = (running ? 0.04 : 0.35) + worn * 0.03;

    // Nouvelles alertes critiques : une sirène brève.
    const critical = s.incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved');
    let fresh = false;
    for (const i of critical) if (!this.incidentIds.has(i.id)) fresh = true;
    this.incidentIds = new Set(critical.map((i) => i.id));
    if (fresh && ctx.currentTime > this.alarmUntil) this.alarm(2);
    // Nouvelle décision en attente : un signal discret.
    if (s.decisions.length > this.decisionCount) this.chime([660, 880], 0.05, 0.5);
    this.decisionCount = s.decisions.length;
    // Fin d'année : une cloche.
    if (s.yearReport && s.yearReport.year !== this.yearReport) this.bell();
    this.yearReport = s.yearReport?.year;
    // Fin de partie : accord grave (victoire) ou bourdon sombre (défaite).
    const go = s.gameOver ? `${s.gameOver.kind}:${s.gameOver.id}` : undefined;
    if (go && go !== this.gameOver) s.gameOver!.kind === 'victory' ? this.chime([131, 196, 262, 330], 0.09, 4) : this.chime([55, 82, 87], 0.1, 6);
    this.gameOver = go;
  }

  private tickAmbient() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    if (t < this.alarmUntil && t >= this.nextAlarm) {
      this.alarm(1);
      this.nextAlarm = t + 6;
    }
    if (t >= this.nextDrip) {
      if (Math.random() < this.dripRate * 4) this.drip();
      this.nextDrip = t + 1 + Math.random() * 2;
    }
  }

  /** Klaxon à deux tons. */
  private alarm(cycles: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.connect(lp).connect(g).connect(this.master!);
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < cycles * 2; i++) {
      o.frequency.setValueAtTime(i % 2 ? 470 : 620, t0 + i * 0.42);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.42);
      g.gain.linearRampToValueAtTime(0.05, t0 + i * 0.42 + 0.03);
      g.gain.setValueAtTime(0.05, t0 + i * 0.42 + 0.34);
      g.gain.linearRampToValueAtTime(0.0001, t0 + i * 0.42 + 0.4);
    }
    o.start(t0);
    o.stop(t0 + cycles * 0.84 + 0.1);
  }

  private chime(freqs: number[], level: number, dur: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(level, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + dur);
      o.connect(g).connect(this.master!);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + dur + 0.05);
    });
  }

  /** Cloche : partiels inharmoniques à décroissance lente. */
  private bell() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.01;
    for (const [ratio, lvl] of [
      [1, 0.09],
      [2.0, 0.05],
      [2.76, 0.035],
      [5.4, 0.015],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = 196 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(lvl, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5 / ratio + 1);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 6.5);
    }
  }

  private drip() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t0 + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + 0.15);
  }

  /** Clic d'interface (choix d'une décision, ordres). */
  click() {
    if (!this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 2, 0.06);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
  }
}

export const sound = new SoundEngine();
