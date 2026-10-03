import { FLOORS, GENERATOR_CAPACITY, OFFICES, SCALE, SECTOR_NAMES, TICKS_PER_DAY, TICKS_PER_HOUR, TRAIT_LABELS, YEAR_DAYS } from './data/world';
import { Rng, clamp } from './rng';
import type { Ctx } from './context';
import { createWorld } from './create';
import { ROOMS } from './data/rooms';
import { autonomyDays, countStaff, energyStep, resourceStep, updateEfficiency } from './systems/economy';
import { fail, infrastructureHour, minesHour, riskLabel } from './systems/infrastructure';
import {
  appoint,
  decide,
  decisionView,
  dismissOffice,
  electionHour,
  evaluateEvents,
  eventDef,
  expireDecisions,
  processDelayed,
  processPromises,
  rebalanceStaff,
  setLockdown,
  spawn,
  startElection,
} from './systems/events';
import {
  arrestCitizen,
  computePresence,
  healthDeaths,
  locationOf,
  killCitizen,
  populationHour,
  propagate,
  reportsDay,
  sanitationHour,
  socialHour,
  supplyTheftDay,
} from './systems/social';
import type {
  Citizen,
  CitizenDetail,
  RoomDetail,
  CitizenSummary,
  FloorView,
  GameCommand,
  GameQuery,
  OfficeId,
  ResourceView,
  Snapshot,
  Speed,
  WorldState,
} from './types';
import { applyVerdict, caseAction, caseOf, justiceDay, justiceHour } from './systems/justice';
import { rumorAction, rumorsHour, startRumor } from './systems/rumors';
import { DEMAND_LABELS, STAGE_LABELS, factionAction, factionsDay, setStage } from './systems/factions';
import { convene, councilChoice, councilReadyIn, councilView, initAffinity } from './systems/council';
import { DIFFICULTY, diff } from './data/difficulty';
import { forecast } from './systems/forecast';
import { initInstitutions, institutionsDay, institutionsView } from './systems/institutions';
import { patrolCapacity, patrolHour, patrolsUsed, setPatrol } from './systems/patrols';
import { openingView, sealInvestiture } from './systems/opening';
import { initObjectives, objectivesHour, objectivesView } from './systems/objectives';
import { calendar, checkDefeat, checkVictory, demographyDay, remember, yearEnd } from './systems/years';
import { addTag, dayOf, fullName, hasTag, holder, hourOf, journal, minuteOfDay, pruneIncidents } from './util';

export class Engine {
  w: WorldState;
  ctx: Ctx;
  speed: Speed = 0; // la partie démarre en pause (intro / tutoriel)

  constructor(world?: WorldState) {
    this.w = world ?? createWorld();
    this.ctx = this.makeCtx();
    if (!Object.keys(this.w.officeAffinity).length) initAffinity(this.ctx);
    this.hourly();
  }

  private makeCtx(): Ctx {
    const ctx: Ctx = {
      w: this.w,
      rng: new Rng(this.w.rng),
      staff: {} as Ctx['staff'],
      children: 0,
      adults: 0,
      population: 0,
      sick: 0,
      waterSupplyRatio: 1,
      presence: {},
      infoAccuracy: 0.8,
      scheduled: [],
    };
    return ctx;
  }

  load(world: WorldState) {
    // Anciennes sauvegardes
    if (world.lens === undefined) world.lens = 0.8;
    world.cases ??= [];
    world.rumors ??= [];
    world.factions ??= [];
    world.officeAffinity ??= {};
    world.difficulty ??= 'standard';
    world.chronicle ??= [];
    world.yearReports ??= [];
    world.yearReportSeen ??= world.yearReports.length;
    world.yearStart ??= { population: world.citizens.filter((c) => c.lifeState === 'alive').length, deaths: world.stats.deaths, births: world.stats.births, arrests: world.stats.arrests, tick: world.tick };
    world.policies.births ??= 'normal';
    initInstitutions(world);
    // Ouverture narrative (investiture, objectifs) : absente des anciennes sauvegardes.
    world.opening ??= { status: 'done', auto: true, seats: [] };
    if (!world.objectives) {
      initObjectives(world);
      // Une partie déjà avancée n'a plus besoin du premier chapitre.
      if (Math.floor(world.tick / TICKS_PER_DAY) + 1 > 12) world.objectives!.chapter = 1;
    }
    world.stats.decisions ??= 0;
    world.stats.councils ??= 0;
    for (const def of OFFICES) if (world.offices[def.id]) world.offices[def.id].title = def.title;
    if (world.gameOver && !('kind' in world.gameOver)) world.gameOver = undefined;
    this.w = world;
    this.ctx = this.makeCtx();
    this.hourly();
  }

  serialize(): WorldState {
    this.w.rng = this.ctx.rng.state;
    return this.w;
  }

  // -------------------------------------------------------------------------
  // Tick de simulation (10 minutes de jeu)

  tick() {
    const w = this.w;
    if (w.gameOver) return;
    const ctx = this.ctx;
    // Sans écran d'investiture (tests, banc), les favoris sont confirmés au premier tick.
    if (w.opening?.status === 'pending') sealInvestiture(ctx, {}, {}, true);
    w.tick++;
    energyStep(ctx);
    resourceStep(ctx);
    minesHour(ctx, (id, cause, perceived) => killCitizen(ctx, id, cause, perceived));
    processDelayed(ctx);
    if (w.tick % TICKS_PER_HOUR === 0) this.hourly();
    if (w.tick % TICKS_PER_DAY === 0) this.daily();
    if (ctx.scheduled.length) evaluateEvents(ctx);
    expireDecisions(ctx);
  }

