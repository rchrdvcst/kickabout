import { aggregatePlayerStats, duelOutcome, normalizePhone, whatsappUrl } from '@kickabout/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { Db } from '../db';
import type { AppDeps } from '../deps';
import { idParams, teamRef, teamsById } from '../dto';
import { AppError, isUniqueViolation, notFound, parse } from '../errors';
import { toDuelInput } from '../stats/queries';
import { findTeamOrThrow, setPlayerTeam } from './roster';

const playerBody = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().min(1),
  teamId: z.string().min(1).nullable().optional(),
});
const playerPatch = playerBody.pick({ name: true, phone: true }).partial();
const teamBody = z.object({ teamId: z.string().min(1).nullable() });
const searchQuery = z.object({ search: z.string().trim().optional() });

function phoneOrThrow(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Número de celular inválido.');
  return phone;
}

const phoneTaken = () => new AppError(409, 'PHONE_TAKEN', 'Já existe um jogador com esse celular.');

async function adminPlayer(db: Db, id: string) {
  const player = await db.player.findUnique({
    where: { id },
    include: { memberships: { where: { leftAt: null }, include: { team: true } } },
  });
  if (!player) throw notFound('Jogador');
  const team = player.memberships[0]?.team;
  return {
    id: player.id,
    name: player.name,
    phone: player.phone,
    whatsappUrl: whatsappUrl(player.phone),
    team: team ? teamRef(team) : null,
  };
}

export function registerPlayerRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/players', { preHandler: requireAdmin }, async (request) => {
    const { search } = parse(searchQuery, request.query);
    const digits = search?.replace(/\D/g, '') ?? '';
    const players = await prisma.player.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              ...(digits ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : {},
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    return Promise.all(players.map((player) => adminPlayer(prisma, player.id)));
  });

  app.post('/players', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(playerBody, request.body);
    const phone = phoneOrThrow(body.phone);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const player = await tx.player.create({ data: { name: body.name, phone } });
        if (body.teamId) {
          await findTeamOrThrow(tx, body.teamId);
          await setPlayerTeam(tx, player.id, body.teamId);
        }
        return player.id;
      });
      return reply.status(201).send(await adminPlayer(prisma, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw phoneTaken();
      throw error;
    }
  });

  app.patch('/players/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(playerPatch, request.body);
    await adminPlayer(prisma, id);
    try {
      await prisma.player.update({
        where: { id },
        data: { name: body.name, phone: body.phone === undefined ? undefined : phoneOrThrow(body.phone) },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw phoneTaken();
      throw error;
    }
    return adminPlayer(prisma, id);
  });

  app.get('/players/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const player = await prisma.player.findUnique({
      where: { id },
      include: { memberships: { include: { team: true }, orderBy: { joinedAt: 'desc' } } },
    });
    if (!player) throw notFound('Jogador');

    const duels = await prisma.duel.findMany({
      where: { OR: [{ playerAId: id }, { playerBId: id }], fixture: { status: 'completed' } },
      include: {
        fixture: { include: { tournament: { select: { id: true, name: true } } } },
        playerA: { select: { id: true, name: true } },
        playerB: { select: { id: true, name: true } },
      },
      orderBy: [{ fixture: { playedAt: 'desc' } }, { order: 'asc' }],
    });
    const teams = await teamsById(prisma, duels.flatMap((d) => [d.teamAId, d.teamBId]));

    const stats = aggregatePlayerStats(duels.map(toDuelInput)).find((s) => s.playerId === id) ?? {
      playerId: id,
      duels: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      winRate: 0,
    };

    const history = duels.map((duel) => {
      const isA = duel.playerAId === id;
      const outcome = duelOutcome(toDuelInput(duel));
      return {
        tournamentId: duel.fixture.tournament.id,
        tournamentName: duel.fixture.tournament.name,
        matchId: duel.fixture.bmMatchId,
        order: duel.order,
        team: teams.get(isA ? duel.teamAId : duel.teamBId)!,
        opponentTeam: teams.get(isA ? duel.teamBId : duel.teamAId)!,
        opponent: isA ? duel.playerB : duel.playerA,
        goalsFor: isA ? duel.goalsA : duel.goalsB,
        goalsAgainst: isA ? duel.goalsB : duel.goalsA,
        penaltiesFor: isA ? duel.penaltiesA : duel.penaltiesB,
        penaltiesAgainst: isA ? duel.penaltiesB : duel.penaltiesA,
        result: outcome === 'draw' ? 'draw' : (outcome === 'A') === isA ? 'win' : 'loss',
        playedAt: duel.fixture.playedAt,
      };
    });

    const playedFor = new Set(duels.map((d) => `${d.fixture.tournamentId}:${d.playerAId === id ? d.teamAId : d.teamBId}`));
    const candidateTitles = await prisma.title.findMany({
      where: { tournamentId: { in: [...new Set(duels.map((d) => d.fixture.tournamentId))] } },
      include: { team: true },
      orderBy: [{ year: 'desc' }, { position: 'asc' }],
    });
    const titles = candidateTitles
      .filter((t) => playedFor.has(`${t.tournamentId}:${t.teamId}`))
      .map((t) => ({ position: t.position, year: t.year, tournamentId: t.tournamentId, tournamentName: t.tournamentName, team: teamRef(t.team) }));

    const current = player.memberships.find((m) => m.leftAt === null);
    return {
      player: { id: player.id, name: player.name },
      currentTeam: current ? teamRef(current.team) : null,
      teamHistory: player.memberships.map((m) => ({ team: teamRef(m.team), joinedAt: m.joinedAt, leftAt: m.leftAt })),
      stats,
      duels: history,
      titles,
    };
  });

  app.put('/players/:id/team', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { teamId } = parse(teamBody, request.body);
    await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id } });
      if (!player) throw notFound('Jogador');
      if (teamId) await findTeamOrThrow(tx, teamId);
      await setPlayerTeam(tx, id, teamId);
    });
    return { playerId: id, teamId };
  });
}
