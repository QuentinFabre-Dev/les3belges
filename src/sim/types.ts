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
  | 'mine';

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
  psychology: { fear: number; morale: number; trust: number; legitimacy: number; authority: number };
  stability: number;
  history: HistoryPoint[];
  nextUid: number;
  gameOver?: { day: number; reason: string; chain: string[] };
  stats: { deaths: number; births: number; arrests: number };
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
  | { type: 'start_election'; officeId: OfficeId };

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
  | { type: 'SET_STAFFING'; sector: SectorId; delta: number }
  | { type: 'APPOINT'; officeId: OfficeId; citizenId: CitizenId }
  | { type: 'START_ELECTION'; officeId: OfficeId }
  | { type: 'SUPPORT_CANDIDATE'; citizenId: CitizenId }
  | { type: 'AUDIT'; target: 'supplies' | 'maintenance' | 'mines' | 'security' }
  | { type: 'COMMUNICATE'; style: 'truth' | 'reassure' | 'silence' | 'blame' }
  | { type: 'CITIZEN_ACTION'; citizenId: CitizenId; action: 'arrest' | 'release' | 'reward' | 'protect' | 'investigate' | 'dismiss' }
  | { type: 'SEND_REPAIR'; assetId: AssetId }
  | { type: 'MARK_READ'; messageId: number }
  | { type: 'NEW_GAME'; seed?: number }
  | { type: 'SAVE' }
  | { type: 'LOAD' };

export type WorkerRequest =
  | { kind: 'command'; command: GameCommand }
  | { kind: 'query'; requestId: number; query: GameQuery };

export type GameQuery =
  | { type: 'CITIZEN'; id: CitizenId }
  | { type: 'CITIZENS'; floor?: FloorId; sector?: SectorId; keyOnly?: boolean; search?: string; offset: number; limit: number }
  | { type: 'CANDIDATES'; officeId: OfficeId };

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
  gameOver?: { day: number; reason: string; chain: string[] };
  infoAccuracy: number;
}
