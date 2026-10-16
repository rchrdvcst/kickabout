import { aggregateTeamStats } from '@kickabout/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { teamRef, idParams } from '../dto';
import { AppError, isUniqueViolation, parse } from '../errors';
import { activePlayers, canSeePhones, findTeamOrThrow, rosterPlayer } from '../players/roster';
import { completedFixtures, fixtureSummaries, toFixtureRecord } from '../stats/queries';

const teamBody = z.object({
  name: z.string().trim().min(1).max(60),
  shortName: z.string().trim().min(1).max(5).toUpperCase(),
  crestUrl: z.url().nullable().optional(),
});

const nameTaken = () => new AppError(409, 'TEAM_NAME_TAKEN', 'Já existe um time com esse nome.');

export function registerTeamRoutes(app: FastifyInstance, { prisma, config }: AppDeps) {
  app.get('/teams', async () => {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { memberships: { where: { leftAt: null } } } } },
    });
    return teams.map((team) => ({ ...teamRef(team), playerCount: team._count.memberships }));
  });

  app.post('/teams', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(teamBody, request.body);
    try {
      const team = await prisma.team.create({
        data: { name: body.name, shortName: body.shortName, crestUrl: body.crestUrl ?? null, ownerId: request.user!.id },
      });
      return reply.status(201).send({ ...teamRef(team), playerCount: 0 });
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  });

  app.patch('/teams/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(teamBody.partial(), request.body);
    await findTeamOrThrow(prisma, id);
    try {
      return teamRef(await prisma.team.update({ where: { id }, data: body }));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  });

  app.get('/teams/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const team = await findTeamOrThrow(prisma, id);
    const showPhone = canSeePhones(request, config);
    const [players, fixtures, titles, entries] = await Promise.all([
      activePlayers(prisma, id),
      completedFixtures(prisma, { OR: [{ teamAId: id }, { teamBId: id }] }),
      prisma.title.findMany({ where: { teamId: id }, orderBy: [{ year: 'desc' }, { position: 'asc' }] }),
      prisma.tournamentEntry.findMany({ where: { teamId: id }, include: { tournament: true }, orderBy: { tournament: { createdAt: 'desc' } } }),
    ]);
    return {
      team: teamRef(team),
      roster: players.map((player) => rosterPlayer(player, showPhone)),
      stats: aggregateTeamStats(id, fixtures.map(toFixtureRecord)),
      titles: titles.map((t) => ({ id: t.id, position: t.position, year: t.year, tournamentId: t.tournamentId, tournamentName: t.tournamentName })),
      recentFixtures: await fixtureSummaries(prisma, fixtures.slice(0, 10)),
      tournaments: entries.map((e) => ({ id: e.tournament.id, name: e.tournament.name, format: e.tournament.format, status: e.tournament.status })),
    };
  });

  app.get('/teams/:id/roster', async (request) => {
    const { id } = parse(idParams, request.params);
    const team = await findTeamOrThrow(prisma, id);
    const showPhone = canSeePhones(request, config);
    const players = await activePlayers(prisma, id);
    return { team: teamRef(team), players: players.map((player) => rosterPlayer(player, showPhone)) };
  });
}
