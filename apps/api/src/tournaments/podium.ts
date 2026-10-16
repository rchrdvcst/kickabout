export interface PodiumEntry {
  teamId: string;
  position: 1 | 2 | 3;
}

export function eliminationPodium(
  standings: { id: number | string; rank: number }[],
  teamOf: Map<number, string>,
): PodiumEntry[] {
  const withRank = (rank: number) =>
    standings
      .filter((s) => s.rank === rank)
      .map((s) => teamOf.get(Number(s.id)))
      .filter((teamId): teamId is string => teamId !== undefined);
  const podium: PodiumEntry[] = [];
  const [first] = withRank(1);
  if (first) podium.push({ teamId: first, position: 1 });
  const [second] = withRank(2);
  if (second) podium.push({ teamId: second, position: 2 });
  const thirds = withRank(3);
  if (thirds.length === 1) podium.push({ teamId: thirds[0]!, position: 3 });
  return podium;
}

export function roundRobinPodium(rows: { teamId: string }[]): PodiumEntry[] {
  return rows.slice(0, 3).map((row, index) => ({ teamId: row.teamId, position: (index + 1) as 1 | 2 | 3 }));
}
