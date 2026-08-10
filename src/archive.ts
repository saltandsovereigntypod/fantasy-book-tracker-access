import type { User } from '@supabase/supabase-js';
import type {
  BookRecord,
  CardDesign,
  SuspicionRecord,
  TheoryRecord,
  WallDossierRecord,
  WallRecord,
} from './domain';
import { defaultDesign } from './defaults';
import { normalizeIdentityAssignments, stableFaeRole, type IdentityAssignments } from './identity';
import { supabase } from './supabase';
import {
  PRYTHIAN_COURT_IDS,
  freshUniverseProfiles,
  prythianRankIndex,
  type PrythianCourtId,
  type UniverseProfiles,
} from './universes';

export interface V2BookRecord extends BookRecord {
  design: CardDesign;
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
  archived?: boolean;
}

export type PointEventKind =
  | 'book-added'
  | 'reading-session-started'
  | 'reading-session-completed'
  | 'book-first-completion'
  | 'book-reread-completion'
  | 'theory-created'
  | 'suspicion-created'
  | 'evidence-added';

export interface PointEvent {
  id: string;
  kind: PointEventKind;
  sourceId: string;
  label: string;
  amount: number;
  occurredAt: string;
}

export interface V2Profile {
  displayName: string;
  path: string;
  points: number;
  rankIndex: number;
  onboarded: boolean;
  identitySeed: string;
  identityAssignments: IdentityAssignments;
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: { kind: 'dragon' | 'gryphon' | 'wyvern'; name: string; color: string; tail?: string; flameColor?: 'Red' | 'Green' | 'Blue'; strength?: number };
  primaryPowerId?: string;
  primaryPowerName?: string;
  primaryPowerDescription?: string;
  rareAffinityId?: string;
  rareAffinityName?: string;
  role?: 'high-fae' | 'lesser-fae' | 'illyrian';
  court?: PrythianCourtId;
}

export interface V2ArchiveState {
  version: 1;
  profile: V2Profile;
  universes: UniverseProfiles;
  books: V2BookRecord[];
  theories: TheoryRecord[];
  suspicions: SuspicionRecord[];
  dossiers: WallDossierRecord[];
  walls: WallRecord[];
  mindMapNodes: unknown[];
  pointLog: PointEvent[];
  pointResetAt?: string;
  suppressedPointEventIds?: string[];
  updatedAt: string;
}

const LOCAL_KEY = 'empyrean-v2-archive';
const CLOUD_READ_TIMEOUT_MS = 5000;

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function validCourt(value: unknown): PrythianCourtId | undefined {
  return PRYTHIAN_COURT_IDS.includes(value as PrythianCourtId)
    ? value as PrythianCourtId
    : undefined;
}

function creatureKind(value: unknown): 'dragon' | 'gryphon' | 'wyvern' {
  return value === 'gryphon' || value === 'wyvern' ? value : 'dragon';
}

function hasLegacyPrythianIdentity(profile: Record<string, unknown>, source: Record<string, unknown>): boolean {
  return Boolean(
    validCourt(profile.court)
    || validCourt(source.court)
    || profile.primaryPowerId
    || profile.primaryPowerName
    || profile.primaryPowerDescription
    || profile.rareAffinityId
    || profile.rareAffinityName
    || profile.role
  );
}

