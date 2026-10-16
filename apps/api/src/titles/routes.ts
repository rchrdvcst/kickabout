import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { idParams, teamRef, teamRefSelect, type TeamRef } from '../dto';
import { AppError, notFound, parse } from '../errors';
import { findTeamOrThrow } from '../players/roster';

const titleBody = z.object({
  teamId: z.string().min(1),
  tournamentName: z.string().trim().min(1).max(80),
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  year: z.number().int().min(1990).max(2100),
});

const titleInclude = { team: { select: teamRefSelect } } as const;

const titleDto = (title: { id: string; position: number; year: number; tournamentId: string | null; tournamentName: string; team: TeamRef }) => ({
  id: title.id,
  position: title.position,
  year: title.year,
  tournamentId: title.tournamentId,
  tournamentName: title.tournamentName,
  team: teamRef(title.team),
});

export function registerTitleRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/titles', async () => {
    const titles = await prisma.title.findMany({
      include: titleInclude,
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }, { position: 'asc' }],
    });
    const ranking = new Map<string, { team: TeamRef; champion: number; runnerUp: number; third: number }>();
    for (const title of titles) {
      const row = ranking.get(title.teamId) ?? { team: teamRef(title.team), champion: 0, runnerUp: 0, third: 0 };
      if (title.position === 1) row.champion++;
      else if (title.position === 2) row.runnerUp++;
      else row.third++;
      ranking.set(title.teamId, row);
    }
    return {
      ranking: [...ranking.values()].sort(
        (a, b) => b.champion - a.champion || b.runnerUp - a.runnerUp || b.third - a.third || a.team.name.localeCompare(b.team.name),
      ),
      titles: titles.map(titleDto),
    };
  });

  app.post('/titles', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(titleBody, request.body);
    await findTeamOrThrow(prisma, body.teamId);
    const title = await prisma.title.create({ data: body, include: titleInclude });
    return reply.status(201).send(titleDto(title));
  });

  app.delete('/titles/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) throw notFound('Título');
    if (title.tournamentId) {
      throw new AppError(409, 'TITLE_FROM_TOURNAMENT', 'Títulos gerados por campeonato não podem ser apagados.');
    }
    await prisma.title.delete({ where: { id } });
    return { ok: true };
  });
}
