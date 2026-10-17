export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'draft' | 'in_progress' | 'finished';
export type FixtureStatus = 'pending' | 'draft' | 'completed';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface TeamSummary extends TeamRef {
  playerCount: number;
}

export interface PlayerRef {
  id: string;
  name: string;
}

export interface RosterPlayer extends PlayerRef {
  phone?: string;
  whatsappUrl?: string;
}

export interface TournamentListItem {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  teamCount: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  options: { consolationFinal: boolean; grandFinalReset: boolean; roundRobinMode: 'simple' | 'double' };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  entries: { seed: number; team: TeamRef }[];
}

export interface FixtureListItem {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  isKnockout: boolean;
  status: FixtureStatus;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

export interface DuelView {
  order: number;
  playerA: PlayerRef;
  playerB: PlayerRef;
  goalsA: number;
  goalsB: number;
  penaltiesA: number | null;
  penaltiesB: number | null;
}

export interface FixtureDetail extends FixtureListItem {
  duels: DuelView[];
  rosterA?: PlayerRef[];
  rosterB?: PlayerRef[];
}

export interface StandingRow {
  position: number;
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  duelsWon: number;
  duelsLost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  team: TeamRef;
}

export interface PlayerStats {
  playerId: string;
  duels: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number;
}

export interface LeaderboardRow extends PlayerStats {
  player: PlayerRef;
  team: TeamRef | null;
}

export interface FixtureSummary {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number;
  scoreB: number;
  playedAt: string | null;
}

export interface RecordTally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TeamPageData {
  team: TeamRef;
  roster: RosterPlayer[];
  stats: { teamId: string; fixtures: RecordTally; duels: RecordTally; goalsFor: number; goalsAgainst: number; goalDiff: number };
  titles: { id: string; position: number; year: number; tournamentId: string | null; tournamentName: string }[];
  recentFixtures: FixtureSummary[];
  tournaments: { id: string; name: string; format: TournamentFormat; status: TournamentStatus }[];
}

export interface PlayerDuel {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  order: number;
  team: TeamRef;
  opponentTeam: TeamRef;
  opponent: PlayerRef;
  goalsFor: number;
  goalsAgainst: number;
  penaltiesFor: number | null;
  penaltiesAgainst: number | null;
  result: 'win' | 'draw' | 'loss';
  playedAt: string | null;
}

export interface PlayerPageData {
  player: PlayerRef;
  currentTeam: TeamRef | null;
  teamHistory: { team: TeamRef; joinedAt: string; leftAt: string | null }[];
  stats: PlayerStats;
  duels: PlayerDuel[];
  titles: { position: number; year: number; tournamentId: string | null; tournamentName: string; team: TeamRef }[];
}

export interface TitleEntry {
  id: string;
  position: number;
  year: number;
  tournamentId: string | null;
  tournamentName: string;
  team: TeamRef;
}

export interface TitlesData {
  ranking: { team: TeamRef; champion: number; runnerUp: number; third: number }[];
  titles: TitleEntry[];
}

/** Estado do brackets-manager (só os campos usados pelo site; o resto vai direto para o brackets-viewer). */
export interface BracketData {
  stage: unknown[];
  group: { id: number; stage_id: number; number: number }[];
  round: { id: number; group_id: number; number: number }[];
  match: unknown[];
  match_game: unknown[];
  participant: { id: number; name: string }[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/** Jogador como o admin vê (sempre com celular). */
export interface AdminPlayer {
  id: string;
  name: string;
  phone: string;
  whatsappUrl: string;
  team: TeamRef | null;
}

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
}
