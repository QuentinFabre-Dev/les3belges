import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { TICKS_PER_DAY, YEAR_DAYS } from '../src/sim/data/world';
import { Engine } from '../src/sim/engine';
import { calendar, checkVictory, remember } from '../src/sim/systems/years';

const runDays = (e: Engine, days: number) => {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) e.tick();
};

describe('étape 4 : années, mémoire collective, fins', () => {
  it('une année passe : vieillissement, affectations, bilan annuel', () => {
    const e = new Engine(createWorld(41));
    const c = e.w.citizens.find((x) => x.lifeState === 'alive' && x.age === 15)!;
    // On se place juste avant le tournant de l'année.
    e.w.tick = (YEAR_DAYS - 1) * TICKS_PER_DAY - 1;
    const age = c.age;
    runDays(e, 1.2);
    expect(calendar(e.w).year).toBe(143);
    expect(e.w.yearReports.length).toBe(1);
    expect(e.snapshot().yearReport?.year).toBe(142);
    if (c.lifeState === 'alive') {
      expect(c.age).toBe(age + 1);
      expect(c.flags).toContain('apprentice');
    }
    e.command({ type: 'ACK_YEAR_REPORT' });
    expect(e.snapshot().yearReport).toBeUndefined();
  });

  it('une crise du même type réveille un souvenir ancien', () => {
    const e = new Engine(createWorld(41)); // graine sans véritable accident minier pendant ces 9 jours
    const old = remember(e.ctx, 'mine_accident', 60, { floors: ['mines'], sectors: ['mines'] });
    runDays(e, 9);
    const miners = e.w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === 'mines');
    const fear0 = miners.reduce((s, c) => s + c.fear, 0);
    remember(e.ctx, 'mine_accident', 20, { floors: ['mines'], sectors: ['mines'] });
    expect(old.reactivations).toBe(1);
    expect(miners.reduce((s, c) => s + c.fear, 0)).toBeGreaterThan(fear0);
    expect(e.w.chronicle.length).toBe(2);
  });

  it('la fin de mandat déclenche une fin selon le style de gouvernance', () => {
    const e = new Engine(createWorld(43, 'accessible'));
    e.w.tick = 3 * YEAR_DAYS * TICKS_PER_DAY + 10;
    e.w.psychology = { fear: 10, morale: 70, trust: 70, legitimacy: 75, authority: 60 };
    e.w.stability = 80;
    checkVictory(e.ctx);
    expect(e.w.gameOver?.kind).toBe('victory');
    expect(e.w.gameOver?.id).toBe('golden');
    e.command({ type: 'CONTINUE_FREE' });
    expect(e.w.gameOver).toBeUndefined();
    checkVictory(e.ctx);
    expect(e.w.gameOver).toBeUndefined();
  });

  it('la difficulté change la fiabilité des données', () => {
    const easy = new Engine(createWorld(44, 'accessible'));
    const hard = new Engine(createWorld(44, 'hard'));
    expect(easy.ctx.infoAccuracy).toBeGreaterThan(hard.ctx.infoAccuracy);
  });
});
