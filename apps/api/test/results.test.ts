import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  TIED_2_2,
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

async function setup(format: 'single_elimination' | 'double_elimination' | 'round_robin', count: number, options?: Record<string, unknown>) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team), options });
  const playersOf = (teamId: string): TestPlayer[] => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf };
}

describe('result entry', () => {
  it('saves a draft without touching the bracket, then confirms a round robin result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 3);
    const list = await fixtures(app, tournament.id);
    expect(list).toHaveLength(3);
    expect(list.every((f) => f.status === 'pending')).toBe(true);

    const [first] = list;
    const pA = playersOf(first!.teamA.id);
    const pB = playersOf(first!.teamB.id);

    const draft = await saveResult(app, cookie, tournament.id, first!.matchId, 'draft', duelsPayload(pA, pB, A_WINS_3_1.slice(0, 2)));
    expect(draft.statusCode).toBe(200);
    expect(draft.json()).toMatchObject({ status: 'draft', scoreA: null, duels: [{ order: 1 }, { order: 2 }] });
    expect((await fixtures(app, tournament.id))[0]).toMatchObject({ status: 'draft', scoreA: null });

    const final = await saveResult(app, cookie, tournament.id, first!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
    expect(final.json()).toMatchObject({ status: 'completed', scoreA: 3, scoreB: 1 });
    expect(final.json().duels).toHaveLength(5);
    expect((await fixtures(app, tournament.id))[0]).toMatchObject({ status: 'completed', scoreA: 3, scoreB: 1 });
  });

  it('accepts a round robin draw', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duelsPayload(playersOf(f!.teamA.id), playersOf(f!.teamB.id), TIED_2_2));
    expect(res.json()).toMatchObject({ status: 'completed', scoreA: 2, scoreB: 2 });
  });

  it('returns validation issues from the shared rules', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const pA = playersOf(f!.teamA.id);
    const duels = duelsPayload(pA, playersOf(f!.teamB.id), A_WINS_3_1);
    duels[1]!.playerAId = pA[0]!.id;
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'INVALID_RESULT', details: [{ code: 'PLAYER_REPEATED', path: 'duels.1.playerAId' }] },
    });
  });

  it('requires login to save', async () => {
    const { tournament } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const res = await app.inject({ method: 'PUT', url: `/api/tournaments/${tournament.id}/fixtures/${f!.matchId}/result`, payload: { mode: 'draft', duels: [] } });
    expect(res.statusCode).toBe(401);
  });

  it('requires the 6th duel in a tied knockout and advances the penalty winner', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    const pA = playersOf(semi1!.teamA.id);
    const pB = playersOf(semi1!.teamB.id);

    const missing = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, TIED_2_2));
    expect(missing.json()).toMatchObject({ error: { code: 'INVALID_RESULT', details: [{ code: 'TIEBREAKER_REQUIRED' }] } });

    const decided = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, [...TIED_2_2, [1, 1, 3, 4]]));
    expect(decided.json()).toMatchObject({ status: 'completed', scoreA: 2, scoreB: 3 });

    await saveResult(app, cookie, tournament.id, semi2!.matchId, 'final', duelsPayload(playersOf(semi2!.teamA.id), playersOf(semi2!.teamB.id), A_WINS_3_1));
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    expect([final.teamA.id, final.teamB.id]).toEqual([semi1!.teamB.id, semi2!.teamA.id]);
  });

  it('lets the winner change while the next match has no result', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    const pA = playersOf(semi1!.teamA.id);
    const pB = playersOf(semi1!.teamB.id);
    await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
    await saveResult(app, cookie, tournament.id, semi2!.matchId, 'final', duelsPayload(playersOf(semi2!.teamA.id), playersOf(semi2!.teamB.id), A_WINS_3_1));
    const swapped = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]]));
    expect(swapped.json()).toMatchObject({ scoreA: 1, scoreB: 3 });
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    expect(final.teamA.id).toBe(semi1!.teamB.id);
  });

  it('blocks editing a knockout result once a later match has a result', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    for (const semi of [semi1!, semi2!]) {
      await saveResult(app, cookie, tournament.id, semi.matchId, 'final', duelsPayload(playersOf(semi.teamA.id), playersOf(semi.teamB.id), A_WINS_3_1));
    }
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    await saveResult(app, cookie, tournament.id, final.matchId, 'final', duelsPayload(playersOf(final.teamA.id), playersOf(final.teamB.id), A_WINS_3_1));

    const res = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(playersOf(semi1!.teamA.id), playersOf(semi1!.teamB.id), [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]]));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'RESULT_LOCKED', details: { blockingMatchIds: [final.matchId] } } });
  });

  it('refuses a draft over a completed result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const duels = duelsPayload(playersOf(f!.teamA.id), playersOf(f!.teamB.id), A_WINS_3_1);
    await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'draft', duels);
    expect(res.json()).toMatchObject({ error: { code: 'FIXTURE_ALREADY_COMPLETED' } });
  });

  it('sends the loser of a winners bracket match to the losers bracket', async () => {
    const { cookie, tournament, playersOf } = await setup('double_elimination', 4);
    const wbRound1 = (await fixtures(app, tournament.id)).filter((f) => f.groupNumber === 1 && f.roundNumber === 1);
    for (const f of wbRound1) {
      await saveResult(app, cookie, tournament.id, f.matchId, 'final', duelsPayload(playersOf(f.teamA.id), playersOf(f.teamB.id), A_WINS_3_1));
    }
    const lb = (await fixtures(app, tournament.id)).find((f) => f.groupNumber === 2)!;
    expect([lb.teamA.id, lb.teamB.id].sort()).toEqual(wbRound1.map((f) => f.teamB.id).sort());
  });

  it('shows rosters only to the admin in the fixture detail', async () => {
    const { cookie, tournament } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const url = `/api/tournaments/${tournament.id}/fixtures/${f!.matchId}`;
    const anon = (await app.inject({ method: 'GET', url })).json();
    expect(anon).not.toHaveProperty('rosterA');
    const admin = (await app.inject({ method: 'GET', url, headers: { cookie } })).json();
    expect(admin.rosterA).toHaveLength(6);
    expect(admin.rosterA[0]).toEqual({ id: expect.any(String), name: expect.any(String) });
  });

  it('serializes concurrent saves in the same tournament without losing bracket updates', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 4);
    const list = await fixtures(app, tournament.id);
    const responses = await Promise.all(
      list.slice(0, 3).map((f) => saveResult(app, cookie, tournament.id, f.matchId, 'final', duelsPayload(playersOf(f.teamA.id), playersOf(f.teamB.id), A_WINS_3_1))),
    );
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    const after = await fixtures(app, tournament.id);
    expect(after.filter((f) => f.scoreA === 3)).toHaveLength(3);
  });

  it('still accepts a transferred player when editing an old result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const pA = playersOf(f!.teamA.id);
    const duels = duelsPayload(pA, playersOf(f!.teamB.id), A_WINS_3_1);
    await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);

    await app.inject({ method: 'PUT', url: `/api/players/${pA[0]!.id}/team`, headers: { cookie }, payload: { teamId: null } });
    duels[0]!.goalsA = 4;
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    expect(res.statusCode).toBe(200);
    expect(await prisma.duel.findFirst({ where: { order: 1 } })).toMatchObject({ goalsA: 4, playerAId: pA[0]!.id });
  });
});