function normalizeProfile(value: unknown, user?: User | null): V2Profile {
  const source = isRecord(value) ? value : {};
  const displayName = String(source.displayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Reader');
  const identitySeed = String(source.identitySeed || user?.id || `reader:${displayName.toLocaleLowerCase()}`);
  const sharedCreature: V2Profile['creature'] = isRecord(source.creature) && source.creature.name
    ? {
        kind: creatureKind(source.creature.kind),
        name: String(source.creature.name),
        color: String(source.creature.color || ''),
        tail: source.creature.tail ? String(source.creature.tail) : undefined,
        flameColor: source.creature.flameColor === 'Red' || source.creature.flameColor === 'Green' || source.creature.flameColor === 'Blue' ? source.creature.flameColor : undefined,
        strength: Number.isFinite(Number(source.creature.strength)) ? Number(source.creature.strength) : undefined,
      }
    : undefined;
  const identityAssignments = normalizeIdentityAssignments(source.identityAssignments, source, identitySeed);
  return {
    displayName,
    path: String(source.path || 'rider'),
    points: numberOr(source.points),
    rankIndex: numberOr(source.rankIndex),
    onboarded: Boolean(source.onboarded),
    identitySeed,
    identityAssignments,
    abilityId: source.abilityId ? String(source.abilityId) : undefined,
    abilityName: source.abilityName ? String(source.abilityName) : undefined,
    abilityDescription: source.abilityDescription ? String(source.abilityDescription) : undefined,
    creature: sharedCreature,
    primaryPowerId: source.primaryPowerId ? String(source.primaryPowerId) : undefined,
    primaryPowerName: source.primaryPowerName ? String(source.primaryPowerName) : undefined,
    primaryPowerDescription: source.primaryPowerDescription ? String(source.primaryPowerDescription) : undefined,
    rareAffinityId: source.rareAffinityId ? String(source.rareAffinityId) : undefined,
    rareAffinityName: source.rareAffinityName ? String(source.rareAffinityName) : undefined,
    role: source.role === 'lesser-fae' || source.role === 'illyrian' ? source.role : source.role === 'high-fae' ? 'high-fae' : undefined,
    court: validCourt(source.court),
  };
}

function normalizeUniverses(value: unknown, profile: V2Profile, archiveSource: Record<string, unknown>): UniverseProfiles {
  const raw = isRecord(value) ? value : {};
  const rawEmpyrean = isRecord(raw.empyrean) ? raw.empyrean : {};
  const rawPrythian = isRecord(raw.prythian) ? raw.prythian : {};
  const base = freshUniverseProfiles(profile.path);
  const migratedPrythian = hasLegacyPrythianIdentity(profile as unknown as Record<string, unknown>, archiveSource);
  const activeUniverse = raw.activeUniverse === 'prythian' || raw.activeUniverse === 'empyrean'
    ? raw.activeUniverse
    : migratedPrythian
      ? 'prythian'
      : 'empyrean';
  const sharedPoints = numberOr(profile.points);
  const court = validCourt(rawPrythian.court) || profile.court || validCourt(archiveSource.court) || (migratedPrythian ? 'night' : undefined);
  const role = rawPrythian.role === 'lesser-fae' || rawPrythian.role === 'illyrian' || rawPrythian.role === 'high-fae'
    ? rawPrythian.role
    : profile.role || (court || activeUniverse === 'prythian' ? stableFaeRole(profile.identitySeed) : undefined);

  return {
    activeUniverse,
    empyrean: {
      ...base.empyrean,
      path: String(rawEmpyrean.path || profile.path || 'rider'),
      onboarded: rawEmpyrean.onboarded == null ? Boolean(profile.onboarded && activeUniverse === 'empyrean') : Boolean(rawEmpyrean.onboarded),
      points: numberOr(rawEmpyrean.points, sharedPoints),
      rankIndex: numberOr(rawEmpyrean.rankIndex, profile.rankIndex),
      completedEvents: strings(rawEmpyrean.completedEvents),
      stories: Array.isArray(rawEmpyrean.stories) ? rawEmpyrean.stories as UniverseProfiles['empyrean']['stories'] : [],
    },
    prythian: {
      ...base.prythian,
      court,
      onboarded: rawPrythian.onboarded == null ? Boolean(migratedPrythian || activeUniverse === 'prythian') : Boolean(rawPrythian.onboarded),
      points: numberOr(rawPrythian.points, sharedPoints),
      rankIndex: numberOr(rawPrythian.rankIndex, prythianRankIndex(sharedPoints)),
      completedEvents: strings(rawPrythian.completedEvents),
      stories: Array.isArray(rawPrythian.stories) ? rawPrythian.stories as UniverseProfiles['prythian']['stories'] : [],
      primaryPowerId: rawPrythian.primaryPowerId ? String(rawPrythian.primaryPowerId) : profile.primaryPowerId,
      primaryPowerName: rawPrythian.primaryPowerName ? String(rawPrythian.primaryPowerName) : profile.primaryPowerName,
      primaryPowerDescription: rawPrythian.primaryPowerDescription ? String(rawPrythian.primaryPowerDescription) : profile.primaryPowerDescription,
      rareAffinityId: rawPrythian.rareAffinityId ? String(rawPrythian.rareAffinityId) : profile.rareAffinityId,
      rareAffinityName: rawPrythian.rareAffinityName ? String(rawPrythian.rareAffinityName) : profile.rareAffinityName,
      role,
      distinctions: strings(rawPrythian.distinctions),
    },
  };
}

function normalizeDesign(value: unknown): CardDesign {
  const source = isRecord(value) ? value as Partial<CardDesign> : {};
  const { actions: _actions, ...cleanSource } = source as Partial<CardDesign> & { actions?: unknown };
  return {
    ...structuredClone(defaultDesign),
    ...cleanSource,
    width: numberOr(source.width, 420),
    height: numberOr(source.height, 380),
    elements: Array.isArray(source.elements) ? structuredClone(source.elements) : structuredClone(defaultDesign.elements),
    version: Math.max(4, numberOr(source.version, 1)),
  };
}

function normalizeBook(value: unknown): V2BookRecord {
  const book = isRecord(value) ? value as Partial<V2BookRecord> : {};
  const createdAt = String(book.createdAt || now());
  return {
    ...(book as BookRecord),
    id: String(book.id || crypto.randomUUID()),
    title: String(book.title || 'Untitled Book'),
    author: String(book.author || ''),
    series: String(book.series || ''),
    status: book.status || 'want',
    progress: numberOr(book.progress),
    rating: numberOr(book.rating),
    spice: numberOr(book.spice),
    impact: numberOr(book.impact),
    reaction: String(book.reaction || ''),
    coverUrl: String(book.coverUrl || ''),
    genres: strings(book.genres),
    tags: strings(book.tags),
    about: String(book.about || ''),
    summary: String(book.summary || ''),
    notes: Array.isArray(book.notes) ? book.notes : [],
    readingSessions: Array.isArray(book.readingSessions) ? book.readingSessions : [],
    relationships: Array.isArray(book.relationships) ? book.relationships : [],
    theoryIds: strings(book.theoryIds),
    suspicionIds: strings(book.suspicionIds),
    wallCardIds: strings(book.wallCardIds),
    mindMapNodeIds: strings(book.mindMapNodeIds),
    customRatings: Array.isArray(book.customRatings) ? book.customRatings : [],
    design: normalizeDesign(book.design),
    createdAt,
    updatedAt: String(book.updatedAt || createdAt),
    favorite: Boolean(book.favorite),
    archived: Boolean(book.archived),
  };
}

function pointEvent(kind: PointEventKind, sourceId: string, label: string, amount: number, occurredAt: string): PointEvent {
  return { id: `${kind}:${sourceId}`, kind, sourceId, label, amount, occurredAt };
}

function derivePointLog(books: V2BookRecord[], theories: TheoryRecord[], suspicions: SuspicionRecord[]): PointEvent[] {
  const events: PointEvent[] = [];

  books.forEach((book) => {
    events.push(pointEvent('book-added', book.id, `Added ${book.title}`, 10, book.createdAt));
    const sessions = book.readingSessions ?? [];
    sessions.forEach((session) => {
      events.push(pointEvent('reading-session-started', session.id, `Started a reading session for ${book.title}`, 1, session.startedAt));
      if (session.completedAt) {
        events.push(pointEvent('reading-session-completed', session.id, `Completed a reading session for ${book.title}`, 4, session.completedAt));
      }
    });

    const completionSessions = sessions
      .filter((session) => Boolean(session.completedAt) && Number(session.endProgress) >= 100)
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));

    if (completionSessions.length) {
      const first = completionSessions[0];
      events.push(pointEvent('book-first-completion', book.id, `Completed ${book.title} for the first time`, 100, first.completedAt || book.updatedAt));
      completionSessions.slice(1).forEach((session, index) => {
        events.push(pointEvent('book-reread-completion', `${book.id}:${session.id}`, `Completed reread ${index + 1} of ${book.title}`, 40, session.completedAt || book.updatedAt));
      });
    } else if (book.status === 'completed' || book.progress >= 100) {
      events.push(pointEvent('book-first-completion', book.id, `Completed ${book.title} for the first time`, 100, book.updatedAt));
    }
  });

  theories.forEach((theory) => {
    events.push(pointEvent('theory-created', theory.id, `Created theory: ${theory.title}`, 15, theory.createdAt));
    (theory.evidence ?? []).forEach((evidence) => {
      events.push(pointEvent('evidence-added', `theory:${theory.id}:${evidence.id}`, `Added evidence to ${theory.title}`, 3, evidence.createdAt));
    });
  });

  suspicions.forEach((suspicion) => {
    events.push(pointEvent('suspicion-created', suspicion.id, `Created suspicion: ${suspicion.title}`, 10, suspicion.createdAt));
    (suspicion.evidence ?? []).forEach((evidence) => {
      events.push(pointEvent('evidence-added', `suspicion:${suspicion.id}:${evidence.id}`, `Added evidence to ${suspicion.title}`, 3, evidence.createdAt));
    });
  });

  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function freshArchive(user?: User | null): V2ArchiveState {
  const profile = normalizeProfile({}, user);
  return {
    version: 1,
    profile,
    universes: freshUniverseProfiles(profile.path),
    books: [],
    theories: [],
    suspicions: [],
    dossiers: [],
    walls: [],
    mindMapNodes: [],
    pointLog: [],
    updatedAt: now(),
  };
}

