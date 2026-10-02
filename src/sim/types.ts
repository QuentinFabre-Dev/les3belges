// Modèle de données du moteur. Tout est normalisé et sérialisable (identifiants, pas de références).

export type CitizenId = number;
export type FloorId = string;
export type SectorId =
  | 'admin'
  | 'security'
  | 'agriculture'
  | 'medical'
  | 'mechanical'
  | 'water'
  | 'energy'
  | 'supplies'
  | 'mines'
  | 'sanitation'
  | 'residential';
export type OfficeId =
  | 'mayor'
  | 'judge'
  | 'sheriff'
  | 'it_director'
  | 'mechanic_chief'
  | 'mines_chief'
  | 'medical_chief'
  | 'agri_chief'
  | 'supply_chief';
export type AssetId = string;
export type RoomTexture =
  | 'admin'
  | 'servers'
  | 'security'
  | 'canteen'
  | 'residential'
  | 'hydroponics'
  | 'medical'
  | 'workshop'
  | 'water'
  | 'generator'
  | 'depot'
  | 'mine'
  | 'cafe_main'
  | 'cafe_mid'
  | 'court'
  | 'council'
  | 'school'
  | 'bazaar'
  | 'quarters'
  | 'laundry'
  | 'greenhouse';

export type Trait =
  | 'loyal'
  | 'skeptical'
  | 'pragmatic'
  | 'altruistic'
  | 'ambitious'
  | 'impulsive'
  | 'calm'
  | 'solidary'
  | 'individualistic'
  | 'corruptible'
  | 'rigorous'
  | 'charismatic';

export type LifeState = 'alive' | 'dead' | 'imprisoned' | 'missing';

export interface Citizen {
  id: CitizenId;
  first: string;
  last: string;
  age: number;
  sex: 'f' | 'm';
  lifeState: LifeState;
  householdId: number;
  homeFloor: FloorId;
  workFloor: FloorId;
  sector: SectorId;
  skill: number; // 0-100 compétence métier
  leadership: number; // 0-100
  integrity: number; // 0-100
  traits: Trait[];
  // état courant (0-100)
  health: number;
  fatigue: number;
  morale: number;
  fear: number;
  anger: number;
  grievance: number;
  trust: number; // confiance envers l'administration
  trustSecurity: number;
  popularity: number;
  influence: number;
  key: boolean; // habitant suivi en détail
  officeId?: OfficeId;
  portrait?: string;
  look: number; // variante visuelle
  memories: CitizenMemory[];
  flags: string[];
}

export interface CitizenMemory {
  day: number;
  text: string;
  trustDelta: number;
  angerDelta: number;
}

export type RelationType = 'partner' | 'parent' | 'child' | 'sibling' | 'friend' | 'coworker' | 'rival';

export interface RelationshipEdge {
  to: CitizenId;
  type: RelationType;
  strength: number; // 0-1
  affinity: number; // -100..100
}

export interface FloorState {
  id: FloorId;
  index: number;
  label: string;
  name: string;
  sector: SectorId;
  left: RoomTexture;
  right: RoomTexture;
  cafeteria?: 'main' | 'relay';
  capacity: number;
  condition: number; // 0-1
  power: number; // 0-1 disponibilité énergétique
  water: number; // 0-1
  cleanliness: number; // 0-100
  waste: number; // 0-100
  managerId?: CitizenId;
  reportingAccuracy: number; // 0-1
  lockdown: LockdownLevel;
  lockdownSince?: number;
  unrest: UnrestLevel;
  unrestPressure: number;
  // agrégats sociaux (calculés)
  morale: number;
  fear: number;
  anger: number;
  grievance: number;
  trust: number;
  residents: number;
  workers: number;
  patrol?: number; // patrouilles d'adjoints affectées
  patrolSince?: number;
  patrolWarned?: boolean;
}

