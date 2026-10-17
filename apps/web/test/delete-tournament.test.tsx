import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureListItem, Tournament } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES, tournamentListItem } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
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

const fixture = (matchId: number, status: FixtureListItem['status']): FixtureListItem => ({
  matchId,
  groupNumber: 1,
  roundNumber: 1,
  number: matchId + 1,
  phase: 'knockout',
  isKnockout: true,
  status,
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: status === 'pending' ? null : 3,
  scoreB: status === 'pending' ? null : 2,
});

const bracket = {
  data: { stage: [], group: [{ id: 0, stage_id: 0, number: 1 }], round: [{ id: 0, group_id: 0, number: 1 }], match: [], match_game: [], participant: [] },
};

const deleted = () => new Response(null, { status: 204 });

describe('delete tournament', () => {
  it('deletes a draft after confirming and goes back to the list', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament(),
      '/teams': [],
      '/tournaments': [tournamentListItem({ id: 'c2', name: 'Copa Novembro' })],
      'DELETE /tournaments/c1': deleted,
    });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('group', { name: 'Excluir campeonato' });
    expect(within(section).getByText(/apaga o campeonato e as inscrições/)).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Excluir campeonato' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Cancelar' }));
    expect(sentBodies(fetchMock, 'DELETE /tournaments/c1')).toEqual([]);

    fireEvent.click(within(section).getByRole('button', { name: 'Excluir campeonato' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Excluir de vez' }));
    expect(await screen.findByText('Campeonato excluído.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campeonatos', level: 1 })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'DELETE /tournaments/c1')).toEqual([undefined]);
  });

  it('asks for the name when there are results', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament({ status: 'in_progress' }),
      '/tournaments/c1/fixtures': [fixture(0, 'completed'), fixture(1, 'pending'), fixture(2, 'draft')],
      '/tournaments/c1/bracket': bracket,
      '/tournaments': [],
      'DELETE /tournaments/c1': deleted,
    });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('group', { name: 'Excluir campeonato' });
    expect(await within(section).findByText(/apaga o campeonato, 3 confrontos e as estatísticas desses jogos/)).toBeInTheDocument();

    const button = within(section).getByRole('button', { name: 'Excluir campeonato' });
    expect(button).toBeDisabled();
    const name = within(section).getByLabelText('Digite o nome do campeonato para confirmar');
    fireEvent.change(name, { target: { value: 'Copa' } });
    expect(button).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Copa Outubro' } });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    fireEvent.click(within(section).getByRole('button', { name: 'Excluir de vez' }));
    expect(await screen.findByText('Campeonato excluído.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'DELETE /tournaments/c1')).toEqual([undefined]);
  });

  it('does not ask for the name when no fixture has a result', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament({ status: 'in_progress' }),
      '/tournaments/c1/fixtures': [fixture(0, 'pending')],
      '/tournaments/c1/bracket': bracket,
    });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('group', { name: 'Excluir campeonato' });
    expect(await within(section).findByText(/apaga o campeonato, 1 confronto e as estatísticas/)).toBeInTheDocument();
    expect(within(section).queryByLabelText('Digite o nome do campeonato para confirmar')).toBeNull();
    expect(within(section).getByRole('button', { name: 'Excluir campeonato' })).toBeEnabled();
  });
});
