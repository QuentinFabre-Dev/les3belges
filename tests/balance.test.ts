// Banc d'équilibrage : compare un joueur passif et un joueur automatique raisonnable
// sur plusieurs graines. Lancement : BALANCE=1 npx vitest run tests/balance.test.ts
import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/create';
import { Engine } from '../src/sim/engine';
import { eventDef } from '../src/sim/systems/events';

declare const process: { env: Record<string, string | undefined> };
const RUN = !!process.env.BALANCE;
const SEEDS = Number(process.env.SEEDS ?? 12);
const DAYS = Number(process.env.DAYS ?? 60);

const ADVISOR_TRUST = ['mechanic_chief', 'medical_chief', 'judge', 'mayor', 'agri_chief', 'it_director', 'sheriff'];

// Joueur automatique : suit l'avis le plus fiable, répare, rationne quand il faut.
export function autoPlay(e: Engine) {
  const w = e.w;
  for (const p of [...w.pending]) {
    const def = eventDef(p.defId);
    if (!def) continue;
    const view = e.snapshot().decisions.find((d) => d.uid === p.uid);
    const enabled = def.choices.filter((c) => view?.choices.find((x) => x.id === c.id)?.enabled);
    const ranked = [...enabled].sort((a, b) => {
      const ra = a.advisor ? ADVISOR_TRUST.indexOf(a.advisor) : 99;
      const rb = b.advisor ? ADVISOR_TRUST.indexOf(b.advisor) : 99;
      return (ra < 0 ? 50 : ra) - (rb < 0 ? 50 : rb);
    });
    const pick = ranked[0];
    if (pick) e.command({ type: 'MAKE_DECISION', uid: p.uid, choiceId: pick.id });
  }
  const assets = Object.values(w.assets);
  for (const a of assets) if (a.state === 'failed') e.command({ type: 'SEND_REPAIR', assetId: a.id });
  const worst = assets.filter((a) => a.state !== 'failed').sort((a, b) => a.condition - b.condition)[0];
  if (worst && worst.condition < 0.55 && w.policies.maintenanceFocus !== worst.id) e.command({ type: 'SET_POLICY', key: 'maintenanceFocus', value: worst.id });
  if (worst && worst.condition > 0.7 && w.policies.maintenanceFocus !== 'auto') e.command({ type: 'SET_POLICY', key: 'maintenanceFocus', value: 'auto' });
  const foodDays = w.resources.food.real / Math.max(1, e.ctx.population);
  if (foodDays < 7 && w.policies.rations === 'normal') e.command({ type: 'SET_POLICY', key: 'rations', value: 'reduced' });
  if (foodDays > 14 && w.policies.rations === 'reduced') e.command({ type: 'SET_POLICY', key: 'rations', value: 'normal' });
  for (const f of w.floors) if (f.lockdown !== 'open' && f.unrest <= 1) e.command({ type: 'SET_LOCKDOWN', floor: f.id, level: 'open' });
}

interface Result {
  seed: number;
  survived: number;
  minStability: number;
  deaths: number;
  decisions: number;
}

function play(seed: number, auto: boolean): Result {
  const e = new Engine(createWorld(seed));
  let minStability = 100;
  let decisions = 0;
  for (let t = 0; t < DAYS * 144; t++) {
    e.tick();
    if (auto && t % 18 === 0) {
      decisions += e.w.pending.length;
      autoPlay(e);
    }
    if (t % 144 === 0) {
      minStability = Math.min(minStability, e.w.stability);
      if (process.env.TRACE && auto && t % (144 * 5) === 0) {
        const w = e.w;
        console.log(`  s${seed} J${t / 144} stab${Math.round(w.stability)} leg${Math.round(w.psychology.legitimacy)} trust${Math.round(w.psychology.trust)} mor${Math.round(w.psychology.morale)} fear${Math.round(w.psychology.fear)} unrest[${w.floors.map((f) => f.unrest).join('')}] F${Math.round(w.resources.food.real)} W${Math.round(w.resources.water.real)} P${Math.round(w.resources.parts.real)} M${Math.round(w.resources.materials.real)} gen${w.assets.generator.condition.toFixed(2)} pump${w.assets.pump_main.condition.toFixed(2)} rations:${w.policies.rations} quota${w.policies.mineQuota} grv${Math.round(w.floors.reduce((a, f) => a + f.grievance, 0) / 12)}`);
      }
    }
    if (e.w.gameOver) break;
  }
  if (process.env.TRACE && e.w.gameOver) console.log('FIN', seed, e.w.gameOver.reason, '\n  ' + e.w.gameOver.chain.join('\n  '));
  return { seed, survived: e.w.gameOver?.day ?? DAYS, minStability: Math.round(minStability), deaths: e.w.stats.deaths, decisions };
}

describe.runIf(RUN)('équilibrage', () => {
  it(`passif vs automatique sur ${SEEDS} graines × ${DAYS} jours`, () => {
    const passive: Result[] = [];
    const auto: Result[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const seed = 1000 + i * 37;
      passive.push(play(seed, false));
      auto.push(play(seed, true));
    }
    const summary = (rs: Result[]) => {
      const surv = rs.map((r) => r.survived).sort((a, b) => a - b);
      return {
        survie_mediane: surv[Math.floor(surv.length / 2)],
        survie_min: surv[0],
        parties_completes: `${rs.filter((r) => r.survived >= DAYS).length}/${rs.length}`,
        stabilite_min_moy: Math.round(rs.reduce((s, r) => s + r.minStability, 0) / rs.length),
        morts_moy: Math.round(rs.reduce((s, r) => s + r.deaths, 0) / rs.length),
      };
    };
    console.log('PASSIF', JSON.stringify(summary(passive)));
    console.log('AUTO  ', JSON.stringify(summary(auto)));
    console.log('détail auto', auto.map((r) => `${r.seed}:${r.survived}j/stab${r.minStability}/†${r.deaths}`).join(' '));
    console.log('détail passif', passive.map((r) => `${r.seed}:${r.survived}j/†${r.deaths}`).join(' '));
    expect(summary(auto).survie_mediane).toBeGreaterThanOrEqual(summary(passive).survie_mediane);
  }, 600_000);
});