export type LockdownLevel = 'open' | 'controlled' | 'full';
export type UnrestLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface SectorState {
  id: SectorId;
  name: string;
  officeId?: OfficeId;
  staffingTarget: number;
  cohesion: number; // 0-1
  morale: number; // 0-100 (agrégat)
  efficiency: number; // 0-1.5 (calculé)
  grievance: number;
  strikeRisk: number;
}

export type AssetState = 'running' | 'degraded' | 'maintenance' | 'failed' | 'offline';

export interface InfrastructureAsset {
  id: AssetId;
  name: string;
  floor: FloorId;
  sector: SectorId;
  condition: number; // 0-1
  wearPerDay: number;
  state: AssetState;
  failureRisk: number; // probabilité / jour (calculée)
  repairProgress: number; // 0-1 quand en réparation
  partsPerRepair: number;
  critical: boolean;
  specialistIds: CitizenId[];
  ignoredWarnings: number;
}

export interface ResourceStock {
  real: number;
  declared: number; // ce que les registres affichent (vol / erreurs)
  capacity: number;
}

export interface Resources {
  food: ResourceStock;
  water: ResourceStock;
  parts: ResourceStock;
  materials: ResourceStock; // fer / matières
  medicine: ResourceStock;
  battery: number; // réserve d'énergie de secours 0-100
  energyProduction: number;
  energyDemand: number;
}

export interface Rates {
  food: number;
  water: number;
  parts: number;
  materials: number;
  medicine: number;
}

export type Rations = 'reduced' | 'normal' | 'generous';
export type CrewLevel = 'low' | 'normal' | 'high';

export interface Policies {
  rations: Rations;
  extendedHours: boolean;
  mineQuota: number; // 0.7 - 1.4
  cleaning: CrewLevel;
  transparency: 'low' | 'normal' | 'high';
  powerPriority: SectorId[];
  maintenanceFocus: AssetId | 'auto';
  emergencyPowers: boolean;
  births: 'restricted' | 'normal' | 'expanded'; // loterie des naissances
}

export interface Office {
  id: OfficeId;
  title: string;
  sector?: SectorId;
  holderId?: CitizenId;
  succession: 'election' | 'appointment';
  legitimacy: number; // 0-100
  portrait: string;
  termEndsDay?: number;
}

export type IncidentStatus = 'active' | 'contained' | 'resolved';
export type Severity = 'info' | 'attention' | 'important' | 'critical';

export interface Incident {
  id: number;
  type: string;
  title: string;
  floor?: FloorId;
  assetId?: AssetId;
  severity: Severity;
  startedTick: number;
  status: IncidentStatus;
  causes: string[];
  resolvedTick?: number;
}

export interface DecisionContext {
  floor?: FloorId;
  assetId?: AssetId;
  subjectId?: CitizenId;
  vars?: Record<string, string | number>;
}

export interface DelayedEffect {
  dueTick: number;
  effects: Effect[];
  note?: string;
  pctx?: DecisionContext;
}

export interface PendingDecision {
  uid: number;
  defId: string;
  createdTick: number;
  expiresTick: number;
  floor?: FloorId;
  assetId?: AssetId;
  subjectId?: CitizenId;
  vars: Record<string, string | number>;
}

export interface JournalEntry {
  tick: number;
  severity: Severity;
  text: string;
  floor?: FloorId;
}

export interface Message {
  id: number;
  tick: number;
  fromId?: CitizenId;
  fromTitle: string;
  subject: string;
  body: string;
  read: boolean;
}

export interface PromiseRecord {
  id: number;
  text: string;
  deadlineTick: number;
  check: Condition;
  resolved?: boolean;
}

export interface WorldMemory {
  tick: number;
  type: string;
  text: string;
  severity: number;
  perceivedLegitimacy: number;
}

export interface Election {
  officeId: OfficeId;
  candidateIds: CitizenId[];
  startTick: number;
  endTick: number;
  supportedId?: CitizenId;
  results?: Record<number, number>;
  winnerId?: CitizenId;
}

// ---------------------------------------------------------------------------
// Justice, rumeurs, factions, conseil (étape 2)

export type Verdict = 'acquitted' | 'prison' | 'cleaning' | 'pardoned';

