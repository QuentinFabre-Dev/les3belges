// Ouverture narrative : le nouveau DSI forme la direction du silo (investiture).
// Le monde est créé avec des titulaires provisoires (les favoris) ; l'écran d'investiture
// permet de les remplacer et de peser sur l'élection du maire. Sans écran (tests, banc
// d'équilibrage), l'investiture est scellée automatiquement au premier tick.
import type { Ctx } from '../context';
import { OPENING_SEATS, genderize, type ArchetypeDef, type SeatDef } from '../data/opening';
import { SECTOR_FLOOR, SECTOR_NAMES, TICKS_PER_DAY, YEAR_DAYS } from '../data/world';
import { Rng, clamp } from '../rng';
import type { Citizen, CitizenId, OfficeId, OpeningCandidate, OpeningSeat, OpeningView, SectorId, WorldState } from '../types';
import { addTag, dayOf, fullName, holder, journal, message } from '../util';
import { applyEffects } from './events';
import { shakeTrust } from './institutions';

/** Poids du soutien discret de la DSI dans l'intention de vote (consignes aux responsables d'étage, temps de parole au réfectoire…). */
export const BACKING_BONUS = 11;
/** Écart-type de la dynamique de campagne propre à chaque candidat (incertitude du scrutin). */
const CAMPAIGN_SWING = 6;
/** Diversité des électeurs : plus elle est grande, moins le scrutin est un raz-de-marée. */
const VOTER_SPREAD = 22;

const SECTOR_PLACE: Record<SectorId, string> = {
  admin: 'bureaux',
  security: 'adjoints',
  agriculture: 'fermes',
  medical: 'soins',
  mechanical: 'ateliers',
  water: 'pompes',
  energy: 'génératrices',
  supplies: 'fournitures',
  mines: 'mines',
  sanitation: 'blanchisseries',
  residential: 'étages',
};

const seatDef = (officeId: OfficeId) => OPENING_SEATS.find((s) => s.officeId === officeId);

export function archetypeOf(officeId: OfficeId, key: string): ArchetypeDef | undefined {
  const def = seatDef(officeId);
  if (!def) return undefined;
  if (def.keepIncumbent?.archetype.key === key) return def.keepIncumbent.archetype;
  return def.archetypes.find((a) => a.key === key);
}

function text(t: string, c: Citizen, fromSector: SectorId, w: WorldState) {
  const floor = w.floors.find((f) => f.id === c.homeFloor);
  return genderize(t, c.sex)
    .replace(/\{first\}/g, c.first)
    .replace(/\{sector\}/g, SECTOR_PLACE[fromSector])
    .replace(/\{floor\}/g, floor?.label ?? '-13');
}

function pickCitizen(w: WorldState, rng: Rng, a: ArchetypeDef, used: Set<CitizenId>): Citizen | undefined {
  const ok = (c: Citizen) => c.lifeState === 'alive' && !c.officeId && !used.has(c.id) && c.age >= a.age[0] && c.age <= a.age[1] && !c.flags.includes('retired') && !c.flags.includes('specialist');
  let pool = w.citizens.filter((c) => ok(c) && a.sectors.includes(c.sector));
  if (pool.length < 3) pool = w.citizens.filter((c) => ok(c) && c.sector !== 'residential');
  if (!pool.length) return undefined;
  pool.sort((x, y) => y.leadership + y.popularity + y.skill - (x.leadership + x.popularity + x.skill));
  return rng.pick(pool.slice(0, 12));
}

