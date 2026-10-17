import { computeStandings, type StandingRow } from '@kickabout/shared';
import type { Db } from '../db';
import { AppError } from '../errors';
import { completedFixtures, toFixtureRecord } from '../stats/queries';
import type { TournamentOptions } from './options';
import type { TournamentWithEntries } from './routes';
import type { BracketData } from './bracket-store';
import { MATCH_STATUS, teamIdByParticipant } from './bracket-view';

/** Fase 2 da copa (mata-mata), se já foi sorteada. */
export const knockoutStageOf = (data: BracketData | null) => data?.stage.find((stage) => stage.number === 2) ?? null;

/** Confrontos da fase de grupos (fase 1) ainda sem resultado confirmado. */
export function groupsPending(data: BracketData): number {
  const groupStage = data.stage.find((stage) => stage.number === 1);
  return data.match.filter((match) => match.stage_id === groupStage?.id && match.status < MATCH_STATUS.Completed).length;
}

/** Grupos da fase 1: times (na ordem do seed) e partidas de cada grupo. */
export function cupGroups(data: BracketData, seedOf: Map<string, number>) {
  const groupStage = data.stage.find((stage) => stage.number === 1);
  const teamOf = teamIdByParticipant(data);
  return data.group
    .filter((group) => group.stage_id === groupStage?.id)
    .sort((a, b) => a.number - b.number)
    .map((group) => {
      const matches = data.match.filter((match) => match.group_id === group.id);
      const participantIds = new Set(matches.flatMap((match) => [match.opponent1?.id, match.opponent2?.id]).filter((pid) => pid != null).map(Number));
      const teamIds = [...participantIds].map((pid) => teamOf.get(pid)!).sort((a, b) => (seedOf.get(a) ?? 0) - (seedOf.get(b) ?? 0));
      return { groupNumber: group.number, teamIds, matchIds: matches.map((match) => Number(match.id)) };
    });
}

export type CupStandingRow = StandingRow & { groupNumber: number; qualified: boolean };

/** Classificação de cada grupo com os classificados marcados. */
export async function cupStandings(db: Db, t: TournamentWithEntries, data: BracketData): Promise<CupStandingRow[]> {
  const options = t.options as unknown as TournamentOptions;
  const fixtures = await completedFixtures(db, { tournamentId: t.id });
  const byMatch = new Map(fixtures.map((fixture) => [fixture.bmMatchId, fixture]));
  const seedOf = new Map(t.entries.map((entry) => [entry.team.id, entry.seed]));
  return cupGroups(data, seedOf).flatMap((group) => {
    const records = group.matchIds.flatMap((matchId) => {
      const fixture = byMatch.get(matchId);
      return fixture ? [toFixtureRecord(fixture)] : [];
    });
    return computeStandings(group.teamIds, records).map((row) => ({
      ...row,
      groupNumber: group.groupNumber,
      qualified: row.position <= options.qualifiersPerGroup,
    }));
  });
}

export const groupsLockedError = () =>
  new AppError(409, 'GROUPS_LOCKED', 'Desfaça o sorteio do mata-mata para corrigir jogos dos grupos.');

/** Recusa sortear de novo ou desfazer quando algum confronto do mata-mata tem resultado (confirmado ou rascunho). */
export async function assertKnockoutUntouched(db: Db, tournamentId: string, data: BracketData) {
  const knockout = knockoutStageOf(data);
  if (!knockout) return;
  const matchIds = data.match.filter((match) => match.stage_id === knockout.id).map((match) => Number(match.id));
  const touched = await db.fixture.count({ where: { tournamentId, bmMatchId: { in: matchIds } } });
  if (touched > 0) {
    throw new AppError(409, 'KNOCKOUT_STARTED', 'Já há resultado lançado no mata-mata; não dá para sortear de novo nem desfazer.');
  }
}

export const groupsPendingError = (pending: number) =>
  new AppError(409, 'GROUPS_PENDING', pending === 1 ? 'Falta 1 jogo dos grupos.' : `Faltam ${pending} jogos dos grupos.`);