export interface Case {
  id: number;
  defendantId: CitizenId;
  charge: string;
  severity: number; // 1-3 : gravité du motif
  evidence: number; // 0-100 : solidité du dossier
  openedTick: number;
  trialTick: number;
  status: 'detention' | 'trial' | 'serving' | 'closed';
  verdict?: Verdict;
  sentenceEndTick?: number;
  appealed?: boolean;
  forced?: boolean; // verdict imposé par l'administration contre l'avis du juge
  notes: string[];
}

export type RumorTruth = 'true' | 'false' | 'partial';

export interface Rumor {
  id: number;
  templateId: string;
  text: string;
  truth: RumorTruth;
  known: boolean; // le joueur connaît la vérité (enquête DSI)
  originFloor: FloorId;
  originId?: CitizenId;
  reach: Record<FloorId, number>; // 0-1 par étage
  createdTick: number;
  fear: number;
  anger: number;
  trust: number;
  status: 'spreading' | 'fading' | 'debunked' | 'confirmed' | 'gone';
  denied?: boolean;
  investigating?: number; // tick de fin d'enquête
}

export type DemandKind = 'lower_quota' | 'more_rations' | 'release_member' | 'replace_chief' | 'end_lockdown' | 'inquiry' | 'more_staff';

export interface Faction {
  id: number;
  name: string;
  symbol: string;
  sector: SectorId;
  floorIds: FloorId[];
  truceUntil?: number; // trêve après une concession : pas d'escalade avant ce tick
  leaderId: CitizenId;
  members: CitizenId[];
  influence: number; // 0-100
  stage: 0 | 1 | 2 | 3 | 4; // cercle, mouvement, organisation, préparation, insurrection
  demands: DemandKind[];
  createdTick: number;
  lastStageTick: number;
  detected: boolean;
  infiltrated: boolean;
  status: 'active' | 'coopted' | 'dissolved';
}

export interface CouncilProposal {
  id: string;
  label: string;
  hint: string;
  effects: Effect[];
}

export interface CouncilSession {
  tick: number;
  topic: string;
  title: string;
  summary: string;
  proposals: CouncilProposal[];
  statements: { officeId: OfficeId; proposalId: string; text: string }[];
  resolved?: string;
}

export interface WorldState {
  version: number;
  seed: number;
  rng: number;
  tick: number;
  citizens: Citizen[];
  relations: RelationshipEdge[][]; // index = CitizenId
  floors: FloorState[];
  sectors: Record<SectorId, SectorState>;
  offices: Record<OfficeId, Office>;
  assets: Record<AssetId, InfrastructureAsset>;
  resources: Resources;
  rates: Rates; // flux nets par jour (calculés)
  policies: Policies;
  incidents: Incident[];
  pending: PendingDecision[];
  delayed: DelayedEffect[];
  journal: JournalEntry[];
  messages: Message[];
  promises: PromiseRecord[];
  memories: WorldMemory[];
  tags: Record<string, number>; // tag -> tick d'expiration (Infinity = permanent)
  cooldowns: Record<string, number>;
  election?: Election;
  cases: Case[];
  rumors: Rumor[];
  factions: Faction[];
  council?: CouncilSession;
  officeAffinity: Record<string, number>; // 'a|b' -> -100..100
  psychology: { fear: number; morale: number; trust: number; legitimacy: number; authority: number };
  stability: number;
  lens: number; // netteté des capteurs extérieurs (écran des réfectoires), 0-1
  history: HistoryPoint[];
  nextUid: number;
  gameOver?: GameOver;
  stats: { deaths: number; births: number; arrests: number };
  difficulty: Difficulty;
  chronicle: ChronicleEntry[];
  yearReports: YearReport[];
  yearReportSeen: number;
  yearStart: { population: number; deaths: number; births: number; arrests: number; tick: number };
  freeMode?: boolean;
  blackoutDays?: number;
  institutions: Record<InstitutionId, { trust: number; history: number[] }>;
}

export type Difficulty = 'accessible' | 'standard' | 'hard';

