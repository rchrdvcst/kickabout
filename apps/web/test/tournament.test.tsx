import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BracketData, FixtureListItem, Tournament } from '../src/api/types';
import { FALCOES, LEOES, TIGRES, team } from './data';
import { mockApi, renderRoute } from './utils';

vi.mock('brackets-viewer/dist/brackets-viewer.min.js', () => ({}));
vi.mock('brackets-viewer/dist/brackets-viewer.min.css', () => ({}));

const ONCAS = team('t4', 'Onças');

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'in_progress',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '2026-10-01T00:00:00.000Z',
  startedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: null,
  entries: [LEOES, TIGRES, FALCOES, ONCAS].map((t, i) => ({ seed: i + 1, team: t })),
  ...overrides,
});

const bracket: BracketData = {
  stage: [{ id: 0, number: 1, type: 'single_elimination' }],
  group: [{ id: 0, stage_id: 0, number: 1 }],
  round: [
    { id: 0, stage_id: 0, group_id: 0, number: 1 },
    { id: 1, stage_id: 0, group_id: 0, number: 2 },
  ],
  match: [],
  match_game: [],
  participant: [],
};

const fixture = (overrides: Partial<FixtureListItem>): FixtureListItem => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  phase: 'knockout',
  isKnockout: true,
  status: 'completed',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 3,
  scoreB: 1,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal('bracketsViewer', { render: vi.fn().mockResolvedValue(undefined), addLocale: vi.fn().mockResolvedValue(undefined) });
});

describe('tournament page', () => {
  it('draws the bracket for elimination formats', async () => {
    mockApi({ '/tournaments/c1': tournament(), '/tournaments/c1/bracket': { data: bracket } });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByRole('heading', { name: 'Copa Outubro' })).toBeInTheDocument();
    expect(screen.getByText('Eliminatória simples, 4 times, em andamento.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chave' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(window.bracketsViewer.render).toHaveBeenCalledTimes(1));
    const [data, config] = vi.mocked(window.bracketsViewer.render).mock.calls[0]!;
    expect(data).toMatchObject({ stages: bracket.stage, matches: [], participants: [] });
    expect(config).toMatchObject({ clear: true, selector: expect.stringMatching(/^#bracket-/) });
  });

  it('labels the bracket groups in Portuguese before drawing', async () => {
    mockApi({ '/tournaments/c1': tournament({ format: 'double_elimination' }), '/tournaments/c1/bracket': { data: bracket } });
    renderRoute('/campeonatos/c1');
    await waitFor(() => expect(window.bracketsViewer.render).toHaveBeenCalledTimes(1));
    const labels = expect.objectContaining({
      common: expect.objectContaining({ 'group-name-winner-bracket': 'Chave superior', 'group-name-loser-bracket': 'Chave inferior' }),
    });
    expect(window.bracketsViewer.addLocale).toHaveBeenCalledWith('en', labels);
    expect(vi.mocked(window.bracketsViewer.addLocale).mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(window.bracketsViewer.render).mock.invocationCallOrder[0]!,
    );
  });

  it('shows the standings table for round robin', async () => {
    mockApi({
      '/tournaments/c1': tournament({ format: 'round_robin' }),
      '/tournaments/c1/standings': [
        { position: 1, teamId: 't1', team: LEOES, played: 2, wins: 2, draws: 0, losses: 0, points: 6, duelsWon: 7, duelsLost: 3, goalsFor: 12, goalsAgainst: 5, goalDiff: 7 },
        { position: 2, teamId: 't2', team: TIGRES, played: 2, wins: 0, draws: 1, losses: 1, points: 1, duelsWon: 4, duelsLost: 6, goalsFor: 6, goalsAgainst: 9, goalDiff: -3 },
      ],
    });
    renderRoute('/campeonatos/c1');
    const table = await screen.findByRole('table', { name: 'Classificação' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Leões6220+7');
    expect(screen.getByRole('link', { name: 'Tabela' })).toHaveAttribute('aria-current', 'page');
  });

  it('groups fixtures by round with Portuguese round names', async () => {
    mockApi({
      '/tournaments/c1': tournament(),
      '/tournaments/c1/bracket': { data: bracket },
      '/tournaments/c1/fixtures': [
        fixture({ matchId: 0 }),
        fixture({ matchId: 1, teamA: FALCOES, teamB: ONCAS, status: 'draft', scoreA: null, scoreB: null }),
        fixture({ matchId: 2, roundNumber: 2, teamB: FALCOES, status: 'pending', scoreA: null, scoreB: null }),
      ],
    });
    renderRoute('/campeonatos/c1?aba=jogos');
    expect(await screen.findByRole('heading', { name: 'Semifinal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Falcões.*Parcial.*Onças/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/1');
  });

  it('lists the teams linking to each BID', async () => {
    mockApi({ '/tournaments/c1': tournament() });
    renderRoute('/campeonatos/c1?aba=times');
    expect(await screen.findByRole('link', { name: /Leões/ })).toHaveAttribute('href', '/times/t1/bid');
    expect(screen.getAllByRole('link', { name: /Ver BID/ })).toHaveLength(4);
  });

  it('shows the player leaderboard', async () => {
    mockApi({
      '/tournaments/c1': tournament(),
      '/tournaments/c1/stats': [
        { playerId: 'p1', player: { id: 'p1', name: 'Ana' }, team: LEOES, duels: 3, wins: 2, draws: 1, losses: 0, goalsFor: 7, goalsAgainst: 2, goalDiff: 5, winRate: 2 / 3 },
      ],
    });
    renderRoute('/campeonatos/c1?aba=estatisticas');
    const table = await screen.findByRole('table', { name: 'Artilharia' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('1AnaLeões73267%');
    expect(within(table).getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/jogadores/p1');
  });

  it('ranks players by goals, duel wins and win rate (minimum 3 duels)', async () => {
    const row = (id: string, name: string, duels: number, wins: number, goalsFor: number) => ({
      playerId: id,
      player: { id, name },
      team: LEOES,
      duels,
      wins,
      draws: 0,
      losses: duels - wins,
      goalsFor,
      goalsAgainst: 0,
      goalDiff: goalsFor,
      winRate: wins / duels,
    });
    mockApi({
      '/tournaments/c1': tournament(),
      '/tournaments/c1/stats': [row('p1', 'Ana', 3, 2, 7), row('p2', 'Bia', 5, 4, 3), row('p3', 'Caio', 1, 1, 1)],
    });
    renderRoute('/campeonatos/c1?aba=estatisticas');
    const first = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row')[1];
    expect(await screen.findByRole('table', { name: 'Artilharia' })).toBeInTheDocument();
    expect(first('Artilharia')).toHaveTextContent('Ana');
    expect(first('Mais vitórias em duelos')).toHaveTextContent('Bia');
    const rate = screen.getByRole('table', { name: 'Melhor aproveitamento' });
    expect(within(rate).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      expect.stringContaining('Bia'),
      expect.stringContaining('Ana'),
    ]);
    expect(screen.getByText('Melhor aproveitamento considera jogadores com pelo menos 3 duelos.')).toBeInTheDocument();
  });

  it('explains that the bracket appears once a draft starts, but lists its teams', async () => {
    mockApi({ '/tournaments/c1': tournament({ status: 'draft', startedAt: null }) });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByText('A chave aparece quando o campeonato começar.')).toBeInTheDocument();
    renderRoute('/campeonatos/c1?aba=times');
    expect(await screen.findAllByRole('link', { name: /Ver BID/ })).toHaveLength(4);
  });
});
