import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  TIED_2_2,
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

interface CupFixture {
  matchId: number;
  phase: 'groups' | 'knockout';
  isKnockout: boolean;
  groupNumber: number;
  roundNumber: number;
  status: string;
  teamA: { id: string };
  teamB: { id: string };
}

async function draftCup(count: number, options: Record<string, unknown> = {}) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie },
    payload: { name: 'Copa Teste', format: 'cup', options: { groupCount: 2, qualifiersPerGroup: 2, ...options } },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  const entries = await app.inject({
    method: 'PUT',
    url: `/api/tournaments/${id}/entries`,
    headers: { cookie },
    payload: { teamIds: squads.map((squad) => squad.team.id) },
  });
  expect(entries.statusCode).toBe(200);
  const playersOf = (teamId: string): TestPlayer[] => squads.find((squad) => squad.team.id === teamId)!.players;
  const post = (path: string) => app.inject({ method: 'POST', url: `/api/tournaments/${id}${path}`, headers: { cookie } });
  const del = (path: string) => app.inject({ method: 'DELETE', url: `/api/tournaments/${id}${path}`, headers: { cookie } });
  const get = (path = '') => app.inject({ method: 'GET', url: `/api/tournaments/${id}${path}` });
  return { cookie, id, squads, playersOf, post, del, get };
}

type Cup = Awaited<ReturnType<typeof draftCup>>;

async function startedCup(count: number, options: Record<string, unknown> = {}) {
  const cup = await draftCup(count, options);
  expect((await cup.post('/group-draw')).statusCode).toBe(200);
  const started = await cup.post('/start');
  expect(started.statusCode, started.body).toBe(200);
  return cup;
}

const listOf = async (cup: Cup) => (await fixtures(app, cup.id)) as unknown as CupFixture[];

async function confirm(cup: Cup, f: CupFixture, scores: [number, number][] = A_WINS_3_1) {
  const res = await saveResult(app, cup.cookie, cup.id, f.matchId, 'final', duelsPayload(cup.playersOf(f.teamA.id), cup.playersOf(f.teamB.id), scores));
  expect(res.statusCode, res.body).toBe(200);
}

async function playPhase(cup: Cup, phase: 'groups' | 'knockout') {
  for (let i = 0; i < 300; i++) {
    const pending = (await listOf(cup)).filter((f) => f.phase === phase && f.status !== 'completed');
    if (pending.length === 0) return;
    await confirm(cup, pending[0]!);
  }
  throw new Error(`playPhase(${phase}): não terminou`);
}

describe('cup draft', () => {
  it('creates a cup with group options and explains layouts that cannot work', async () => {
    const cup = await draftCup(5, { groupCount: 4, qualifiersPerGroup: 1 });
    expect((await cup.get()).json()).toMatchObject({
      format: 'cup',
      options: { groupCount: 4, qualifiersPerGroup: 1, roundRobinMode: 'simple', consolationFinal: false },
      groupDraw: null,
      knockoutDrawn: false,
      groupsPending: null,
    });
    const draw = await cup.post('/group-draw');
    expect(draw.statusCode).toBe(409);
    expect(draw.json()).toMatchObject({ error: { code: 'CUP_LAYOUT_INVALID', message: 'Com 5 times, dá para ter no máximo 2 grupos.' } });

    const odd = await app.inject({
      method: 'PATCH',
      url: `/api/tournaments/${cup.id}`,
      headers: { cookie: cup.cookie },
      payload: { options: { groupCount: 3 } },
    });
    expect(odd.statusCode).toBe(400);
    expect(JSON.stringify(odd.json())).toContain('O número de grupos precisa ser 2, 4, 8, 16, 32 ou 64.');
  });

  it('draws the groups, draws again, and forgets the draw when the entries or options change', async () => {
    const cup = await draftCup(8);
    const first = await cup.post('/group-draw');
    expect(first.statusCode).toBe(200);
    const groups = first.json().groups as { id: string }[][];
    expect(groups.map((group) => group.length)).toEqual([4, 4]);
    expect(groups.flat().map((team) => team.id).sort()).toEqual(cup.squads.map((squad) => squad.team.id).sort());
    expect((await cup.get()).json().groupDraw).toEqual(groups);

    expect((await cup.post('/group-draw')).statusCode).toBe(200);

    await app.inject({
      method: 'PATCH',
      url: `/api/tournaments/${cup.id}`,
      headers: { cookie: cup.cookie },
      payload: { options: { qualifiersPerGroup: 1 } },
    });
    expect((await cup.get()).json().groupDraw).toBeNull();

    await cup.post('/group-draw');
    await app.inject({
      method: 'PUT',
      url: `/api/tournaments/${cup.id}/entries`,
      headers: { cookie: cup.cookie },
      payload: { teamIds: cup.squads.slice(0, 7).map((squad) => squad.team.id) },
    });
    expect((await cup.get()).json().groupDraw).toBeNull();
    const start = await cup.post('/start');
    expect(start.statusCode).toBe(409);
    expect(start.json()).toMatchObject({ error: { code: 'GROUP_DRAW_REQUIRED', message: 'Sorteie os grupos antes de iniciar.' } });
  });

  it('only draws groups for a cup in draft', async () => {
    const cookie = await loginAdmin(app);
    const created = await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'Liga', format: 'round_robin' } });
    const res = await app.inject({ method: 'POST', url: `/api/tournaments/${created.json().id}/group-draw`, headers: { cookie } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_A_CUP' } });
  });
});