export type InstitutionId = 'mayor' | 'judiciary' | 'security' | 'mechanics' | 'medical' | 'it';

export type ChronicleKind = 'mine_accident' | 'blackout' | 'famine' | 'thirst' | 'epidemic' | 'riot' | 'insurrection' | 'lockdown' | 'forced_verdict' | 'death_key' | 'truth';

/** Mémoire collective (§116) : une crise dont le silo se souvient, qui peut se réactiver. */
export interface ChronicleEntry {
  id: number;
  kind: ChronicleKind;
  title: string;
  tick: number;
  year: number;
  severity: number; // 0-100, s'efface avec les années
  peak: number;
  floors: FloorId[];
  sectors: SectorId[];
  responsibility?: string;
  reactivations: number;
  commemorated?: 'official' | 'quiet' | 'forbidden';
}

export interface YearReport {
  year: number;
  population: number;
  popDelta: number;
  births: number;
  deaths: number;
  arrests: number;
  stability: number;
  legitimacy: number;
  trust: number;
  memories: { title: string; severity: number }[];
  notes: string[];
}

export interface GameOver {
  day: number;
  year: number;
  kind: 'defeat' | 'victory';
  id: string;
  title: string;
  reason: string;
  chain: string[];
  epilogue: string[];
  stats: { label: string; value: string }[];
}

export interface HistoryPoint {
  day: number;
  population: number;
  food: number;
  water: number;
  energy: number;
  materials: number;
  stability: number;
}

// ---------------------------------------------------------------------------
// Événements data-driven

export type Condition =
  | { metric: string; op: '<' | '<=' | '>' | '>=' | '==' | '!='; value: number | string }
  | { tag: string }
  | { notTag: string }
  | { all: Condition[] }
  | { any: Condition[] };

export type Effect =
  | { type: 'resource'; resource: keyof Rates | 'battery'; amount: number; declaredOnly?: boolean; realOnly?: boolean }
  | { type: 'asset'; assetId: string; field: 'condition' | 'state'; amount?: number; value?: AssetState }
  | { type: 'floor'; floor: string; field: 'cleanliness' | 'condition' | 'waste'; amount: number }
  | { type: 'social'; target: string; stat: 'morale' | 'fear' | 'anger' | 'grievance' | 'trust' | 'trustSecurity' | 'fatigue' | 'health'; amount: number }
  | { type: 'sector'; sector: SectorId | 'subject'; field: 'cohesion' | 'staffingTarget'; amount: number }
  | { type: 'tag'; tag: string; days?: number; remove?: boolean }
  | { type: 'schedule'; eventId: string; delayDays: number }
  | { type: 'delayed'; delayDays: number; effects: Effect[]; note?: string }
  | { type: 'incident'; incidentType: string; title: string; floor?: string; assetId?: string; severity: Severity }
  | { type: 'resolve_incident'; incidentType?: string; floor?: string; assetId?: string }
  | { type: 'kill'; selector: string; cause: string; perceived: 'accident' | 'negligence' | 'legal' | 'controversial' | 'heroic' }
  | { type: 'arrest'; selector: string; reason: string; legitimacy: number }
  | { type: 'release'; selector: string }
  | { type: 'dismiss'; officeId: OfficeId }
  | { type: 'make_manager'; selector: string }
  | { type: 'policy'; key: keyof Policies; value: unknown }
  | { type: 'legitimacy'; amount: number }
  | { type: 'authority'; amount: number }
  | { type: 'office_legitimacy'; officeId: OfficeId; amount: number }
  | { type: 'lockdown'; floor: string; level: LockdownLevel }
  | { type: 'promise'; text: string; days: number; check: Condition }
  | { type: 'journal'; text: string; severity?: Severity }
  | { type: 'memory'; memoryType: string; text: string; severity: number; legitimacy: number }
  | { type: 'reveal_stocks' }
  | { type: 'chance'; p: number; then: Effect[]; else?: Effect[] }
  | { type: 'start_election'; officeId: OfficeId }
  | { type: 'clean_lens' }
  | { type: 'chronicle'; factor: number; mark?: 'official' | 'quiet' | 'forbidden' }
  | { type: 'remember'; kind: ChronicleKind; severity: number; title?: string }
  | { type: 'verdict'; mode: 'judge' | 'convict' | 'pardon' | 'cleaning' | 'reduce' | 'annul' | 'confirm' }
  | { type: 'rumor'; templateId: string }
  | { type: 'faction'; action: 'negotiate' | 'coopt' | 'infiltrate' | 'arrest_leader' | 'dissolve' };