  private hourly() {
    const ctx = this.ctx;
    const w = this.w;
    countStaff(ctx);
    updateEfficiency(ctx);
    if (w.tick === 0) energyStep(ctx); // pour que le snapshot initial (en pause) soit juste
    computePresence(ctx);
    populationHour(ctx);
    sanitationHour(ctx);
    infrastructureHour(ctx);
    socialHour(ctx);
    healthDeaths(ctx);
    processPromises(ctx);
    electionHour(ctx);
    justiceHour(ctx);
    patrolHour(ctx);
    rumorsHour(ctx);
    if (w.tick > 0) evaluateEvents(ctx);
    objectivesHour(ctx);
    // Mesure de la fiabilité de l'information : DSI + serveurs + responsables.
    const it = holder(w, 'it_director');
    let acc = 0.42 + (it ? it.skill / 250 : 0) + w.assets.servers.condition * 0.12;
    if (hasTag(w, 'info_filtered')) acc -= 0.18;
    if (hasTag(w, 'it_oversight')) acc += 0.06;
    if (w.assets.servers.state === 'failed') acc -= 0.25;
    acc += diff(w).info;
    ctx.infoAccuracy = clamp(acc, 0.2, 1);
    if (w.policies.emergencyPowers) addTag(w, 'emergency_active', 1);
    // Mémoire collective : les émeutes marquent les étages.
    for (const f of w.floors) if (f.unrest >= 4) remember(ctx, 'riot', 3, { floors: [f.id] });
    checkDefeat(ctx, () => this.deathChain());
  }

  private daily() {
    const ctx = this.ctx;
    const w = this.w;
    supplyTheftDay(ctx);
    justiceDay(ctx);
    factionsDay(ctx);
    // La poussière et les vents salissent les capteurs extérieurs.
    w.lens = Math.max(0.05, w.lens - 0.012 - ctx.rng.next() * 0.01);
    reportsDay(ctx);
    pruneIncidents(w);
    institutionsDay(ctx);
    // Démographie : vieillesse et loterie des naissances.
    demographyDay(ctx, () => this.birth());
    // Crises vécues collectivement.
    if (w.resources.food.real <= 1) remember(ctx, 'famine', 10);
    if (w.resources.water.real <= 1) remember(ctx, 'thirst', 12);
    if (ctx.sick > ctx.population * 0.05) remember(ctx, 'epidemic', 8);
    w.blackoutDays = w.assets.generator.state === 'failed' && w.resources.battery <= 1 ? (w.blackoutDays ?? 0) + 1 : 0;
    // Tournant de l'année : vieillissement, affectations, bilan, fin de mandat.
    if (calendar(w).dayOfYear === 1 && dayOf(w) > 1) {
      yearEnd(ctx);
      checkVictory(ctx);
    }
    for (const c of w.citizens) if (c.flags.includes('rewarded') && ctx.rng.chance(0.2)) c.flags = c.flags.filter((f) => f !== 'rewarded');
    for (const [k, v] of Object.entries(w.tags)) if (v <= w.tick) delete w.tags[k];
    w.history.push({
      day: dayOf(w),
      population: ctx.population,
      food: Math.round((w.resources.food.declared / w.resources.food.capacity) * 100),
      water: Math.round((w.resources.water.declared / w.resources.water.capacity) * 100),
      energy: Math.round((w.resources.energyProduction / GENERATOR_CAPACITY) * 100),
      materials: Math.round((w.resources.materials.declared / w.resources.materials.capacity) * 100),
      stability: Math.round(w.stability),
    });
    if (w.history.length > 120) w.history.shift();
    if (w.memories.length > 200) w.memories.splice(0, w.memories.length - 200);
  }

