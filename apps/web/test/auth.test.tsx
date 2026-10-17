import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../src/lib/redirect';
import { ADMIN, SIGNED_IN } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

function signIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('safeRedirect', () => {
  it('keeps internal paths and rejects anything that could leave the site', () => {
    expect(safeRedirect('/admin/times?x=1')).toBe('/admin/times?x=1');
    expect(['//evil.com', 'https://evil.com', '/\\evil.com', 'admin', '', null, '/\n/evil.com'].map(safeRedirect)).toEqual(
      Array(7).fill('/admin'),
    );
  });
});

describe('sign in', () => {
  it('sends signed-out visitors to the login page, remembering where they were going', async () => {
    mockApi({ '/auth/me': { user: null } });
    const { router } = renderRoute('/admin');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toBe('?voltar=%2Fadmin');
  });

  it('signs in and returns to the requested page', async () => {
    let user: typeof ADMIN | null = null;
    const fetchMock = mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/login': () => {
        user = ADMIN;
        return { user: ADMIN };
      },
    });
    renderRoute('/entrar?voltar=%2Fadmin');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('admin@kickabout.local', 'segredo123');
    expect(await screen.findByRole('heading', { name: 'Área do organizador' })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /auth/login')).toEqual([{ email: 'admin@kickabout.local', password: 'segredo123' }]);
  });

  it('shows the API message for wrong credentials', async () => {
    mockApi({
      '/auth/me': { user: null },
      'POST /auth/login': () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } }), { status: 401 }),
    });
    renderRoute('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('admin@kickabout.local', 'errada');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos.');
  });

  it('never follows an external return address', async () => {
    mockApi(SIGNED_IN);
    const { router } = renderRoute('/entrar?voltar=%2F%2Fevil.com');
    expect(await screen.findByRole('heading', { name: 'Área do organizador' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('signs out back to the public home', async () => {
    let user: typeof ADMIN | null = ADMIN;
    const fetchMock = mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/logout': () => {
        user = null;
        return { ok: true };
      },
      '/fixtures/recent?limit=8': [],
      '/tournaments?status=in_progress': [],
    });
    const { router } = renderRoute('/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/logout')).toHaveLength(1);
  });
});
