import { duelOutcome, type DuelOutcome } from '@kickabout/shared';
import type { BracketData, DuelView, TournamentFormat, TournamentStatus } from '../api/types';

/** Resultado do duelo pelas regras do shared (que recebe ids, não objetos de jogador). */
export const outcomeOf = (duel: DuelView): DuelOutcome =>
  duelOutcome({
    order: duel.order,
    playerAId: duel.playerA.id,
    playerBId: duel.playerB.id,
    goalsA: duel.goalsA,
    goalsB: duel.goalsB,
    penaltiesA: duel.penaltiesA,
    penaltiesB: duel.penaltiesB,
  });

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  single_elimination: 'Eliminatória simples',
  double_elimination: 'Eliminatória dupla',
  round_robin: 'Pontos corridos',
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Em preparação',
  in_progress: 'Em andamento',
  finished: 'Encerrado',
};

export const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

export function formatPhone(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

export const positionLabel = (position: number): string =>
  position === 1 ? 'Campeão' : position === 2 ? 'Vice' : `${position}º lugar`;

export function eliminationRoundName(roundNumber: number, roundCount: number): string {
  const names = ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'];
  return names[roundCount - roundNumber] ?? `${roundNumber}ª rodada`;
}

export function roundLabel(format: TournamentFormat, groupNumber: number, roundNumber: number, roundCount: number): string {
  if (format === 'round_robin') return `Rodada ${roundNumber}`;
  if (format === 'single_elimination') {
    return groupNumber === 2 ? 'Disputa de 3º lugar' : eliminationRoundName(roundNumber, roundCount);
  }
  if (groupNumber === 1) {
    return roundNumber === roundCount ? 'Final da chave superior' : `Chave superior, ${roundNumber}ª rodada`;
  }
  if (groupNumber === 2) {
    return roundNumber === roundCount ? 'Final da chave inferior' : `Chave inferior, ${roundNumber}ª rodada`;
  }
  return roundNumber === 1 ? 'Grande final' : 'Final de desempate';
}

/** Número de rodadas por número de grupo (1 = chave principal/superior, 2 = inferior/3º lugar, 3 = final). */
export function roundCounts(data: BracketData | null): Map<number, number> {
  const counts = new Map<number, number>();
  if (!data) return counts;
  for (const group of data.group) {
    counts.set(group.number, data.round.filter((round) => round.group_id === group.id).length);
  }
  return counts;
}

export interface ViewerRoundInfo {
  groupType: string;
  roundNumber: number;
  roundCount: number;
  finalType?: string;
}

/** Nomes de rodada em português para o brackets-viewer (`customRoundName`). */
export function viewerRoundName(info: ViewerRoundInfo): string {
  switch (info.groupType) {
    case 'round-robin':
      return `Rodada ${info.roundNumber}`;
    case 'winner-bracket':
      return roundLabel('double_elimination', 1, info.roundNumber, info.roundCount);
    case 'loser-bracket':
      return roundLabel('double_elimination', 2, info.roundNumber, info.roundCount);
    case 'final-group':
      return info.finalType === 'consolation-final' ? 'Disputa de 3º lugar' : roundLabel('double_elimination', 3, info.roundNumber, info.roundCount);
    default:
      return eliminationRoundName(info.roundNumber, info.roundCount);
  }
}