  private birth() {
    const w = this.w;
    const parents = w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 22 && c.age <= 40 && w.relations[c.id].some((r) => r.type === 'partner'));
    if (!parents.length) return;
    const p = this.ctx.rng.pick(parents);
    const sex = this.ctx.rng.chance(0.5) ? 'f' : 'm';
    const baby: Citizen = {
      ...p,
      id: w.citizens.length,
      first: this.ctx.rng.pick(sex === 'f' ? ['Lou', 'Ève', 'Mila', 'Nina', 'Iris'] : ['Tom', 'Noah', 'Léo', 'Axel', 'Sacha']),
      age: 0,
      sex,
      sector: 'residential',
      workFloor: p.homeFloor,
      officeId: undefined,
      key: false,
      portrait: undefined,
      traits: [],
      memories: [],
      flags: [],
      popularity: 10,
      influence: 0,
      look: Math.floor(this.ctx.rng.next() * 1000),
    };
    w.citizens.push(baby);
    w.relations.push([]);
    w.relations[p.id].push({ to: baby.id, type: 'parent', strength: 1, affinity: 95 });
    w.relations[baby.id].push({ to: p.id, type: 'child', strength: 1, affinity: 95 });
    w.stats.births++;
    journal(w, `Naissance : ${baby.first} ${baby.last}`, 'info', p.homeFloor);
  }

  /** Chaîne lisible des derniers événements marquants (pour l'écran de fin). */
  private deathChain() {
    const w = this.w;
    // Chaîne lisible : on regroupe les morts anonymes, on garde les événements marquants.
    const recent = w.memories.filter((m) => m.tick > w.tick - TICKS_PER_DAY * 20);
    const chain: string[] = [];
    const deathsByDay = new Map<number, number>();
    for (const m of recent) {
      const day = Math.floor(m.tick / TICKS_PER_DAY) + 1;
      if (m.type.startsWith('death') && m.text.includes('Conditions de vie')) deathsByDay.set(day, (deathsByDay.get(day) ?? 0) + 1);
      else if (chain.length < 10) chain.push(`Jour ${day} — ${m.text}`);
    }
    for (const [day, n] of deathsByDay) chain.push(`Jour ${day} — ${n} décès liés aux conditions de vie`);
    chain.sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
    return chain;
  }

  // -------------------------------------------------------------------------
  // Commandes

  command(cmd: GameCommand) {
    const w = this.w;
    const ctx = this.ctx;
    switch (cmd.type) {
      case 'SET_SPEED':
        this.speed = cmd.speed;
        break;
      case 'ACK_YEAR_REPORT':
        w.yearReportSeen = w.yearReports.length;
        break;
      case 'CONTINUE_FREE':
        if (w.gameOver?.kind === 'victory') {
          w.freeMode = true;
          w.gameOver = undefined;
          journal(w, 'L’administration reste en place au-delà de son mandat.', 'important');
        }
        break;
      case 'MAKE_DECISION':
        decide(ctx, cmd.uid, cmd.choiceId);
        break;
      case 'SET_POLICY':
        (w.policies as unknown as Record<string, unknown>)[cmd.key] = cmd.value;
        if (cmd.key === 'cleaning') {
          w.sectors.sanitation.staffingTarget = Math.round({ low: 28, normal: 45, high: 70 }[cmd.value as 'low' | 'normal' | 'high'] * SCALE);
          rebalanceStaff(ctx);
        }
        if (cmd.key === 'rations') {
          const delta = cmd.value === 'reduced' ? -6 : cmd.value === 'generous' ? 4 : 0;
          for (const c of w.citizens) if (c.lifeState === 'alive') c.morale = clamp(c.morale + delta);
        }
        journal(w, `Politique modifiée : ${policyLabel(cmd.key, cmd.value)}`, 'info');
        updateEfficiency(ctx);
        break;
      case 'SET_PATROL':
        setPatrol(ctx, cmd.floor, cmd.units);
        break;
      case 'SET_LOCKDOWN':
        setLockdown(ctx, cmd.floor, cmd.level);
        updateEfficiency(ctx);
        break;
      case 'SET_STAFFING': {
        const s = w.sectors[cmd.sector];
        s.staffingTarget = Math.max(0, s.staffingTarget + cmd.delta);
        rebalanceStaff(ctx);
        countStaff(ctx);
        updateEfficiency(ctx);
        break;
      }
      case 'APPOINT':
        appoint(ctx, cmd.officeId, cmd.citizenId);
        updateEfficiency(ctx);
        break;
      case 'START_ELECTION':
        startElection(ctx, cmd.officeId);
        break;
      case 'INVESTITURE':
        sealInvestiture(ctx, cmd.picks, cmd.backed ?? {});
        countStaff(ctx);
        updateEfficiency(ctx);
        objectivesHour(ctx);
        break;
      case 'SUPPORT_CANDIDATE':
        if (w.election && !w.election.winnerId) w.election.supportedId = cmd.citizenId;
        break;
      case 'AUDIT':
        this.audit(cmd.target);
        break;
      case 'COMMUNICATE':
        this.communicate(cmd.style);
        break;
      case 'CITIZEN_ACTION':
        this.citizenAction(cmd.citizenId, cmd.action);
        break;
      case 'SEND_REPAIR': {
        const a = w.assets[cmd.assetId];
        if (!a) break;
        if (a.state === 'running' || a.state === 'degraded') {
          if (w.resources.parts.real < 10) {
            journal(w, `Impossible de lancer la maintenance de ${a.name} : pièces insuffisantes.`, 'attention');
            break;
          }
          a.state = 'maintenance';
          a.repairProgress = 0;
          journal(w, `Maintenance planifiée : ${a.name}`, 'info', a.floor);
        } else addTag(w, `repair_${a.id}`, 1);
        break;
      }
      case 'CASE_ACTION':
        caseAction(ctx, cmd.caseId, cmd.action);
        break;
      case 'RUMOR_ACTION':
        rumorAction(ctx, cmd.rumorId, cmd.action);
        break;
      case 'FACTION_ACTION':
        factionAction(ctx, cmd.factionId, cmd.action, cmd.demand);
        break;
      case 'CONVENE_COUNCIL':
        convene(ctx);
        break;
      case 'COUNCIL_CHOICE':
        councilChoice(ctx, cmd.proposalId);
        break;
      case 'SPAWN_EVENT': {
        const def = eventDef(cmd.eventId);
        if (def) spawn(ctx, def, { floor: cmd.floor, assetId: cmd.assetId });
        break;
      }
      case 'DEBUG':
        this.debug(cmd.action, cmd.target);
        break;
      case 'MARK_READ': {
        const m = w.messages.find((x) => x.id === cmd.messageId);
        if (m) m.read = true;
        break;
      }
    }
  }

  private audit(target: 'supplies' | 'maintenance' | 'mines' | 'security') {
    const w = this.w;
    const ctx = this.ctx;
    if (hasTag(w, `audit_cooldown_${target}`)) return;
    addTag(w, `audit_cooldown_${target}`, 4);
    addTag(w, 'audit_done');
    if (target === 'supplies') {
      const r = w.resources;
      const lost = Math.round(r.parts.declared - r.parts.real + (r.medicine.declared - r.medicine.real));
      for (const k of ['food', 'water', 'parts', 'materials', 'medicine'] as const) r[k].declared = r[k].real;
      addTag(w, 'strike:supplies', 0.5);
      const chief = holder(w, 'supply_chief');
      journal(w, `Audit des fournitures : ${lost > 0 ? lost + ' unités manquantes' : 'registres conformes'}.`, lost > 10 ? 'important' : 'info', 'supplies');
      if (chief) chief.trust = clamp(chief.trust - 10);
      if (lost > 10) {
        const thief = w.citizens.find((c) => c.lifeState === 'alive' && c.flags.includes('thief'));
        if (thief) {
          ctx.scheduled.push({ id: 'theft_suspect', data: { subjectId: thief.id } });
        }
      }
    } else if (target === 'maintenance') {
      for (const a of Object.values(w.assets)) a.ignoredWarnings = 0;
      journal(w, `Audit maintenance : ${Object.values(w.assets).filter((a) => a.condition < 0.55).map((a) => `${a.name} ${Math.round(a.condition * 100)} %`).join(', ') || 'aucun équipement critique'}.`, 'info');
      addTag(w, 'maintenance_audited', 5);
    } else if (target === 'mines') {
      const s = w.assets.mine_supports;
      journal(w, `Audit des mines : étais ${Math.round(s.condition * 100)} %, foreuses ${Math.round(w.assets.mine_drill.condition * 100)} %, fatigue des mineurs élevée : ${w.sectors.mines.morale < 45 ? 'oui' : 'non'}.`, 'info', 'mines');
      for (const c of w.citizens) if (c.sector === 'mines' && c.lifeState === 'alive') c.trust = clamp(c.trust + 3);
    } else {
      const corrupt = w.citizens.filter((c) => c.lifeState === 'alive' && c.sector === 'security' && c.integrity < 35);
      journal(w, `Audit de la sécurité : ${corrupt.length} adjoint(s) au comportement douteux.`, corrupt.length ? 'attention' : 'info', 'security');
      for (const c of corrupt) if (!c.flags.includes('suspect')) c.flags.push('suspect');
      for (const c of w.citizens) if (c.sector === 'security' && c.lifeState === 'alive') c.morale = clamp(c.morale - 4);
    }
  }

  private communicate(style: 'truth' | 'reassure' | 'silence' | 'blame') {
    const w = this.w;
    if (hasTag(w, 'communication_cooldown')) return;
    addTag(w, 'communication_cooldown', 0.5);
    const mayor = holder(w, 'mayor');
    const credibility = (mayor ? mayor.leadership * 0.5 + mayor.popularity * 0.5 : 30) / 100;
    const crisis = w.incidents.some((i) => i.status !== 'resolved' && i.severity === 'critical');
    for (const c of w.citizens) {
      if (c.lifeState !== 'alive') continue;
      if (style === 'truth') {
        c.fear = clamp(c.fear + (crisis ? 3 : -2));
        c.trust = clamp(c.trust + 3 * credibility + (w.policies.transparency === 'high' ? 1 : 0));
      } else if (style === 'reassure') {
        c.fear = clamp(c.fear - 8 * credibility);
        c.trust = clamp(c.trust + (crisis ? 0 : 1));
      } else if (style === 'blame') {
        c.anger = clamp(c.anger - 4);
        c.trust = clamp(c.trust - 1);
      }
    }
    if (style === 'reassure' && crisis) {
      w.promises.push({ id: w.nextUid++, text: 'Situation maîtrisée sous 2 jours', deadlineTick: w.tick + TICKS_PER_DAY * 2, check: { all: [{ metric: 'asset.generator.state', op: '!=', value: 'failed' }, { metric: 'asset.pump_main.state', op: '!=', value: 'failed' }, { metric: 'floor.max.unrest', op: '<', value: 3 }] } });
    }
    if (style === 'blame') {
      const target = (['mines_chief', 'supply_chief', 'mechanic_chief'] as OfficeId[]).map((o) => holder(w, o)).filter(Boolean)[0];
      if (target) {
        target.popularity = clamp(target.popularity - 20);
        w.offices[target.officeId!].legitimacy = clamp(w.offices[target.officeId!].legitimacy - 15);
        propagate(this.ctx, target.id, 12, 'dismissal', 40);
        journal(w, `L’administration désigne ${fullName(target)} comme responsable.`, 'attention');
      }
    }
    if (style === 'silence') for (const c of w.citizens) if (c.lifeState === 'alive') c.fear = clamp(c.fear + 2);
    journal(w, `Communication officielle : ${{ truth: 'la vérité', reassure: 'message rassurant', silence: 'silence', blame: 'désignation d’un responsable' }[style]}.`, 'info');
  }

  private citizenAction(id: number, action: 'arrest' | 'release' | 'reward' | 'protect' | 'investigate' | 'dismiss') {
    const w = this.w;
    const ctx = this.ctx;
    const c = w.citizens[id];
    if (!c) return;
    switch (action) {
      case 'arrest': {
        if (c.lifeState !== 'alive') return;
        const evidence = c.flags.includes('thief') && c.flags.includes('investigated') ? 30 : c.flags.includes('suspect') ? 10 : -25;
        const sheriff = holder(w, 'sheriff');
        arrestCitizen(ctx, id, evidence > 0 ? 'Sur ordre de l’administration (dossier)' : 'Sur ordre de l’administration', clamp(45 + evidence + (sheriff ? (sheriff.integrity - 60) / 3 : -10)));
        if (evidence < 0) addTag(w, 'arbitrary_arrests', 15);
        break;
      }
      case 'release':
        if (c.lifeState === 'imprisoned' && caseOf(ctx, id)) {
          applyVerdict(ctx, id, 'pardon');
        } else if (c.lifeState === 'imprisoned') {
          c.lifeState = 'alive';
          journal(w, `${fullName(c)} est libéré·e.`, 'info');
          propagate(ctx, id, 10 + c.popularity * 0.2, 'reward', 70);
        }
        break;
      case 'reward':
        if (hasTag(w, `rewarded_${id}`)) return;
        addTag(w, `rewarded_${id}`, 5);
        c.flags.push('rewarded');
        c.popularity = clamp(c.popularity + 8);
        c.trust = clamp(c.trust + 12);
        propagate(ctx, id, 10 + c.influence * 0.2, 'reward', 80);
        w.resources.food.real = Math.max(0, w.resources.food.real - 20);
        journal(w, `${fullName(c)} est récompensé·e publiquement.`, 'info');
        break;
      case 'protect':
        if (!c.flags.includes('protected')) c.flags.push('protected');
        journal(w, `Protection rapprochée accordée à ${fullName(c)}.`, 'info');
        break;
      case 'investigate':
        if (!c.flags.includes('investigated')) c.flags.push('investigated');
        journal(w, `Enquête du shérif ouverte sur ${fullName(c)} : ${c.flags.includes('thief') ? 'indices de vol trouvés' : 'rien de probant'}.`, c.flags.includes('thief') ? 'attention' : 'info');
        if (c.flags.includes('thief') && !c.flags.includes('suspect')) c.flags.push('suspect');
        c.trustSecurity = clamp(c.trustSecurity - 10);
        break;
      case 'dismiss':
        if (c.officeId) dismissOffice(ctx, c.officeId);
        break;
    }
  }

  private debug(action: 'fail' | 'resources' | 'unrest' | 'accident' | 'faction' | 'rumor' | 'arrest' | 'year' | 'victory' | 'hour', target?: string) {
    const w = this.w;
    const ctx = this.ctx;
    if (action === 'hour') {
      // Avance la simulation jusqu'à l'heure demandée (outil de test).
      for (let i = 0; i < TICKS_PER_DAY && hourOf(w) !== Number(target); i++) this.tick();
      return;
    }
    if (action === 'year' || action === 'victory') {
      // Saute à la veille du prochain tournant d'année (ou de la fin du mandat).
      const year = action === 'victory' ? DIFFICULTY[w.difficulty].mandateYears : calendar(w).yearIndex + 1;
      const target = year * YEAR_DAYS * TICKS_PER_DAY - 2;
      if (target > w.tick) w.tick = target;
      for (let i = 0; i < 4; i++) this.tick();
      return;
    }
    if (action === 'fail') this.forceFailure(target ?? 'generator');
    else if (action === 'resources') {
      for (const k of ['food', 'water', 'parts', 'materials', 'medicine'] as const) {
        const r = w.resources[k];
        r.real = r.declared = r.capacity;
      }
      w.resources.battery = 100;
    } else if (action === 'unrest') {
      const f = w.floors.find((x) => x.id === (target ?? 'res_mid'));
      if (f) for (const c of w.citizens) if (c.lifeState === 'alive' && c.homeFloor === f.id) {
        c.anger = clamp(c.anger + 40);
        c.grievance = clamp(c.grievance + 35);
      }
    } else if (action === 'faction') {
      for (const c of w.citizens) if (c.sector === 'mines' && c.lifeState === 'alive') c.grievance = clamp(c.grievance + 35);
      w.sectors.mines.grievance = 50;
      for (let i = 0; i < 8 && !w.factions.some((f) => f.status === 'active' && f.sector === 'mines'); i++) factionsDay(ctx);
      const f = w.factions.find((x) => x.status === 'active' && x.sector === 'mines');
      if (f) {
        setStage(ctx, f, 1);
        setStage(ctx, f, 2);
      }
    } else if (action === 'rumor') {
      startRumor(ctx, 'rations_secretes', 'false');
    } else if (action === 'arrest') {
      const c = w.citizens.find((x) => x.lifeState === 'alive' && x.sector === 'supplies' && !x.officeId);
      if (c) {
        arrestCitizen(ctx, c.id, 'Vol de fournitures', 60);
        const k = caseOf(ctx, c.id);
        if (k) k.trialTick = w.tick + 1;
      }
    } else if (action === 'accident') {
      const miner = w.citizens.find((c) => c.lifeState === 'alive' && c.sector === 'mines');
      if (miner) {
        killCitizen(ctx, miner.id, 'Accident minier', 'negligence');
        ctx.scheduled.push({ id: 'mine_accident', data: { floor: 'mines', subjectId: miner.id } });
      }
    }
    evaluateEvents(ctx);
    journal(w, `[debug] ${action}${target ? ' ' + target : ''}`, 'info');
  }

  // Outil de debug / test : force la panne d'un équipement.
  forceFailure(assetId: string) {
    const a = this.w.assets[assetId];
    if (a) fail(this.ctx, a);
    evaluateEvents(this.ctx);
  }

  // -------------------------------------------------------------------------
  // Requêtes

  query(q: GameQuery): unknown {
    const w = this.w;
    switch (q.type) {
      case 'CITIZEN':
        return this.citizenDetail(q.id);
      case 'CITIZENS': {
        let list = w.citizens.filter((c) => c.lifeState !== 'dead' || c.key);
        if (q.floor) list = list.filter((c) => c.homeFloor === q.floor || c.workFloor === q.floor);
        if (q.sector) list = list.filter((c) => c.sector === q.sector);
        if (q.keyOnly) list = list.filter((c) => c.key);
        if (q.search) {
          const s = q.search.toLowerCase();
          list = list.filter((c) => fullName(c).toLowerCase().includes(s));
        }
        list.sort((a, b) => Number(!!b.officeId) - Number(!!a.officeId) || Number(b.key) - Number(a.key) || b.influence - a.influence);
        return { total: list.length, items: list.slice(q.offset, q.offset + q.limit).map((c) => this.summary(c)) };
      }
      case 'ROOM':
        return this.roomDetail(q.floor, q.side);
      case 'CANDIDATES': {
        const office = w.offices[q.officeId];
        const pool = w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 25 && !c.officeId && (!office.sector || office.id === 'mayor' || office.id === 'judge' || c.sector === office.sector));
        pool.sort((a, b) => b.skill + b.leadership * 0.6 - (a.skill + a.leadership * 0.6));
        return pool.slice(0, 8).map((c) => this.citizenDetail(c.id));
      }
    }
  }

  private summary(c: Citizen): CitizenSummary {
    return {
      id: c.id,
      name: fullName(c),
      age: c.age,
      sector: c.sector,
      sectorName: SECTOR_NAMES[c.sector],
      homeFloor: c.homeFloor,
      workFloor: c.workFloor,
      lifeState: c.lifeState,
      morale: Math.round(c.morale),
      key: c.key,
      officeTitle: c.officeId ? this.w.offices[c.officeId].title : c.flags.includes('floor_manager') ? 'Responsable d’étage' : c.flags.includes('informal_leader') || c.flags.includes('agitator') ? 'Leader informel' : c.flags.includes('specialist') ? 'Spécialiste' : undefined,
      portrait: c.portrait,
      look: c.look,
    };
  }

  private roomDetail(floorId: string, side: 'left' | 'right'): RoomDetail | null {
    const w = this.w;
    const f = w.floors.find((x) => x.id === floorId);
    if (!f) return null;
    const texture = side === 'left' ? f.left : f.right;
    const h = hourOf(w);
    const here = w.citizens.filter((c) => {
      if (c.lifeState === 'dead') return false;
      const loc = locationOf(w, c, h);
      if (!loc || loc.floor !== floorId) return false;
      return f.left === f.right ? true : (c.id % 2 === 0) === (side === 'left');
    });
    here.sort((a, b) => Number(b.key) - Number(a.key) || b.influence - a.influence);
    const info = ROOMS[texture];
    const facts: string[] = [];
    if (f.cafeteria) facts.push(`Netteté de l’écran extérieur : ${Math.round(w.lens * 100)} %`);
    if (texture === 'court') facts.push(`Affaires en cours : ${w.cases.filter((k) => k.status !== 'closed').length}`);
    if (texture === 'security') facts.push(`Détenus : ${w.citizens.filter((c) => c.lifeState === 'imprisoned').length}/10 cellules`);
    if (texture === 'school') facts.push(`Enfants scolarisés : ${w.citizens.filter((c) => c.lifeState === 'alive' && c.age >= 6 && c.age < 16).length}`);
    if (texture === 'bazaar') facts.push(w.policies.rations === 'reduced' ? 'Le troc de nourriture flambe avec le rationnement.' : 'Échanges calmes.');
    if (f.lockdown !== 'open') facts.push(f.lockdown === 'full' ? 'Étage sous blocus' : 'Accès contrôlés');
    if (f.cleanliness < 40) facts.push(`Propreté préoccupante (${f.cleanliness | 0} %)`);
    return {
      floor: f.id,
      floorLabel: f.label,
      floorName: f.name,
      side,
      texture,
      title: info?.title ?? f.name,
      description: info?.description ?? '',
      occupants: here.slice(0, 14).map((c) => ({ id: c.id, name: fullName(c), sector: c.sector, look: c.look, portrait: c.portrait, label: locationOf(w, c, h)?.label ?? '', officeTitle: c.officeId ? w.offices[c.officeId].title : undefined })),
      total: here.length,
      assets: Object.values(w.assets)
        .filter((a) => a.floor === f.id)
        .map((a) => ({ id: a.id, name: a.name, condition: a.condition, state: a.state })),
      facts,
    };
  }

  private citizenDetail(id: number): CitizenDetail | null {
    const w = this.w;
    const c = w.citizens[id];
    if (!c) return null;
    const h = hourOf(w);
    const routine = c.lifeState === 'dead' ? 'Décédé·e' : (locationOf(w, c, h)?.label ?? '—');
    return {
      ...this.summary(c),
      skill: Math.round(c.skill),
      leadership: Math.round(c.leadership),
      integrity: Math.round(c.integrity),
      traits: c.traits,
      health: Math.round(c.health),
      fatigue: Math.round(c.fatigue),
      fear: Math.round(c.fear),
      anger: Math.round(c.anger),
      grievance: Math.round(c.grievance),
      trust: Math.round(c.trust),
      popularity: Math.round(c.popularity),
      influence: Math.round(c.influence),
      relations: w.relations[id]
        .slice()
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 14)
        .map((r) => ({ id: r.to, name: fullName(w.citizens[r.to]), type: r.type, strength: r.strength, lifeState: w.citizens[r.to].lifeState })),
      memories: c.memories,
      household: w.citizens.filter((x) => x.householdId === c.householdId && x.id !== c.id).map((x) => ({ id: x.id, name: fullName(x), age: x.age, lifeState: x.lifeState })),
      routine,
      location: (() => {
        const loc = locationOf(w, c, h);
        if (!loc) return undefined;
        const fl = w.floors.find((x) => x.id === loc.floor);
        return { floor: loc.floor, floorLabel: fl?.label ?? '', floorIndex: fl?.index ?? 0, act: loc.act, label: loc.label };
      })(),
      schedule: Array.from({ length: 24 }, (_, hour) => {
        const loc = locationOf(w, c, hour);
        const fl = loc ? w.floors.find((x) => x.id === loc.floor) : undefined;
        return { hour, floor: loc?.floor ?? '', floorLabel: fl ? `${fl.label} ${fl.name}` : '—', act: loc?.act ?? 'sleep', label: loc?.label ?? '—' };
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Snapshot compact pour le rendu

  snapshot(): Snapshot {
    const w = this.w;
    const ctx = this.ctx;
    const acc = ctx.infoAccuracy;
    const day = dayOf(w);
    // Bruit stable sur la journée : l'information imparfaite ne scintille pas à chaque tick.
    const noise = (salt: number) => {
      const x = Math.sin(day * 12.9898 + salt * 78.233) * 43758.5453;
      return (x - Math.floor(x) - 0.5) * 2 * (1 - acc);
    };
    const r = w.resources;
    const days = autonomyDays(w, ctx);
    const rv = (key: 'food' | 'water' | 'materials' | 'parts' | 'medicine', label: string, salt: number, d: number): ResourceView => ({
      key,
      label,
      pct: clamp(Math.round(((r[key].declared * (1 + noise(salt) * 0.12)) / r[key].capacity) * 100)),
      days: d,
      trend: Math.round(w.rates[key]),
      stock: Math.round(r[key].declared),
      capacity: r[key].capacity,
    });
    const resources: ResourceView[] = [
      rv('food', 'Nourriture', 1, days.food),
      rv('water', 'Eau', 2, days.water),
      {
        key: 'energy',
        label: 'Énergie',
        pct: clamp(Math.round((r.energyProduction / GENERATOR_CAPACITY) * 100)),
        days: r.battery,
        trend: Math.round(r.energyProduction - r.energyDemand),
        stock: Math.round(r.energyProduction),
        capacity: Math.round(r.energyDemand),
      },
      rv('materials', 'Matériaux', 3, r.materials.declared / 190),
      rv('parts', 'Pièces', 4, r.parts.declared / 12),
      rv('medicine', 'Médicaments', 5, r.medicine.declared / Math.max(1, 6 + ctx.sick * 0.12)),
    ];

    const floors: FloorView[] = w.floors.map((f, i) => {
      const pr = ctx.presence[f.id] ?? { present: 0, work: 0, walk: 0, eat: 0, sleep: 0, leisure: 0 };
      const mgr = f.managerId !== undefined ? w.citizens[f.managerId] : undefined;
      // Un responsable peu fiable minimise la colère de son étage.
      const minimize = mgr && mgr.lifeState === 'alive' ? (1 - f.reportingAccuracy) * (mgr.integrity < 50 ? 0.5 : 0.15) * diff(w).managerBias : 0.2;
      const incidents = w.incidents.filter((x) => x.floor === f.id && x.status !== 'resolved');
      const assetsHere = Object.values(w.assets).filter((a) => a.floor === f.id);
      const repairing = assetsHere.some((a) => a.state === 'failed' || a.state === 'maintenance');
      const alert: FloorView['alert'] = incidents.some((x) => x.severity === 'critical') || f.unrest >= 4 || assetsHere.some((a) => a.state === 'failed') ? 'critical' : incidents.length || f.unrest >= 2 || f.cleanliness < 35 || assetsHere.some((a) => a.condition < 0.5) ? 'warning' : 'normal';
      const sector = w.sectors[f.sector];
      return {
        id: f.id,
        index: i,
        label: f.label,
        name: f.name,
        sector: f.sector,
        left: f.left,
        right: f.right,
        cafeteria: f.cafeteria,
        present: pr.present,
        residents: f.residents,
        workers: f.workers,
        workersTarget: f.sector === 'residential' ? 0 : sector.staffingTarget,
        power: f.power,
        water: f.water,
        condition: f.condition,
        cleanliness: Math.round(f.cleanliness),
        morale: Math.round(f.morale),
        fear: Math.round(f.fear),
        anger: Math.round(f.anger * (1 - minimize)),
        trust: Math.round(f.trust),
        unrest: f.unrest,
        lockdown: f.lockdown,
        patrol: f.patrol ?? 0,
        alert,
        activity: { work: pr.work, walk: pr.walk, eat: pr.eat, sleep: pr.sleep, leisure: pr.leisure },
        incidentCount: incidents.length,
        repairing,
        managerName: mgr ? fullName(mgr) : undefined,
        managerId: mgr?.id,
        rumor: Math.max(0, ...w.rumors.filter((r) => r.status === 'spreading' || r.status === 'confirmed').map((r) => r.reach[f.id] ?? 0)),
        factionSymbol: w.factions.find((x) => x.status === 'active' && x.stage >= 1 && x.floorIds.includes(f.id))?.symbol,
      };
    });

    const e = w.election;
    return {
      tick: w.tick,
      day,
      hour: hourOf(w),
      minute: minuteOfDay(w) % 60,
      speed: this.speed,
      population: ctx.population,
      popTrend: w.history.length > 1 ? ctx.population - w.history[w.history.length - 2].population : 0,
      resources,
      energy: { production: Math.round(r.energyProduction), demand: Math.round(r.energyDemand), battery: Math.round(r.battery), generatorState: w.assets.generator.state },
      floors,
      sectors: Object.values(w.sectors)
        .filter((s) => s.id !== 'residential')
        .map((s) => ({ id: s.id, name: s.name, staffing: ctx.staff[s.id], target: s.staffingTarget, morale: Math.round(s.morale), efficiency: s.efficiency, cohesion: s.cohesion, strikeRisk: Math.round(s.strikeRisk) })),
      assets: Object.values(w.assets).map((a, i) => {
        const perceived = clamp(a.condition + noise(10 + i) * 0.18, 0, 1);
        return { id: a.id, name: a.name, floor: a.floor, condition: perceived, state: a.state, risk: riskLabel({ condition: perceived, state: a.state }), repairProgress: a.repairProgress, critical: a.critical };
      }),
      offices: Object.values(w.offices).map((o) => {
        const h = holder(w, o.id);
        return {
          id: o.id,
          title: o.title,
          portrait: h?.portrait ?? '',
          holderId: h?.id,
          holderName: h ? fullName(h) + (h.flags.includes('interim') ? ' (intérim)' : '') : undefined,
          skill: h ? Math.round(h.skill) : undefined,
          leadership: h ? Math.round(h.leadership) : undefined,
          integrity: h ? Math.round(clamp(h.integrity + noise(30 + h.id) * 25)) : undefined,
          popularity: h ? Math.round(h.popularity) : undefined,
          loyalty: h ? Math.round(h.trust) : undefined,
          traits: h?.traits,
          legitimacy: Math.round(o.legitimacy),
          succession: o.succession,
          termEndsDay: o.termEndsDay,
        };
      }),
      decisions: w.pending
        .map((p) => decisionView(ctx, p))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.hoursLeft - b.hoursLeft),
      incidents: w.incidents
        .slice()
        .reverse()
        .slice(0, 30)
        .map((i) => ({ id: i.id, type: i.type, title: i.title, floor: i.floor, floorLabel: i.floor ? FLOORS.find((f) => f.id === i.floor)?.label : undefined, severity: i.severity, status: i.status, ageHours: (w.tick - i.startedTick) / TICKS_PER_HOUR, causes: i.causes })),
      journal: w.journal.slice(-80),
      messages: w.messages.slice(-30),
      policies: w.policies,
      psychology: {
        fear: Math.round(w.psychology.fear),
        morale: Math.round(w.psychology.morale),
        trust: Math.round(w.psychology.trust),
        legitimacy: Math.round(w.psychology.legitimacy),
        authority: Math.round(w.psychology.authority),
      },
      stability: Math.round(w.stability),
      election: e
        ? {
            officeId: e.officeId,
            title: w.offices[e.officeId].title,
            candidates: e.candidateIds.map((id) => {
              const total = Object.values(e.results ?? {}).reduce((a, b) => a + b, 0) || 1;
              return { id, name: fullName(w.citizens[id]), support: Math.round(((e.results?.[id] ?? 0) / total) * 100), portrait: w.citizens[id].portrait };
            }),
            endsInHours: Math.max(0, (e.endTick - w.tick) / TICKS_PER_HOUR),
            supportedId: e.supportedId,
            winnerId: e.winnerId,
          }
        : undefined,
      history: w.history,
      tags: Object.keys(w.tags).filter((t) => hasTag(w, t)),
      gameOver: w.gameOver,
      calendar: { ...calendar(w), yearDays: YEAR_DAYS, mandateYear: calendar(w).yearIndex + 1, mandateYears: DIFFICULTY[w.difficulty].mandateYears, freeMode: !!w.freeMode },
      difficulty: w.difficulty,
      chronicle: [...w.chronicle]
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 12)
        .map((e) => ({ id: e.id, title: e.title, severity: Math.round(e.severity), year: e.year, kind: e.kind, reactivations: e.reactivations, commemorated: e.commemorated })),
      yearReport: w.yearReportSeen < w.yearReports.length ? w.yearReports[w.yearReports.length - 1] : undefined,
      infoAccuracy: acc,
      lens: w.lens,
      cases: w.cases
        .filter((k) => k.status !== 'closed' || w.tick - (k.sentenceEndTick ?? k.trialTick) < TICKS_PER_DAY * 3)
        .map((k) => {
          const c = w.citizens[k.defendantId];
          return {
            id: k.id,
            defendantId: k.defendantId,
            name: fullName(c),
            charge: k.charge,
            evidence: k.evidence,
            status: k.status,
            verdict: k.verdict,
            hoursToTrial: Math.max(0, (k.trialTick - w.tick) / TICKS_PER_HOUR),
            daysLeft: k.sentenceEndTick ? Math.max(0, (k.sentenceEndTick - w.tick) / TICKS_PER_DAY) : undefined,
            forced: k.forced,
            appealed: k.appealed,
            notes: k.notes,
            popularity: Math.round(c.popularity),
          };
        })
        .reverse(),
      rumors: w.rumors
        .filter((r) => r.status !== 'gone')
        .map((r) => {
          const floors = w.floors.map((f) => ({ id: f.id, label: f.label, reach: Math.round(clamp((r.reach[f.id] ?? 0) + noise(50 + r.id + f.index) * 0.15, 0, 1) * 100) / 100 }));
          return {
            id: r.id,
            templateId: r.templateId,
            text: r.text,
            truth: r.known ? r.truth : 'unknown',
            status: r.status,
            reach: floors.reduce((s, f) => s + f.reach, 0) / floors.length,
            floors,
            ageHours: (w.tick - r.createdTick) / TICKS_PER_HOUR,
            investigating: !!r.investigating,
            denied: r.denied,
            originName: r.known && r.originId !== undefined ? fullName(w.citizens[r.originId]) : undefined,
          };
        }),
      factions: w.factions
        .filter((f) => f.detected && f.status !== 'dissolved')
        .map((f) => ({
          id: f.id,
          name: f.name,
          symbol: f.symbol,
          sectorName: SECTOR_NAMES[f.sector],
          floors: f.floorIds.map((id) => w.floors.find((x) => x.id === id)?.label ?? id),
          leaderId: f.leaderId,
          leaderName: fullName(w.citizens[f.leaderId]),
          members: f.members.length,
          memberIds: f.infiltrated ? f.members.slice(0, 30) : undefined,
          influence: Math.round(f.influence),
          stage: f.stage,
          stageLabel: STAGE_LABELS[f.stage],
          demands: f.demands.map((d) => ({ kind: d, label: DEMAND_LABELS[d] })),
          infiltrated: f.infiltrated,
          status: f.status,
        })),
      signals: w.factions
        .filter((f) => f.status === 'active' && !f.detected && f.stage >= 1)
        .flatMap((f) => {
          const fl = w.floors.find((x) => x.id === f.floorIds[0]);
          const where = fl ? `${fl.label} ${fl.name}` : '';
          const out = [{ floor: f.floorIds[0], text: `Des tags « ${f.symbol} » apparaissent dans les escaliers (${where}).` }];
          if (f.stage >= 2) out.push({ floor: f.floorIds[0], text: `Absentéisme en hausse chez les ${SECTOR_NAMES[f.sector].toLowerCase()}.` });
          return out;
        }),
      council: councilView(ctx),
      patrols: { capacity: patrolCapacity(ctx), used: patrolsUsed(w) },
      institutions: institutionsView(ctx),
      forecast: forecast(ctx, resources),
      councilReadyInHours: councilReadyIn(ctx),
      opening: openingView(ctx),
      objectives: objectivesView(w),
    };
  }
}

const sevRank = (s: string) => ({ info: 0, attention: 1, important: 2, critical: 3 })[s] ?? 0;

function policyLabel(key: string, value: unknown) {
  const labels: Record<string, string> = {
    rations: 'Rations',
    extendedHours: 'Heures prolongées',
    mineQuota: 'Quota minier',
    cleaning: 'Équipes de nettoyage',
    transparency: 'Transparence',
    powerPriority: 'Priorités énergétiques',
    maintenanceFocus: 'Priorité de maintenance',
    emergencyPowers: 'Pouvoirs d’urgence',
  };
  const v = Array.isArray(value) ? value.join(' > ') : typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value);
  return `${labels[key] ?? key} → ${v}`;
}

export { TRAIT_LABELS };
