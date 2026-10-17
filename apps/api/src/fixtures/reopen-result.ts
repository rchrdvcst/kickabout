import type { PrismaClient } from '@prisma/client';
import type { BracketsManager } from 'brackets-manager';
import type { ParticipantResult } from 'brackets-model';
import { AppError, notFound } from '../errors';
import { lockTournament, withBracket } from '../tournaments/bracket-store';
import { findMatch, laterCompletedMatchIds } from '../tournaments/bracket-view';
import { pruneStaleDrafts } from './save-result';

const withoutScore = (opponent: ParticipantResult | null): ParticipantResult | null =>
  opponent ? { id: opponent.id, position: opponent.position } : opponent;

/**
 * Volta uma partida do brackets-manager para "a jogar" e libera as partidas anteriores.
 * `reset.matchResults` tira o resultado e recusa ("The match is locked.") se uma partida seguinte já começou,
 * mas mantém o placar: a partida fica "em andamento" e as anteriores continuam arquivadas (bloqueadas).
 * Por isso o placar é apagado e o reset roda de novo: sem placar, a partida fica "pronta" e as anteriores voltam a "concluída".
 */
export async function reopenMatch(manager: BracketsManager, matchId: number) {
  await manager.reset.matchResults(matchId);
  const stored = await manager.storage.select('match', matchId);
  if (!stored) throw notFound('Confronto');
  await manager.storage.update('match', matchId, {
    ...stored,
    opponent1: withoutScore(stored.opponent1),
    opponent2: withoutScore(stored.opponent2),
  });
  await manager.reset.matchResults(matchId);
}

/** Reabre um resultado confirmado: volta a rascunho (duelos mantidos), sai da chave, da classificação e das estatísticas. */
export async function reopenResult(prisma: PrismaClient, tournamentId: string, matchId: number) {
  await prisma.$transaction(
    async (tx) => {
      await lockTournament(tx, tournamentId);
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw notFound('Campeonato');
      if (tournament.status !== 'in_progress') {
        throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      }
      const key = { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } };
      const fixture = await tx.fixture.findUnique({ where: key });
      if (fixture?.status !== 'completed') {
        throw new AppError(409, 'FIXTURE_NOT_COMPLETED', 'Este confronto não tem resultado confirmado.');
      }

      await withBracket(tx, tournamentId, async (manager) => {
        const data = await manager.export();
        if (!findMatch(data, matchId)) throw notFound('Confronto');
        try {
          await reopenMatch(manager, matchId);
        } catch (error) {
          if (error instanceof Error && /locked/i.test(error.message)) {
            throw new AppError(
              409,
              'RESULT_LOCKED',
              'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Reabra-os primeiro.',
              { blockingMatchIds: laterCompletedMatchIds(data, matchId) },
            );
          }
          throw error;
        }
        await tx.fixture.update({
          where: key,
          data: { status: 'draft', scoreA: null, scoreB: null, winnerTeamId: null, playedAt: null },
        });
        await pruneStaleDrafts(tx, tournamentId, await manager.export());
      });
    },
    { timeout: 15_000 },
  );
}
