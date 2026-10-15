import { describe, expect, it } from 'vitest';
import { duelOutcome } from './duel';
import type { DuelInput } from './types';

const duel = (goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order: 1,
  playerAId: 'pa',
  playerBId: 'pb',
  goalsA,
  goalsB,
  ...extra,
});

describe('duelOutcome', () => {
  it('returns A when A scores more', () => {
    expect(duelOutcome(duel(2, 1))).toBe('A');
  });

  it('returns B when B scores more', () => {
    expect(duelOutcome(duel(0, 3))).toBe('B');
  });

  it('returns draw on equal goals without penalties', () => {
    expect(duelOutcome(duel(1, 1))).toBe('draw');
  });

  it('decides a drawn duel by penalties', () => {
    expect(duelOutcome(duel(1, 1, { order: 6, penaltiesA: 5, penaltiesB: 4 }))).toBe('A');
    expect(duelOutcome(duel(0, 0, { order: 6, penaltiesA: 2, penaltiesB: 3 }))).toBe('B');
  });

  it('ignores penalties when goals already decide', () => {
    expect(duelOutcome(duel(2, 1, { penaltiesA: 0, penaltiesB: 5 }))).toBe('A');
  });

  it('treats tied or one-sided penalties as a draw', () => {
    expect(duelOutcome(duel(1, 1, { penaltiesA: 4, penaltiesB: 4 }))).toBe('draw');
    expect(duelOutcome(duel(1, 1, { penaltiesA: 3 }))).toBe('draw');
  });
});
