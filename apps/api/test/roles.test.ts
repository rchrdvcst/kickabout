import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTeam, createTestApp, loginAdmin, loginUser, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const FORBIDDEN = { error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } };

describe('roles', () => {
  it('new users default to the user role in the database', async () => {
    const user = await prisma.user.create({ data: { email: 'novo@kickabout.test' } });
    expect(user).toMatchObject({ role: 'user', passwordHash: null, googleId: null, name: null, avatarUrl: null, lastLoginAt: null });
  });

  it('refuses every family of admin routes to a regular user with 403', async () => {
    const admin = await loginAdmin(app);
    const team = await createTeam(app, admin, 'Leões');
    const { id: tournamentId } = (
      await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie: admin }, payload: { name: 'C', format: 'round_robin' } })
    ).json();
    const cookie = await loginUser(app);

    const attempts = [
      { method: 'POST', url: '/api/teams', payload: { name: 'Tigres', shortName: 'TIG' } },
      { method: 'PATCH', url: `/api/teams/${team.id}`, payload: { name: 'X', shortName: 'X', crestUrl: null } },
      { method: 'GET', url: '/api/players' },
      { method: 'POST', url: '/api/players', payload: { name: 'Ana', phone: '11 912345678' } },
      { method: 'POST', url: '/api/tournaments', payload: { name: 'C', format: 'round_robin' } },
      { method: 'DELETE', url: `/api/tournaments/${tournamentId}` },
      { method: 'PUT', url: `/api/tournaments/${tournamentId}/fixtures/0/result`, payload: { mode: 'draft', duels: [] } },
      { method: 'POST', url: '/api/titles', payload: { teamId: team.id, tournamentName: 'X', position: 1, year: 2020 } },
    ] as const;
    for (const attempt of attempts) {
      const res = await app.inject({ ...attempt, headers: { cookie } });
      expect({ url: attempt.url, method: attempt.method, status: res.statusCode, body: res.json() }).toEqual({
        url: attempt.url,
        method: attempt.method,
        status: 403,
        body: FORBIDDEN,
      });
    }
    expect(await prisma.tournament.count()).toBe(1);
  });

  it('keeps 401 for visitors without a session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/teams', payload: { name: 'Tigres', shortName: 'TIG' } });
    expect(res.statusCode).toBe(401);
  });

  it('exposes name, avatar and role on /auth/me', async () => {
    const cookie = await loginUser(app);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toEqual({
      user: { id: expect.any(String), email: 'ana@kickabout.test', name: null, avatarUrl: null, role: 'user' },
    });
  });
});
