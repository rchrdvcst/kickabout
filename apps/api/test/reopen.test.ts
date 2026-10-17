import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  B_WINS_3_1,
  createStartedTournament,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
  type TestFixture,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

type Format = 'single_elimination' | 'double_elimination' | 'round_robin';

async function setup(format: Format, count: number) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team) });
  const playersOf = (teamId: string): TestPlayer[] => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function confirm(ctx: Ctx, f: TestFixture, scores = A_WINS_3_1) {
  const res = await saveResult(app, ctx.cookie, ctx.tournament.id, f.matchId, 'final', duelsPayload(ctx.playersOf(f.teamA.id), ctx.playersOf(f.teamB.id), scores));
  expect(res.statusCode).toBe(200);
}

const reopen = (ctx: Ctx, matchId: number) =>
  app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/fixtures/${matchId}/reopen`, headers: { cookie: ctx.cookie } });

describe('reopen result', () => {
  it('turns a confirmed result back into a draft, keeping the duels', async () => {
    const ctx = await setup('round_robin', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    await confirm(ctx, f!);
    const res = await reopen(ctx, f!.matchId);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'draft', scoreA: null, scoreB: null });
    expect(res.json().duels).toHaveLength(5);
    const standings = (await app.inject({ method: 'GET', url: `/api/tournaments/${ctx.tournament.id}/standings` })).json();
    expect(standings.every((row: { played: number }) => row.played === 0)).toBe(true);
  });

  it('unlocks the previous round of a knockout once the later result is reopened', async () => {
    const ctx = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, ctx.tournament.id);
    await confirm(ctx, semi1!);
    await confirm(ctx, semi2!);
    const final = (await fixtures(app, ctx.tournament.id)).find((f) => f.roundNumber === 2)!;
    await confirm(ctx, final);

    const blocked = await reopen(ctx, semi1!.matchId);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: { code: 'RESULT_LOCKED', details: { blockingMatchIds: [final.matchId] } } });
    expect(blocked.json().error.message).toContain('Reabra-os primeiro.');

    expect((await reopen(ctx, final.matchId)).statusCode).toBe(200);
    expect((await reopen(ctx, semi1!.matchId)).statusCode).toBe(200);

    // Novo resultado da semifinal: o outro time vai à final e o rascunho antigo da final some.
    await confirm(ctx, semi1!, B_WINS_3_1);
    const updatedFinal = (await fixtures(app, ctx.tournament.id)).find((f) => f.roundNumber === 2)!;
    expect(updatedFinal.teamA.id).toBe(semi1!.teamB.id);
    expect(updatedFinal.status).toBe('pending');
  });

  it('blocks a double elimination match whose loser already played in the losers bracket', async () => {
    const ctx = await setup('double_elimination', 4);
    const wbRound1 = (await fixtures(app, ctx.tournament.id)).filter((f) => f.groupNumber === 1 && f.roundNumber === 1);
    for (const f of wbRound1) await confirm(ctx, f);
    const lb = (await fixtures(app, ctx.tournament.id)).find((f) => f.groupNumber === 2)!;
    await confirm(ctx, lb);
    const res = await reopen(ctx, wbRound1[0]!.matchId);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.blockingMatchIds).toContain(lb.matchId);
  });

  it('refuses fixtures without a confirmed result and finished tournaments', async () => {
    const ctx = await setup('single_elimination', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    expect((await reopen(ctx, f!.matchId)).json()).toMatchObject({ error: { code: 'FIXTURE_NOT_COMPLETED' } });
    await confirm(ctx, f!);
    await app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/finish`, headers: { cookie: ctx.cookie } });
    expect((await reopen(ctx, f!.matchId)).json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_IN_PROGRESS' } });
  });

  it('requires login', async () => {
    const ctx = await setup('round_robin', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    const res = await app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/fixtures/${f!.matchId}/reopen` });
    expect(res.statusCode).toBe(401);
  });
});
