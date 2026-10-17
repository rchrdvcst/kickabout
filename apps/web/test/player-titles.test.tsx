import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlayerPageData, TitlesData } from '../src/api/types';
import { FALCOES, LEOES, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const player: PlayerPageData = {
  player: { id: 'p1', name: 'Ana' },
  currentTeam: LEOES,
  teamHistory: [
    { team: LEOES, joinedAt: '2026-09-01T00:00:00.000Z', leftAt: null },
    { team: FALCOES, joinedAt: '2026-01-01T00:00:00.000Z', leftAt: '2026-08-31T00:00:00.000Z' },
  ],
  stats: { playerId: 'p1', duels: 4, wins: 2, draws: 1, losses: 1, goalsFor: 9, goalsAgainst: 4, goalDiff: 5, winRate: 0.5 },
  duels: [
    {
      tournamentId: 'c1',
      tournamentName: 'Copa Outubro',
      matchId: 3,
      order: 6,
      team: LEOES,
      opponentTeam: TIGRES,
      opponent: { id: 'p9', name: 'Bia' },
      goalsFor: 1,
      goalsAgainst: 1,
      penaltiesFor: 5,
      penaltiesAgainst: 4,
      result: 'win',
      playedAt: '2026-10-10T22:00:00.000Z',
    },
  ],
  titles: [{ position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: LEOES }],
};

const titles: TitlesData = {
  ranking: [
    { team: LEOES, champion: 2, runnerUp: 0, third: 1 },
    { team: TIGRES, champion: 0, runnerUp: 2, third: 0 },
  ],
  titles: [
    { id: 'a', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: LEOES },
    { id: 'b', position: 2, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: TIGRES },
    { id: 'c', position: 1, year: 2025, tournamentId: null, tournamentName: 'Liga 2025', team: LEOES },
  ],
};

describe('player page', () => {
  it('shows the current team, numbers, duel history and titles', async () => {
    mockApi({ '/players/p1': player });
    renderRoute('/jogadores/p1');
    expect(await screen.findByRole('heading', { name: 'Ana', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Leões' })[0]).toHaveAttribute('href', '/times/t1');
    expect(screen.getByText('50%')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'Histórico de duelos' });
    const [entry] = within(history).getAllByRole('listitem');
    expect(entry).toHaveTextContent('V');
    expect(entry).toHaveTextContent('1 × 1 (5 × 4 nos pênaltis)');
    expect(entry).toHaveTextContent('Bia (Tigres)');
    expect(within(entry!).getByRole('link', { name: /Copa Outubro, desempate/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/3');
    expect(screen.getByText('Campeão')).toBeInTheDocument();
    expect(screen.getByText('Falcões')).toBeInTheDocument();
  });

  it('explains when the player has not played yet', async () => {
    mockApi({ '/players/p1': { ...player, duels: [], titles: [], stats: { ...player.stats, duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 } } });
    renderRoute('/jogadores/p1');
    expect(await screen.findByText('Nenhum duelo jogado ainda.')).toBeInTheDocument();
  });
});

describe('titles page', () => {
  it('ranks teams and lists podiums by tournament', async () => {
    mockApi({ '/titles': titles });
    renderRoute('/titulos');
    const table = await screen.findByRole('table', { name: 'Ranking de títulos' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Leões201');
    expect(screen.getByRole('heading', { name: 'Copa Outubro (2026)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Liga 2025 (2025)' })).toBeInTheDocument();
  });

  it('explains when there are no titles yet', async () => {
    mockApi({ '/titles': { ranking: [], titles: [] } });
    renderRoute('/titulos');
    expect(await screen.findByText('Os títulos aparecem quando o primeiro campeonato for encerrado.')).toBeInTheDocument();
  });
});
