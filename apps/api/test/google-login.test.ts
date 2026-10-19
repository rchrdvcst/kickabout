import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { GoogleProfile } from '../src/auth/google';
import { ADMIN, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const CLIENT_ID = 'kickabout-test.apps.googleusercontent.com';

/** Verificador falso: o "token" é o perfil em JSON; "invalido" é recusado; o destinatário precisa ser o nosso. */
async function fakeVerify(credential: string, clientId: string): Promise<GoogleProfile> {
  if (clientId !== CLIENT_ID || credential === 'invalido') throw new Error('token inválido');
  return JSON.parse(credential) as GoogleProfile;
}

const token = (overrides: Partial<GoogleProfile> = {}) =>
  JSON.stringify({ sub: 'g-ana', email: 'ana@gmail.com', emailVerified: true, name: 'Ana Souza', picture: 'https://foto/ana', ...overrides });

const app = createTestApp({ googleClientId: CLIENT_ID }, { verifyGoogleToken: fakeVerify });
afterAll(() => app.close());
beforeEach(resetDb);

const google = (credential: string, target = app) =>
  target.inject({ method: 'POST', url: '/api/auth/google', payload: { credential } });

describe('google login', () => {
  it('publishes the client id', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ googleClientId: CLIENT_ID });
  });

  it('creates a regular user on the first login and reuses it afterwards', async () => {
    const first = await google(token());
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({
      user: { id: expect.any(String), email: 'ana@gmail.com', name: 'Ana Souza', avatarUrl: 'https://foto/ana', role: 'user' },
    });
    const cookie = first.cookies.find((c) => c.name === 'kb_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `kb_session=${cookie!.value}` } });
    expect(me.json().user).toMatchObject({ email: 'ana@gmail.com', role: 'user' });

    const second = await google(token({ name: 'Ana S.', picture: 'https://foto/nova' }));
    expect(second.json().user).toMatchObject({ id: first.json().user.id, name: 'Ana S.', avatarUrl: 'https://foto/nova' });
    expect(await prisma.user.count()).toBe(1);
    const stored = await prisma.user.findFirstOrThrow();
    expect(stored).toMatchObject({ googleId: 'g-ana', passwordHash: null });
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it('links to the existing organizer by email, in any case, keeping the admin role', async () => {
    await loginAdmin(app);
    const res = await google(token({ sub: 'g-admin', email: ADMIN.email.toUpperCase(), name: 'Organizador' }));
    expect(res.json().user).toMatchObject({ email: ADMIN.email, role: 'admin', name: 'Organizador' });
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findFirstOrThrow()).googleId).toBe('g-admin');
  });

  it('refuses to relink an email already tied to another Google account', async () => {
    await google(token());
    const res = await google(token({ sub: 'g-outra' }));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'GOOGLE_ACCOUNT_CONFLICT', message: 'Este email já está ligado a outra conta Google.' } });
  });

  it('creates a single user when the first login arrives twice at once', async () => {
    const responses = await Promise.all([google(token()), google(token())]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuses invalid tokens and unverified emails', async () => {
    const message = { error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Não foi possível entrar com o Google. Tente de novo.' } };
    const invalid = await google('invalido');
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toEqual(message);
    const unverified = await google(token({ emailVerified: false }));
    expect(unverified.statusCode).toBe(401);
    expect(unverified.json()).toEqual(message);
    expect(await prisma.user.count()).toBe(0);
  });

  it('validates the body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/google', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('is disabled without GOOGLE_CLIENT_ID', async () => {
    const plain = createTestApp({}, { verifyGoogleToken: fakeVerify });
    expect((await plain.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ googleClientId: null });
    const res = await google(token(), plain);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'GOOGLE_LOGIN_DISABLED', message: 'Login com Google não está habilitado.' } });
    await plain.close();
  });
});
