import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  createStartedTournament,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function playedFinal(targetApp = app) {
  const cookie = await loginAdmin(targetApp);
  const home = await createTeamWithPlayers(targetApp, cookie, 'Leões');
  const away = await createTeamWithPlayers(targetApp, cookie, 'Tigres');
  const tournament = await createStartedTournament(targetApp, cookie, { format: 'single_elimination', teams: [home.team, away.team], name: 'Copa 2026' });
  const [final] = await fixtures(targetApp, tournament.id);
  const [pA, pB] = final!.teamA.id === home.team.id ? [home.players, away.players] : [away.players, home.players];
  await saveResult(targetApp, cookie, tournament.id, final!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
  await targetApp.inject({ method: 'POST', url: `/api/tournaments/${tournament.id}/finish`, headers: { cookie } });
  const winner = final!.teamA.id === home.team.id ? home : away;
  const loser = winner === home ? away : home;
  return { cookie, tournament, winner, loser, final: final! };
}

describe('public pages', () => {
  it('shows a team page with roster, stats, titles and recent fixtures', async () => {
    const { winner } = await playedFinal();
    const res = await app.inject({ method: 'GET', url: `/api/teams/${winner.team.id}` });
    const body = res.json();
    expect(body.team).toMatchObject({ id: winner.team.id, name: winner.team.name });
    expect(body.roster).toHaveLength(6);
    expect(body.roster[0]).toHaveProperty('whatsappUrl');
    expect(body.stats).toMatchObject({ fixtures: { played: 1, wins: 1 }, duels: { played: 5, wins: 3, draws: 1, losses: 1 }, goalsFor: 7, goalsAgainst: 3 });
    expect(body.titles).toEqual([expect.objectContaining({ position: 1, tournamentName: 'Copa 2026' })]);
    expect(body.recentFixtures).toEqual([expect.objectContaining({ tournamentName: 'Copa 2026', scoreA: 3, scoreB: 1 })]);
    expect(body.tournaments).toEqual([expect.objectContaining({ name: 'Copa 2026', status: 'finished' })]);
  });

  it('shows a player page with stats, duel history and titles, without the phone', async () => {
    const { winner, loser } = await playedFinal();
    const scorer = winner.players[0]!;
    const res = await app.inject({ method: 'GET', url: `/api/players/${scorer.id}` });
    const body = res.json();
    expect(body.player).toEqual({ id: scorer.id, name: scorer.name });
    expect(body.currentTeam).toMatchObject({ id: winner.team.id });
    expect(body.teamHistory).toEqual([expect.objectContaining({ team: expect.objectContaining({ id: winner.team.id }), leftAt: null })]);
    expect(body.stats).toMatchObject({ playerId: scorer.id, duels: 1, wins: 1, goalsFor: 2, goalsAgainst: 0 });
    expect(body.duels).toEqual([
      expect.objectContaining({ order: 1, result: 'win', goalsFor: 2, goalsAgainst: 0, opponent: { id: loser.players[0]!.id, name: loser.players[0]!.name } }),
    ]);
    expect(body.titles).toEqual([expect.objectContaining({ position: 1, team: expect.objectContaining({ id: winner.team.id }) })]);
    expect(res.body).not.toContain('+55');
  });

  it('returns zero stats for a player who never played', async () => {
    const cookie = await loginAdmin(app);
    const { players } = await createTeamWithPlayers(app, cookie, 'Leões', 1);
    const body = (await app.inject({ method: 'GET', url: `/api/players/${players[0]!.id}` })).json();
    expect(body.stats).toMatchObject({ duels: 0, wins: 0, winRate: 0 });
    expect(body.duels).toEqual([]);
  });

  it('lists recent completed fixtures', async () => {
    await playedFinal();
    const res = await app.inject({ method: 'GET', url: '/api/fixtures/recent?limit=5' });
    expect(res.json()).toEqual([expect.objectContaining({ tournamentName: 'Copa 2026', scoreA: 3, scoreB: 1 })]);
  });

  it('never leaks phones to visitors when PHONE_VISIBILITY=authenticated', async () => {
    const privateApp = createTestApp({ phoneVisibility: 'authenticated' });
    const { tournament, winner, final } = await playedFinal(privateApp);
    const urls = [
      `/api/teams/${winner.team.id}`,
      `/api/teams/${winner.team.id}/roster`,
      `/api/players/${winner.players[0]!.id}`,
      `/api/tournaments/${tournament.id}/fixtures/${final.matchId}`,
      `/api/tournaments/${tournament.id}/stats`,
      '/api/fixtures/recent',
    ];
    for (const url of urls) {
      const res = await privateApp.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).not.toContain('+55');
      expect(res.body, url).not.toContain('wa.me');
    }
    await privateApp.close();
  });
});
