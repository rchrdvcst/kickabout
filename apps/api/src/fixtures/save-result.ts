import { computeFixtureScore, validateFixtureResult, type DuelInput } from '@kickabout/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError, notFound } from '../errors';
import { activePlayerIds } from '../players/roster';
import { lockTournament, withBracket, type BracketData } from '../tournaments/bracket-store';
import { findMatch, laterCompletedMatchIds, matchView } from '../tournaments/bracket-view';

export interface SaveResultInput {
  mode: 'draft' | 'final';
  duels: DuelInput[];
}

async function pruneStaleDrafts(tx: Prisma.TransactionClient, tournamentId: string, data: BracketData) {
  const drafts = await tx.fixture.findMany({ where: { tournamentId, status: 'draft' } });
  for (const draft of drafts) {
    const raw = findMatch(data, draft.bmMatchId);
    const view = raw ? matchView(data, raw) : null;
    if (!view || view.teamAId !== draft.teamAId || view.teamBId !== draft.teamBId) {
      await tx.fixture.delete({ where: { id: draft.id } });
    }
  }
}

export async function saveResult(prisma: PrismaClient, tournamentId: string, matchId: number, input: SaveResultInput) {
  await prisma.$transaction(
    async (tx) => {
      await lockTournament(tx, tournamentId);
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw notFound('Campeonato');
      if (tournament.status !== 'in_progress') {
        throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      }
      const isKnockout = tournament.format !== 'round_robin';

      await withBracket(tx, tournamentId, async (manager) => {
        const data = await manager.export();
        const raw = findMatch(data, matchId);
        if (!raw) throw notFound('Confronto');
        const view = matchView(data, raw);
        if (!view) throw new AppError(409, 'FIXTURE_NOT_READY', 'Os dois times deste confronto ainda não estão definidos.');

        const key = { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } };
        const existing = await tx.fixture.findUnique({ where: key, include: { duels: true } });
        if (input.mode === 'draft' && existing?.status === 'completed') {
          throw new AppError(409, 'FIXTURE_ALREADY_COMPLETED', 'Este confronto já tem resultado confirmado.');
        }

        const [activeA, activeB] = await Promise.all([activePlayerIds(tx, view.teamAId), activePlayerIds(tx, view.teamBId)]);
        const rosterA = [...activeA, ...(existing?.duels.map((d) => d.playerAId) ?? [])];
        const rosterB = [...activeB, ...(existing?.duels.map((d) => d.playerBId) ?? [])];
        const issues = validateFixtureResult({ mode: input.mode, isKnockout, duels: input.duels, rosterA, rosterB });
        if (issues.length > 0) throw new AppError(400, 'INVALID_RESULT', 'O resultado tem erros.', issues);

        const isFinal = input.mode === 'final';
        const score = computeFixtureScore(input.duels);
        if (isFinal) {
          const result = (side: 'A' | 'B') => (score.winner === null ? 'draw' : score.winner === side ? 'win' : 'loss');
          try {
            await manager.update.match({
              id: matchId,
              opponent1: { score: score.scoreA, result: result('A') },
              opponent2: { score: score.scoreB, result: result('B') },
            });
          } catch (error) {
            if (error instanceof Error && /locked/i.test(error.message)) {
              throw new AppError(
                409,
                'RESULT_LOCKED',
                'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Desfaça-os primeiro.',
                { blockingMatchIds: laterCompletedMatchIds(data, matchId) },
              );
            }
            throw error;
          }
        }

        const values = {
          teamAId: view.teamAId,
          teamBId: view.teamBId,
          isKnockout,
          status: isFinal ? ('completed' as const) : ('draft' as const),
          scoreA: isFinal ? score.scoreA : null,
          scoreB: isFinal ? score.scoreB : null,
          winnerTeamId: isFinal && score.winner ? (score.winner === 'A' ? view.teamAId : view.teamBId) : null,
          playedAt: isFinal ? new Date() : null,
        };
        const fixture = await tx.fixture.upsert({
          where: key,
          create: { tournamentId, bmMatchId: matchId, ...values },
          update: values,
        });
        await tx.duel.deleteMany({ where: { fixtureId: fixture.id } });
        await tx.duel.createMany({
          data: input.duels.map((duel) => ({
            fixtureId: fixture.id,
            order: duel.order,
            playerAId: duel.playerAId,
            playerBId: duel.playerBId,
            teamAId: view.teamAId,
            teamBId: view.teamBId,
            goalsA: duel.goalsA,
            goalsB: duel.goalsB,
            penaltiesA: duel.penaltiesA ?? null,
            penaltiesB: duel.penaltiesB ?? null,
          })),
        });

        if (isFinal) await pruneStaleDrafts(tx, tournamentId, await manager.export());
      });
    },
    { timeout: 15_000 },
  );
}
