import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureListItem, Tournament } from '../src/api/types';
import { FALCOES, LEOES, SIGNED_IN, TIGRES, tournamentListItem } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

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

const teams = [LEOES, TIGRES, FALCOES].map((t) => ({ ...t, playerCount: 6 }));

const pending: FixtureListItem = {
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  phase: 'knockout',
  isKnockout: true,
  status: 'pending',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: null,
  scoreB: null,
};

const bracket = {
  data: { stage: [], group: [{ id: 0, stage_id: 0, number: 1 }], round: [{ id: 0, group_id: 0, number: 1 }], match: [], match_game: [], participant: [] },
};

describe('admin tournaments', () => {
  it('creates a tournament with the options of its format', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments': [tournamentListItem()],
      '/teams': teams,
      'POST /tournaments': (body: { name: string }) => draft({ id: 'c9', name: body.name, entries: [] }),
      '/tournaments/c9': draft({ id: 'c9', name: 'Copa Novembro', entries: [] }),
    });
    renderRoute('/admin/campeonatos');
    expect(await screen.findByRole('link', { name: /Copa Outubro/ })).toHaveAttribute('href', '/admin/campeonatos/c1');
    const form = screen.getByRole('form', { name: 'Novo campeonato' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Novembro' } });
    expect(within(form).getByLabelText('Disputa de 3º lugar')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'round_robin' } });
    expect(within(form).queryByLabelText('Disputa de 3º lugar')).toBeNull();
    fireEvent.change(within(form).getByLabelText('Turnos'), { target: { value: 'double' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar campeonato' }));
    expect(await screen.findByRole('heading', { name: 'Copa Novembro', level: 1 })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /tournaments')).toEqual([
      { name: 'Copa Novembro', format: 'round_robin', options: { roundRobinMode: 'double' } },
    ]);
  });

  it('saves the configuration of a tournament in preparation', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft(),
      '/teams': teams,
      'PATCH /tournaments/c1': (body: object) => ({ ...draft(), ...body }),
    });
    renderRoute('/admin/campeonatos/c1');
    const form = await screen.findByRole('form', { name: 'Configuração' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Outubro 2026' } });
    fireEvent.click(within(form).getByLabelText('Disputa de 3º lugar'));
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar configuração' }));
    expect(await screen.findByText('Configuração salva.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /tournaments/c1')).toEqual([
      {
        name: 'Copa Outubro 2026',
        format: 'single_elimination',
        options: { consolationFinal: true, grandFinalReset: false, roundRobinMode: 'simple' },
      },
    ]);
  });

  it('orders the seeds and saves the entries', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/tournaments/c1': draft(), '/teams': teams, 'PUT /tournaments/c1/entries': () => draft() });
    renderRoute('/admin/campeonatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: 'Descer Leões' }));
    fireEvent.change(await screen.findByLabelText('Inscrever time'), { target: { value: 't3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar inscrições' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /tournaments/c1/entries')).toEqual([{ teamIds: ['t2', 't1', 't3'] }]));
  });

  it('starts only with saved entries and enough teams, after confirming', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft(),
      '/teams': teams,
      'POST /tournaments/c1/start': () => draft({ status: 'in_progress' }),
    });
    renderRoute('/admin/campeonatos/c1');
    await screen.findByLabelText('Inscrever time');
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Tirar Tigres' }));
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeDisabled();
    expect(screen.getByText('Salve as inscrições antes de iniciar.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Inscrever time'), { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar campeonato' }));
    expect(sentBodies(fetchMock, 'POST /tournaments/c1/start')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar início: a chave não pode ser refeita' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'POST /tournaments/c1/start')).toHaveLength(1));
  });

  it('links fixtures to the result screen and explains why it cannot finish yet', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft({ status: 'in_progress', startedAt: '2026-10-02T00:00:00.000Z' }),
      '/tournaments/c1/bracket': bracket,
      '/tournaments/c1/fixtures': [pending],
      'POST /tournaments/c1/finish': () =>
        new Response(JSON.stringify({ error: { code: 'TOURNAMENT_NOT_COMPLETE', message: 'Ainda há confrontos sem resultado.' } }), {
          status: 409,
        }),
    });
    renderRoute('/admin/campeonatos/c1');
    expect(await screen.findByRole('link', { name: /Leões.*A jogar.*Tigres/ })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/0');
    expect(screen.queryByRole('form', { name: 'Configuração' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar campeonato' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda há confrontos sem resultado.');
  });
});
