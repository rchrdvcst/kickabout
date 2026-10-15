import type { DuelInput, DuelOutcome } from './types';

export function hasPenalties(duel: Pick<DuelInput, 'penaltiesA' | 'penaltiesB'>): boolean {
  return duel.penaltiesA != null && duel.penaltiesB != null;
}

export function duelOutcome(duel: DuelInput): DuelOutcome {
  if (duel.goalsA > duel.goalsB) return 'A';
  if (duel.goalsB > duel.goalsA) return 'B';
  if (duel.penaltiesA != null && duel.penaltiesB != null) {
    if (duel.penaltiesA > duel.penaltiesB) return 'A';
    if (duel.penaltiesB > duel.penaltiesA) return 'B';
  }
  return 'draw';
}
