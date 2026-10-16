import type { DuelInput, FixtureRecord } from '@kickabout/shared';
import type { Duel, Prisma } from '@prisma/client';
import type { Db } from '../db';
import { teamsById, type TeamRef } from '../dto';

export const toDuelInput = (duel: Duel): DuelInput => ({
  order: duel.order,
  playerAId: duel.playerAId,
  playerBId: duel.playerBId,
  goalsA: duel.goalsA,
  goalsB: duel.goalsB,
  penaltiesA: duel.penaltiesA,
  penaltiesB: duel.penaltiesB,
});

export function completedFixtures(db: Db, where: Prisma.FixtureWhereInput) {
  return db.fixture.findMany({
    where: { ...where, status: 'completed' },
    include: { duels: { orderBy: { order: 'asc' } }, tournament: { select: { id: true, name: true } } },
    orderBy: { playedAt: 'desc' },
  });
}

export const toFixtureRecord = (fixture: { teamAId: string; teamBId: string; duels: Duel[] }): FixtureRecord => ({
  teamAId: fixture.teamAId,
  teamBId: fixture.teamBId,
  duels: fixture.duels.map(toDuelInput),
});

export interface FixtureSummary {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number;
  scoreB: number;
  playedAt: Date | null;
}

export async function fixtureSummaries(
  db: Db,
  fixtures: Awaited<ReturnType<typeof completedFixtures>>,
): Promise<FixtureSummary[]> {
  const teams = await teamsById(db, fixtures.flatMap((f) => [f.teamAId, f.teamBId]));
  return fixtures.map((f) => ({
    tournamentId: f.tournament.id,
    tournamentName: f.tournament.name,
    matchId: f.bmMatchId,
    teamA: teams.get(f.teamAId)!,
    teamB: teams.get(f.teamBId)!,
    scoreA: f.scoreA ?? 0,
    scoreB: f.scoreB ?? 0,
    playedAt: f.playedAt,
  }));
}
