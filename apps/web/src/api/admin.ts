import type { DuelInput } from '@kickabout/shared';
import { apiRequest } from './client';
import type {
  AdminPlayer,
  AuthUser,
  FixtureDetail,
  Role,
  TeamRef,
  TeamSummary,
  TitleEntry,
  Tournament,
  TournamentFormat,
  TournamentOptions,
  UserListItem,
} from './types';

export interface TeamInput {
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface PlayerInput {
  name: string;
  phone: string;
  teamId: string | null;
}

export interface TournamentInput {
  name: string;
  format: TournamentFormat;
  options: Partial<TournamentOptions>;
}

export interface TitleInput {
  teamId: string;
  tournamentName: string;
  position: 1 | 2 | 3;
  year: number;
}

export const login = (email: string, password: string) =>
  apiRequest<{ user: AuthUser }>('POST', '/auth/login', { email, password });
export const logout = () => apiRequest<{ ok: true }>('POST', '/auth/logout');
export const loginWithGoogle = (credential: string) => apiRequest<{ user: AuthUser }>('POST', '/auth/google', { credential });
export const setUserRole = (id: string, role: Role) => apiRequest<UserListItem>('PATCH', `/users/${id}`, { role });

export const createTeam = (input: TeamInput) => apiRequest<TeamSummary>('POST', '/teams', input);
export const updateTeam = (id: string, input: TeamInput) => apiRequest<TeamRef>('PATCH', `/teams/${id}`, input);

export const createPlayer = (input: PlayerInput) => apiRequest<AdminPlayer>('POST', '/players', input);

export interface BulkResult {
  created: { line: number; player: AdminPlayer }[];
  failed: { line: number; name: string | null; message: string }[];
}

export const bulkCreatePlayers = (players: unknown[]) => apiRequest<BulkResult>('POST', '/players/bulk', { players });
export const updatePlayer = (id: string, input: { name: string; phone: string }) =>
  apiRequest<AdminPlayer>('PATCH', `/players/${id}`, input);
export const setPlayerTeam = (playerId: string, teamId: string | null) =>
  apiRequest<{ playerId: string; teamId: string | null }>('PUT', `/players/${playerId}/team`, { teamId });

export const createTournament = (input: TournamentInput) => apiRequest<Tournament>('POST', '/tournaments', input);
export const updateTournament = (id: string, input: Partial<TournamentInput>) =>
  apiRequest<Tournament>('PATCH', `/tournaments/${id}`, input);
export const setEntries = (id: string, teamIds: string[]) =>
  apiRequest<Tournament>('PUT', `/tournaments/${id}/entries`, { teamIds });
export const startTournament = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/start`);
export const deleteTournament = (id: string) => apiRequest<null>('DELETE', `/tournaments/${id}`);
export const finishTournament = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/finish`);

export const saveResult = (id: string, matchId: number, mode: 'draft' | 'final', duels: DuelInput[]) =>
  apiRequest<FixtureDetail>('PUT', `/tournaments/${id}/fixtures/${matchId}/result`, { mode, duels });
export const reopenResult = (id: string, matchId: number) =>
  apiRequest<FixtureDetail>('POST', `/tournaments/${id}/fixtures/${matchId}/reopen`);

export const createTitle = (input: TitleInput) => apiRequest<TitleEntry>('POST', '/titles', input);
export const deleteTitle = (id: string) => apiRequest<{ ok: true }>('DELETE', `/titles/${id}`);

export const drawGroups = (id: string) => apiRequest<{ groups: TeamRef[][] }>('POST', `/tournaments/${id}/group-draw`);
export const drawKnockout = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/knockout-draw`);
export const undoKnockoutDraw = (id: string) => apiRequest<Tournament>('DELETE', `/tournaments/${id}/knockout-draw`);