function makeCandidate(w: WorldState, rng: Rng, c: Citizen, a: ArchetypeDef, incumbent: boolean): OpeningCandidate {
  const between = (r: [number, number]) => (r[0] === r[1] ? r[0] : rng.int(r[0], r[1]));
  if (!incumbent) {
    c.skill = between(a.skill);
    c.leadership = between(a.leadership);
    c.integrity = between(a.integrity);
    c.popularity = between(a.popularity);
    c.traits = [...a.traits];
  }
  c.trust = between(a.trust);
  c.influence = Math.max(c.influence, Math.round(40 + c.popularity / 3));
  c.key = true;
  if (!c.flags.includes('candidate')) c.flags.push('candidate');
  let file = a.file;
  let secret: OpeningCandidate['secret'];
  if (a.secret && rng.chance(a.secret.p)) {
    secret = a.secret.kind;
    c.flags.push(`secret:${secret}`);
    if (rng.chance(a.secret.found)) file = a.secret.file;
  }
  const sector = c.sector;
  return {
    id: c.id,
    archetype: a.key,
    bio: text(a.bio, c, sector, w),
    file: text(file, c, sector, w),
    pledge: a.pledge?.text,
    secret,
    incumbent: incumbent || undefined,
    fromSector: sector,
    fromFloor: c.workFloor,
  };
}

/** Installe un titulaire (sans effet social : réservé à l'ouverture). */
function install(w: WorldState, officeId: OfficeId, c: Citizen) {
  const office = w.offices[officeId];
  const prev = office.holderId !== undefined ? w.citizens[office.holderId] : undefined;
  if (prev && prev.id !== c.id && prev.officeId === officeId) prev.officeId = undefined;
  office.holderId = c.id;
  c.officeId = officeId;
  c.key = true;
  if (office.sector && c.sector !== office.sector) {
    c.sector = office.sector;
    c.workFloor = SECTOR_FLOOR[office.sector];
  }
}

/** Rend un candidat non retenu à son poste d'origine. */
function uninstall(w: WorldState, cand: OpeningCandidate) {
  const c = w.citizens[cand.id];
  if (c.officeId) {
    if (w.offices[c.officeId].holderId === c.id) w.offices[c.officeId].holderId = undefined;
    c.officeId = undefined;
  }
  c.sector = cand.fromSector;
  c.workFloor = cand.fromFloor;
}

/**
 * Intentions de vote pour l'élection d'ouverture. Sans `rng` : sondage déterministe de la DSI.
 * Avec `rng` : scrutin réel (dynamique de campagne propre à chaque candidat + bruit individuel).
 */
export function openingVotes(w: WorldState, seat: OpeningSeat, backedId?: CitizenId, ballot?: Rng): Record<number, number> {
  const cands = seat.candidates.filter((k) => w.citizens[k.id]?.lifeState === 'alive');
  const votes: Record<number, number> = {};
  for (const k of cands) votes[k.id] = 0;
  if (!cands.length) return votes;
  // Le sondage tire toujours le même échantillon d'opinions ; le scrutin réel a sa propre dynamique.
  const rng = ballot ?? new Rng(w.seed ^ 0x5eed);
  const swing = new Map(cands.map((k) => [k.id, ballot ? rng.normal(0, CAMPAIGN_SWING) : 0]));
  const rel = new Map(cands.map((k) => [k.id, new Map(w.relations[k.id].map((r) => [r.to, r.strength * (r.affinity >= 0 ? 1 : -1)]))]));
  for (const v of w.citizens) {
    if (v.lifeState !== 'alive' || v.age < 16) continue;
    let best = -1e9;
    let bestId = cands[0].id;
    for (const k of cands) {
      const c = w.citizens[k.id];
      let s = c.popularity * 0.55 + c.leadership * 0.2 + swing.get(k.id)!;
      if (k.fromSector === v.sector && k.fromSector !== 'residential') s += 14;
      if (c.homeFloor === v.homeFloor) s += 6;
      s += (rel.get(k.id)!.get(v.id) ?? 0) * 40;
      if (backedId === k.id) s += BACKING_BONUS * (0.6 + v.trust / 125);
      s += rng.normal(0, VOTER_SPREAD);
      if (s > best) {
        best = s;
        bestId = k.id;
      }
    }
    votes[bestId]++;
  }
  return votes;
}

