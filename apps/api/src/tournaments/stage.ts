import type { TournamentFormat } from '@prisma/client';
import type { InputStage } from 'brackets-model';
import type { TournamentOptions } from './options';

export const MIN_TEAMS: Record<TournamentFormat, number> = {
  single_elimination: 2,
  double_elimination: 3,
  round_robin: 2,
};

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

export interface StageSource {
  id: string;
  name: string;
  format: TournamentFormat;
  options: TournamentOptions;
  entries: { team: { id: string; name: string } }[];
}

export function stageInput(t: StageSource): InputStage {
  const seeding = t.entries.map((entry) => ({ name: entry.team.name, teamId: entry.team.id }));
  const base = { tournamentId: t.id, name: t.name, seeding };
  switch (t.format) {
    case 'round_robin':
      return { ...base, type: 'round_robin', settings: { groupCount: 1, roundRobinMode: t.options.roundRobinMode } };
    case 'single_elimination':
      return {
        ...base,
        type: 'single_elimination',
        settings: {
          size: nextPowerOfTwo(seeding.length),
          balanceByes: true,
          // Com 3 times a disputa de 3º seria contra um BYE e nunca terminaria; o perdedor da semi já é o 3º.
          consolationFinal: t.options.consolationFinal && seeding.length >= 4,
        },
      };
    case 'double_elimination':
      return {
        ...base,
        type: 'double_elimination',
        settings: {
          size: nextPowerOfTwo(seeding.length),
          balanceByes: true,
          grandFinal: t.options.grandFinalReset ? 'double' : 'simple',
        },
      };
  }
}
