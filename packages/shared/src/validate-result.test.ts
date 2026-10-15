import { describe, expect, it } from 'vitest';
import { validateFixtureResult, type ValidateResultInput } from './validate-result';
import type { DuelInput } from './types';

const rosterA = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
const rosterB = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'];

const d = (order: number, goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order,
  playerAId: `a${order}`,
  playerBId: `b${order}`,
  goalsA,
  goalsB,
  ...extra,
});

// 3x1: A vence 1, 2 e 4; B vence 3; duelo 5 empata.
const threeToOne = (): DuelInput[] => [d(1, 2, 0), d(2, 1, 0), d(3, 0, 1), d(4, 3, 1), d(5, 1, 1)];
// 2x2 após os 5 duelos.
const twoToTwo = (): DuelInput[] => [d(1, 1, 0), d(2, 1, 0), d(3, 0, 1), d(4, 0, 2), d(5, 2, 2)];

const run = (overrides: Partial<ValidateResultInput>) =>
  validateFixtureResult({ mode: 'final', isKnockout: false, duels: threeToOne(), rosterA, rosterB, ...overrides });
const codes = (overrides: Partial<ValidateResultInput>) => run(overrides).map((issue) => issue.code);

describe('validateFixtureResult', () => {
  it('accepts a complete round robin result', () => {
    expect(run({})).toEqual([]);
  });

  it('accepts a round robin draw without a 6th duel', () => {
    expect(run({ duels: twoToTwo() })).toEqual([]);
  });

  it('rejects negative or fractional goals and penalties', () => {
    const duels = threeToOne();
    duels[0] = d(1, -1, 0);
    duels[1] = d(2, 1.5, 0);
    expect(codes({ duels })).toEqual(['INVALID_GOALS', 'INVALID_GOALS']);
  });

  it('rejects duel orders outside 1..6', () => {
    const duels = threeToOne();
    duels[4] = d(7, 1, 1, { playerAId: 'a5', playerBId: 'b5' });
    expect(codes({ duels })).toContain('INVALID_DUEL_ORDER');
  });

  it('rejects duplicated duel orders', () => {
    const duels = threeToOne();
    duels[4] = d(4, 1, 1, { playerAId: 'a5', playerBId: 'b5' });
    expect(codes({ duels })).toContain('DUPLICATE_DUEL_ORDER');
  });

  it('requires duels 1..5 in final mode but not in draft mode', () => {
    const duels = threeToOne().slice(0, 4);
    expect(codes({ duels })).toEqual(['MISSING_DUELS']);
    expect(codes({ duels, mode: 'draft' })).toEqual([]);
  });

  it('rejects players outside the active roster', () => {
    const duels = threeToOne();
    duels[0] = d(1, 2, 0, { playerAId: 'intruder' });
    const issues = run({ duels });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'PLAYER_NOT_IN_ROSTER', path: 'duels.0.playerAId' });
  });

  it('rejects the same player in two regular duels', () => {
    const duels = threeToOne();
    duels[1] = d(2, 1, 0, { playerBId: 'b1' });
    const issues = run({ duels });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'PLAYER_REPEATED', path: 'duels.1.playerBId' });
  });

  it('allows a player who already played to take the 6th duel', () => {
    const duels = [...twoToTwo(), d(6, 1, 0, { playerAId: 'a1', playerBId: 'b3' })];
    expect(run({ isKnockout: true, duels })).toEqual([]);
  });

  it('rejects a 6th duel in round robin', () => {
    const duels = [...twoToTwo(), d(6, 1, 0)];
    expect(codes({ duels })).toEqual(['TIEBREAKER_NOT_ALLOWED']);
  });

  it('rejects a 6th duel when the knockout fixture was not tied', () => {
    const duels = [...threeToOne(), d(6, 1, 0)];
    expect(codes({ isKnockout: true, duels })).toEqual(['TIEBREAKER_NOT_ALLOWED']);
  });

  it('requires a 6th duel for a tied knockout fixture in final mode only', () => {
    expect(codes({ isKnockout: true, duels: twoToTwo() })).toEqual(['TIEBREAKER_REQUIRED']);
    expect(codes({ isKnockout: true, duels: twoToTwo(), mode: 'draft' })).toEqual([]);
  });

  it('rejects penalties on regular duels', () => {
    const duels = threeToOne();
    duels[4] = d(5, 1, 1, { penaltiesA: 5, penaltiesB: 4 });
    expect(codes({ duels })).toEqual(['PENALTIES_NOT_ALLOWED']);
  });

  it('rejects penalties on a 6th duel already decided by goals', () => {
    const duels = [...twoToTwo(), d(6, 2, 1, { penaltiesA: 3, penaltiesB: 4 })];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_NOT_ALLOWED']);
  });

  it('requires penalties when the 6th duel is drawn', () => {
    const duels = [...twoToTwo(), d(6, 1, 1)];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_REQUIRED']);
    const oneSided = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 4 })];
    expect(codes({ isKnockout: true, duels: oneSided })).toEqual(['PENALTIES_REQUIRED']);
  });

  it('rejects tied penalties', () => {
    const duels = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 4, penaltiesB: 4 })];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_TIED']);
  });

  it('accepts a 6th duel decided on penalties', () => {
    const duels = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 5, penaltiesB: 4 })];
    expect(run({ isKnockout: true, duels })).toEqual([]);
  });

  it('returns Portuguese messages', () => {
    const [issue] = run({ duels: threeToOne().slice(0, 4) });
    expect(issue?.message).toBe('Para confirmar o resultado, os duelos 1 a 5 precisam estar preenchidos.');
  });
});