export interface DecisionChoice {
  id: string;
  label: string;
  hint: string; // coût / risque lisible
  requires?: Condition[];
  effects: Effect[];
  advisor?: OfficeId; // responsable qui recommande ce choix
}

export interface EventDefinition {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string; // supporte {floor}, {asset}, {subject}, {office:x}
  image?: RoomTexture;
  conditions: Condition[];
  chancePerDay: number; // probabilité si conditions remplies
  cooldownDays: number;
  expiresDays: number;
  context?: { floorFrom?: string; assetFrom?: string; subjectFrom?: string };
  advice?: Partial<Record<OfficeId, string>>;
  onExpire?: Effect[];
  choices: DecisionChoice[];
  manual?: boolean; // déclenché uniquement par schedule / système
}

// ---------------------------------------------------------------------------
// Protocole Worker <-> main thread

export type Speed = 0 | 1 | 2 | 5 | 10;

export type GameCommand =
  | { type: 'SET_SPEED'; speed: Speed }
  | { type: 'MAKE_DECISION'; uid: number; choiceId: string }
  | { type: 'SET_POLICY'; key: keyof Policies; value: unknown }
  | { type: 'SET_LOCKDOWN'; floor: FloorId; level: LockdownLevel }
  | { type: 'SET_PATROL'; floor: FloorId; units: number }
  | { type: 'SET_STAFFING'; sector: SectorId; delta: number }
  | { type: 'APPOINT'; officeId: OfficeId; citizenId: CitizenId }
  | { type: 'START_ELECTION'; officeId: OfficeId }
  | { type: 'SUPPORT_CANDIDATE'; citizenId: CitizenId }
  | { type: 'AUDIT'; target: 'supplies' | 'maintenance' | 'mines' | 'security' }
  | { type: 'COMMUNICATE'; style: 'truth' | 'reassure' | 'silence' | 'blame' }
  | { type: 'CITIZEN_ACTION'; citizenId: CitizenId; action: 'arrest' | 'release' | 'reward' | 'protect' | 'investigate' | 'dismiss' }
  | { type: 'SEND_REPAIR'; assetId: AssetId }
  | { type: 'MARK_READ'; messageId: number }
  | { type: 'NEW_GAME'; seed?: number; difficulty?: Difficulty }
  | { type: 'ACK_YEAR_REPORT' }
  | { type: 'CONTINUE_FREE' }
  | { type: 'CASE_ACTION'; caseId: number; action: 'release' | 'expedite' }
  | { type: 'RUMOR_ACTION'; rumorId: number; action: 'deny' | 'confirm' | 'investigate' }
  | { type: 'FACTION_ACTION'; factionId: number; action: 'negotiate' | 'coopt' | 'infiltrate' | 'arrest_leader' | 'dissolve'; demand?: DemandKind }
  | { type: 'CONVENE_COUNCIL' }
  | { type: 'COUNCIL_CHOICE'; proposalId: string }
  | { type: 'SPAWN_EVENT'; eventId: string; floor?: FloorId; assetId?: AssetId }
  | { type: 'DEBUG'; action: 'fail' | 'resources' | 'unrest' | 'accident' | 'faction' | 'rumor' | 'arrest' | 'year' | 'victory' | 'hour'; target?: string }
  | { type: 'SAVE' }
  | { type: 'LOAD' };

export type WorkerRequest =
  | { kind: 'command'; command: GameCommand }
  | { kind: 'query'; requestId: number; query: GameQuery };

