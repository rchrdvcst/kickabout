import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { Db } from '../db';
import type { AppDeps } from '../deps';
import { idParams, teamRef, teamRefSelect, teamsById } from '../dto';
import { AppError, notFound, parse } from '../errors';
import { aggregatePlayerStats, computeStandings, cupProblem, drawGroups, drawKnockout } from '@kickabout/shared';
import { completedFixtures, toDuelInput, toFixtureRecord } from '../stats/queries';
import { lockTournament, managerFor, withBracket, type BracketData } from './bracket-store';
import { isStageComplete, teamIdByParticipant } from './bracket-view';
import { assertKnockoutUntouched, cupStandings, groupsPending, groupsPendingError, knockoutStageOf } from './cup';
import { eliminationPodium, roundRobinPodium, type PodiumEntry } from './podium';
import { normalizeOptions, optionsSchema, type TournamentOptions } from './options';
import { MIN_TEAMS, cupGroupStageInput, cupKnockoutStageInput, stageInput } from './stage';

const formatSchema = z.enum(['single_elimination', 'double_elimination', 'round_robin', 'cup']);
const createBody = z.object({ name: z.string().trim().min(1).max(80), format: formatSchema, options: optionsSchema.optional() });
const updateBody = createBody.partial();
const entriesBody = z.object({
  teamIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, 'Times repetidos.'),
});
const listQuery = z.object({ status: z.enum(['draft', 'in_progress', 'finished']).optional() });

export const tournamentInclude = {
  entries: { orderBy: { seed: 'asc' }, include: { team: { select: teamRefSelect } } },
} satisfies Prisma.TournamentInclude;

export type TournamentWithEntries = Prisma.TournamentGetPayload<{ include: typeof tournamentInclude }>;

export async function loadTournament(db: Db, id: string): Promise<TournamentWithEntries> {
  const tournament = await db.tournament.findUnique({ where: { id }, include: tournamentInclude });
  if (!tournament) throw notFound('Campeonato');
  return tournament;
}

/** Prévia do sorteio como times; null se não houver ou se não bater mais com a inscrição. */
function groupDrawDto(t: TournamentWithEntries) {
  const draw = t.groupDraw as string[][] | null;
  if (!draw) return null;
  const teams = new Map(t.entries.map((entry) => [entry.team.id, teamRef(entry.team)]));
  if (!draw.flat().every((teamId) => teams.has(teamId))) return null;
  return draw.map((group) => group.map((teamId) => teams.get(teamId)!));
}

export function tournamentDto(t: TournamentWithEntries) {
  return {
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    options: t.options as unknown as TournamentOptions,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
    entries: t.entries.map((entry) => ({ seed: entry.seed, team: teamRef(entry.team) })),
    ...(t.format === 'cup'
      ? {
          groupDraw: groupDrawDto(t),
          knockoutDrawn: knockoutStageOf(t.bracket as unknown as BracketData | null) !== null,
          groupsPending: t.bracket ? groupsPending(t.bracket as unknown as BracketData) : null,
        }
      : {}),
  };
}

const lockedError = (message: string) => new AppError(409, 'TOURNAMENT_LOCKED', message);

async function cupInProgress(tx: Prisma.TransactionClient, id: string) {
  await lockTournament(tx, id);
  const t = await loadTournament(tx, id);
  if (t.format !== 'cup') throw new AppError(409, 'NOT_A_CUP', 'Este campeonato não é uma copa.');
  if (t.status !== 'in_progress') throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
  return t;
}

