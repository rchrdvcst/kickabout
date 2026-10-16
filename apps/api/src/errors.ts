import { Prisma } from '@prisma/client';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} não encontrado.`);

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Dados inválidos.',
      result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    );
  }
  return result.data;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({ error: { code: (error as FastifyError).code ?? 'BAD_REQUEST', message: error.message } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Erro interno.' } });
  });
}
