import { z } from 'zod';
import type { Db } from './db';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export const teamRefSelect = { id: true, name: true, shortName: true, crestUrl: true } as const;

export const teamRef = (team: TeamRef): TeamRef => ({
  id: team.id,
  name: team.name,
  shortName: team.shortName,
  crestUrl: team.crestUrl,
});

export const idParams = z.object({ id: z.string().min(1) });

export async function teamsById(db: Db, ids: Iterable<string>): Promise<Map<string, TeamRef>> {
  const teams = await db.team.findMany({ where: { id: { in: [...new Set(ids)] } }, select: teamRefSelect });
  return new Map(teams.map((team) => [team.id, teamRef(team)]));
}
