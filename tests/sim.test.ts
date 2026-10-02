import { describe, expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { createWorld } from '../src/sim/create';
import { killCitizen } from '../src/sim/systems/social';

const run = (e: Engine, days: number) => {
  for (let i = 0; i < days * 144; i++) e.tick();
};

describe('simulation headless', () => {
  it('est déterministe à graine égale', () => {
    const a = new Engine(createWorld(42));
    const b = new Engine(createWorld(42));
    run(a, 5);
    run(b, 5);
    expect(a.snapshot().resources).toEqual(b.snapshot().resources);
    expect(a.w.journal.length).toEqual(b.w.journal.length);
  });

  it('survit 30 jours sans intervention avec des événements émergents', () => {
    const e = new Engine(createWorld(7));
    run(e, 30);
    const s = e.snapshot();
    console.log('jour', s.day, 'pop', s.population, 'stab', s.stability, s.resources.map((r) => `${r.key}:${r.pct}%`).join(' '));
    console.log('psy', s.psychology, 'pending', s.decisions.map((d) => d.title));
    console.log(e.w.journal.slice(-25).map((j) => j.text).join('\n'));
    expect(s.population).toBeGreaterThan(1000);
    expect(e.w.journal.some((j) => j.text.startsWith('Décision requise'))).toBe(true);
  });

  it('la mort d’un mineur populaire après négligence fait monter la rancœur des mines', () => {
    const e = new Engine(createWorld(3));
    run(e, 1);
    const miners = e.w.citizens.filter((c) => c.sector === 'mines' && c.lifeState === 'alive');
    const before = miners.reduce((s, c) => s + c.grievance, 0) / miners.length;
    const trustBefore = miners.reduce((s, c) => s + c.trust, 0) / miners.length;
    const victim = miners.sort((a, b) => b.popularity - a.popularity)[0];
    killCitizen(e.ctx, victim.id, 'Accident minier', 'negligence');
    const alive = miners.filter((c) => c.lifeState === 'alive');
    const after = alive.reduce((s, c) => s + c.grievance, 0) / alive.length;
    const trustAfter = alive.reduce((s, c) => s + c.trust, 0) / alive.length;
    expect(after).toBeGreaterThan(before + 3);
    expect(trustAfter).toBeLessThan(trustBefore);
  });

  it('une panne de génératrice déclenche une décision critique et la peur', () => {
    const e = new Engine(createWorld(11));
    run(e, 1);
    const fearBefore = e.w.psychology.fear;
    e.forceFailure('generator');
    expect(e.w.pending.some((p) => p.defId === 'generator_failure')).toBe(true);
    run(e, 0.5);
    expect(e.w.psychology.fear).toBeGreaterThan(fearBefore + 10);
    expect(e.w.floors.some((f) => f.power < 1)).toBe(true);
  });

  it('les choix appliquent des effets data-driven', () => {
    const e = new Engine(createWorld(5));
    e.w.assets.pump_main.condition = 0.5;
    run(e, 3);
    const p = e.w.pending.find((x) => x.defId === 'water_leak');
    if (p) {
      const before = e.w.assets.pump_main.condition;
      e.command({ type: 'MAKE_DECISION', uid: p.uid, choiceId: 'repair' });
      expect(e.w.assets.pump_main.condition).toBeGreaterThan(before);
    }
  });
});
