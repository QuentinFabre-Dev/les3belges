import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { Engine } from '../src/sim/engine';
import { applyVerdict, caseOf } from '../src/sim/systems/justice';
import { startRumor } from '../src/sim/systems/rumors';
import { factionsDay } from '../src/sim/systems/factions';
import { arrestCitizen } from '../src/sim/systems/social';

const run = (e: Engine, days: number) => {
  for (let i = 0; i < days * 144; i++) e.tick();
};

describe('étape 2 : justice, rumeurs, factions, conseil', () => {
  it('une arrestation ouvre un dossier puis un procès arrive après la détention', () => {
    const e = new Engine(createWorld(21));
    const c = e.w.citizens.find((x) => x.sector === 'supplies' && !x.officeId)!;
    arrestCitizen(e.ctx, c.id, 'Vol de fournitures', 70);
    expect(caseOf(e.ctx, c.id)?.status).toBe('detention');
    run(e, 2.2);
    const pending = e.w.pending.find((p) => p.defId === 'trial' && p.subjectId === c.id);
    expect(pending || caseOf(e.ctx, c.id)?.status === 'serving').toBeTruthy();
  });

  it('imposer une condamnation sur un dossier faible désavoue le juge', () => {
    const e = new Engine(createWorld(22));
    const c = e.w.citizens.find((x) => x.sector === 'residential' && x.age > 20)!;
    arrestCitizen(e.ctx, c.id, 'Trouble à l’ordre public', 10);
    const k = caseOf(e.ctx, c.id)!;
    k.evidence = 15;
    const before = e.w.offices.judge.legitimacy;
    applyVerdict(e.ctx, c.id, 'convict');
    expect(e.w.offices.judge.legitimacy).toBeLessThan(before);
    expect(k.forced).toBe(true);
  });

  it('une rumeur se propage d’étage en étage et pèse sur la confiance', () => {
    const e = new Engine(createWorld(23));
    startRumor(e.ctx, 'rations_secretes', 'false');
    const r = e.w.rumors[0];
    const trust0 = e.w.citizens.reduce((s, c) => s + c.trust, 0);
    run(e, 3);
    const spread = Object.values(r.reach).filter((v) => v > 0.05).length;
    expect(spread).toBeGreaterThan(1);
    expect(e.w.citizens.reduce((s, c) => s + c.trust, 0)).toBeLessThan(trust0);
  });

  it('une faction naît d’un secteur rancunier autour d’un meneur', () => {
    const e = new Engine(createWorld(24));
    for (const c of e.w.citizens) if (c.sector === 'mines') c.grievance = 45;
    e.w.sectors.mines.grievance = 45;
    for (let i = 0; i < 10 && !e.w.factions.length; i++) factionsDay(e.ctx);
    expect(e.w.factions.length).toBeGreaterThan(0);
    expect(e.w.factions[0].sector).toBe('mines');
  });

  it('le conseil débat, puis la décision modifie la loyauté des responsables', () => {
    const e = new Engine(createWorld(25));
    e.command({ type: 'CONVENE_COUNCIL' });
    const c = e.w.council!;
    expect(c.statements.length).toBeGreaterThan(5);
    const choice = c.proposals[0].id;
    const backer = c.statements.find((s) => s.proposalId === choice);
    const trustBefore = backer ? e.w.citizens[e.w.offices[backer.officeId].holderId!].trust : 0;
    e.command({ type: 'COUNCIL_CHOICE', proposalId: choice });
    expect(e.w.council!.resolved).toBe(choice);
    if (backer) expect(e.w.citizens[e.w.offices[backer.officeId].holderId!].trust).toBeGreaterThan(trustBefore);
  });
});