const shares = (votes: Record<number, number>) => {
  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(votes).map(([id, n]) => [id, Math.round((n / total) * 100)])) as Record<number, number>;
};

const leader = (votes: Record<number, number>) => Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);

/**
 * Prépare l'ouverture à la création du monde : les anciens titulaires quittent la scène,
 * trois candidats par siège sont tirés de la population, les favoris sont installés à titre provisoire.
 */
export function prepareOpening(w: WorldState, rng: Rng) {
  // Ruth Jahns et Aldous Meadows se retirent ; Holston Becker est sorti nettoyer les capteurs.
  const retire = (officeId: OfficeId, how: 'retired' | 'cleaning') => {
    const h = holder(w, officeId);
    if (!h) return;
    w.offices[officeId].holderId = undefined;
    h.officeId = undefined;
    h.flags.push(`former_${officeId}`);
    if (how === 'cleaning') {
      h.lifeState = 'dead';
      h.memories.push({ day: -8, text: 'A demandé à sortir. A nettoyé les capteurs.', trustDelta: 0, angerDelta: 0 });
    } else {
      h.flags.push('retired');
      h.sector = 'residential';
      h.workFloor = h.homeFloor;
    }
  };
  retire('mayor', 'retired');
  retire('judge', 'retired');
  retire('sheriff', 'cleaning');
  w.lens = 0.86; // le nettoyage de Becker remonte à neuf jours

  const used = new Set<CitizenId>();
  const seats: OpeningSeat[] = [];
  for (const def of OPENING_SEATS) {
    const candidates: OpeningCandidate[] = [];
    if (def.keepIncumbent) {
      const h = holder(w, def.officeId);
      if (h) {
        used.add(h.id);
        candidates.push(makeCandidate(w, rng, h, def.keepIncumbent.archetype, true));
      }
    }
    for (const a of def.archetypes) {
      if (candidates.length >= 3) break;
      const c = pickCitizen(w, rng, a, used);
      if (!c) continue;
      used.add(c.id);
      candidates.push(makeCandidate(w, rng, c, a, false));
    }
    const seat: OpeningSeat = { officeId: def.officeId, mode: def.mode, candidates };
    if (def.mode === 'election') {
      const free = shares(openingVotes(w, seat));
      seat.polls = {};
      for (const k of candidates) seat.polls[k.id] = { free: free[k.id] ?? 0, backed: shares(openingVotes(w, seat, k.id))[k.id] ?? 0 };
      seat.chosenId = candidates.length ? candidates.slice().sort((a, b) => (free[b.id] ?? 0) - (free[a.id] ?? 0))[0].id : undefined;
    } else seat.chosenId = candidates[0]?.id;
    if (seat.chosenId !== undefined) install(w, def.officeId, w.citizens[seat.chosenId]);
    seats.push(seat);
  }
  w.opening = { status: 'pending', seats };
}

/**
 * Scelle l'investiture : nominations retenues, élection du maire (avec ou sans soutien de la DSI),
 * conséquences immédiates, promesse de campagne, rival battu.
 */
