import type { User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { idParams } from '../dto';
import { AppError, notFound, parse } from '../errors';

const roleBody = z.object({ role: z.enum(['admin', 'user']) });

const userDto = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
  hasPassword: user.passwordHash !== null,
  hasGoogle: user.googleId !== null,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

export function registerUserRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/users', { preHandler: requireAdmin }, async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(userDto);
  });

  app.patch('/users/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { role } = parse(roleBody, request.body);
    const updated = await prisma.$transaction(async (tx) => {
      // Trava os organizadores: dois rebaixamentos ao mesmo tempo não podem zerar a lista.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'admin' FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw notFound('Usuário');
      if (role === 'user' && user.role === 'admin') {
        if (id === request.user!.id) {
          throw new AppError(409, 'CANNOT_DEMOTE_SELF', 'Você não pode tirar o seu próprio papel de organizador.');
        }
        if (admins.length <= 1) throw new AppError(409, 'LAST_ADMIN', 'É preciso ter pelo menos um organizador.');
      }
      return tx.user.update({ where: { id }, data: { role } });
    });
    return userDto(updated);
  });
}
