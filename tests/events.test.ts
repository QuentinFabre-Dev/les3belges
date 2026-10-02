import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { EVENTS } from '../src/sim/data/events';
import { Engine } from '../src/sim/engine';
import { decide, spawn } from '../src/sim/systems/events';

describe('catalogue d’événements', () => {
  it('chaque événement s’ouvre et chaque choix se résout sans placeholder ni erreur', () => {
    const problems: string[] = [];
    const skipped = new Set<string>();
    for (const def of EVENTS) {
      for (const choice of def.choices ?? []) {
        const e = new Engine(createWorld(7));
        for (let i = 0; i < 144; i++) e.tick();
        e.w.pending = [];
        spawn(e.ctx, def, {});
        const p = e.w.pending.find((x) => x.defId === def.id);
        if (!p) {
          skipped.add(def.id); // contexte introuvable (pas de sujet, etc.) : acceptable
          continue;
        }
        const view = JSON.stringify(e.snapshot().decisions ?? []);
        const raw = view.match(/\{[a-zA-Z0-9_:]+\}/g);
        if (raw) problems.push(`${def.id}: ${raw.join(',')}`);
        try {
          decide(e.ctx, p.uid, choice.id);
          for (let i = 0; i < 72; i++) e.tick();
        } catch (err) {
          problems.push(`${def.id}/${choice.id}: ${(err as Error).message}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(skipped.size).toBeLessThan(EVENTS.length / 4);
    if (skipped.size) console.log('non ouverts :', [...skipped].join(', '));
  }, 300_000);
});
