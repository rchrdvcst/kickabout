import { duelOutcome } from './duel';
import { computeFixtureScore, sumGoals } from './fixture-score';
import type { DuelInput, FixtureRecord } from './types';

export interface PlayerStats {
  playerId: string;
  duels: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  /** wins / duels, de 0 a 1. */
  winRate: number;
}

export interface RecordTally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TeamStats {
  teamId: string;
  fixtures: RecordTally;
  duels: RecordTally;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

type Result = 'win' | 'draw' | 'loss';

const emptyTally = (): RecordTally => ({ played: 0, wins: 0, draws: 0, losses: 0 });

function tally(target: RecordTally, result: Result) {
  target.played++;
  if (result === 'win') target.wins++;
  else if (result === 'draw') target.draws++;
  else target.losses++;
}

const resultFor = (side: 'A' | 'B', outcome: 'A' | 'B' | 'draw'): Result =>
  outcome === 'draw' ? 'draw' : outcome === side ? 'win' : 'loss';

export function aggregatePlayerStats(duels: readonly DuelInput[]): PlayerStats[] {
  const byPlayer = new Map<string, PlayerStats>();
  const statsFor = (playerId: string): PlayerStats => {
    let stats = byPlayer.get(playerId);
    if (!stats) {
      stats = { playerId, duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 };
      byPlayer.set(playerId, stats);
    }
    return stats;
  };
  const apply = (stats: PlayerStats, result: Result, goalsFor: number, goalsAgainst: number) => {
    stats.duels++;
    if (result === 'win') stats.wins++;
    else if (result === 'draw') stats.draws++;
    else stats.losses++;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
  };

  for (const duel of duels) {
    const outcome = duelOutcome(duel);
    apply(statsFor(duel.playerAId), resultFor('A', outcome), duel.goalsA, duel.goalsB);
    apply(statsFor(duel.playerBId), resultFor('B', outcome), duel.goalsB, duel.goalsA);
  }

  return [...byPlayer.values()]
    .map((stats) => ({
      ...stats,
      goalDiff: stats.goalsFor - stats.goalsAgainst,
      winRate: stats.duels === 0 ? 0 : stats.wins / stats.duels,
    }))
    .sort(
      (a, b) =>
        b.goalsFor - a.goalsFor ||
        b.goalDiff - a.goalDiff ||
        b.wins - a.wins ||
        a.playerId.localeCompare(b.playerId),
    );
}

export function aggregateTeamStats(teamId: string, fixtures: readonly FixtureRecord[]): TeamStats {
  const stats: TeamStats = {
    teamId,
    fixtures: emptyTally(),
    duels: emptyTally(),
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
  };

  for (const fixture of fixtures) {
    const side = fixture.teamAId === teamId ? 'A' : fixture.teamBId === teamId ? 'B' : null;
    if (!side) continue;

    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    const own = side === 'A' ? scoreA : scoreB;
    const opponent = side === 'A' ? scoreB : scoreA;
    tally(stats.fixtures, own > opponent ? 'win' : own === opponent ? 'draw' : 'loss');

    for (const duel of fixture.duels) tally(stats.duels, resultFor(side, duelOutcome(duel)));

    const { goalsA, goalsB } = sumGoals(fixture.duels);
    stats.goalsFor += side === 'A' ? goalsA : goalsB;
    stats.goalsAgainst += side === 'A' ? goalsB : goalsA;
  }

  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;
  return stats;
}