export function normalizeArchive(value: unknown, user?: User | null): V2ArchiveState {
  const source = isRecord(value) ? value : {};
  const profile = normalizeProfile(source.profile, user);
  const baseUniverses = normalizeUniverses(source.universes, profile, source);
  const books = Array.isArray(source.books) ? source.books.map(normalizeBook) : [];
  const theories = Array.isArray(source.theories) ? source.theories as TheoryRecord[] : [];
  const suspicions = Array.isArray(source.suspicions) ? source.suspicions as SuspicionRecord[] : [];
  const pointResetAt = source.pointResetAt ? String(source.pointResetAt) : undefined;
  const suppressedPointEventIds = strings(source.suppressedPointEventIds);
  const suppressed = new Set(suppressedPointEventIds);
  const allPointEvents = derivePointLog(books, theories, suspicions);
  const pointLog = allPointEvents.filter((event) => !suppressed.has(event.id));
  const earnedPoints = pointLog.reduce((sum, event) => sum + event.amount, 0);
  const sharedPoints = earnedPoints;
  const universes: UniverseProfiles = {
    ...baseUniverses,
    empyrean: {
      ...baseUniverses.empyrean,
      points: sharedPoints,
      rankIndex: numberOr(baseUniverses.empyrean.rankIndex),
    },
    prythian: {
      ...baseUniverses.prythian,
      points: sharedPoints,
      rankIndex: prythianRankIndex(sharedPoints),
    },
  };
  const activeRank = universes.activeUniverse === 'prythian' ? universes.prythian.rankIndex : universes.empyrean.rankIndex;
  const synchronizedProfile: V2Profile = {
    ...profile,
    path: universes.empyrean.path,
    points: sharedPoints,
    rankIndex: activeRank,
    onboarded: universes.activeUniverse === 'prythian' ? universes.prythian.onboarded : universes.empyrean.onboarded,
  };

  return {
    version: 1,
    profile: synchronizedProfile,
    universes,
    books,
    theories,
    suspicions,
    dossiers: Array.isArray(source.dossiers) ? source.dossiers as WallDossierRecord[] : [],
    walls: Array.isArray(source.walls) ? source.walls as WallRecord[] : [],
    mindMapNodes: Array.isArray(source.mindMapNodes) ? source.mindMapNodes : [],
    pointLog,
    pointResetAt,
    suppressedPointEventIds,
    updatedAt: String(source.updatedAt || now()),
  };
}

