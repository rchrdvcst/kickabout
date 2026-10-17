import type { Match, Participant } from 'brackets-model';
import type { BracketData } from './bracket-store';

export const MATCH_STATUS = { Locked: 0, Waiting: 1, Ready: 2, Running: 3, Completed: 4, Archived: 5 } as const;

export interface MatchView {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  status: number;
  teamAId: string;
  teamBId: string;
  participantAId: number;
  participantBId: number;
  scoreA: number | null;
  scoreB: number | null;
}

export function teamIdByParticipant(data: BracketData): Map<number, string> {
  return new Map(data.participant.map((p) => [Number(p.id), (p as Participant & { teamId: string }).teamId]));
}

export function matchView(data: BracketData, match: Match): MatchView | null {
  const a = match.opponent1?.id;
  const b = match.opponent2?.id;
  if (a == null || b == null) return null;
  const teams = teamIdByParticipant(data);
  const teamAId = teams.get(Number(a));
  const teamBId = teams.get(Number(b));
  if (!teamAId || !teamBId) return null;
  return {
    matchId: Number(match.id),
    groupNumber: data.group.find((g) => g.id === match.group_id)?.number ?? 1,
    roundNumber: data.round.find((r) => r.id === match.round_id)?.number ?? 1,
    number: match.number,
    status: match.status,
    teamAId,
    teamBId,
    participantAId: Number(a),
    participantBId: Number(b),
    scoreA: match.opponent1?.score ?? null,
    scoreB: match.opponent2?.score ?? null,
  };
}

export function listMatches(data: BracketData): MatchView[] {
  return data.match.map((match) => matchView(data, match)).filter((view): view is MatchView => view !== null);
}

export function findMatch(data: BracketData, matchId: number): Match | undefined {
  return data.match.find((match) => Number(match.id) === matchId);
}

/** Completo quando toda partida é BYE ou já tem resultado. */
export function isStageComplete(data: BracketData): boolean {
  return data.match.every(
    (match) => match.opponent1 === null || match.opponent2 === null || match.status >= MATCH_STATUS.Completed,
  );
}

/** Partidas posteriores, já com resultado e sem BYE, que envolvem algum dos times da partida informada. */
export function laterCompletedMatchIds(data: BracketData, matchId: number): number[] {
  const match = findMatch(data, matchId);
  if (!match) return [];
  const participants = new Set(
    [match.opponent1?.id, match.opponent2?.id].filter((id) => id != null).map(Number),
  );
  return data.match
    .filter(
      (other) =>
        Number(other.id) > matchId &&
        other.status >= MATCH_STATUS.Completed &&
        other.opponent1?.id != null &&
        other.opponent2?.id != null &&
        [other.opponent1?.id, other.opponent2?.id].some((id) => id != null && participants.has(Number(id))),
    )
    .map((other) => Number(other.id));
}
