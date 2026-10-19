import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { afterSignIn } from '../src/lib/redirect';
import { ADMIN, REGULAR } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const CLIENT_ID = 'kickabout-test.apps.googleusercontent.com';

/** `window.google` falso: o botão renderizado chama o callback com um token. */
function fakeGoogle() {
  const seen: { clientId?: string; options?: Record<string, unknown> } = {};
  let callback: ((response: { credential: string }) => void) | undefined;
  vi.stubGlobal('google', {
    accounts: {
      id: {
        initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => {
          seen.clientId = options.client_id;
          callback = options.callback;
        },
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => {
          seen.options = options;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Fazer login com o Google';
          button.onclick = () => callback?.({ credential: 'token-do-google' });
          parent.append(button);
        },
      },
    },
  });
  return seen;
}

function signInAs(user: typeof ADMIN | typeof REGULAR, extra: Record<string, unknown> = {}) {
  let current: typeof user | null = null;
  return mockApi({
    '/auth/me': () => ({ user: current }),
    '/auth/config': { googleClientId: CLIENT_ID },
    'POST /auth/google': () => {
      current = user;
      return { user };
    },
    '/fixtures/recent?limit=8': [],
    '/tournaments?status=in_progress': [],
    ...extra,
  });
}

describe('afterSignIn', () => {
  it('sends organizers to the requested page or the admin, and regular users away from the admin', () => {
    expect(afterSignIn(ADMIN, '/admin/times')).toBe('/admin/times');
    expect(afterSignIn(ADMIN, null)).toBe('/admin');
    expect(afterSignIn(REGULAR, '/times/t1')).toBe('/times/t1');
    expect(['/admin', '/admin/times', '/admin?x=1', null, '//evil.com'].map((target) => afterSignIn(REGULAR, target))).toEqual(
      Array(5).fill('/'),
    );
    expect(afterSignIn(REGULAR, '/administracao')).toBe('/administracao');
  });
});

describe('sign in with Google', () => {
  it('shows the Google button with the configured client id, above the password form', async () => {
    const seen = fakeGoogle();
    signInAs(REGULAR);
    renderRoute('/entrar');
    expect(await screen.findByRole('button', { name: 'Fazer login com o Google' })).toBeInTheDocument();
    expect(seen.clientId).toBe(CLIENT_ID);
    expect(seen.options).toMatchObject({ theme: 'filled_black', text: 'signin_with', locale: 'pt-BR' });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByText(/organizador/i)).toBeNull();
  });

  it('signs a regular user in and goes home, even when coming from the admin', async () => {
    fakeGoogle();
    const fetchMock = signInAs(REGULAR);
    const { router } = renderRoute('/entrar?voltar=%2Fadmin');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/google')).toEqual([{ credential: 'token-do-google' }]);
  });

  it('signs an organizer in and goes to the requested admin page', async () => {
    fakeGoogle();
    signInAs(ADMIN, { '/teams': [] });
    const { router } = renderRoute('/entrar?voltar=%2Fadmin%2Ftimes');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/times'));
  });

  it('shows the API message when Google sign-in is refused', async () => {
    fakeGoogle();
    mockApi({
      '/auth/me': { user: null },
      '/auth/config': { googleClientId: CLIENT_ID },
      'POST /auth/google': () =>
        new Response(
          JSON.stringify({ error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Não foi possível entrar com o Google. Tente de novo.' } }),
          { status: 401 },
        ),
    });
    renderRoute('/entrar');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar com o Google. Tente de novo.');
  });

  it('hides the Google button when the server has no client id', async () => {
    fakeGoogle();
    mockApi({ '/auth/me': { user: null }, '/auth/config': { googleClientId: null } });
    renderRoute('/entrar');
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fazer login com o Google' })).toBeNull());
  });

  it('explains when the Google script cannot load', async () => {
    mockApi({ '/auth/me': { user: null }, '/auth/config': { googleClientId: CLIENT_ID } });
    renderRoute('/entrar');
    await waitFor(() => expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull());
    document.querySelector('script[src="https://accounts.google.com/gsi/client"]')!.dispatchEvent(new Event('error'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o login do Google. Use email e senha ou tente de novo.',
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