export type GameQuery =
  | { type: 'CITIZEN'; id: CitizenId }
  | { type: 'CITIZENS'; floor?: FloorId; sector?: SectorId; keyOnly?: boolean; search?: string; offset: number; limit: number }
  | { type: 'CANDIDATES'; officeId: OfficeId }
  | { type: 'ROOM'; floor: FloorId; side: 'left' | 'right' };

export type WorkerMessage =
  | { kind: 'snapshot'; snapshot: Snapshot }
  | { kind: 'reply'; requestId: number; data: unknown }
  | { kind: 'toast'; text: string; severity: Severity };

// ---------------------------------------------------------------------------
// Snapshot compact envoyé au rendu

export interface ResourceView {
  key: string;
  label: string;
  pct: number; // affiché (déclaré / perçu)
  days: number; // autonomie estimée en jours
  trend: number; // par jour
  stock: number;
  capacity: number;
}

export interface FloorView {
  id: FloorId;
  index: number;
  label: string;
  name: string;
  sector: SectorId;
  left: RoomTexture;
  right: RoomTexture;
  cafeteria?: 'main' | 'relay';
  present: number; // personnes présentes à cette heure
  residents: number;
  workers: number;
  workersTarget: number;
  power: number;
  water: number;
  condition: number;
  cleanliness: number;
  morale: number;
  fear: number;
  anger: number;
  trust: number;
  unrest: UnrestLevel;
  lockdown: LockdownLevel;
  alert: 'normal' | 'warning' | 'critical';
  activity: { work: number; walk: number; eat: number; sleep: number; leisure: number };
  incidentCount: number;
  repairing: boolean;
  patrol: number;
  rumor: number; // portée maximale d'une rumeur active (0-1)
  factionSymbol?: string; // tags d'une faction (visibles même non identifiée)
  managerName?: string;
  managerId?: CitizenId;
}

export interface AssetView {
  id: AssetId;
  name: string;
  floor: FloorId;
  condition: number; // perçue
  state: AssetState;
  risk: 'faible' | 'moyen' | 'élevé' | 'critique';
  repairProgress: number;
  critical: boolean;
}

export interface OfficeView {
  id: OfficeId;
  title: string;
  portrait: string;
  holderId?: CitizenId;
  holderName?: string;
  skill?: number;
  leadership?: number;
  integrity?: number;
  popularity?: number;
  loyalty?: number;
  traits?: Trait[];
  legitimacy: number;
  succession: 'election' | 'appointment';
  termEndsDay?: number;
}

export interface DecisionView {
  uid: number;
  defId: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  image?: RoomTexture;
  floor?: FloorId;
  hoursLeft: number;
  choices: { id: string; label: string; hint: string; enabled: boolean; advisor?: string }[];
  advice: { title: string; portrait?: string; sector: SectorId; look: number; text: string }[];
}

export interface IncidentView {
  id: number;
  type: string;
  title: string;
  floor?: FloorId;
  floorLabel?: string;
  severity: Severity;
  status: IncidentStatus;
  ageHours: number;
  causes: string[];
}

export interface CitizenSummary {
  id: CitizenId;
  name: string;
  age: number;
  sector: SectorId;
  sectorName: string;
  homeFloor: FloorId;
  workFloor: FloorId;
  lifeState: LifeState;
  morale: number;
  key: boolean;
  officeTitle?: string;
  portrait?: string;
  look: number;
}

export interface CitizenDetail extends CitizenSummary {
  skill: number;
  leadership: number;
  integrity: number;
  traits: Trait[];
  health: number;
  fatigue: number;
  fear: number;
  anger: number;
  grievance: number;
  trust: number;
  popularity: number;
  influence: number;
  relations: { id: CitizenId; name: string; type: RelationType; strength: number; lifeState: LifeState }[];
  memories: CitizenMemory[];
  household: { id: CitizenId; name: string; age: number; lifeState: LifeState }[];
  routine: string;
  location?: { floor: FloorId; floorLabel: string; floorIndex: number; act: string; label: string };
  schedule: { hour: number; floor: FloorId; floorLabel: string; act: string; label: string }[];
}

