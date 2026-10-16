import { describe, expect, it } from 'vitest';
import { eliminationPodium, roundRobinPodium } from '../src/tournaments/podium';

const teamOf = new Map([
  [0, 'a'],
  [1, 'b'],
  [2, 'c'],
  [3, 'd'],
]);

describe('eliminationPodium', () => {
  it('uses ranks 1, 2 and a single rank 3', () => {
    expect(
      eliminationPodium(
        [
          { id: 2, rank: 1 },
          { id: 0, rank: 2 },
          { id: 3, rank: 3 },
          { id: 1, rank: 4 },
        ],
        teamOf,
      ),
    ).toEqual([
      { teamId: 'c', position: 1 },
      { teamId: 'a', position: 2 },
      { teamId: 'd', position: 3 },
    ]);
  });

  it('skips third place when two teams share rank 3', () => {
    expect(
      eliminationPodium(
        [
          { id: 0, rank: 1 },
          { id: 1, rank: 2 },
          { id: 2, rank: 3 },
          { id: 3, rank: 3 },
        ],
        teamOf,
      ),
    ).toEqual([
      { teamId: 'a', position: 1 },
      { teamId: 'b', position: 2 },
    ]);
  });
});

describe('roundRobinPodium', () => {
  it('takes the top three rows', () => {
    const rows = ['x', 'y', 'z', 'w'].map((teamId) => ({ teamId }));
    expect(roundRobinPodium(rows)).toEqual([
      { teamId: 'x', position: 1 },
      { teamId: 'y', position: 2 },
      { teamId: 'z', position: 3 },
    ]);
  });
});
