import type { FixtureSummary, TeamRef, TournamentListItem } from '../src/api/types';

export const team = (id: string, name: string, crestUrl: string | null = null): TeamRef => ({
  id,
  name,
  shortName: name.slice(0, 3).toUpperCase(),
  crestUrl,
});

export const LEOES = team('t1', 'Leões');
export const TIGRES = team('t2', 'Tigres');
export const FALCOES = team('t3', 'Falcões');

export const fixtureSummary = (overrides: Partial<FixtureSummary> = {}): FixtureSummary => ({
  tournamentId: 'c1',
  tournamentName: 'Copa Outubro',
  matchId: 0,
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 3,
  scoreB: 2,
  playedAt: '2026-10-10T22:00:00.000Z',
  ...overrides,
});

export const tournamentListItem = (overrides: Partial<TournamentListItem> = {}): TournamentListItem => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'in_progress',
  teamCount: 8,
  startedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: null,
  ...overrides,
});

export const ADMIN = { id: 'u1', email: 'admin@kickabout.local', name: null, avatarUrl: null, role: 'admin' as const };
export const REGULAR = { id: 'u2', email: 'ana@gmail.com', name: 'Ana Souza', avatarUrl: null, role: 'user' as const };

/** Rotas de API de um organizador logado. */
export const SIGNED_IN = { '/auth/me': { user: ADMIN } };