export function sealInvestiture(ctx: Ctx, picks: Partial<Record<OfficeId, CitizenId>>, backed: Partial<Record<OfficeId, CitizenId | null>> = {}, auto = false) {
  const { w, rng } = ctx;
  const o = w.opening;
  if (!o || o.status !== 'pending') return;
  o.status = 'done';
  o.auto = auto || undefined;
  for (const seat of o.seats) {
    const def = seatDef(seat.officeId);
    if (!def || !seat.candidates.length) continue;
    const isCand = (id: CitizenId | null | undefined) => id !== undefined && id !== null && seat.candidates.some((k) => k.id === id);
    let chosenId = seat.chosenId!;
    let share = 0;
    if (seat.mode === 'election') {
      const b = backed[seat.officeId];
      seat.backedId = isCand(b) ? (b as CitizenId) : undefined;
      seat.votes = openingVotes(w, seat, seat.backedId, rng);
      chosenId = leader(seat.votes);
      share = seat.votes[chosenId] / total(seat.votes);
      const leakP = w.policies.transparency === 'high' ? 0.5 : w.policies.transparency === 'low' ? 0.12 : 0.25;
      seat.leaked = seat.backedId !== undefined && rng.chance(leakP);
      if (seat.backedId !== undefined) addTag(w, 'opening_backed');
    } else if (isCand(picks[seat.officeId])) chosenId = picks[seat.officeId]!;
    // Les candidats non retenus retournent à leur poste.
    for (const k of seat.candidates) if (k.id !== chosenId) uninstall(w, k);
    const c = w.citizens[chosenId];
    install(w, seat.officeId, c);
    seat.chosenId = chosenId;
    const cand = seat.candidates.find((k) => k.id === chosenId)!;
    const arch = archetypeOf(seat.officeId, cand.archetype);
    const office = w.offices[seat.officeId];
    if (seat.mode === 'election') {
      office.legitimacy = clamp(40 + share * 70 + (seat.backedId === undefined ? 5 : 0) - (seat.leaked ? 12 : 0));
      office.termEndsDay = dayOf(w) + YEAR_DAYS * 2;
      journal(w, `${fullName(c)} est élu·e ${office.title.toLowerCase()} avec ${Math.round(share * 100)} % des voix.`, 'important', 'admin');
      if (seat.backedId !== undefined && seat.backedId !== chosenId) journal(w, `Le candidat soutenu par la DSI, ${fullName(w.citizens[seat.backedId])}, est battu.`, 'attention', 'admin');
      if (seat.leaked) {
        w.psychology.legitimacy = clamp(w.psychology.legitimacy - 5);
        shakeTrust(w, 'it', -8);
        journal(w, 'Le soutien discret de la DSI à un candidat a été éventé : on parle d’élection arrangée.', 'important', 'admin');
      }
      // Le mieux placé des battus garde ses partisans… et sa rancune.
      const votes = seat.votes ?? {};
      const runner = seat.candidates.filter((k) => k.id !== chosenId).sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0))[0];
      if (runner && (votes[runner.id] ?? 0) / total(votes) >= 0.18) {
        const r = w.citizens[runner.id];
        if (!r.flags.includes('opening_rival')) r.flags.push('opening_rival');
        r.popularity = clamp(r.popularity + 4);
        for (const m of w.citizens) {
          if (m.lifeState !== 'alive' || m.sector !== runner.fromSector || runner.fromSector === 'residential') continue;
          m.grievance = clamp(m.grievance + 5);
          m.trust = clamp(m.trust - 3);
        }
      }
      if (arch?.pledge) {
        w.promises.push({ id: w.nextUid++, text: arch.pledge.text, deadlineTick: w.tick + Math.round(arch.pledge.days * TICKS_PER_DAY), check: arch.pledge.check, tag: 'campaign' });
        journal(w, `Promesse de campagne : ${arch.pledge.text}.`, 'info', 'admin');
      }
    } else {
      office.legitimacy = clamp(45 + c.popularity * 0.35 + c.skill * 0.1);
      if (cand.incumbent) journal(w, `${office.title} : ${fullName(c)} est maintenu·e dans ses fonctions.`, 'info');
      else journal(w, `${office.title} : ${fullName(c)} est nommé·e par la DSI.`, 'info');
    }
    addTag(w, `opening_${seat.officeId}_${cand.archetype}`);
    if (arch?.onSeat) applyEffects(ctx, arch.onSeat, { subjectId: c.id });
  }
  addTag(w, 'opening_done');
  w.psychology.legitimacy = clamp(w.psychology.legitimacy + 2);
  const mayor = holder(w, 'mayor');
  const deputy = holder(w, 'it_director');
  if (mayor) {
    const b = o.seats.find((x) => x.officeId === 'mayor')?.backedId;
    // Le maire sait qui l'a aidé·e… ou qui a soutenu son adversaire.
    if (b !== undefined) mayor.trust = clamp(mayor.trust + (b === mayor.id ? 15 : -20));
    const first =
      b === undefined
        ? 'Le silo m’a choisi·e sans vous. C’est une force, et je vous la rappellerai.'
        : b === mayor.id
          ? 'Je sais ce que je dois à vos consignes. Je n’aime pas les dettes.'
          : 'Je sais que vous souteniez quelqu’un d’autre. Je ne vous en tiendrai pas rigueur — pas encore.';
    message(w, `Maire — ${fullName(mayor)}`, 'Premier jour', `${first} Je parlerai aux étages. Vous, gardez les machines en vie et dites-moi la vérité quand elle compte.`, mayor.id);
  }
  if (deputy)
    message(
      w,
      `Adjointe DSI — ${fullName(deputy)}`,
      'Les dossiers de Cort',
      'Cort tenait une liste pour ses premiers jours : réunir le conseil, ouvrir un audit (les registres mentent), poser des adjoints là où ça gronde, et tenir ce que le maire a promis. Je l’ai recopiée dans vos objectifs. J’espérais ce poste, vous le savez. Je ferai mon travail.',
      deputy.id,
    );
}

