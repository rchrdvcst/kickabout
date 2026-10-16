import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { parse } from '../errors';
import { completedFixtures, fixtureSummaries } from '../stats/queries';
import { getFixtureDetail, listFixtures } from './detail';
import { saveResult } from './save-result';

const tournamentParams = z.object({ id: z.string().min(1) });
const fixtureParams = tournamentParams.extend({ matchId: z.coerce.number().int().min(0) });
const duelSchema = z.object({
  order: z.number(),
  playerAId: z.string().min(1),
  playerBId: z.string().min(1),
  goalsA: z.number(),
  goalsB: z.number(),
  penaltiesA: z.number().nullable().optional(),
  penaltiesB: z.number().nullable().optional(),
});
const resultBody = z.object({ mode: z.enum(['draft', 'final']), duels: z.array(duelSchema).max(6) });

export function registerFixtureRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/tournaments/:id/fixtures', async (request) => {
    const { id } = parse(tournamentParams, request.params);
    return listFixtures(prisma, id);
  });

  app.get('/tournaments/:id/fixtures/:matchId', async (request) => {
    const { id, matchId } = parse(fixtureParams, request.params);
    return getFixtureDetail(prisma, id, matchId, request.user !== null);
  });

  app.put('/tournaments/:id/fixtures/:matchId/result', { preHandler: requireAdmin }, async (request) => {
    const { id, matchId } = parse(fixtureParams, request.params);
    const body = parse(resultBody, request.body);
    await saveResult(prisma, id, matchId, body);
    return getFixtureDetail(prisma, id, matchId, true);
  });

  const recentQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

  app.get('/fixtures/recent', async (request) => {
    const { limit } = parse(recentQuery, request.query);
    const fixtures = await completedFixtures(prisma, {});
    return fixtureSummaries(prisma, fixtures.slice(0, limit));
  });
}
