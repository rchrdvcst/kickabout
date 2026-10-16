import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../deps';
import { AppError, parse } from '../errors';
import { verifyPassword } from './password';
import { SESSION_COOKIE, createSession, deleteSession } from './sessions';

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, { prisma, config }: AppDeps) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = parse(loginBody, request.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
    }
    const { token, expiresAt } = await createSession(prisma, user.id, config.sessionTtlDays);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/',
      expires: expiresAt,
    });
    return { user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(prisma, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', async (request) => ({ user: request.user }));
}
