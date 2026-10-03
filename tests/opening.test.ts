import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { CHAPTERS } from '../src/sim/data/objectives';
import { OPENING_SEATS } from '../src/sim/data/opening';
import { TICKS_PER_DAY } from '../src/sim/data/world';
import { Engine } from '../src/sim/engine';
import { decide, spawn, eventDef, metric } from '../src/sim/systems/events';
import { openingVotes } from '../src/sim/systems/opening';
import type { WorldState } from '../src/sim/types';

const runDays = (e: Engine, days: number) => {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) e.tick();
};

describe('ouverture : investiture du nouveau DSI', () => {
  it('trois candidats par siège, tirés de la population, et des titulaires provisoires', () => {
    const w = createWorld(101);
    expect(w.opening?.status).toBe('pending');
    expect(w.opening!.seats.map((s) => s.officeId)).toEqual(OPENING_SEATS.map((s) => s.officeId));
    const all = new Set<number>();
    for (const seat of w.opening!.seats) {
      expect(seat.candidates).toHaveLength(3);
      for (const k of seat.candidates) {
        const c = w.citizens[k.id];
        expect(c.lifeState).toBe('alive');
        expect(k.bio).not.toMatch(/[{}]/);
        expect(k.file).not.toMatch(/[{}]/);
        expect(all.has(k.id)).toBe(false); // un habitant ne brigue qu'un seul siège
        all.add(k.id);
      }
      // Le favori est installé à titre provisoire : le monde reste cohérent sans écran.
      expect(w.offices[seat.officeId].holderId).toBe(seat.chosenId);
      expect(w.citizens[seat.chosenId!].officeId).toBe(seat.officeId);
    }
    // L'ancien shérif est sorti nettoyer ; la maire et le juge se sont retirés.
    expect(w.citizens.some((c) => c.flags.includes('former_sheriff') && c.lifeState === 'dead')).toBe(true);
    expect(w.citizens.some((c) => c.flags.includes('former_mayor') && c.flags.includes('retired'))).toBe(true);
    // Le titulaire des fournitures fait partie des choix.
    expect(w.opening!.seats.find((s) => s.officeId === 'supply_chief')!.candidates.some((k) => k.incumbent)).toBe(true);
    // La DSI n'est pas un siège : le joueur est le DSI, l'office it_director est son adjointe.
    expect(w.offices.it_director.title).toBe('Adjointe DSI');
  });

  it('les nominations choisies remplacent les favoris et rendent les autres à leur poste', () => {
    const e = new Engine(createWorld(102));
    const w = e.w;
    const judgeSeat = w.opening!.seats.find((s) => s.officeId === 'judge')!;
    const sheriffSeat = w.opening!.seats.find((s) => s.officeId === 'sheriff')!;
    const judge = judgeSeat.candidates[2];
    const sheriff = sheriffSeat.candidates[1];
    const previousJudge = judgeSeat.chosenId!;
    e.command({ type: 'INVESTITURE', picks: { judge: judge.id, sheriff: sheriff.id }, backed: {} });
    expect(w.opening!.status).toBe('done');
    expect(w.offices.judge.holderId).toBe(judge.id);
    expect(w.offices.sheriff.holderId).toBe(sheriff.id);
    expect(w.citizens[previousJudge].officeId).toBeUndefined();
    expect(w.citizens[previousJudge].sector).toBe(judgeSeat.candidates[0].fromSector);
    // Chaque siège a un et un seul titulaire.
    for (const seat of w.opening!.seats) expect(w.citizens.filter((c) => c.officeId === seat.officeId)).toHaveLength(1);
    // L'archétype choisi laisse sa marque (tag) et le maire a une promesse de campagne.
    expect(w.tags[`opening_judge_${judge.archetype}`]).toBeDefined();
    expect(w.promises.some((p) => p.tag === 'campaign')).toBe(true);
    expect(w.offices.mayor.termEndsDay).toBeGreaterThan(90);
    // Un second scellement est ignoré.
    e.command({ type: 'INVESTITURE', picks: { judge: judgeSeat.candidates[0].id }, backed: {} });
    expect(w.offices.judge.holderId).toBe(judge.id);
  });

  it('élection : le soutien de la DSI pèse, sans tout garantir', () => {
    const w = createWorld(103);
    const seat = w.opening!.seats.find((s) => s.mode === 'election')!;
    const poll = openingVotes(w, seat);
    const ranked = [...seat.candidates].sort((a, b) => poll[b.id] - poll[a.id]);
    const underdog = ranked[2];
    // Le sondage est déterministe ; le soutien fait monter l'outsider.
    expect(openingVotes(w, seat)).toEqual(poll);
    const backedPoll = openingVotes(w, seat, underdog.id);
    expect(backedPoll[underdog.id]).toBeGreaterThan(poll[underdog.id]);
    // Sur plusieurs scrutins réels, le favori soutenu gagne presque toujours, l'outsider soutenu pas toujours.
    let favWins = 0;
    let dogWins = 0;
    const N = 12;
    for (let t = 0; t < N; t++) {
      for (const [target, inc] of [
        [ranked[0].id, () => favWins++],
        [underdog.id, () => dogWins++],
      ] as const) {
        const e = new Engine(createWorld(103));
        e.ctx.rng.state = 777 + t * 131;
        e.command({ type: 'INVESTITURE', picks: {}, backed: { mayor: target } });
        if (e.w.offices.mayor.holderId === target) inc();
        expect(e.w.tags.opening_backed).toBeDefined();
      }
    }
    expect(favWins).toBeGreaterThanOrEqual(N - 1);
    expect(dogWins).toBeLessThan(N);
    expect(dogWins).toBeGreaterThan(0);
  });

  it('sans écran, le premier tick scelle l’investiture par défaut', () => {
    const e = new Engine(createWorld(104));
    e.tick();
    expect(e.w.opening!.status).toBe('done');
    expect(e.w.opening!.auto).toBe(true);
    expect(e.w.offices.mayor.holderId).toBeDefined();
    expect(e.snapshot().opening).toBeUndefined();
  });

  it('les défauts cachés du titulaire conditionnent des événements', () => {
    const e = new Engine(createWorld(105));
    const w = e.w;
    const seat = w.opening!.seats.find((s) => s.officeId === 'sheriff')!;
    const pick = seat.candidates[2];
    e.command({ type: 'INVESTITURE', picks: { sheriff: pick.id }, backed: {} });
    const sheriff = w.citizens[pick.id];
    sheriff.flags = sheriff.flags.filter((f) => !f.startsWith('secret:'));
    sheriff.flags.push('secret:bribes');
    expect(metric(e.ctx, 'office.sheriff.secret')).toBe('bribes');
    expect(metric(e.ctx, 'office.judge.secret') === 'bribes').toBe(false);
    spawn(e.ctx, eventDef('sheriff_bribes')!, {});
    const p = w.pending.find((x) => x.defId === 'sheriff_bribes')!;
    expect(p.subjectId).toBe(pick.id);
    decide(e.ctx, p.uid, 'dismiss');
    expect(w.offices.sheriff.holderId).not.toBe(pick.id);
    // Le rival battu à l'élection peut revenir hanter le maire.
    const rival = w.citizens.find((c) => c.flags.includes('opening_rival'));
    if (rival) {
      spawn(e.ctx, eventDef('opening_rival')!, {});
      expect(w.pending.find((x) => x.defId === 'opening_rival')?.subjectId).toBe(rival.id);
    }
  });
});

