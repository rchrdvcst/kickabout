import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlayer, createTeam, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

describe('teams', () => {
  it('requires login to create', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/teams', payload: { name: 'Leões', shortName: 'LEO' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('creates, lists with player count and rejects duplicate names', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    await createPlayer(app, cookie, { teamId: team.id });

    const list = await app.inject({ method: 'GET', url: '/api/teams' });
    expect(list.json()).toEqual([{ id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null, playerCount: 1 }]);

    const dup = await app.inject({ method: 'POST', url: '/api/teams', headers: { cookie }, payload: { name: 'Leões', shortName: 'L2' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'TEAM_NAME_TAKEN' } });
  });

  it('updates a team', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/teams/${team.id}`,
      headers: { cookie },
      payload: { name: 'Leões FC', crestUrl: 'https://example.com/leoes.png' },
    });
    expect(res.json()).toMatchObject({ name: 'Leões FC', crestUrl: 'https://example.com/leoes.png' });
  });
});

describe('players and BID', () => {
  it('normalizes the phone and exposes it in the public BID with a WhatsApp link', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const player = await createPlayer(app, cookie, { name: 'Ana', phone: '(11) 98765-4321', teamId: team.id });
    expect(player.phone).toBe('+5511987654321');

    const bid = await app.inject({ method: 'GET', url: `/api/teams/${team.id}/roster` });
    expect(bid.json()).toEqual({
      team: { id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null },
      players: [{ id: player.id, name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' }],
    });
  });

  it('hides phones from visitors when PHONE_VISIBILITY=authenticated', async () => {
    const privateApp = createTestApp({ phoneVisibility: 'authenticated' });
    const cookie = await loginAdmin(privateApp);
    const team = await createTeam(privateApp, cookie, 'Leões');
    const player = await createPlayer(privateApp, cookie, { name: 'Ana', teamId: team.id });

    const anon = await privateApp.inject({ method: 'GET', url: `/api/teams/${team.id}/roster` });
    expect(anon.json().players).toEqual([{ id: player.id, name: 'Ana' }]);

    const admin = await privateApp.inject({ method: 'GET', url: `/api/teams/${team.id}/roster`, headers: { cookie } });
    expect(admin.json().players[0]).toHaveProperty('phone');
    await privateApp.close();
  });

  it('rejects invalid and duplicated phones', async () => {
    const cookie = await loginAdmin(app);
    const invalid = await app.inject({ method: 'POST', url: '/api/players', headers: { cookie }, payload: { name: 'X', phone: '123' } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'INVALID_PHONE' } });

    await createPlayer(app, cookie, { phone: '(11) 98765-4321' });
    const dup = await app.inject({ method: 'POST', url: '/api/players', headers: { cookie }, payload: { name: 'Y', phone: '+55 11 98765-4321' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'PHONE_TAKEN' } });
  });

  it('enforces the 20 active players limit', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    for (let i = 0; i < 20; i++) await createPlayer(app, cookie, { teamId: team.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/players',
      headers: { cookie },
      payload: { name: 'Vinte e um', phone: '11 91111-1111', teamId: team.id },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'ROSTER_FULL', message: 'O time já tem 20 jogadores ativos.' } });
    expect(await prisma.player.count()).toBe(20);
  });

  it('transfers a player keeping the membership history', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeam(app, cookie, 'Leões');
    const b = await createTeam(app, cookie, 'Tigres');
    const player = await createPlayer(app, cookie, { teamId: a.id });

    const res = await app.inject({ method: 'PUT', url: `/api/players/${player.id}/team`, headers: { cookie }, payload: { teamId: b.id } });
    expect(res.json()).toEqual({ playerId: player.id, teamId: b.id });

    const rosterA = await app.inject({ method: 'GET', url: `/api/teams/${a.id}/roster` });
    const rosterB = await app.inject({ method: 'GET', url: `/api/teams/${b.id}/roster` });
    expect(rosterA.json().players).toEqual([]);
    expect(rosterB.json().players.map((p: { id: string }) => p.id)).toEqual([player.id]);

    const memberships = await prisma.teamMembership.findMany({ where: { playerId: player.id }, orderBy: { joinedAt: 'asc' } });
    expect(memberships.map((m) => [m.teamId, m.leftAt === null])).toEqual([
      [a.id, false],
      [b.id, true],
    ]);
  });

  it('removes a player from the team with teamId null', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeam(app, cookie, 'Leões');
    const player = await createPlayer(app, cookie, { teamId: a.id });
    await app.inject({ method: 'PUT', url: `/api/players/${player.id}/team`, headers: { cookie }, payload: { teamId: null } });
    const roster = await app.inject({ method: 'GET', url: `/api/teams/${a.id}/roster` });
    expect(roster.json().players).toEqual([]);
  });

  it('lists and searches players for the admin only', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    await createPlayer(app, cookie, { name: 'Ana Souza', phone: '11 98765-4321', teamId: team.id });
    await createPlayer(app, cookie, { name: 'Bruno' });

    expect((await app.inject({ method: 'GET', url: '/api/players' })).statusCode).toBe(401);

    const byName = await app.inject({ method: 'GET', url: '/api/players?search=ana', headers: { cookie } });
    expect(byName.json()).toEqual([
      {
        id: expect.any(String),
        name: 'Ana Souza',
        phone: '+5511987654321',
        whatsappUrl: 'https://wa.me/5511987654321',
        team: { id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null },
      },
    ]);

    const byPhone = await app.inject({ method: 'GET', url: '/api/players?search=98765', headers: { cookie } });
    expect(byPhone.json()).toHaveLength(1);
  });

  it('edits a player name and phone', async () => {
    const cookie = await loginAdmin(app);
    const player = await createPlayer(app, cookie, { name: 'Ana' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/players/${player.id}`,
      headers: { cookie },
      payload: { name: 'Ana Souza', phone: '21 99999-0000' },
    });
    expect(res.json()).toMatchObject({ name: 'Ana Souza', phone: '+5521999990000' });
  });
});
