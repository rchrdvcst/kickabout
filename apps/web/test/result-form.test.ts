import { describe, expect, it } from 'vitest';
import {
  duelsToSend,
  emptyRow,
  liveScore,
  penaltiesNeeded,
  playerOptions,
  rowToDuel,
  rowsFromDuels,
  tiebreakNeeded,
  type DuelRow,
} from '../src/lib/result-form';

const row = (a: string, b: string, goalsA: string, goalsB: string, penaltiesA = '', penaltiesB = ''): DuelRow => ({
  playerAId: a,
  playerBId: b,
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});
const five = (scores: [string, string][]) => scores.map(([goalsA, goalsB], i) => row(`a${i + 1}`, `b${i + 1}`, goalsA, goalsB));
const roster = (side: string) => Array.from({ length: 6 }, (_, i) => ({ id: `${side}${i + 1}`, name: `${side}${i + 1}` }));
const TIED: [string, string][] = [['1', '0'], ['1', '0'], ['0', '1'], ['0', '1'], ['2', '2']];
const NOT_TIED: [string, string][] = [['1', '0'], ['1', '0'], ['1', '0'], ['0', '1'], ['2', '2']];

describe('result form', () => {
  it('turns saved duels into six editable rows', () => {
    const rows = rowsFromDuels([
      { order: 6, playerA: { id: 'a1', name: 'A' }, playerB: { id: 'b1', name: 'B' }, goalsA: 1, goalsB: 1, penaltiesA: 5, penaltiesB: 4 },
    ]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual(emptyRow());
    expect(rows[5]).toEqual(row('a1', 'b1', '1', '1', '5', '4'));
  });

  it('only turns rows with both players and a valid score into duels', () => {
    expect(rowToDuel(row('a1', 'b1', '2', '0'), 1)).toEqual({ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 0 });
    expect(rowToDuel(row('a1', '', '2', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', '2a', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', '100', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', ' 3 ', '0'), 1)).toMatchObject({ goalsA: 3 });
    expect(rowToDuel(row('a1', 'b1', '2', '0', '5', '4'), 6)).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 0 });
  });

  it('hides players already picked by the same team in duels 1 to 5', () => {
    const rows = [row('a1', 'b1', '', ''), row('a2', '', '', ''), emptyRow(), emptyRow(), emptyRow(), emptyRow()];
    expect(playerOptions(roster('a'), rows, 'A', 1).map((p) => p.id)).toEqual(['a2', 'a3', 'a4', 'a5', 'a6']);
    expect(playerOptions(roster('b'), rows, 'B', 1).map((p) => p.id)).toEqual(['b2', 'b3', 'b4', 'b5', 'b6']);
    expect(playerOptions(roster('a'), rows, 'A', 5)).toHaveLength(6);
  });

  it('needs the tiebreak only in a tied knockout with all five duels', () => {
    const tied = [...five(TIED), emptyRow()];
    expect(tiebreakNeeded(tied, true)).toBe(true);
    expect(tiebreakNeeded(tied, false)).toBe(false);
    expect(tiebreakNeeded([...tied.slice(0, 4), emptyRow(), emptyRow()], true)).toBe(false);
    expect(tiebreakNeeded([...five(NOT_TIED), emptyRow()], true)).toBe(false);
  });

  it('requires penalties when the tiebreak ends level and lets them decide the score', () => {
    const tiebreak = row('a1', 'b1', '1', '1', '5', '4');
    expect(penaltiesNeeded(tiebreak)).toBe(true);
    expect(penaltiesNeeded(row('a1', 'b1', '2', '1'))).toBe(false);
    expect(penaltiesNeeded(emptyRow())).toBe(false);
    const rows = [...five(TIED), tiebreak];
    expect(duelsToSend(rows, true)[5]).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 1, penaltiesA: 5, penaltiesB: 4 });
    expect(liveScore(rows, true)).toEqual({ scoreA: 3, scoreB: 2, winner: 'A' });
  });

  it('drops a leftover tiebreak once the regular duels are no longer tied', () => {
    const rows = [...five(NOT_TIED), row('a1', 'b1', '1', '0')];
    expect(duelsToSend(rows, true)).toHaveLength(5);
    expect(liveScore(rows, true)).toEqual({ scoreA: 3, scoreB: 1, winner: 'A' });
  });
});
