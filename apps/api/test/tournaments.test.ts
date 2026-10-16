import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createStartedTournament, createTeam, createTestApp, loginAdmin, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function teams(cookie: string, n: number) {
  const list = [];
  for (let i = 1; i <= n; i++) list.push(await createTeam(app, cookie, `Time ${i}`));
  return list;
}

describe('tournaments', () => {
  it('creates a draft with default options and lists it', async () => {
    const cookie = await loginAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie },
      payload: { name: 'Copa', format: 'round_robin' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'Copa',
      format: 'round_robin',
      status: 'draft',
      options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
      entries: [],
    });

    const list = await app.inject({ method: 'GET', url: '/api/tournaments?status=draft' });
    expect(list.json()).toEqual([expect.objectContaining({ name: 'Copa', teamCount: 0, status: 'draft' })]);
  });

  it('sets entries in seed order and rejects unknown teams', async () => {
    const cookie = await loginAdmin(app);
    const [a, b] = await teams(cookie, 2);
    const { id } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'C', format: 'single_elimination' } })).json();

    const res = await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: [b!.id, a!.id] } });
    expect(res.json().entries.map((e: { seed: number; team: { id: string } }) => [e.seed, e.team.id])).toEqual([
      [1, b!.id],
      [2, a!.id],
    ]);

    const bad = await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: ['nope'] } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'UNKNOWN_TEAM' } });
  });

  it('starts each format and exposes the bracket', async () => {
    const cookie = await loginAdmin(app);
    const list = await teams(cookie, 5);

    const se = await createStartedTournament(app, cookie, { format: 'single_elimination', teams: list });
    expect(se.status).toBe('in_progress');
    const bracket = (await app.inject({ method: 'GET', url: `/api/tournaments/${se.id}/bracket` })).json();
    expect(bracket.data.stage[0]).toMatchObject({ type: 'single_elimination', settings: expect.objectContaining({ size: 8 }) });
    expect(bracket.data.participant.map((p: { name: string }) => p.name)).toEqual(list.map((t) => t.name));

    const de = await createStartedTournament(app, cookie, { format: 'double_elimination', teams: list.slice(0, 3), name: 'D' });
    expect(de.status).toBe('in_progress');

    const rr = await createStartedTournament(app, cookie, { format: 'round_robin', teams: list.slice(0, 4), name: 'L' });
    const rrBracket = (await app.inject({ method: 'GET', url: `/api/tournaments/${rr.id}/bracket` })).json();
    expect(rrBracket.data.match).toHaveLength(6);
  });

  it('refuses to start twice, with too few teams, or to change format after start', async () => {
    const cookie = await loginAdmin(app);
    const [a, b, c] = await teams(cookie, 3);

    const { id: lonely } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'S', format: 'double_elimination' } })).json();
    await app.inject({ method: 'PUT', url: `/api/tournaments/${lonely}/entries`, headers: { cookie }, payload: { teamIds: [a!.id, b!.id] } });
    const few = await app.inject({ method: 'POST', url: `/api/tournaments/${lonely}/start`, headers: { cookie } });
    expect(few.statusCode).toBe(409);
    expect(few.json()).toMatchObject({ error: { code: 'NOT_ENOUGH_TEAMS', message: 'São necessários pelo menos 3 times.' } });

    const t = await createStartedTournament(app, cookie, { format: 'round_robin', teams: [a!, b!, c!] });
    const again = await app.inject({ method: 'POST', url: `/api/tournaments/${t.id}/start`, headers: { cookie } });
    expect(again.json()).toMatchObject({ error: { code: 'TOURNAMENT_ALREADY_STARTED' } });

    const locked = await app.inject({ method: 'PATCH', url: `/api/tournaments/${t.id}`, headers: { cookie }, payload: { format: 'single_elimination' } });
    expect(locked.json()).toMatchObject({ error: { code: 'TOURNAMENT_LOCKED' } });

    const rename = await app.inject({ method: 'PATCH', url: `/api/tournaments/${t.id}`, headers: { cookie }, payload: { name: 'Novo nome' } });
    expect(rename.json()).toMatchObject({ name: 'Novo nome' });

    const entries = await app.inject({ method: 'PUT', url: `/api/tournaments/${t.id}/entries`, headers: { cookie }, payload: { teamIds: [a!.id] } });
    expect(entries.json()).toMatchObject({ error: { code: 'TOURNAMENT_LOCKED' } });
  });

  it('starts only once under concurrent requests', async () => {
    const cookie = await loginAdmin(app);
    const list = await teams(cookie, 4);
    const { id } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'C', format: 'single_elimination' } })).json();
    await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: list.map((t) => t.id) } });

    const responses = await Promise.all([1, 2, 3].map(() => app.inject({ method: 'POST', url: `/api/tournaments/${id}/start`, headers: { cookie } })));
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
    const bracket = (await app.inject({ method: 'GET', url: `/api/tournaments/${id}/bracket` })).json();
    expect(bracket.data.stage).toHaveLength(1);
  });

  it('returns 404 for unknown tournaments', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tournaments/nao-existe' });
    expect(res.statusCode).toBe(404);
  });
});
