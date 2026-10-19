import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserListItem } from '../src/api/types';
import { ADMIN, SIGNED_IN } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const row = (overrides: Partial<UserListItem>): UserListItem => ({
  id: 'x',
  email: 'x@kickabout.local',
  name: null,
  avatarUrl: null,
  role: 'user',
  hasPassword: false,
  hasGoogle: true,
  lastLoginAt: '2026-10-18T12:00:00.000Z',
  createdAt: '2026-10-18T12:00:00.000Z',
  ...overrides,
});

const users = [
  row({ id: 'u2', email: 'ana@gmail.com', name: 'Ana Souza' }),
  row({ id: 'u3', email: 'bia@gmail.com', name: 'Bia', role: 'admin', hasPassword: true, lastLoginAt: null }),
  row({ id: ADMIN.id, email: ADMIN.email, role: 'admin', hasPassword: true, hasGoogle: false }),
];

describe('admin users', () => {
  it('lists users with how they sign in and their role', async () => {
    mockApi({ ...SIGNED_IN, '/users': users });
    renderRoute('/admin/usuarios');
    const list = await screen.findByRole('list', { name: 'Usuários' });
    const [ana, bia, me] = within(list).getAllByRole('listitem');
    expect(ana).toHaveTextContent('Ana Souza');
    expect(ana).toHaveTextContent('ana@gmail.com');
    expect(ana).toHaveTextContent('Google');
    expect(ana).toHaveTextContent('Usuário');
    expect(bia).toHaveTextContent('Google e senha');
    expect(bia).toHaveTextContent('Nunca entrou');
    expect(bia).toHaveTextContent('Organizador');
    expect(me).toHaveTextContent('Sem nome');
    expect(me).toHaveTextContent('Senha');
    expect(within(me!).queryByRole('button')).toBeNull();
    expect(within(me!).getByText('Você')).toBeInTheDocument();
  });

  it('promotes a user after confirming', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/users': users,
      'PATCH /users/u2': (body: { role: string }) => ({ ...users[0], ...body }),
    });
    renderRoute('/admin/usuarios');
    fireEvent.click(await screen.findByRole('button', { name: 'Tornar Ana Souza organizador' }));
    expect(sentBodies(fetchMock, 'PATCH /users/u2')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: tornar organizador' }));
    await screen.findByRole('button', { name: 'Tornar Ana Souza organizador' });
    expect(sentBodies(fetchMock, 'PATCH /users/u2')).toEqual([{ role: 'admin' }]);
  });

  it('demotes another organizer after confirming and shows API errors', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/users': users,
      'PATCH /users/u3': () =>
        new Response(JSON.stringify({ error: { code: 'LAST_ADMIN', message: 'É preciso ter pelo menos um organizador.' } }), { status: 409 }),
    });
    renderRoute('/admin/usuarios');
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Bia de organizador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: remover organizador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('É preciso ter pelo menos um organizador.');
    expect(sentBodies(fetchMock, 'PATCH /users/u3')).toEqual([{ role: 'user' }]);
  });

  it('is linked from the organizer bar', async () => {
    mockApi({ ...SIGNED_IN, '/users': users, '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] });
    renderRoute('/admin');
    const nav = await screen.findByRole('navigation', { name: 'Administração' });
    expect(within(nav).getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios');
  });
});
