import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  createStartedTournament,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  prisma,
  resetDb,
  saveResult,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const remove = (cookie: string, id: string) => app.inject({ method: 'DELETE', url: `/api/tournaments/${id}`, headers: { cookie } });

async function finishedTournament(cookie: string) {
  const a = await createTeamWithPlayers(app, cookie, 'Leões');
  const b = await createTeamWithPlayers(app, cookie, 'Tigres');
  const playersOf = (id: string): TestPlayer[] => (id === a.team.id ? a.players : b.players);
  const tournament = await createStartedTournament(app, cookie, { format: 'single_elimination', teams: [a.team, b.team], name: 'Copa Velha' });
  const [final] = await fixtures(app, tournament.id);
  await saveResult(app, cookie, tournament.id, final!.matchId, 'final', duelsPayload(playersOf(final!.teamA.id), playersOf(final!.teamB.id), A_WINS_3_1));
  const done = await app.inject({ method: 'POST', url: `/api/tournaments/${tournament.id}/finish`, headers: { cookie } });
  expect(done.json()).toMatchObject({ status: 'finished' });
  return tournament;
}

describe('delete tournament', () => {
  it('deletes a draft and returns 404 afterwards', async () => {
    const cookie = await loginAdmin(app);
    const { id } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'Rascunho', format: 'round_robin' } })).json();

    const res = await remove(cookie, id);
    expect(res.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/tournaments/${id}` })).statusCode).toBe(404);
    expect((await remove(cookie, id)).statusCode).toBe(404);
  });

  it('deletes a tournament in progress with its fixtures and duels', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeamWithPlayers(app, cookie, 'Leões');
    const b = await createTeamWithPlayers(app, cookie, 'Tigres');
    const tournament = await createStartedTournament(app, cookie, { format: 'single_elimination', teams: [a.team, b.team] });
    const [final] = await fixtures(app, tournament.id);
    await saveResult(app, cookie, tournament.id, final!.matchId, 'draft', duelsPayload(a.players, b.players, A_WINS_3_1));
    expect(await prisma.duel.count()).toBe(5);

    expect((await remove(cookie, tournament.id)).statusCode).toBe(204);
    expect(await prisma.tournament.count()).toBe(0);
    expect(await prisma.tournamentEntry.count()).toBe(0);
    expect(await prisma.fixture.count()).toBe(0);
    expect(await prisma.duel.count()).toBe(0);
    expect(await prisma.team.count()).toBe(2);
    expect(await prisma.player.count()).toBe(12);
  });

  it('keeps the titles of a finished tournament, without the link', async () => {
    const cookie = await loginAdmin(app);
    const tournament = await finishedTournament(cookie);

    expect((await remove(cookie, tournament.id)).statusCode).toBe(204);
    const titles = await prisma.title.findMany({ orderBy: { position: 'asc' } });
    expect(titles.map((t) => [t.position, t.tournamentName, t.tournamentId])).toEqual([
      [1, 'Copa Velha', null],
      [2, 'Copa Velha', null],
    ]);
  });

  it('requires an admin', async () => {
    const cookie = await loginAdmin(app);
    const { id } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'X', format: 'round_robin' } })).json();
    const res = await app.inject({ method: 'DELETE', url: `/api/tournaments/${id}` });
    expect(res.statusCode).toBe(401);
    expect(await prisma.tournament.count()).toBe(1);
  });
});
