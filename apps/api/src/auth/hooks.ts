import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppDeps } from '../deps';
import { AppError } from '../errors';
import { SESSION_COOKIE, findSessionUser, type AuthUser } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export function registerAuth(app: FastifyInstance, { prisma }: AppDeps) {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? await findSessionUser(prisma, token) : null;
  });
}

export async function requireAdmin(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.');
}
