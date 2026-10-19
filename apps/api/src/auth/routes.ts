import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../deps';
import { AppError, isUniqueViolation, parse } from '../errors';
import { googleTokenVerifier, signInWithGoogle, type GoogleProfile } from './google';
import { verifyPassword } from './password';
import { SESSION_COOKIE, authUser, deleteSession, startSession } from './sessions';

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const googleBody = z.object({ credential: z.string().min(1) });

const invalidGoogle = () => new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Não foi possível entrar com o Google. Tente de novo.');

export function registerAuthRoutes(app: FastifyInstance, { prisma, config, verifyGoogleToken }: AppDeps) {
  const verify = verifyGoogleToken ?? googleTokenVerifier();

  app.get('/auth/config', async () => ({ googleClientId: config.googleClientId }));

  app.post('/auth/google', async (request, reply) => {
    if (!config.googleClientId) throw new AppError(404, 'GOOGLE_LOGIN_DISABLED', 'Login com Google não está habilitado.');
    const { credential } = parse(googleBody, request.body);
    let profile: GoogleProfile;
    try {
      profile = await verify(credential, config.googleClientId);
    } catch {
      throw invalidGoogle();
    }
    if (!profile.emailVerified) throw invalidGoogle();
    // Dois primeiros logins ao mesmo tempo: o segundo bate no índice único e, na nova tentativa, acha o usuário.
    const user = await signInWithGoogle(prisma, profile).catch((error: unknown) => {
      if (isUniqueViolation(error)) return signInWithGoogle(prisma, profile);
      throw error;
    });
    await startSession(reply, prisma, config, user.id);
    return { user: authUser(user) };
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = parse(loginBody, request.body);
    const found = await prisma.user.findUnique({ where: { email } });
    if (!found?.passwordHash || !(await verifyPassword(found.passwordHash, password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
    }
    const user = await prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } });
    await startSession(reply, prisma, config, user.id);
    return { user: authUser(user) };
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(prisma, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', async (request) => ({ user: request.user }));
}
