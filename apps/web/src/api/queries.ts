import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  AdminPlayer,
  AuthUser,
  BracketData,
  FixtureDetail,
  FixtureListItem,
  FixtureSummary,
  LeaderboardRow,
  PlayerPageData,
  RosterPlayer,
  StandingRow,
  TeamPageData,
  TeamRef,
  TeamSummary,
  TitlesData,
  Tournament,
  TournamentListItem,
  TournamentStatus,
} from './types';

export const useRecentFixtures = (limit: number) =>
  useQuery({ queryKey: ['fixtures', 'recent', limit], queryFn: () => apiGet<FixtureSummary[]>(`/fixtures/recent?limit=${limit}`) });

export const useTournaments = (status?: TournamentStatus) =>
  useQuery({
    queryKey: ['tournaments', status ?? 'all'],
    queryFn: () => apiGet<TournamentListItem[]>(status ? `/tournaments?status=${status}` : '/tournaments'),
  });

export const useTournament = (id: string) =>
  useQuery({ queryKey: ['tournament', id], queryFn: () => apiGet<Tournament>(`/tournaments/${id}`) });

export const useBracket = (id: string, enabled = true) =>
  useQuery({ queryKey: ['tournament', id, 'bracket'], queryFn: () => apiGet<{ data: BracketData | null }>(`/tournaments/${id}/bracket`), enabled });

const fixturesQuery = (id: string) => ({
  queryKey: ['tournament', id, 'fixtures'],
  queryFn: () => apiGet<FixtureListItem[]>(`/tournaments/${id}/fixtures`),
});

export const useTournamentFixtures = (id: string) => useQuery(fixturesQuery(id));

/** Confrontos de vários campeonatos, na mesma ordem dos ids (mesmo cache de `useTournamentFixtures`). */
export const useFixturesOf = (ids: string[]) => useQueries({ queries: ids.map(fixturesQuery) });

export const useStandings = (id: string) =>
  useQuery({ queryKey: ['tournament', id, 'standings'], queryFn: () => apiGet<StandingRow[]>(`/tournaments/${id}/standings`) });

export const useTournamentStats = (id: string) =>
  useQuery({ queryKey: ['tournament', id, 'stats'], queryFn: () => apiGet<LeaderboardRow[]>(`/tournaments/${id}/stats`) });

export const useFixture = (id: string, matchId: number, enabled = true) =>
  useQuery({
    queryKey: ['tournament', id, 'fixture', matchId],
    queryFn: () => apiGet<FixtureDetail>(`/tournaments/${id}/fixtures/${matchId}`),
    enabled,
  });

export const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: () => apiGet<TeamSummary[]>('/teams') });

export const useTeam = (id: string) => useQuery({ queryKey: ['team', id], queryFn: () => apiGet<TeamPageData>(`/teams/${id}`) });

export const useRoster = (id: string) =>
  useQuery({ queryKey: ['team', id, 'roster'], queryFn: () => apiGet<{ team: TeamRef; players: RosterPlayer[] }>(`/teams/${id}/roster`) });

export const usePlayer = (id: string) => useQuery({ queryKey: ['player', id], queryFn: () => apiGet<PlayerPageData>(`/players/${id}`) });

export const useTitles = () => useQuery({ queryKey: ['titles'], queryFn: () => apiGet<TitlesData>('/titles') });

export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => apiGet<{ user: AuthUser | null }>('/auth/me'), staleTime: 60_000 });

export const useAdminPlayers = (search: string, enabled = true) =>
  useQuery({
    queryKey: ['players', 'admin', search],
    queryFn: () => apiGet<AdminPlayer[]>(search ? `/players?search=${encodeURIComponent(search)}` : '/players'),
    placeholderData: keepPreviousData,
    enabled,
  });
