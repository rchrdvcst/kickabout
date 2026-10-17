import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cupLayout, cupProblem, duelOutcome, type DuelOutcome } from '@kickabout/shared';
import type { BracketData, DuelView, Phase, TournamentFormat, TournamentStatus } from '../api/types';

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
  cup: 'Copa (grupos + mata-mata)',
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Em preparação',
  in_progress: 'Em andamento',
  finished: 'Encerrado',
};

/** Mínimo de times para iniciar (igual a `apps/api/src/tournaments/stage.ts`). */
export const MIN_TEAMS: Record<TournamentFormat, number> = {
  single_elimination: 2,
  double_elimination: 3,
  round_robin: 2,
  cup: 4,
};

export const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

/** Brasileiro no formato nacional, (11) 98765-4321; estrangeiro no internacional, +351 912 345 678. */
export function formatPhone(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export const positionLabel = (position: number): string =>
  position === 1 ? 'Campeão' : position === 2 ? 'Vice' : `${position}º lugar`;

export function eliminationRoundName(roundNumber: number, roundCount: number): string {
  const names = ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'];
  return names[roundCount - roundNumber] ?? `${roundNumber}ª rodada`;
}

export function roundLabel(format: TournamentFormat, groupNumber: number, roundNumber: number, roundCount: number): string {
  if (format === 'round_robin' || format === 'cup') return `Rodada ${roundNumber}`;
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
export function roundCounts(data: BracketData | null, phase?: Phase): Map<number, number> {
  const counts = new Map<number, number>();
  const scoped = data && phase ? phaseData(data, phase) : data;
  if (!scoped) return counts;
  for (const group of scoped.group) {
    counts.set(group.number, scoped.round.filter((round) => round.group_id === group.id).length);
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

/** Letra do grupo: 1 → A, 2 → B. */
export const groupLetter = (n: number): string => String.fromCharCode(64 + n);

/** Só uma fase da chave (copa: 'groups' = fase 1, 'knockout' = fase 2). */
export function phaseData(data: BracketData, phase: Phase): BracketData | null {
  const stage = data.stage.find((s) => (s.type === 'round_robin') === (phase === 'groups'));
  if (!stage) return null;
  return {
    ...data,
    stage: [stage],
    group: data.group.filter((g) => g.stage_id === stage.id),
    round: data.round.filter((r) => r.stage_id === stage.id),
    match: data.match.filter((m) => m.stage_id === stage.id),
    match_game: data.match_game.filter((g) => g.stage_id === stage.id),
  };
}

/** Nome da rodada de um confronto, considerando a fase na copa. */
export function fixtureRoundLabel(
  format: TournamentFormat,
  data: BracketData | null,
  f: { phase: Phase; groupNumber: number; roundNumber: number },
): string {
  const counts = roundCounts(data, format === 'cup' ? f.phase : undefined);
  const roundCount = counts.get(f.groupNumber) ?? f.roundNumber;
  if (format === 'cup') {
    return f.phase === 'groups'
      ? `Grupo ${groupLetter(f.groupNumber)}, ${f.roundNumber}ª rodada`
      : roundLabel('single_elimination', f.groupNumber, f.roundNumber, roundCount);
  }
  return roundLabel(format, f.groupNumber, f.roundNumber, roundCount);
}

const listPt = (items: string[]) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(items);

/** Resumo da copa para o formulário: tamanhos dos grupos, classificados e mata-mata, ou o que impede. */
export function cupSummary(teamCount: number, groupCount: number, qualifiers: number): string {
  const problem = cupProblem(teamCount, groupCount, qualifiers);
  const layout = cupLayout(teamCount, groupCount);
  if (problem || !layout.ok) return problem ?? 'Opções inválidas.';
  const sizes = layout.sizes;
  const groups = sizes.every((size) => size === sizes[0])
    ? `${groupCount} grupos de ${sizes[0]}`
    : `grupos de ${listPt(sizes.map(String))}`;
  const total = groupCount * qualifiers;
  let bracket = 1;
  while (bracket < total) bracket *= 2;
  const byes = bracket - total;
  const byeText = byes === 0 ? '' : ` com ${byes} ${byes === 1 ? 'BYE' : 'BYEs'}`;
  return `${teamCount} times: ${groups}; passam ${total}; mata-mata de ${bracket}${byeText}.`;
}
