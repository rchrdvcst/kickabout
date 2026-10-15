import { describe, expect, it } from 'vitest';
import { aggregatePlayerStats, aggregateTeamStats } from './stats';
import { D, L, W, fx } from './testing/fixtures';
import type { DuelInput } from './types';

describe('aggregatePlayerStats', () => {
  const duels: DuelInput[] = [
    { order: 1, playerAId: 'p1', playerBId: 'q1', goalsA: 2, goalsB: 0 },
    { order: 1, playerAId: 'p1', playerBId: 'q2', goalsA: 1, goalsB: 1 },
    { order: 6, playerAId: 'p1', playerBId: 'q1', goalsA: 0, goalsB: 0, penaltiesA: 3, penaltiesB: 4 },
  ];

  it('aggregates both sides and counts penalty results as wins/losses', () => {
    const stats = aggregatePlayerStats(duels);
    expect(stats.map((s) => s.playerId)).toEqual(['p1', 'q2', 'q1']);
    expect(stats[0]).toEqual({
      playerId: 'p1',
      duels: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDiff: 2,
      winRate: 1 / 3,
    });
    expect(stats[2]).toMatchObject({ playerId: 'q1', duels: 2, wins: 1, losses: 1, goalsFor: 0, goalsAgainst: 2 });
  });

  it('returns an empty list for no duels', () => {
    expect(aggregatePlayerStats([])).toEqual([]);
  });
});

describe('aggregateTeamStats', () => {
  it('aggregates fixtures and duels from the team perspective on either side', () => {
    const fixtures = [
      fx('X', 'Y', [W, W, W, L, D]),
      fx('Y', 'X', [W, W, L, L, D, [1, 1, 4, 5]]),
      fx('Z', 'W', [W, W, W, D, D]),
    ];
    expect(aggregateTeamStats('X', fixtures)).toEqual({
      teamId: 'X',
      fixtures: { played: 2, wins: 2, draws: 0, losses: 0 },
      duels: { played: 11, wins: 6, draws: 2, losses: 3 },
      goalsFor: 6,
      goalsAgainst: 4,
      goalDiff: 2,
    });
  });

  it('returns zeros for a team without fixtures', () => {
    expect(aggregateTeamStats('X', [])).toEqual({
      teamId: 'X',
      fixtures: { played: 0, wins: 0, draws: 0, losses: 0 },
      duels: { played: 0, wins: 0, draws: 0, losses: 0 },
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    });
  });
});