describe('objectifs guidés', () => {
  it('détecte la progression et récompense', () => {
    const e = new Engine(createWorld(106));
    const w = e.w;
    e.command({ type: 'INVESTITURE', picks: {}, backed: {} });
    expect(w.objectives!.done.investiture).toBeDefined();
    expect(e.snapshot().objectives!.title).toBe(CHAPTERS[0].title);
    // Une décision tranchée.
    spawn(e.ctx, eventDef('water_leak')!, { floor: 'water', assetId: 'pump_main' });
    const p = w.pending.find((x) => x.defId === 'water_leak')!;
    decide(e.ctx, p.uid, 'postpone');
    // Un conseil réuni et tranché, un audit, une patrouille.
    e.command({ type: 'CONVENE_COUNCIL' });
    e.command({ type: 'COUNCIL_CHOICE', proposalId: w.council!.proposals[0].id });
    e.command({ type: 'AUDIT', target: 'supplies' });
    e.command({ type: 'SET_PATROL', floor: 'res_mid', units: 1 });
    const legit0 = w.psychology.legitimacy;
    runDays(e, 1 / 12);
    for (const id of ['first_decision', 'council', 'audit', 'patrol']) expect(w.objectives!.done[id], id).toBeDefined();
    expect(w.psychology.legitimacy).toBeGreaterThan(legit0 - 1);
    const view = e.snapshot().objectives!;
    expect(view.items.filter((i) => i.done).length).toBeGreaterThanOrEqual(5);
    // Promesse de campagne tenue → objectif.
    const pr = w.promises.find((x) => x.tag === 'campaign')!;
    pr.check = { metric: 'day', op: '>=', value: 1 };
    runDays(e, 1 / 12);
    expect(w.tags.campaign_kept).toBeDefined();
    expect(w.objectives!.done.campaign).toBeDefined();
  });

  it('un chapitre terminé laisse place au suivant', () => {
    const e = new Engine(createWorld(107));
    const w = e.w;
    for (const o of CHAPTERS[0].objectives) w.objectives!.done[o.id] = 0;
    runDays(e, 1);
    expect(w.objectives!.chapter).toBe(1);
    expect(e.snapshot().objectives!.title).toBe(CHAPTERS[1].title);
  });
});

describe('migration des sauvegardes', () => {
  it('une ancienne sauvegarde sans ouverture ni objectifs se charge', () => {
    const e = new Engine(createWorld(108));
    runDays(e, 0.5);
    const old = JSON.parse(JSON.stringify(e.serialize())) as WorldState;
    delete old.opening;
    delete old.objectives;
    delete old.stats.decisions;
    old.offices.it_director.title = 'Directrice DSI';
    old.tick = TICKS_PER_DAY * 20;
    const e2 = new Engine(createWorld(1));
    e2.load(old);
    expect(e2.w.opening).toEqual({ status: 'done', auto: true, seats: [] });
    expect(e2.w.objectives!.chapter).toBe(1); // partie avancée : le premier chapitre est sauté
    expect(e2.w.stats.decisions).toBe(0);
    expect(e2.w.offices.it_director.title).toBe('Adjointe DSI');
    expect(e2.snapshot().opening).toBeUndefined();
    runDays(e2, 0.2);
    // Partie récente : les objectifs commencent au premier chapitre.
    const fresh = JSON.parse(JSON.stringify(e.serialize())) as WorldState;
    delete fresh.objectives;
    const e3 = new Engine(createWorld(1));
    e3.load(fresh);
    expect(e3.w.objectives!.chapter).toBe(0);
  });
});
