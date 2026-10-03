import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { TICKS_PER_DAY } from '../src/sim/data/world';
import { Engine } from '../src/sim/engine';
import { fail } from '../src/sim/systems/infrastructure';
import { trustIn } from '../src/sim/systems/institutions';
import { applyVerdict } from '../src/sim/systems/justice';
import { patrolCapacity } from '../src/sim/systems/patrols';
import { arrestCitizen } from '../src/sim/systems/social';

const runDays = (e: Engine, days: number) => {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) e.tick();
};

describe('étape 5 : adjoints, confiance par institution, anticipation', () => {
  it('les patrouilles sont limitées par les effectifs et pèsent sur l’étage', () => {
    const e = new Engine(createWorld(51));
    const cap = patrolCapacity(e.ctx);
    expect(cap).toBeGreaterThan(1);
    e.command({ type: 'SET_PATROL', floor: 'res_mid', units: 3 });
    e.command({ type: 'SET_PATROL', floor: 'res_low', units: 3 });
    const used = e.w.floors.reduce((s, f) => s + (f.patrol ?? 0), 0);
    expect(used).toBeLessThanOrEqual(cap);
    const f = e.w.floors.find((x) => x.id === 'res_mid')!;
    const ref = e.w.floors.find((x) => x.id === 'res_11')!;
    runDays(e, 2);
    expect(f.fear).toBeGreaterThan(ref.fear);
    expect(e.snapshot().floors.find((x) => x.id === 'res_mid')!.patrol).toBe(f.patrol);
  });

  it('un jugement imposé discrédite le judiciaire, une panne la mécanique', () => {
    const e = new Engine(createWorld(52));
    const j0 = trustIn(e.w, 'judiciary');
    const c = e.w.citizens.find((x) => x.lifeState === 'alive' && x.sector === 'residential' && x.age > 20)!;
    arrestCitizen(e.ctx, c.id, 'Trouble à l’ordre public', 10);
    e.w.cases.find((k) => k.defendantId === c.id)!.evidence = 10;
    applyVerdict(e.ctx, c.id, 'convict');
    expect(trustIn(e.w, 'judiciary')).toBeLessThan(j0);
    const m0 = trustIn(e.w, 'mechanics');
    fail(e.ctx, e.w.assets.generator);
    expect(trustIn(e.w, 'mechanics')).toBeLessThan(m0);
    const view = e.snapshot().institutions;
    expect(view.map((i) => i.id)).toEqual(['mayor', 'judiciary', 'security', 'mechanics', 'medical', 'it']);
  });

  it('le panneau « À venir » annonce pénuries, procès et pannes probables', () => {
    const e = new Engine(createWorld(53));
    e.w.resources.food.real = e.w.resources.food.declared = 3000;
    e.w.assets.pump_main.condition = 0.2;
    const c = e.w.citizens.find((x) => x.lifeState === 'alive' && x.age > 20 && !x.officeId)!;
    arrestCitizen(e.ctx, c.id, 'Vol', 50);
    runDays(e, 0.1);
    const ids = e.snapshot().forecast.map((f) => f.id);
    expect(ids.some((id) => id.startsWith('asset_pump_main'))).toBe(true);
    expect(ids.some((id) => id.startsWith('trial_'))).toBe(true);
    expect(ids).toContain('res_food');
  });
});
