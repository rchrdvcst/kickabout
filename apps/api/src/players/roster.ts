import { MAX_ACTIVE_ROSTER, whatsappUrl } from '@kickabout/shared';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';
import type { Db } from '../db';
import { AppError, notFound } from '../errors';

export interface RosterPlayer {
  id: string;
  name: string;
  phone?: string;
  whatsappUrl?: string;
}

export const canSeePhones = (request: FastifyRequest, config: AppConfig): boolean =>
  config.phoneVisibility === 'public' || request.user !== null;

export function rosterPlayer(player: { id: string; name: string; phone: string }, showPhone: boolean): RosterPlayer {
  return showPhone
    ? { id: player.id, name: player.name, phone: player.phone, whatsappUrl: whatsappUrl(player.phone) }
    : { id: player.id, name: player.name };
}

export async function findTeamOrThrow(db: Db, id: string) {
  const team = await db.team.findUnique({ where: { id } });
  if (!team) throw notFound('Time');
  return team;
}

export async function activePlayers(db: Db, teamId: string) {
  const memberships = await db.teamMembership.findMany({
    where: { teamId, leftAt: null },
    include: { player: true },
    orderBy: { player: { name: 'asc' } },
  });
  return memberships.map((membership) => membership.player);
}

export async function activePlayerIds(db: Db, teamId: string): Promise<string[]> {
  const memberships = await db.teamMembership.findMany({ where: { teamId, leftAt: null }, select: { playerId: true } });
  return memberships.map((membership) => membership.playerId);
}

export async function setPlayerTeam(db: Db, playerId: string, teamId: string | null) {
  const current = await db.teamMembership.findFirst({ where: { playerId, leftAt: null } });
  if ((current?.teamId ?? null) === teamId) return;
  if (teamId) {
    const count = await db.teamMembership.count({ where: { teamId, leftAt: null } });
    if (count >= MAX_ACTIVE_ROSTER) {
      throw new AppError(409, 'ROSTER_FULL', `O time já tem ${MAX_ACTIVE_ROSTER} jogadores ativos.`);
    }
  }
  if (current) await db.teamMembership.update({ where: { id: current.id }, data: { leftAt: new Date() } });
  if (teamId) await db.teamMembership.create({ data: { teamId, playerId } });
}