const total = (votes: Record<number, number>) => Object.values(votes).reduce((a, b) => a + b, 0) || 1;

const ambitionOf = (c: Citizen) => Math.round(clamp((c.traits.includes('ambitious') ? 58 : 12) + c.leadership * 0.32));

/** Vue de l'investiture pour l'écran d'ouverture (et ses résultats, tant que la partie n'a pas démarré). */
export function openingView(ctx: Ctx): OpeningView | undefined {
  const { w } = ctx;
  const o = w.opening;
  if (!o || !o.seats.length) return undefined;
  if (o.status === 'done' && (o.auto || w.tick > TICKS_PER_DAY / 2)) return undefined;
  return {
    status: o.status,
    auto: o.auto,
    seats: o.seats.map((seat) => {
      const def = seatDef(seat.officeId) as SeatDef;
      const votes = seat.votes ? shares(seat.votes) : undefined;
      const free = seat.polls ? Object.fromEntries(Object.entries(seat.polls).map(([id, p]) => [id, p.free])) : {};
      const backedPolls = seat.polls ? Object.values(seat.polls).map((p) => p.backed - p.free) : [];
      return {
        officeId: seat.officeId,
        title: w.offices[seat.officeId].title,
        mode: seat.mode,
        role: def.role,
        weighs: def.weighs,
        chosenId: seat.chosenId,
        backedId: seat.backedId,
        leaked: seat.leaked,
        backingBonus: backedPolls.length ? Math.round(backedPolls.reduce((a, b) => a + b, 0) / backedPolls.length) : undefined,
        candidates: seat.candidates.map((k) => {
          const c = w.citizens[k.id];
          const arch = archetypeOf(seat.officeId, k.archetype);
          const noise = ((c.id * 37) % 21) - 10; // les dossiers de la DSI ne sont pas exacts
          return {
            id: c.id,
            name: fullName(c),
            age: Math.floor(c.age),
            sex: c.sex,
            sector: k.fromSector,
            sectorName: SECTOR_NAMES[k.fromSector],
            look: c.look,
            portrait: c.portrait,
            archetype: k.archetype,
            archetypeLabel: arch ? genderize(arch.label, c.sex) : '',
            skill: Math.round(c.skill),
            leadership: Math.round(c.leadership),
            integrity: Math.round(clamp(c.integrity + noise)),
            popularity: Math.round(c.popularity),
            loyalty: Math.round(c.trust),
            ambition: ambitionOf(c),
            traits: c.traits,
            bio: k.bio,
            file: k.file,
            pledge: k.pledge,
            incumbent: k.incumbent,
            poll: seat.mode === 'election' ? free[k.id] : undefined,
            votes: votes?.[k.id],
          };
        }),
      };
    }),
  };
}