export function registerTournamentRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/tournaments', async (request) => {
    const { status } = parse(listQuery, request.query);
    const tournaments = await prisma.tournament.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { entries: true } } },
    });
    return tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      status: t.status,
      teamCount: t._count.entries,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
    }));
  });

  app.get('/tournaments/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.post('/tournaments', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(createBody, request.body);
    const created = await prisma.tournament.create({
      data: {
        name: body.name,
        format: body.format,
        options: normalizeOptions(body.options) as unknown as Prisma.InputJsonValue,
        ownerId: request.user!.id,
      },
    });
    return reply.status(201).send(tournamentDto(await loadTournament(prisma, created.id)));
  });

  app.patch('/tournaments/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(updateBody, request.body);
    const current = await loadTournament(prisma, id);
    if (current.status !== 'draft' && (body.format !== undefined || body.options !== undefined)) {
      throw lockedError('Formato e opções só podem ser alterados antes do início.');
    }
    await prisma.tournament.update({
      where: { id },
      data: {
        name: body.name,
        format: body.format,
        options:
          body.options === undefined
            ? undefined
            : (normalizeOptions({ ...(current.options as unknown as TournamentOptions), ...body.options }) as unknown as Prisma.InputJsonValue),
        groupDraw: body.format !== undefined || body.options !== undefined ? Prisma.DbNull : undefined,
      },
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.put('/tournaments/:id/entries', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { teamIds } = parse(entriesBody, request.body);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const current = await loadTournament(tx, id);
      if (current.status !== 'draft') throw lockedError('As inscrições só podem ser alteradas antes do início.');
      const found = await tx.team.count({ where: { id: { in: teamIds } } });
      if (found !== teamIds.length) throw new AppError(400, 'UNKNOWN_TEAM', 'Algum time informado não existe.');
      await tx.tournamentEntry.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentEntry.createMany({ data: teamIds.map((teamId, index) => ({ tournamentId: id, teamId, seed: index + 1 })) });
      await tx.tournament.update({ where: { id }, data: { groupDraw: Prisma.DbNull } });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.post('/tournaments/:id/group-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const t = await loadTournament(tx, id);
      if (t.format !== 'cup') throw new AppError(409, 'NOT_A_CUP', 'Este campeonato não é uma copa.');
      if (t.status !== 'draft') throw lockedError('O sorteio dos grupos só pode ser feito antes do início.');
      const options = t.options as unknown as TournamentOptions;
      const problem = cupProblem(t.entries.length, options.groupCount, options.qualifiersPerGroup);
      if (problem) throw new AppError(409, 'CUP_LAYOUT_INVALID', problem);
      const draw = drawGroups(
        t.entries.map((entry) => entry.team.id),
        options.groupCount,
        Math.random,
      );
      await tx.tournament.update({ where: { id }, data: { groupDraw: draw } });
    });
    return { groups: groupDrawDto(await loadTournament(prisma, id)) };
  });

  app.post('/tournaments/:id/start', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const t = await loadTournament(tx, id);
      if (t.status !== 'draft') throw new AppError(409, 'TOURNAMENT_ALREADY_STARTED', 'O campeonato já foi iniciado.');
      const min = MIN_TEAMS[t.format];
      if (t.entries.length < min) throw new AppError(409, 'NOT_ENOUGH_TEAMS', `São necessários pelo menos ${min} times.`);
      if (t.format === 'cup') {
        const options = t.options as unknown as TournamentOptions;
        const problem = cupProblem(t.entries.length, options.groupCount, options.qualifiersPerGroup);
        if (problem) throw new AppError(409, 'CUP_LAYOUT_INVALID', problem);
        const draw = t.groupDraw as string[][] | null;
        const entered = new Set(t.entries.map((entry) => entry.team.id));
        const drawn = draw?.flat() ?? [];
        if (!draw || draw.length !== options.groupCount || drawn.length !== entered.size || !drawn.every((teamId) => entered.has(teamId))) {
          throw new AppError(409, 'GROUP_DRAW_REQUIRED', 'Sorteie os grupos antes de iniciar.');
        }
        // O seed passa a ser a ordem do sorteio (último critério de desempate). Recria as inscrições de uma vez por
        // causa da chave única (tournamentId, seed).
        await tx.tournamentEntry.deleteMany({ where: { tournamentId: id } });
        await tx.tournamentEntry.createMany({ data: drawn.map((teamId, index) => ({ tournamentId: id, teamId, seed: index + 1 })) });
        const names = new Map(t.entries.map((entry) => [entry.team.id, entry.team.name]));
        await withBracket(tx, id, (manager) =>
          manager.create.stage(
            cupGroupStageInput(
              { id, name: t.name, options },
              draw.map((group) => group.map((teamId) => ({ name: names.get(teamId)!, teamId }))),
            ),
          ),
        );
        await tx.tournament.update({ where: { id }, data: { groupDraw: Prisma.DbNull } });
      } else {
        await withBracket(tx, id, (manager) =>
          manager.create.stage(stageInput({ ...t, options: t.options as unknown as TournamentOptions })),
        );
      }
      await tx.tournament.update({ where: { id }, data: { status: 'in_progress', startedAt: new Date() } });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.post('/tournaments/:id/knockout-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(
      async (tx) => {
        const t = await cupInProgress(tx, id);
        await withBracket(tx, id, async (manager) => {
          const data = await manager.export();
          const pending = groupsPending(data);
          if (pending > 0) throw groupsPendingError(pending);
          await assertKnockoutUntouched(tx, id, data);
          const previous = knockoutStageOf(data);
          if (previous) await manager.delete.stage(previous.id);
          const participantOf = new Map([...teamIdByParticipant(data)].map(([participantId, teamId]) => [teamId, participantId]));
          const qualified = (await cupStandings(tx, t, data))
            .filter((row) => row.qualified)
            .map((row) => ({ item: participantOf.get(row.teamId)!, group: row.groupNumber }));
          const slots = drawKnockout(qualified, Math.random);
          await manager.create.stage(cupKnockoutStageInput({ id, options: t.options as unknown as TournamentOptions }, slots));
        });
      },
      { timeout: 15_000 },
    );
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.delete('/tournaments/:id/knockout-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(
      async (tx) => {
        await cupInProgress(tx, id);
        await withBracket(tx, id, async (manager) => {
          const data = await manager.export();
          const knockout = knockoutStageOf(data);
          if (!knockout) throw new AppError(409, 'KNOCKOUT_NOT_DRAWN', 'O mata-mata ainda não foi sorteado.');
          await assertKnockoutUntouched(tx, id, data);
          await manager.delete.stage(knockout.id);
        });
      },
      { timeout: 15_000 },
    );
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.get('/tournaments/:id/bracket', async (request) => {
    const { id } = parse(idParams, request.params);
    const t = await loadTournament(prisma, id);
    const data = t.bracket as unknown as BracketData | null;
    if (!data) return { data: null };
    const teamOf = teamIdByParticipant(data);
    const teams = await teamsById(prisma, teamOf.values());
    return {
      data: {
        ...data,
        participant: data.participant.map((p) => ({ ...p, name: teams.get(teamOf.get(Number(p.id)) ?? '')?.name ?? p.name })),
      },
    };
  });

  app.get('/tournaments/:id/standings', async (request) => {
    const { id } = parse(idParams, request.params);
    const t = await loadTournament(prisma, id);
    const teams = new Map(t.entries.map((e) => [e.team.id, teamRef(e.team)]));
    if (t.format === 'cup') {
      const data = t.bracket as unknown as BracketData | null;
      if (!data) return [];
      return (await cupStandings(prisma, t, data)).map((row) => ({ ...row, team: teams.get(row.teamId)! }));
    }
    if (t.format !== 'round_robin') return [];
    const fixtures = await completedFixtures(prisma, { tournamentId: id });
    const rows = computeStandings(t.entries.map((e) => e.team.id), fixtures.map(toFixtureRecord));
    return rows.map((row) => ({ ...row, groupNumber: 1, team: teams.get(row.teamId)! }));
  });

  app.get('/tournaments/:id/stats', async (request) => {
    const { id } = parse(idParams, request.params);
    await loadTournament(prisma, id);
    const duels = (await completedFixtures(prisma, { tournamentId: id })).flatMap((f) => f.duels);
    const teamOfPlayer = new Map<string, string>();
    for (const duel of [...duels].reverse()) {
      teamOfPlayer.set(duel.playerAId, duel.teamAId);
      teamOfPlayer.set(duel.playerBId, duel.teamBId);
    }
    const stats = aggregatePlayerStats(duels.map(toDuelInput));
    const players = await prisma.player.findMany({
      where: { id: { in: stats.map((s) => s.playerId) } },
      select: { id: true, name: true },
    });
    const playerById = new Map(players.map((p) => [p.id, p]));
    const teams = await teamsById(prisma, teamOfPlayer.values());
    return stats.map((s) => ({
      ...s,
      player: playerById.get(s.playerId)!,
      team: teams.get(teamOfPlayer.get(s.playerId) ?? '') ?? null,
    }));
  });

  app.post('/tournaments/:id/finish', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const t = await loadTournament(tx, id);
      if (t.status !== 'in_progress') throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      const data = t.bracket as unknown as BracketData;
      const knockout = t.format === 'cup' ? knockoutStageOf(data) : null;
      if (t.format === 'cup' && !knockout) throw new AppError(409, 'KNOCKOUT_NOT_DRAWN', 'Sorteie o mata-mata antes de encerrar.');
      if (!isStageComplete(data)) throw new AppError(409, 'TOURNAMENT_NOT_COMPLETE', 'Ainda há confrontos sem resultado.');

      let podium: PodiumEntry[];
      if (t.format === 'round_robin') {
        const fixtures = await completedFixtures(tx, { tournamentId: id });
        podium = roundRobinPodium(computeStandings(t.entries.map((e) => e.team.id), fixtures.map(toFixtureRecord)));
      } else {
        const manager = await managerFor(data);
        const standings = await manager.get.finalStandings((knockout ?? data.stage[0]!).id);
        podium = eliminationPodium(standings, teamIdByParticipant(data));
      }

      const year = new Date().getFullYear();
      await tx.title.createMany({
        data: podium.map((entry) => ({ teamId: entry.teamId, tournamentId: id, tournamentName: t.name, position: entry.position, year })),
      });
      await tx.tournament.update({ where: { id }, data: { status: 'finished', finishedAt: new Date() } });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });
}
