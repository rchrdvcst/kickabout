import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db';

export const SESSION_COOKIE = 'kb_session';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

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
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
