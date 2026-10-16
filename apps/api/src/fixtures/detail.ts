import type { Db } from '../db';
import { teamsById, type TeamRef } from '../dto';
import { AppError, notFound } from '../errors';
import { activePlayers } from '../players/roster';
import type { BracketData } from '../tournaments/bracket-store';
import { findMatch, listMatches, matchView, type MatchView } from '../tournaments/bracket-view';

export type FixtureStatusView = 'pending' | 'draft' | 'completed';

export interface FixtureListItem {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  isKnockout: boolean;
  status: FixtureStatusView;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

const toItem = (view: MatchView, isKnockout: boolean, status: FixtureStatusView, teams: Map<string, TeamRef>): FixtureListItem => ({
  matchId: view.matchId,
  groupNumber: view.groupNumber,
  roundNumber: view.roundNumber,
  number: view.number,
  isKnockout,
  status,
  teamA: teams.get(view.teamAId)!,
  teamB: teams.get(view.teamBId)!,
  scoreA: status === 'completed' ? view.scoreA : null,
  scoreB: status === 'completed' ? view.scoreB : null,
});

async function bracketOf(db: Db, tournamentId: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw notFound('Campeonato');
  return { tournament, data: tournament.bracket as unknown as BracketData | null };
}

export async function listFixtures(db: Db, tournamentId: string): Promise<FixtureListItem[]> {
  const { tournament, data } = await bracketOf(db, tournamentId);
  if (!data) return [];
  const views = listMatches(data);
  const saved = await db.fixture.findMany({ where: { tournamentId }, select: { bmMatchId: true, status: true } });
  const statusByMatch = new Map(saved.map((f) => [f.bmMatchId, f.status]));
  const teams = await teamsById(db, views.flatMap((v) => [v.teamAId, v.teamBId]));
  const isKnockout = tournament.format !== 'round_robin';
  return views.map((v) => toItem(v, isKnockout, statusByMatch.get(v.matchId) ?? 'pending', teams));
}

export async function getFixtureDetail(db: Db, tournamentId: string, matchId: number, includeRosters: boolean) {
  const { tournament, data } = await bracketOf(db, tournamentId);
  const raw = data ? findMatch(data, matchId) : undefined;
  if (!data || !raw) throw notFound('Confronto');
  const view = matchView(data, raw);
  if (!view) throw new AppError(409, 'FIXTURE_NOT_READY', 'Os dois times deste confronto ainda não estão definidos.');

  const fixture = await db.fixture.findUnique({
    where: { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } },
    include: {
      duels: {
        orderBy: { order: 'asc' },
        include: { playerA: { select: { id: true, name: true } }, playerB: { select: { id: true, name: true } } },
      },
    },
  });
  const teams = await teamsById(db, [view.teamAId, view.teamBId]);
  const item = toItem(view, tournament.format !== 'round_robin', fixture?.status ?? 'pending', teams);
  const detail = {
    ...item,
    duels: (fixture?.duels ?? []).map((duel) => ({
      order: duel.order,
      playerA: duel.playerA,
      playerB: duel.playerB,
      goalsA: duel.goalsA,
      goalsB: duel.goalsB,
      penaltiesA: duel.penaltiesA,
      penaltiesB: duel.penaltiesB,
    })),
  };
  if (!includeRosters) return detail;
  const pick = (players: { id: string; name: string }[]) => players.map(({ id, name }) => ({ id, name }));
  const [rosterA, rosterB] = await Promise.all([activePlayers(db, view.teamAId), activePlayers(db, view.teamBId)]);
  return { ...detail, rosterA: pick(rosterA), rosterB: pick(rosterB) };
}
