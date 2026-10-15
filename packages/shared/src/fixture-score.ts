import { REGULAR_DUELS } from './constants';
import { duelOutcome } from './duel';
import type { DuelInput, FixtureScore } from './types';

export function computeFixtureScore(duels: readonly DuelInput[]): FixtureScore {
  let scoreA = 0;
  let scoreB = 0;
  for (const duel of duels) {
    const outcome = duelOutcome(duel);
    if (outcome === 'A') scoreA++;
    else if (outcome === 'B') scoreB++;
  }
  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
  return { scoreA, scoreB, winner };
}

export function sumGoals(duels: readonly DuelInput[]): { goalsA: number; goalsB: number } {
  let goalsA = 0;
  let goalsB = 0;
  for (const duel of duels) {
    goalsA += duel.goalsA;
    goalsB += duel.goalsB;
  }
  return { goalsA, goalsB };
}

export function isTiedAfterRegularDuels(duels: readonly DuelInput[]): boolean {
  const { scoreA, scoreB } = computeFixtureScore(duels.filter((duel) => duel.order <= REGULAR_DUELS));
  return scoreA === scoreB;
}
