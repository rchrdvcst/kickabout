import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, REGULAR } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const HOME = { '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] };

describe('account in the top bar', () => {
  it('shows a regular user their name and sign out, with no trace of the admin', async () => {
    let user: typeof REGULAR | null = REGULAR;
    const fetchMock = mockApi({
      ...HOME,
      '/auth/me': () => ({ user }),
      'POST /auth/logout': () => {
        user = null;
        return { ok: true };
      },
    });
    const { router } = renderRoute('/times');
    const account = await screen.findByRole('group', { name: 'Conta de Ana Souza' });
    expect(within(account).getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/organizador/i);

    fireEvent.click(within(account).getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/logout')).toHaveLength(1);
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('closes the account menu when the user navigates', async () => {
    mockApi({ ...HOME, '/auth/me': { user: REGULAR }, '/teams': [] });
    renderRoute('/');
    const account = (await screen.findByRole('group', { name: 'Conta de Ana Souza' })) as HTMLDetailsElement;
    account.open = true;
    fireEvent.click(screen.getByRole('link', { name: 'Times' }));
    await waitFor(() => expect(account.open).toBe(false));
  });

  it('gives organizers a link to the organizer area', async () => {
    mockApi({ ...HOME, '/auth/me': { user: ADMIN } });
    renderRoute('/');
    const account = await screen.findByRole('group', { name: 'Conta de admin@kickabout.local' });
    expect(within(account).getByRole('link', { name: 'Área do organizador' })).toHaveAttribute('href', '/admin');
  });

  it('shows the Google photo when there is one', async () => {
    mockApi({ ...HOME, '/auth/me': { user: { ...REGULAR, avatarUrl: 'https://foto/ana' } } });
    renderRoute('/');
    const account = await screen.findByRole('group', { name: 'Conta de Ana Souza' });
    expect(account.querySelector('img')).toHaveAttribute('src', 'https://foto/ana');
  });
});

describe('admin for regular users', () => {
  it('shows the standard not found page inside the public layout', async () => {
    mockApi({ '/auth/me': { user: REGULAR } });
    renderRoute('/admin/times');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Administração' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver site' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/organizador/i);
  });

  it('hides the admin as soon as an organizer is demoted (403 on a read)', async () => {
    let user: typeof ADMIN | typeof REGULAR = ADMIN;
    mockApi({
      '/auth/me': () => ({ user }),
      '/teams': () => {
        user = REGULAR;
        return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } }), { status: 403 });
      },
    });
    renderRoute('/admin/times');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Administração' })).toBeNull();
  });

  it('hides the admin when a write comes back 403', async () => {
    let user: typeof ADMIN | typeof REGULAR = ADMIN;
    mockApi({
      '/auth/me': () => ({ user }),
      '/teams': [],
      'POST /teams': () => {
        user = REGULAR;
        return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } }), { status: 403 });
      },
    });
    renderRoute('/admin/times');
    const form = await screen.findByRole('form', { name: 'Novo time' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Tigres' } });
    fireEvent.change(within(form).getByLabelText(/Tag/), { target: { value: 'TIG' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar time' }));
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
  });
});
