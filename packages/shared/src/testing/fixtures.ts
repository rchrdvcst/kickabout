import type { FixtureRecord } from '../types';

/** [golsA, golsB, pênaltisA?, pênaltisB?] — a posição no array define a ordem do duelo. */
export type DuelTuple = [goalsA: number, goalsB: number, penaltiesA?: number, penaltiesB?: number];

export const W: DuelTuple = [1, 0];
export const L: DuelTuple = [0, 1];
export const D: DuelTuple = [0, 0];

export function fx(teamAId: string, teamBId: string, results: DuelTuple[]): FixtureRecord {
  return {
    teamAId,
    teamBId,
    duels: results.map(([goalsA, goalsB, penaltiesA, penaltiesB], index) => ({
      order: index + 1,
      playerAId: `${teamAId}-p${index + 1}`,
      playerBId: `${teamBId}-p${index + 1}`,
      goalsA,
      goalsB,
      ...(penaltiesA !== undefined ? { penaltiesA, penaltiesB: penaltiesB ?? null } : {}),
    })),
  };
}
