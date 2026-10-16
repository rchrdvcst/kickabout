import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  createStartedTournament,
  createTeam,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function playAll(cookie: string, tournamentId: string, playersOf: (id: string) => TestPlayer[]) {
  for (let i = 0; i < 20; i++) {
    const pending = (await fixtures(app, tournamentId)).find((f) => f.status === 'pending');
    if (!pending) return;
    const res = await saveResult(app, cookie, tournamentId, pending.matchId, 'final', duelsPayload(playersOf(pending.teamA.id), playersOf(pending.teamB.id), A_WINS_3_1));
    if (res.statusCode !== 200) throw new Error(res.body);
  }
}

async function setup(format: 'single_elimination' | 'double_elimination' | 'round_robin', count: number, options?: Record<string, unknown>) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team), options, name: 'Copa 2026' });
  const playersOf = (teamId: string) => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf, squads };
}

const finish = (cookie: string, id: string) => app.inject({ method: 'POST', url: `/api/tournaments/${id}/finish`, headers: { cookie } });

describe('standings, stats and finish', () => {
  it('computes round robin standings and leaderboard, then finishes with a podium', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 3);

    const early = await finish(cookie, tournament.id);
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_COMPLETE' } });

    await playAll(cookie, tournament.id, playersOf);

    const standings = (await app.inject({ method: 'GET', url: `/api/tournaments/${tournament.id}/standings` })).json();
    expect(standings).toHaveLength(3);
    expect(standings[0]).toMatchObject({ position: 1, played: 2, team: { name: expect.any(String) } });

    const stats = (await app.inject({ method: 'GET', url: `/api/tournaments/${tournament.id}/stats` })).json();
    expect(stats[0]).toMatchObject({ player: { name: expect.any(String) }, team: { name: expect.any(String) } });
    expect(stats[0].goalsFor).toBeGreaterThanOrEqual(stats[1].goalsFor);

    const done = await finish(cookie, tournament.id);
    expect(done.json()).toMatchObject({ status: 'finished' });

    const titles = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titles.titles.map((t: { position: number; team: { id: string } }) => [t.position, t.team.id])).toEqual(
      standings.map((row: { position: number; team: { id: string } }) => [row.position, row.team.id]),
    );
    expect(titles.ranking[0]).toMatchObject({ team: { id: standings[0].team.id }, champion: 1, runnerUp: 0, third: 0 });

    const again = await finish(cookie, tournament.id);
    expect(again.json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_IN_PROGRESS' } });
  });

  it('awards third place only with a consolation final', async () => {
    const withThird = await setup('single_elimination', 4, { consolationFinal: true });
    await playAll(withThird.cookie, withThird.tournament.id, withThird.playersOf);
    await finish(withThird.cookie, withThird.tournament.id);
    const titlesWith = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titlesWith.titles.map((t: { position: number }) => t.position).sort()).toEqual([1, 2, 3]);

    await resetDb();
    const without = await setup('single_elimination', 4);
    await playAll(without.cookie, without.tournament.id, without.playersOf);
    await finish(without.cookie, without.tournament.id);
    const titlesWithout = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titlesWithout.titles.map((t: { position: number }) => t.position).sort()).toEqual([1, 2]);
  });

  it('finishes non power-of-two brackets with byes', async () => {
    for (const format of ['single_elimination', 'double_elimination'] as const) {
      await resetDb();
      const { cookie, tournament, playersOf } = await setup(format, 3);
      await playAll(cookie, tournament.id, playersOf);
      const res = await finish(cookie, tournament.id);
      expect(res.json()).toMatchObject({ status: 'finished' });
      const titles = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
      expect(titles.titles.some((t: { position: number }) => t.position === 1)).toBe(true);
    }
  });
});

describe('historical titles', () => {
  it('creates and deletes manual titles but protects tournament titles', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const created = await app.inject({
      method: 'POST',
      url: '/api/titles',
      headers: { cookie },
      payload: { teamId: team.id, tournamentName: 'Copa 2024', position: 1, year: 2024 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ tournamentId: null, tournamentName: 'Copa 2024', team: { id: team.id } });

    const del = await app.inject({ method: 'DELETE', url: `/api/titles/${created.json().id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);

    const { cookie: c2, tournament, playersOf } = await setup('round_robin', 2);
    await playAll(c2, tournament.id, playersOf);
    await finish(c2, tournament.id);
    const [fromTournament] = (await app.inject({ method: 'GET', url: '/api/titles' })).json().titles;
    const blocked = await app.inject({ method: 'DELETE', url: `/api/titles/${fromTournament.id}`, headers: { cookie: c2 } });
    expect(blocked.json()).toMatchObject({ error: { code: 'TITLE_FROM_TOURNAMENT' } });
  });
});
