import { POINTS } from './constants';
import { computeFixtureScore, sumGoals } from './fixture-score';
import type { FixtureRecord } from './types';

export interface StandingRow {
  position: number;
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  duelsWon: number;
  duelsLost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

const emptyRow = (teamId: string): StandingRow => ({
  position: 0,
  teamId,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  duelsWon: 0,
  duelsLost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
});

function fixturePoints(own: number, opponent: number): number {
  if (own > opponent) return POINTS.win;
  if (own === opponent) return POINTS.draw;
  return POINTS.loss;
}

function applyFixture(row: StandingRow, own: number, opponent: number, goalsFor: number, goalsAgainst: number) {
  row.played++;
  row.duelsWon += own;
  row.duelsLost += opponent;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.points += fixturePoints(own, opponent);
  if (own > opponent) row.wins++;
  else if (own === opponent) row.draws++;
  else row.losses++;
}

function headToHeadPoints(teamIds: ReadonlySet<string>, fixtures: readonly FixtureRecord[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const fixture of fixtures) {
    if (!teamIds.has(fixture.teamAId) || !teamIds.has(fixture.teamBId)) continue;
    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    points.set(fixture.teamAId, (points.get(fixture.teamAId) ?? 0) + fixturePoints(scoreA, scoreB));
    points.set(fixture.teamBId, (points.get(fixture.teamBId) ?? 0) + fixturePoints(scoreB, scoreA));
  }
  return points;
}

export function computeStandings(
  teamIdsBySeed: readonly string[],
  fixtures: readonly FixtureRecord[],
): StandingRow[] {
  const rows = new Map(teamIdsBySeed.map((teamId) => [teamId, emptyRow(teamId)]));
  const rowFor = (teamId: string): StandingRow => {
    const row = rows.get(teamId);
    if (!row) throw new Error(`Time desconhecido: ${teamId}`);
    return row;
  };

  for (const fixture of fixtures) {
    const rowA = rowFor(fixture.teamAId);
    const rowB = rowFor(fixture.teamBId);
    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    const { goalsA, goalsB } = sumGoals(fixture.duels);
    applyFixture(rowA, scoreA, scoreB, goalsA, goalsB);
    applyFixture(rowB, scoreB, scoreA, goalsB, goalsA);
  }

  const seedIndex = new Map(teamIdsBySeed.map((teamId, index) => [teamId, index]));
  const seed = (row: StandingRow) => seedIndex.get(row.teamId) ?? Number.MAX_SAFE_INTEGER;

  for (const row of rows.values()) row.goalDiff = row.goalsFor - row.goalsAgainst;

  const byPoints = [...rows.values()].sort((a, b) => b.points - a.points || seed(a) - seed(b));
  const ordered: StandingRow[] = [];

  for (let start = 0; start < byPoints.length; ) {
    const points = byPoints[start]!.points;
    let end = start;
    while (end < byPoints.length && byPoints[end]!.points === points) end++;
    const group = byPoints.slice(start, end);

    if (group.length > 1) {
      const h2h = headToHeadPoints(new Set(group.map((row) => row.teamId)), fixtures);
      const h2hOf = (row: StandingRow) => h2h.get(row.teamId) ?? 0;
      group.sort(
        (a, b) =>
          h2hOf(b) - h2hOf(a) ||
          b.wins - a.wins ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          seed(a) - seed(b),
      );
    }

    ordered.push(...group);
    start = end;
  }

  return ordered.map((row, index) => ({ ...row, position: index + 1 }));
}
