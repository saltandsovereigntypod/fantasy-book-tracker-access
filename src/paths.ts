export const PATH_IDS = ['rider', 'scribe', 'gryphon', 'dark', 'infantry', 'healer'] as const;
export type PathId = typeof PATH_IDS[number];

export interface PathTheme {
  background: string;
  panel: string;
  panelAlt: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentContrast: string;
  accentSoft: string;
  border: string;
  paper: string;
}

export interface PathCopy {
  navDashboard: string;
  navLibrary: string;
  navSession: string;
  navTheories: string;
  navWall: string;
  navProfile: string;
  currentRank: string;
  heroTitle: string;
  heroBody: string;
  addBook: string;
  addTheory: string;
  startSession: string;
  completeBook: string;
  saveTheory: string;
  noBooks: string;
  noTheories: string;
  success: string;
}

export interface PathDefinition {
  id: PathId;
  name: string;
  short: string;
  glyph: string;
  creatureKind?: 'dragon' | 'gryphon' | 'wyvern';
  ranks: readonly string[];
  thresholds: readonly number[];
  progressName: string;
  event: string | null;
  bondedRank: number | null;
  copy: PathCopy;
  theme: PathTheme;
}

const copy = {
  rider: { navDashboard: 'Command Hall', navLibrary: 'Campaigns', navSession: 'Reading Deployment', navTheories: 'Intelligence Ledger', navWall: 'Conspiracy Wall', navProfile: 'Service Record', currentRank: 'Current Rank', heroTitle: 'Every chapter is a battlefield. Read like your squad depends on it.', heroBody: 'Track the campaign, secure intelligence, and record every suspicion before it gets someone killed.', addBook: 'Assign New Campaign', addTheory: 'Record a Suspicion', startSession: 'Begin Deployment', completeBook: 'You survived the campaign.', saveTheory: 'Secure this intelligence', noBooks: 'No active campaigns are currently assigned.', noTheories: 'No suspicions have been entered. Dangerous.', success: 'Intelligence secured.' },
  scribe: { navDashboard: 'Central Archive', navLibrary: 'Catalogued Volumes', navSession: 'Text Examination', navTheories: 'Hypothesis Register', navWall: 'Evidence Map', navProfile: 'Archival Record', currentRank: 'Current Appointment', heroTitle: 'Preserve the record. Separate testimony from truth.', heroBody: 'Catalog each volume, document every contradiction, and allow no unsupported claim to pass into history.', addBook: 'Catalogue New Volume', addTheory: 'Enter Working Hypothesis', startSession: 'Resume Examination', completeBook: 'This volume has been fully documented.', saveTheory: 'Enter into the archive', noBooks: 'No volumes have been entered into the catalogue.', noTheories: 'No supporting record currently exists.', success: 'Historical record amended.' },
  gryphon: { navDashboard: 'Rebel Command', navLibrary: 'Liberated Stories', navSession: 'Field Reading', navTheories: 'Counter-Narratives', navWall: 'The Real Story', navProfile: 'Rebel Record', currentRank: 'Current Standing', heroTitle: 'Question the official story. Someone is always lying.', heroBody: 'Read between sanctioned lines, dismantle convenient narratives, and preserve the evidence they hoped you would miss.', addBook: 'Seize Another Story', addTheory: 'Challenge the Record', startSession: 'Return to the Field', completeBook: 'Another sanctioned narrative dismantled.', saveTheory: 'Add it to the real story', noBooks: 'No stories have been liberated yet.', noTheories: 'No one has challenged the official version. Suspicious.', success: 'The real story has been updated.' },
  dark: { navDashboard: 'The Hollow', navLibrary: 'Worlds Consumed', navSession: 'Feeding', navTheories: 'Whispered Truths', navWall: 'The Web', navProfile: 'Corruption Record', currentRank: 'Current Ascension', heroTitle: 'Feed the suspicion. Let the story show you where it bleeds.', heroBody: 'Consume worlds, bind contradictions, and follow every delicious fracture in the truth.', addBook: 'Choose Another World', addTheory: 'Feed the Suspicion', startSession: 'Begin Feeding', completeBook: 'Delicious. Another world consumed.', saveTheory: 'Bind it to the web', noBooks: 'No worlds have been offered to the hunger.', noTheories: 'The silence has not begun whispering yet.', success: 'The web tightens.' },
  infantry: { navDashboard: 'Field Command', navLibrary: 'Campaign Log', navSession: 'Active Deployment', navTheories: 'Field Intelligence', navWall: 'Tactical Board', navProfile: 'Service Record', currentRank: 'Current Rank', heroTitle: 'Hold the line. Slow progress is still ground taken.', heroBody: 'Advance one page at a time, log field intelligence, and return to formation whenever life interrupts the campaign.', addBook: 'Assign Objective', addTheory: 'Log Field Intelligence', startSession: 'Begin Deployment', completeBook: 'Objective secured.', saveTheory: 'Submit field intelligence', noBooks: 'No objectives are currently assigned.', noTheories: 'No field intelligence has been logged.', success: 'Transmission secured.' },
  healer: { navDashboard: 'Healer Station', navLibrary: 'Case Records', navSession: 'Active Assessment', navTheories: 'Diagnostic Notes', navWall: 'Diagnostic Board', navProfile: 'Clinical Record', currentRank: 'Current Appointment', heroTitle: 'Observe carefully. What others dismiss may reveal the entire wound.', heroBody: 'Track every symptom, contradiction, recovery, and emotional consequence without mistaking urgency for understanding.', addBook: 'Open New Case', addTheory: 'Record Possible Cause', startSession: 'Resume Assessment', completeBook: 'Assessment complete. Emotional condition pending.', saveTheory: 'Add to the assessment', noBooks: 'No active cases are currently open.', noTheories: 'No possible causes have been recorded.', success: 'Assessment updated.' }
} satisfies Record<PathId, PathCopy>;