export function loadLocalArchive(user?: User | null): V2ArchiveState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizeArchive(JSON.parse(raw), user) : freshArchive(user);
  } catch {
    return freshArchive(user);
  }
}

export function saveLocalArchive(state: V2ArchiveState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeArchive(state)));
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => window.setTimeout(() => reject(new Error('Cloud archive request timed out.')), ms));
}

export async function loadCloudArchive(user: User): Promise<V2ArchiveState> {
  const local = loadLocalArchive(user);

  try {
    const request = supabase
      .from('archive_states')
      .select('state, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    const { data, error } = await Promise.race([request, timeoutAfter(CLOUD_READ_TIMEOUT_MS)]);
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row?.state) return local;

    const raw = row.state as Record<string, unknown>;
    const candidate = raw.v2Archive && typeof raw.v2Archive === 'object' ? raw.v2Archive : raw;
    const cloud = normalizeArchive(candidate, user);
    saveLocalArchive(cloud);
    return cloud;
  } catch {
    return local;
  }
}

export async function saveCloudArchive(user: User, state: V2ArchiveState): Promise<void> {
  const next = normalizeArchive({ ...state, updatedAt: now() }, user);
  saveLocalArchive(next);

  const { data: rows, error: readError } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw readError;

  const existing = Array.isArray(rows) ? rows[0] : undefined;
  const legacyState = existing?.state && typeof existing.state === 'object'
    ? existing.state as Record<string, unknown>
    : {};
  const payload = { state: { ...legacyState, v2Archive: next }, updated_at: now() };

  if (existing) {
    const { error: updateError } = await supabase
      .from('archive_states')
      .update(payload)
      .eq('user_id', user.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from('archive_states')
    .insert({ user_id: user.id, ...payload });
  if (insertError) throw insertError;
}
