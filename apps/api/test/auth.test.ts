import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/sessions';
import { ADMIN, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

describe('auth', () => {
  it('logs in, exposes /me and logs out', async () => {
    const cookie = await loginAdmin(app);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ user: { email: ADMIN.email, role: 'admin' } });

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.json()).toEqual({ user: null });
  });

  it('sets an httpOnly lax cookie and stores only the token hash', async () => {
    await loginAdmin(app);
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: ADMIN });
    const cookie = res.cookies.find((c) => c.name === 'kb_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    const session = await prisma.session.findUnique({ where: { id: hashToken(cookie!.value) } });
    expect(session).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: cookie!.value } })).toBeNull();
  });

  it('rejects wrong credentials with a Portuguese message', async () => {
    await loginAdmin(app);
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { ...ADMIN, password: 'errada' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } });
  });

  it('accepts the email in any case', async () => {
    await loginAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN.email.toUpperCase(), password: ADMIN.password },
    });
    expect(res.statusCode).toBe(200);
  });

  it('treats expired or forged session cookies as anonymous', async () => {
    const cookie = await loginAdmin(app);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(expired.json()).toEqual({ user: null });

    const forged = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: 'kb_session=inventado' } });
    expect(forged.statusCode).toBe(200);
    expect(forged.json()).toEqual({ user: null });
  });

  it('validates the login body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });

  it('refuses password login for an account without a password, with the generic message', async () => {
    await prisma.user.create({ data: { email: 'google@kickabout.test', googleId: 'g-1' } });
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'google@kickabout.test', password: 'qualquer' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } });
  });

  it('records the last login time', async () => {
    await loginAdmin(app);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });
});
