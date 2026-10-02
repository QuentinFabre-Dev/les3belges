// Graphe de navigation des PNJ visibles : paliers d'escalier reliés verticalement.
// Le blocus d'un étage modifie l'accès des arêtes ; A* n'est relancé que quand la destination change.

import type { LockdownLevel } from '../sim/types';

export type Access = 'open' | 'controlled' | 'blocked';

export interface NavEdge {
  to: number; // index d'étage
  cost: number;
  access: Access;
}

export class NavigationGraph {
  edges: NavEdge[][] = [];

  rebuild(lockdowns: LockdownLevel[]) {
    const n = lockdowns.length;
    this.edges = Array.from({ length: n }, () => []);
    for (let i = 0; i < n - 1; i++) {
      const worst = lockdowns[i] === 'full' || lockdowns[i + 1] === 'full' ? 'blocked' : lockdowns[i] === 'controlled' || lockdowns[i + 1] === 'controlled' ? 'controlled' : 'open';
      const cost = worst === 'controlled' ? 3 : 1;
      this.edges[i].push({ to: i + 1, cost, access: worst });
      this.edges[i + 1].push({ to: i, cost, access: worst });
    }
  }

  // A* sur les paliers. `authorized` : personnel autorisé à franchir les accès contrôlés / bloqués.
  path(from: number, to: number, authorized: boolean): number[] | null {
    if (from === to) return [from];
    const open = new Set([from]);
    const came = new Map<number, number>();
    const g = new Map<number, number>([[from, 0]]);
    const f = new Map<number, number>([[from, Math.abs(to - from)]]);
    while (open.size) {
      let cur = -1;
      let best = Infinity;
      for (const n of open) {
        const v = f.get(n) ?? Infinity;
        if (v < best) {
          best = v;
          cur = n;
        }
      }
      if (cur === to) {
        const out = [cur];
        while (came.has(cur)) {
          cur = came.get(cur)!;
          out.unshift(cur);
        }
        return out;
      }
      open.delete(cur);
      for (const e of this.edges[cur] ?? []) {
        if (e.access === 'blocked' && !authorized) continue;
        const cost = e.access === 'controlled' && !authorized ? e.cost * 2 : e.cost;
        const tentative = (g.get(cur) ?? Infinity) + cost;
        if (tentative < (g.get(e.to) ?? Infinity)) {
          came.set(e.to, cur);
          g.set(e.to, tentative);
          f.set(e.to, tentative + Math.abs(to - e.to));
          open.add(e.to);
        }
      }
    }
    return null;
  }
}
