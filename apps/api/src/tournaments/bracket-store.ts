import type { Prisma } from '@prisma/client';
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Database } from 'brackets-model';

export type BracketData = Database;

export async function managerFor(data: BracketData | null): Promise<BracketsManager> {
  const manager = new BracketsManager(new InMemoryDatabase());
  if (data) await manager.import(data);
  return manager;
}

/**
 * Executa `fn` sobre o bracket do campeonato e grava o resultado.
 * Deve ser chamado dentro de `prisma.$transaction`: a linha do campeonato fica travada até o commit.
 */
export async function withBracket<T>(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  fn: (manager: BracketsManager) => Promise<T>,
): Promise<T> {
  await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;
  const { bracket } = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { bracket: true } });
  const manager = await managerFor(bracket as unknown as BracketData | null);
  const result = await fn(manager);
  const data = await manager.export();
  await tx.tournament.update({ where: { id: tournamentId }, data: { bracket: data as unknown as Prisma.InputJsonValue } });
  return result;
}
