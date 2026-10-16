import { PrismaClient, type Prisma } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
