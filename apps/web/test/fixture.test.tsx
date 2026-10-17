import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDetail } from '../src/api/types';
import { LEOES, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const duel = (order: number, goalsA: number, goalsB: number, penaltiesA: number | null = null, penaltiesB: number | null = null) => ({
  order,
  playerA: { id: `a${order}`, name: `Ana ${order}` },
  playerB: { id: `b${order}`, name: `Bia ${order}` },
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});

const detail = (overrides: Partial<FixtureDetail> = {}): FixtureDetail => ({
  matchId: 2,
  groupNumber: 1,
  roundNumber: 2,
  number: 1,
  isKnockout: true,
  status: 'completed',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 2,
  scoreB: 3,
  duels: [duel(1, 1, 0), duel(2, 1, 0), duel(3, 0, 1), duel(4, 0, 2), duel(5, 2, 2), duel(6, 1, 1, 3, 4)],
  ...overrides,
});

const base = {
  '/tournaments/c1': {
    id: 'c1',
    name: 'Copa Outubro',
    format: 'single_elimination',
    status: 'in_progress',
    options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
    createdAt: '',
    startedAt: '',
    finishedAt: null,
    entries: [],
  },
  '/tournaments/c1/bracket': {
    data: { stage: [], group: [{ id: 0, stage_id: 0, number: 1 }], round: [{ id: 0, group_id: 0, number: 1 }, { id: 1, group_id: 0, number: 2 }], match: [], match_game: [], participant: [] },
  },
};

describe('fixture page', () => {
  it('shows the scoreboard, the duel strip and every duel with the tiebreak', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail() });
    renderRoute('/campeonatos/c1/jogos/2');
    await screen.findByRole('list', { name: 'Duelos' });
    expect(document.querySelector('.scoreboard-score')).toHaveTextContent(/2\s*×\s*a\s*3/);
    expect(await screen.findByRole('link', { name: 'Copa Outubro' })).toHaveAttribute('href', '/campeonatos/c1?aba=jogos');
    expect(await screen.findByText(', Final')).toBeInTheDocument();

    const strip = screen.getByRole('list', { name: 'Resultado de cada duelo' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(6);

    const duels = screen.getByRole('list', { name: 'Duelos' });
    const items = within(duels).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1ºAna 11 × 0Bia 1');
    expect(items[5]).toHaveTextContent('DesempateAna 61 × 1(3 × 4 nos pênaltis)Bia 6');
    expect(within(items[5]!).getByRole('link', { name: 'Bia 6' })).toHaveClass('duel-winner');
    expect(within(items[0]!).getByRole('link', { name: 'Ana 1' })).toHaveAttribute('href', '/jogadores/a1');
  });

  it('marks partial results', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail({ status: 'draft', scoreA: null, scoreB: null, duels: [duel(1, 1, 0)] }) });
    renderRoute('/campeonatos/c1/jogos/2');
    expect(await screen.findByText('Resultado parcial: ainda faltam duelos.')).toBeInTheDocument();
  });

  it('waits for the result of pending fixtures', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail({ status: 'pending', scoreA: null, scoreB: null, duels: [] }) });
    renderRoute('/campeonatos/c1/jogos/2');
    expect(await screen.findByText('Aguardando resultado.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Duelos' })).toBeNull();
  });
});