describe('cup group stage', () => {
  it('starts with exactly the drawn groups, allows draws, and ranks each group', async () => {
    const cup = await draftCup(8);
    const groups = (await cup.post('/group-draw')).json().groups as { id: string }[][];
    expect((await cup.post('/start')).statusCode).toBe(200);

    const list = await listOf(cup);
    expect(list).toHaveLength(12);
    const groupOf = new Map(groups.flatMap((group, index) => group.map((team) => [team.id, index + 1] as const)));
    for (const f of list) {
      expect(f).toMatchObject({ phase: 'groups', isKnockout: false });
      expect(groupOf.get(f.teamA.id)).toBe(groupOf.get(f.teamB.id));
      expect(f.groupNumber).toBe(groupOf.get(f.teamA.id));
    }

    await confirm(cup, list[0]!, TIED_2_2);
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; played: number; team: { id: string } }[];
    expect(standings.map((row) => row.groupNumber)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    for (const row of standings) expect(groupOf.get(row.team.id)).toBe(row.groupNumber);
    expect(standings.filter((row) => row.qualified)).toHaveLength(4);
    expect((await cup.get()).json()).toMatchObject({ status: 'in_progress', groupsPending: 11, knockoutDrawn: false, groupDraw: null });
  });

  it('plays a double round robin in the groups when asked', async () => {
    const cup = await startedCup(6, { groupCount: 2, qualifiersPerGroup: 1, roundRobinMode: 'double' });
    expect(await listOf(cup)).toHaveLength(12);
  });

  it('keeps the standings of plain round robin tournaments with groupNumber 1', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeamWithPlayers(app, cookie, 'Liga A');
    const b = await createTeamWithPlayers(app, cookie, 'Liga B');
    const created = await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'Liga', format: 'round_robin' } });
    const id = created.json().id;
    await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: [a.team.id, b.team.id] } });
    await app.inject({ method: 'POST', url: `/api/tournaments/${id}/start`, headers: { cookie } });
    const rows = (await app.inject({ method: 'GET', url: `/api/tournaments/${id}/standings` })).json();
    expect(rows.map((row: { groupNumber: number }) => row.groupNumber)).toEqual([1, 1]);
    expect(rows[0].qualified).toBeUndefined();
  });
});
describe('cup knockout', () => {
  it('waits for the groups, never pairs teams of the same group, locks the groups, redraws and undoes', async () => {
    const cup = await startedCup(8);
    const early = await cup.post('/knockout-draw');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'GROUPS_PENDING', message: 'Faltam 12 jogos dos grupos.' } });

    await playPhase(cup, 'groups');
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; team: { id: string } }[];
    const groupOf = new Map(standings.map((row) => [row.team.id, row.groupNumber]));
    const qualified = new Set(standings.filter((row) => row.qualified).map((row) => row.team.id));

    const drawn = await cup.post('/knockout-draw');
    expect(drawn.statusCode, drawn.body).toBe(200);
    expect(drawn.json()).toMatchObject({ knockoutDrawn: true, groupsPending: 0 });
    const semis = (await listOf(cup)).filter((f) => f.phase === 'knockout');
    expect(semis).toHaveLength(2);
    for (const f of semis) {
      expect(f.isKnockout).toBe(true);
      expect(qualified.has(f.teamA.id) && qualified.has(f.teamB.id)).toBe(true);
      expect(groupOf.get(f.teamA.id)).not.toBe(groupOf.get(f.teamB.id));
    }

    const group = (await listOf(cup)).find((f) => f.phase === 'groups')!;
    const edit = await saveResult(app, cup.cookie, cup.id, group.matchId, 'final', duelsPayload(cup.playersOf(group.teamA.id), cup.playersOf(group.teamB.id), TIED_2_2));
    expect(edit.statusCode).toBe(409);
    expect(edit.json()).toMatchObject({ error: { code: 'GROUPS_LOCKED', message: 'Desfaça o sorteio do mata-mata para corrigir jogos dos grupos.' } });
    expect((await cup.post(`/fixtures/${group.matchId}/reopen`)).json()).toMatchObject({ error: { code: 'GROUPS_LOCKED' } });

    expect((await cup.post('/knockout-draw')).statusCode).toBe(200);
    const undone = await cup.del('/knockout-draw');
    expect(undone.statusCode).toBe(200);
    expect(undone.json()).toMatchObject({ knockoutDrawn: false });
    expect((await listOf(cup)).some((f) => f.phase === 'knockout')).toBe(false);
    expect((await cup.post(`/fixtures/${group.matchId}/reopen`)).statusCode).toBe(200);
  });

  it('cannot redraw or undo once the knockout has a result, even a reopened draft', async () => {
    const cup = await startedCup(8);
    await playPhase(cup, 'groups');
    await cup.post('/knockout-draw');
    const semi = (await listOf(cup)).find((f) => f.phase === 'knockout')!;
    await confirm(cup, semi);
    const again = await cup.post('/knockout-draw');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({
      error: { code: 'KNOCKOUT_STARTED', message: 'Já há resultado lançado no mata-mata; não dá para sortear de novo nem desfazer.' },
    });
    expect((await cup.post(`/fixtures/${semi.matchId}/reopen`)).statusCode).toBe(200);
    expect((await cup.post('/knockout-draw')).json()).toMatchObject({ error: { code: 'KNOCKOUT_STARTED' } });
    expect((await cup.del('/knockout-draw')).json()).toMatchObject({ error: { code: 'KNOCKOUT_STARTED' } });
  });

  it('ranks uneven groups and fills the knockout with byes', async () => {
    const cup = await startedCup(9, { groupCount: 2, qualifiersPerGroup: 3 });
    const sizes = (await cup.get('/standings')).json().reduce((acc: Record<number, number>, row: { groupNumber: number }) => {
      acc[row.groupNumber] = (acc[row.groupNumber] ?? 0) + 1;
      return acc;
    }, {});
    expect(sizes).toEqual({ 1: 5, 2: 4 });
    await playPhase(cup, 'groups');
    expect((await cup.post('/knockout-draw')).statusCode).toBe(200);
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; team: { id: string } }[];
    expect(standings.filter((row) => row.qualified)).toHaveLength(6);
    const groupOf = new Map(standings.map((row) => [row.team.id, row.groupNumber]));
    const firstRound = (await listOf(cup)).filter((f) => f.phase === 'knockout' && f.roundNumber === 1);
    expect(firstRound).toHaveLength(2); // 8 posições, 2 BYEs: 2 jogos na 1ª rodada (os BYEs não aparecem)
    for (const f of firstRound) expect(groupOf.get(f.teamA.id)).not.toBe(groupOf.get(f.teamB.id));
  });

  it('finishes from the knockout and gives the titles', async () => {
    const cup = await startedCup(8);
    await playPhase(cup, 'groups');
    const early = await cup.post('/finish');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'KNOCKOUT_NOT_DRAWN', message: 'Sorteie o mata-mata antes de encerrar.' } });
    await cup.post('/knockout-draw');
    await playPhase(cup, 'knockout');
    expect((await cup.post('/finish')).statusCode).toBe(200);
    const titles = await prisma.title.findMany({ where: { tournamentId: cup.id }, orderBy: { position: 'asc' } });
    expect(titles.map((title) => title.position)).toEqual([1, 2]);
  });

  it('with two qualifiers the knockout is just the final, even with the 3rd place option', async () => {
    const cup = await startedCup(4, { groupCount: 2, qualifiersPerGroup: 1, consolationFinal: true });
    await playPhase(cup, 'groups');
    await cup.post('/knockout-draw');
    expect((await listOf(cup)).filter((f) => f.phase === 'knockout')).toHaveLength(1);
    await playPhase(cup, 'knockout');
    expect((await cup.post('/finish')).statusCode).toBe(200);
    expect(await prisma.title.count({ where: { tournamentId: cup.id } })).toBe(2);
  });
});
