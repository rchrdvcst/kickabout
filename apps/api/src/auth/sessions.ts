import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config';
import type { Db } from '../db';

export const SESSION_COOKIE = 'kb_session';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

export const authUser = (user: AuthUser): AuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
});

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string, ttlDays: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function findSessionUser(db: Db, token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return authUser(session.user);
}

/** Cria a sessão do usuário e grava o cookie (login por senha ou Google). */
export async function startSession(reply: FastifyReply, prisma: PrismaClient, config: AppConfig, userId: string) {
  const { token, expiresAt } = await createSession(prisma, userId, config.sessionTtlDays);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: expiresAt,
  });
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
