import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../src/lib/redirect';
import { ADMIN, LEOES, REGULAR, SIGNED_IN } from './data';
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
  it('sends a regular user who signs in with a password to the home page', async () => {
    let user: typeof REGULAR | null = null;
    mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/login': () => {
        user = REGULAR;
        return { user: REGULAR };
      },
      '/fixtures/recent?limit=8': [],
      '/tournaments?status=in_progress': [],
    });
    const { router } = renderRoute('/entrar?voltar=%2Fadmin');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('ana@gmail.com', 'segredo123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

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

describe('end of session', () => {
  const ana = { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' };

  /** Com PHONE_VISIBILITY=authenticated, o elenco só traz celulares para quem está logado. */
  function phoneVisibleOnlyWhileSignedIn(extra: Record<string, unknown> = {}) {
    const session = { user: ADMIN as typeof ADMIN | null };
    mockApi({
      '/auth/me': () => ({ user: session.user }),
      '/teams/t1/roster': () => ({ team: LEOES, players: session.user ? [ana] : [{ id: 'p1', name: 'Ana' }] }),
      'POST /auth/logout': () => {
        session.user = null;
        return { ok: true };
      },
      '/fixtures/recent?limit=8': [],
      '/tournaments?status=in_progress': [],
      ...extra,
    });
    return session;
  }

  it('forgets admin-only data (phones) when signing out', async () => {
    phoneVisibleOnlyWhileSignedIn();
    const { router } = renderRoute('/admin/times/t1');
    expect(await screen.findByText('(11) 98765-4321')).toBeInTheDocument();
    // Sai de outra página: o elenco fica só no cache, sem ninguém para buscá-lo de novo.
    await act(() => router.navigate('/admin'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await act(() => router.navigate('/times/t1/bid'));
    expect(screen.queryByText('(11) 98765-4321')).toBeNull();
    expect(await screen.findByRole('link', { name: 'Ana' })).toBeInTheDocument();
  });

  it('forgets admin-only data (phones) when the session expires', async () => {
    const session = phoneVisibleOnlyWhileSignedIn({
      'PUT /players/p1/team': () => {
        session.user = null;
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' } }), { status: 401 });
      },
    });
    const { router } = renderRoute('/admin/times/t1');
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Ana do elenco' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    await act(() => router.navigate('/times/t1/bid'));
    expect(screen.queryByText('(11) 98765-4321')).toBeNull();
    expect(await screen.findByRole('link', { name: 'Ana' })).toBeInTheDocument();
  });
});
