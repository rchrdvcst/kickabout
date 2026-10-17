import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const players: AdminPlayer[] = [
  { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321', team: LEOES },
  { id: 'p2', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000', team: null },
];
const teams = [
  { ...LEOES, playerCount: 1 },
  { ...TIGRES, playerCount: 0 },
];

describe('admin players', () => {
  it('lists players with phone and team, and searches', async () => {
    mockApi({ ...SIGNED_IN, '/players': players, '/players?search=bia': [players[1]], '/teams': teams });
    renderRoute('/admin/jogadores');
    const items = within(await screen.findByRole('list', { name: 'Jogadores' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ana(11) 98765-4321Leões');
    expect(items[1]).toHaveTextContent('Sem time');
    fireEvent.change(screen.getByLabelText('Buscar por nome ou celular'), { target: { value: 'bia' } });
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Jogadores' })).getAllByRole('listitem')).toHaveLength(1));
  });

  it('edits a player and transfers them to another team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/players': players,
      '/teams': teams,
      'PATCH /players/p1': { ...players[0]!, name: 'Ana Paula' },
      'PUT /players/p1/team': { playerId: 'p1', teamId: 't2' },
    });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    const form = screen.getByRole('form', { name: 'Editar Ana' });
    await within(form).findByRole('option', { name: 'Tigres' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Ana Paula' } });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('button', { name: 'Editar Ana' })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /players/p1')).toEqual([{ name: 'Ana Paula', phone: '(11) 98765-4321' }]);
    expect(sentBodies(fetchMock, 'PUT /players/p1/team')).toEqual([{ teamId: 't2' }]);
  });

  it('only sends what changed', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/players': players, '/teams': teams, 'PUT /players/p2/team': { playerId: 'p2', teamId: 't1' } });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Bia' }));
    const form = screen.getByRole('form', { name: 'Editar Bia' });
    await within(form).findByRole('option', { name: 'Leões' });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('button', { name: 'Editar Bia' });
    expect(sentBodies(fetchMock, 'PATCH /players/p2')).toEqual([]);
    expect(sentBodies(fetchMock, 'PUT /players/p2/team')).toEqual([{ teamId: 't1' }]);
  });

  it('creates a player without team and shows phone errors from the API', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/players': [],
      '/teams': teams,
      'POST /players': () =>
        new Response(JSON.stringify({ error: { code: 'PHONE_TAKEN', message: 'Já existe um jogador com esse celular.' } }), { status: 409 }),
    });
    renderRoute('/admin/jogadores');
    const form = await screen.findByRole('form', { name: 'Novo jogador' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '11 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar jogador' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Já existe um jogador com esse celular.');
    expect(sentBodies(fetchMock, 'POST /players')).toEqual([{ name: 'Caio', phone: '11 91234-5678', teamId: null }]);
  });
});
