import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES, team } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const ana: RosterPlayer = { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' };
const roster = (players: RosterPlayer[]) => ({ '/teams/t1/roster': { team: LEOES, players } });

function fillNewTeam(name: string, shortName: string) {
  const form = screen.getByRole('form', { name: 'Novo time' });
  fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: name } });
  fireEvent.change(within(form).getByLabelText('Sigla (até 5 letras)'), { target: { value: shortName } });
  fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar time' }));
}

describe('admin teams', () => {
  it('lists teams with roster size and creates a new team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/teams': [{ ...LEOES, playerCount: 12 }],
      'POST /teams': (body: { name: string }) => ({ ...team('t9', body.name), playerCount: 0 }),
      '/teams/t9/roster': { team: team('t9', 'Panteras'), players: [] },
    });
    renderRoute('/admin/times');
    expect(await screen.findByRole('link', { name: /Leões.*12 de 20 jogadores/ })).toHaveAttribute('href', '/admin/times/t1');
    fillNewTeam('Panteras', 'pan');
    expect(await screen.findByRole('heading', { name: 'Panteras', level: 1 })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /teams')).toEqual([{ name: 'Panteras', shortName: 'PAN', crestUrl: null }]);
  });

  it('edits the team data', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, ...roster([]), 'PATCH /teams/t1': (body: object) => ({ ...LEOES, ...body }) });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Dados do time' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Leões FC' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /teams/t1')).toEqual([{ name: 'Leões FC', shortName: 'LEÕ', crestUrl: null }]);
  });

  it('shows the roster with phones and removes a player', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, ...roster([ana]), 'PUT /players/p1/team': { playerId: 'p1', teamId: null } });
    renderRoute('/admin/times/t1');
    const list = await screen.findByRole('list', { name: 'Elenco atual' });
    expect(list).toHaveTextContent('(11) 98765-4321');
    expect(screen.getByText('1 de 20 jogadores ativos.')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Remover Ana do elenco' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /players/p1/team')).toEqual([{ teamId: null }]));
  });

  it('transfers an existing player from another team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      ...roster([]),
      '/players?search=bia': [{ id: 'p5', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000', team: TIGRES }],
      'PUT /players/p5/team': { playerId: 'p5', teamId: 't1' },
    });
    renderRoute('/admin/times/t1');
    fireEvent.change(await screen.findByLabelText('Buscar por nome ou celular'), { target: { value: 'bia' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Transferir Bia de Tigres para este time' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /players/p5/team')).toEqual([{ teamId: 't1' }]));
  });

  it('registers a new player straight into the roster', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      ...roster([]),
      'POST /players': (body: { name: string }) => ({ id: 'p9', name: body.name, phone: '+5511912345678', whatsappUrl: 'https://wa.me/5511912345678', team: LEOES }),
    });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Novo jogador no elenco' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '(11) 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar e adicionar' }));
    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST /players')).toEqual([{ name: 'Caio', phone: '(11) 91234-5678', teamId: 't1' }]),
    );
  });

  it('warns when the roster is full and hides the add controls', async () => {
    const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Jogador ${i}` }));
    mockApi({ ...SIGNED_IN, ...roster(players) });
    renderRoute('/admin/times/t1');
    expect(await screen.findByText('Elenco cheio: 20 jogadores ativos. Remova alguém para adicionar outro.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar por nome ou celular')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Novo jogador no elenco' })).toBeNull();
  });

  it('shows the server refusal when the roster filled up meanwhile', async () => {
    mockApi({
      ...SIGNED_IN,
      ...roster([]),
      'POST /players': () =>
        new Response(JSON.stringify({ error: { code: 'ROSTER_FULL', message: 'O time já tem 20 jogadores ativos.' } }), { status: 409 }),
    });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Novo jogador no elenco' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '(11) 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar e adicionar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O time já tem 20 jogadores ativos.');
  });

  it('goes to the login page and back when the session expired while saving', async () => {
    mockApi({
      ...SIGNED_IN,
      '/teams': [],
      'POST /teams': () =>
        new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' } }), { status: 401 }),
    });
    const { router } = renderRoute('/admin/times');
    await screen.findByRole('form', { name: 'Novo time' });
    fillNewTeam('Panteras', 'PAN');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?voltar=%2Fadmin%2Ftimes');
  });
});