export interface RoomDetail {
  floor: FloorId;
  floorLabel: string;
  floorName: string;
  side: 'left' | 'right';
  texture: RoomTexture;
  title: string;
  description: string;
  occupants: { id: CitizenId; name: string; sector: SectorId; look: number; portrait?: string; label: string; officeTitle?: string }[];
  total: number;
  assets: { id: AssetId; name: string; condition: number; state: AssetState }[];
  facts: string[];
}

export interface Snapshot {
  tick: number;
  day: number;
  hour: number;
  minute: number;
  speed: Speed;
  population: number;
  popTrend: number;
  resources: ResourceView[];
  energy: { production: number; demand: number; battery: number; generatorState: AssetState };
  floors: FloorView[];
  sectors: { id: SectorId; name: string; staffing: number; target: number; morale: number; efficiency: number; cohesion: number; strikeRisk: number }[];
  assets: AssetView[];
  offices: OfficeView[];
  decisions: DecisionView[];
  incidents: IncidentView[];
  journal: JournalEntry[];
  messages: Message[];
  policies: Policies;
  psychology: { fear: number; morale: number; trust: number; legitimacy: number; authority: number };
  stability: number;
  election?: { officeId: OfficeId; title: string; candidates: { id: CitizenId; name: string; support: number; portrait?: string }[]; endsInHours: number; supportedId?: CitizenId; winnerId?: CitizenId };
  history: HistoryPoint[];
  tags: string[];
  gameOver?: GameOver;
  calendar: { year: number; dayOfYear: number; yearDays: number; mandateYear: number; mandateYears: number; freeMode: boolean };
  difficulty: Difficulty;
  chronicle: { id: number; title: string; severity: number; year: number; kind: ChronicleKind; reactivations: number; commemorated?: string }[];
  yearReport?: YearReport;
  infoAccuracy: number;
  lens: number;
  cases: CaseView[];
  rumors: RumorView[];
  factions: FactionView[];
  signals: { floor: FloorId; text: string }[];
  council?: CouncilView;
  councilReadyInHours: number;
  patrols: { capacity: number; used: number };
  institutions: { id: InstitutionId; label: string; trust: number; trend: number; causes: string[] }[];
  forecast: ForecastItem[];
}

export interface ForecastItem {
  id: string;
  text: string;
  inHours: number;
  severity: Severity;
  floor?: FloorId;
  view?: string;
}

export interface CaseView {
  id: number;
  defendantId: CitizenId;
  name: string;
  charge: string;
  evidence: number;
  status: Case['status'];
  verdict?: Verdict;
  hoursToTrial: number;
  daysLeft?: number;
  forced?: boolean;
  appealed?: boolean;
  notes: string[];
  popularity: number;
}

export interface RumorView {
  id: number;
  templateId: string;
  text: string;
  truth: RumorTruth | 'unknown';
  status: Rumor['status'];
  reach: number; // moyenne perçue
  floors: { id: FloorId; label: string; reach: number }[];
  ageHours: number;
  investigating: boolean;
  denied?: boolean;
  originName?: string;
}

export interface FactionView {
  id: number;
  name: string;
  symbol: string;
  sectorName: string;
  floors: string[];
  leaderId: CitizenId;
  leaderName: string;
  members: number;
  memberIds?: CitizenId[];
  influence: number;
  stage: number;
  stageLabel: string;
  demands: { kind: DemandKind; label: string }[];
  infiltrated: boolean;
  status: Faction['status'];
}

export interface CouncilView {
  title: string;
  summary: string;
  topic: string;
  resolved?: string;
  ageHours: number;
  proposals: { id: string; label: string; hint: string; backers: OfficeId[]; opposers: OfficeId[] }[];
  statements: { officeId: OfficeId; title: string; name: string; portrait?: string; sector: SectorId; look: number; proposalId: string; text: string }[];
  alliances: { a: string; b: string; value: number }[];
}
