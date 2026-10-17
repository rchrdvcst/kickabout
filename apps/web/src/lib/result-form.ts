import { computeFixtureScore, type DuelInput, type FixtureScore } from '@kickabout/shared';
import type { DuelView, PlayerRef } from '../api/types';

/** Uma linha do formulário: campos como texto (vazio = ainda não preenchido). */
export interface DuelRow {
  playerAId: string;
  playerBId: string;
  goalsA: string;
  goalsB: string;
  penaltiesA: string;
  penaltiesB: string;
}

const REGULAR = 5;
export const TIEBREAK_INDEX = 5;

export const emptyRow = (): DuelRow => ({ playerAId: '', playerBId: '', goalsA: '', goalsB: '', penaltiesA: '', penaltiesB: '' });

const text = (value: number | null) => (value === null ? '' : String(value));

/** Sempre seis linhas (duelos 1 a 6), preenchidas com o que já foi salvo. */
export function rowsFromDuels(duels: DuelView[]): DuelRow[] {
  const rows = Array.from({ length: 6 }, emptyRow);
  for (const duel of duels) {
    if (duel.order < 1 || duel.order > 6) continue;
    rows[duel.order - 1] = {
      playerAId: duel.playerA.id,
      playerBId: duel.playerB.id,
      goalsA: String(duel.goalsA),
      goalsB: String(duel.goalsB),
      penaltiesA: text(duel.penaltiesA),
      penaltiesB: text(duel.penaltiesB),
    };
  }
  return rows;
}

const toInt = (value: string): number | null => (/^\d{1,2}$/.test(value.trim()) ? Number(value.trim()) : null);

/** Duelo pronto para enviar, ou null se faltar jogador ou placar. Pênaltis só no 6º duelo empatado. */
export function rowToDuel(row: DuelRow, order: number): DuelInput | null {
  const goalsA = toInt(row.goalsA);
  const goalsB = toInt(row.goalsB);
  if (!row.playerAId || !row.playerBId || goalsA === null || goalsB === null) return null;
  const duel: DuelInput = { order, playerAId: row.playerAId, playerBId: row.playerBId, goalsA, goalsB };
  if (order === TIEBREAK_INDEX + 1 && goalsA === goalsB) {
    const penaltiesA = toInt(row.penaltiesA);
    const penaltiesB = toInt(row.penaltiesB);
    if (penaltiesA !== null && penaltiesB !== null) return { ...duel, penaltiesA, penaltiesB };
  }
  return duel;
}

function regularDuels(rows: DuelRow[]): DuelInput[] {
  return rows.slice(0, REGULAR).flatMap((row, index) => {
    const duel = rowToDuel(row, index + 1);
    return duel ? [duel] : [];
  });
}

/** Mata-mata com os 5 duelos lançados e placar empatado: aparece o 6º duelo. */
export function tiebreakNeeded(rows: DuelRow[], isKnockout: boolean): boolean {
  const regular = regularDuels(rows);
  if (!isKnockout || regular.length < REGULAR) return false;
  const { scoreA, scoreB } = computeFixtureScore(regular);
  return scoreA === scoreB;
}

/** 6º duelo empatado no tempo normal: os pênaltis passam a ser obrigatórios. */
export function penaltiesNeeded(row: DuelRow): boolean {
  const goalsA = toInt(row.goalsA);
  return goalsA !== null && goalsA === toInt(row.goalsB);
}

/** Duelos a enviar: os completos de 1 a 5 e, quando cabe, o 6º. */
export function duelsToSend(rows: DuelRow[], isKnockout: boolean): DuelInput[] {
  const regular = regularDuels(rows);
  if (!tiebreakNeeded(rows, isKnockout)) return regular;
  const tiebreak = rowToDuel(rows[TIEBREAK_INDEX] ?? emptyRow(), TIEBREAK_INDEX + 1);
  return tiebreak ? [...regular, tiebreak] : regular;
}

export const liveScore = (rows: DuelRow[], isKnockout: boolean): FixtureScore => computeFixtureScore(duelsToSend(rows, isKnockout));

/** Opções do seletor: nos duelos 1 a 5 some quem já foi escolhido em outro duelo do mesmo time; no 6º vale o elenco todo. */
export function playerOptions(roster: PlayerRef[], rows: DuelRow[], side: 'A' | 'B', index: number): PlayerRef[] {
  if (index === TIEBREAK_INDEX) return roster;
  const key = side === 'A' ? 'playerAId' : 'playerBId';
  const taken = new Set(
    rows
      .slice(0, REGULAR)
      .filter((_, i) => i !== index)
      .map((row) => row[key])
      .filter(Boolean),
  );
  return roster.filter((player) => !taken.has(player.id));
}

const isBadNumber = (value: string) => value.trim() !== '' && toInt(value) === null;

/** Duelos com gols (ou pênaltis visíveis) que não são números de 0 a 99: o envio os ignoraria em silêncio. */
export function invalidScoreLabels(rows: DuelRow[], includeTiebreak: boolean): string[] {
  return rows.flatMap((row, index) => {
    const tiebreak = index === TIEBREAK_INDEX;
    if (tiebreak && !includeTiebreak) return [];
    const fields = tiebreak && penaltiesNeeded(row) ? [row.goalsA, row.goalsB, row.penaltiesA, row.penaltiesB] : [row.goalsA, row.goalsB];
    return fields.some(isBadNumber) ? [tiebreak ? 'Desempate' : `${index + 1}º duelo`] : [];
  });
}
