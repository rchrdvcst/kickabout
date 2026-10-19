import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, createTestApp, loginAdmin, loginUser, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const list = (cookie: string) => app.inject({ method: 'GET', url: '/api/users', headers: { cookie } });
const setRole = (cookie: string, id: string, role: string) =>
  app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: { cookie }, payload: { role } });
const idOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

describe('users', () => {
  it('lists users newest first with how they sign in', async () => {
    const admin = await loginAdmin(app);
    await loginUser(app, 'ana@kickabout.test');
    await prisma.user.create({ data: { email: 'bia@gmail.com', googleId: 'g-bia', name: 'Bia', avatarUrl: 'https://foto/bia' } });

    const res = await list(admin);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({ email: 'bia@gmail.com', name: 'Bia', role: 'user', hasGoogle: true, hasPassword: false, lastLoginAt: null }),
      expect.objectContaining({ email: 'ana@kickabout.test', role: 'user', hasGoogle: false, hasPassword: true, lastLoginAt: expect.any(String) }),
      expect.objectContaining({ email: ADMIN.email, role: 'admin', hasPassword: true }),
    ]);
    expect(res.json()[0]).not.toHaveProperty('passwordHash');
    expect(res.json()[0]).not.toHaveProperty('googleId');
  });

  it('promotes a user, who then reaches the admin routes', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const res = await setRole(admin, await idOf('ana@kickabout.test'), 'admin');
    expect(res.json()).toMatchObject({ email: 'ana@kickabout.test', role: 'admin' });
    expect((await list(ana)).statusCode).toBe(200);
  });

  it('demotes another organizer, who loses access on the next request', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const anaId = await idOf('ana@kickabout.test');
    await setRole(admin, anaId, 'admin');
    expect((await setRole(admin, anaId, 'user')).json()).toMatchObject({ role: 'user' });
    expect((await list(ana)).statusCode).toBe(403);
  });

  it('refuses demoting yourself', async () => {
    const admin = await loginAdmin(app);
    const res = await setRole(admin, await idOf(ADMIN.email), 'user');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'CANNOT_DEMOTE_SELF', message: 'Você não pode tirar o seu próprio papel de organizador.' } });
  });

  it('never leaves the system without an organizer, even with two demotions at once', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const adminId = await idOf(ADMIN.email);
    const anaId = await idOf('ana@kickabout.test');
    await setRole(admin, anaId, 'admin');

    const [one, two] = await Promise.all([setRole(admin, anaId, 'user'), setRole(ana, adminId, 'user')]);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { role: 'admin' } })).toBe(1);
    const refused = one.statusCode === 409 ? one : two;
    expect(refused.json()).toEqual({ error: { code: 'LAST_ADMIN', message: 'É preciso ter pelo menos um organizador.' } });
  });

  it('validates the role and returns 404 for unknown users', async () => {
    const admin = await loginAdmin(app);
    expect((await setRole(admin, await idOf(ADMIN.email), 'dono')).statusCode).toBe(400);
    const missing = await setRole(admin, 'nao-existe', 'admin');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
  });

  it('is only for organizers', async () => {
    await loginAdmin(app);
    const ana = await loginUser(app);
    expect((await list(ana)).statusCode).toBe(403);
    expect((await setRole(ana, await idOf('ana@kickabout.test'), 'admin')).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/users' })).statusCode).toBe(401);
  });
});
