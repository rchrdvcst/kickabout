import { describe, expect, it } from 'vitest';
import { computeFixtureScore, isTiedAfterRegularDuels, sumGoals } from './fixture-score';
import type { DuelInput } from './types';

const d = (order: number, goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order,
  playerAId: `a${order}`,
  playerBId: `b${order}`,
  goalsA,
  goalsB,
  ...extra,
});

const threeToOne = [d(1, 2, 0), d(2, 1, 1), d(3, 0, 3), d(4, 4, 2), d(5, 1, 0)];
const twoToTwo = [d(1, 1, 0), d(2, 1, 0), d(3, 0, 1), d(4, 0, 2), d(5, 2, 2)];

describe('computeFixtureScore', () => {
  it('gives one point per duel won', () => {
    expect(computeFixtureScore(threeToOne)).toEqual({ scoreA: 3, scoreB: 1, winner: 'A' });
  });

  it('returns null winner when tied', () => {
    expect(computeFixtureScore(twoToTwo)).toEqual({ scoreA: 2, scoreB: 2, winner: null });
  });

  it('counts the tiebreaker decided on penalties', () => {
    const duels = [...twoToTwo, d(6, 1, 1, { penaltiesA: 4, penaltiesB: 5 })];
    expect(computeFixtureScore(duels)).toEqual({ scoreA: 2, scoreB: 3, winner: 'B' });
  });

  it('returns 0x0 for no duels', () => {
    expect(computeFixtureScore([])).toEqual({ scoreA: 0, scoreB: 0, winner: null });
  });
});

describe('sumGoals', () => {
  it('sums duel goals and ignores penalties', () => {
    const duels = [...twoToTwo, d(6, 1, 1, { penaltiesA: 4, penaltiesB: 5 })];
    expect(sumGoals(duels)).toEqual({ goalsA: 5, goalsB: 6 });
  });
});

describe('isTiedAfterRegularDuels', () => {
  it('is true for 2x2 even when a 6th duel exists', () => {
    expect(isTiedAfterRegularDuels([...twoToTwo, d(6, 3, 0)])).toBe(true);
  });

  it('is false for 3x1', () => {
    expect(isTiedAfterRegularDuels(threeToOne)).toBe(false);
  });
});
