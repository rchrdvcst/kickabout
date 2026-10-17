import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerPageData, Tournament } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES, fixtureSummary } from './data';
import { mockApi, renderRoute } from './utils';

const draft = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'draft',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '2026-10-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  entries: [LEOES, TIGRES].map((t, i) => ({ seed: i + 1, team: t })),
  ...overrides,
});

describe('polish', () => {
  it('moves keyboard focus to the confirmation step', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments/c1': draft(), '/teams': [LEOES, TIGRES].map((t) => ({ ...t, playerCount: 6 })) });
    renderRoute('/admin/campeonatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar campeonato' }));
    expect(screen.getByRole('button', { name: 'Confirmar início: a chave não pode ser refeita' })).toHaveFocus();
  });

  it('clears the saved notice once the form changes again', async () => {
    mockApi({ ...SIGNED_IN, '/teams/t1/roster': { team: LEOES, players: [] }, 'PATCH /teams/t1': LEOES });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Dados do time' });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Leões FC' } });
    expect(screen.queryByText('Alterações salvas.')).toBeNull();
  });

  it('keeps one entry per historical title on the player page', async () => {
    const player: PlayerPageData = {
      player: { id: 'p1', name: 'Ana' },
      currentTeam: LEOES,
      teamHistory: [{ team: LEOES, joinedAt: '2026-01-01T00:00:00.000Z', leftAt: null }],
      stats: { playerId: 'p1', duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 },
      duels: [],
      titles: [
        { position: 1, year: 2019, tournamentId: null, tournamentName: 'Liga 2019', team: LEOES },
        { position: 1, year: 2018, tournamentId: null, tournamentName: 'Liga 2018', team: LEOES },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ '/players/p1': player });
    renderRoute('/jogadores/p1');
    expect(await screen.findByText('Liga 2018')).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    consoleError.mockRestore();
  });

  it('talks about the table for a round robin in preparation', async () => {
    mockApi({ '/tournaments/c1': draft({ format: 'round_robin' }) });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByText('A tabela aparece quando o campeonato começar.')).toBeInTheDocument();
  });

  it('links the home page to the titles', async () => {
    mockApi({ '/fixtures/recent?limit=8': [fixtureSummary()], '/tournaments?status=in_progress': [] });
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Ver campeões e ranking de títulos' })).toHaveAttribute('href', '/titulos');
  });
});