const SIX_RANK_THRESHOLDS = [0, 5000, 20000, 50000, 100000, 200000] as const;

export const PATHS: Record<PathId, PathDefinition> = {
  rider: { id:'rider', name:'Dragon Rider', short:'Riders Quadrant', glyph:'🐉', creatureKind:'dragon', ranks:['Candidate','Rider Cadet','Channeled Rider','Squad Leader','Section Leader','Wingleader'], thresholds:SIX_RANK_THRESHOLDS, progressName:'Command', event:'Threshing', bondedRank:1, copy:copy.rider, theme:{ background:'#09090a', panel:'#111113', panelAlt:'#17171a', surface:'#1d1c20', text:'#e8e4dc', muted:'#98938c', accent:'#6f2833', accentContrast:'#f5f2ea', accentSoft:'rgba(111,40,51,.16)', border:'#2b292e', paper:'#cfc2aa' } },
  scribe: { id:'scribe', name:'Scribe', short:'Scribe Quadrant', glyph:'🪶', ranks:['Scribe Candidate','Scribe Cadet','Archivist','Senior Archivist','Royal Archivist','Curator'], thresholds:SIX_RANK_THRESHOLDS, progressName:'Scholarly Standing', event:null, bondedRank:null, copy:copy.scribe, theme:{ background:'#17140f', panel:'#211d16', panelAlt:'#2a241b', surface:'#342d22', text:'#f4ead2', muted:'#c1b392', accent:'#9b7434', accentContrast:'#17140f', accentSoft:'rgba(155,116,52,.18)', border:'#4b402f', paper:'#eadbb9' } },
  gryphon: { id:'gryphon', name:'Gryphon Flier', short:'Poromiel Drift', glyph:'🦅', creatureKind:'gryphon', ranks:['Flier Candidate','Flier Cadet','Channeled Flier','Driftleader','Wing Captain','Flight Commander'], thresholds:SIX_RANK_THRESHOLDS, progressName:'Defiance', event:'The Harvest', bondedRank:1, copy:copy.gryphon, theme:{ background:'#17100b', panel:'#21170f', panelAlt:'#2b1d13', surface:'#39271a', text:'#f0dfc2', muted:'#bca786', accent:'#a75b2b', accentContrast:'#ffffff', accentSoft:'rgba(167,91,43,.18)', border:'#4a3524', paper:'#d8c4a4' } },
  dark: { id:'dark', name:'Dark Wielder', short:'The Source Below', glyph:'🐲', creatureKind:'wyvern', ranks:['Initiate','Asim','Sage','Maven'], thresholds:[0,20000,75000,200000], progressName:'Power', event:'First Channeling', bondedRank:0, copy:copy.dark, theme:{ background:'#0b0710', panel:'#120b17', panelAlt:'#1a1020', surface:'#24162c', text:'#e9e0eb', muted:'#a592aa', accent:'#734184', accentContrast:'#f4edf5', accentSoft:'rgba(115,65,132,.18)', border:'#37213f', paper:'#c9bdc9' } },
  infantry: { id:'infantry', name:'Infantry', short:'Infantry Quadrant', glyph:'🛡️', ranks:['Infantry Recruit','Infantry Cadet','Squad Corporal','Squad Sergeant','Company Captain','Battalion Commander'], thresholds:SIX_RANK_THRESHOLDS, progressName:'Merit', event:null, bondedRank:null, copy:copy.infantry, theme:{ background:'#0a1019', panel:'#101a27', panelAlt:'#152234', surface:'#1c2b40', text:'#e6edf7', muted:'#9cabbd', accent:'#365f94', accentContrast:'#ffffff', accentSoft:'rgba(54,95,148,.20)', border:'#283a51', paper:'#d8c4a4' } },
  healer: { id:'healer', name:'Healer', short:'Healer Quadrant', glyph:'⚕️', ranks:['Healer Candidate','Healer Cadet','Field Healer','Senior Healer','Master Healer','Chief Healer'], thresholds:SIX_RANK_THRESHOLDS, progressName:'Mastery', event:null, bondedRank:null, copy:copy.healer, theme:{ background:'#0d171b', panel:'#142126', panelAlt:'#1a2b31', surface:'#21373f', text:'#eaf4f5', muted:'#a8c0c6', accent:'#5faac3', accentContrast:'#071216', accentSoft:'rgba(95,170,195,.18)', border:'#2b4751', paper:'#d8c4a4' } }
};

export function isPathId(value: unknown): value is PathId { return typeof value === 'string' && PATH_IDS.includes(value as PathId); }
export function pathFor(value: unknown): PathDefinition { return PATHS[isPathId(value) ? value : 'rider']; }
export function rankIndexForPoints(path: PathId, points: number): number { const thresholds = PATHS[path].thresholds; let index = 0; thresholds.forEach((threshold, candidate) => { if (points >= threshold) index = candidate; }); return index; }
export function unlockedRankIndexes(points: number): Record<PathId, number> { return Object.fromEntries(PATH_IDS.map((path) => [path, rankIndexForPoints(path, points)])) as Record<PathId, number>; }