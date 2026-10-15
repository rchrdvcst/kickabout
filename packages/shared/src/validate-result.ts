import { REGULAR_DUELS, TIEBREAKER_ORDER } from './constants';
import { isTiedAfterRegularDuels } from './fixture-score';
import type { DuelInput } from './types';

export type ValidationCode =
  | 'INVALID_GOALS'
  | 'INVALID_DUEL_ORDER'
  | 'DUPLICATE_DUEL_ORDER'
  | 'MISSING_DUELS'
  | 'PLAYER_NOT_IN_ROSTER'
  | 'PLAYER_REPEATED'
  | 'TIEBREAKER_NOT_ALLOWED'
  | 'TIEBREAKER_REQUIRED'
  | 'PENALTIES_NOT_ALLOWED'
  | 'PENALTIES_REQUIRED'
  | 'PENALTIES_TIED';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  path?: string;
}

export interface ValidateResultInput {
  mode: 'draft' | 'final';
  isKnockout: boolean;
  duels: DuelInput[];
  rosterA: readonly string[];
  rosterB: readonly string[];
}

export const VALIDATION_MESSAGES: Record<ValidationCode, string> = {
  INVALID_GOALS: 'Gols e pênaltis devem ser números inteiros maiores ou iguais a zero.',
  INVALID_DUEL_ORDER: 'A ordem do duelo deve ser de 1 a 6.',
  DUPLICATE_DUEL_ORDER: 'Já existe um duelo com essa ordem.',
  MISSING_DUELS: 'Para confirmar o resultado, os duelos 1 a 5 precisam estar preenchidos.',
  PLAYER_NOT_IN_ROSTER: 'O jogador não faz parte do elenco ativo do time.',
  PLAYER_REPEATED: 'O jogador já foi escalado em outro duelo deste confronto.',
  TIEBREAKER_NOT_ALLOWED: 'O 6º duelo só existe no mata-mata, quando os 5 duelos terminam empatados.',
  TIEBREAKER_REQUIRED: 'Confronto de mata-mata empatado: lance o 6º duelo de desempate.',
  PENALTIES_NOT_ALLOWED: 'Pênaltis só podem ser lançados no 6º duelo, quando ele termina empatado.',
  PENALTIES_REQUIRED: 'O 6º duelo terminou empatado: informe o placar dos pênaltis.',
  PENALTIES_TIED: 'A disputa de pênaltis não pode terminar empatada.',
};

const isNonNegativeInt = (value: number): boolean => Number.isInteger(value) && value >= 0;

export function validateFixtureResult(input: ValidateResultInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: ValidationCode, path?: string) => {
    issues.push(path === undefined ? { code, message: VALIDATION_MESSAGES[code] } : { code, message: VALIDATION_MESSAGES[code], path });
  };

  const rosterA = new Set(input.rosterA);
  const rosterB = new Set(input.rosterB);
  const seenOrders = new Set<number>();
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  input.duels.forEach((duel, index) => {
    const path = `duels.${index}`;

    if (!Number.isInteger(duel.order) || duel.order < 1 || duel.order > TIEBREAKER_ORDER) {
      add('INVALID_DUEL_ORDER', `${path}.order`);
    } else if (seenOrders.has(duel.order)) {
      add('DUPLICATE_DUEL_ORDER', `${path}.order`);
    } else {
      seenOrders.add(duel.order);
    }

    if (!isNonNegativeInt(duel.goalsA)) add('INVALID_GOALS', `${path}.goalsA`);
    if (!isNonNegativeInt(duel.goalsB)) add('INVALID_GOALS', `${path}.goalsB`);
    if (duel.penaltiesA != null && !isNonNegativeInt(duel.penaltiesA)) add('INVALID_GOALS', `${path}.penaltiesA`);
    if (duel.penaltiesB != null && !isNonNegativeInt(duel.penaltiesB)) add('INVALID_GOALS', `${path}.penaltiesB`);

    if (!rosterA.has(duel.playerAId)) add('PLAYER_NOT_IN_ROSTER', `${path}.playerAId`);
    if (!rosterB.has(duel.playerBId)) add('PLAYER_NOT_IN_ROSTER', `${path}.playerBId`);

    if (duel.order !== TIEBREAKER_ORDER) {
      if (usedA.has(duel.playerAId)) add('PLAYER_REPEATED', `${path}.playerAId`);
      else usedA.add(duel.playerAId);
      if (usedB.has(duel.playerBId)) add('PLAYER_REPEATED', `${path}.playerBId`);
      else usedB.add(duel.playerBId);
    }

    const anyPenalty = duel.penaltiesA != null || duel.penaltiesB != null;
    if (duel.order !== TIEBREAKER_ORDER || duel.goalsA !== duel.goalsB) {
      if (anyPenalty) add('PENALTIES_NOT_ALLOWED', `${path}.penaltiesA`);
    } else if (duel.penaltiesA != null && duel.penaltiesB != null) {
      if (duel.penaltiesA === duel.penaltiesB) add('PENALTIES_TIED', `${path}.penaltiesA`);
    } else if (input.mode === 'final') {
      add('PENALTIES_REQUIRED', `${path}.penaltiesA`);
    }
  });

  const regularComplete = Array.from({ length: REGULAR_DUELS }, (_, i) => i + 1).every((order) =>
    input.duels.some((duel) => duel.order === order),
  );
  const tied = regularComplete && isTiedAfterRegularDuels(input.duels);
  const tiebreakerIndex = input.duels.findIndex((duel) => duel.order === TIEBREAKER_ORDER);

  if (tiebreakerIndex >= 0 && (!input.isKnockout || !tied)) {
    add('TIEBREAKER_NOT_ALLOWED', `duels.${tiebreakerIndex}.order`);
  }

  if (input.mode === 'final') {
    if (!regularComplete) add('MISSING_DUELS');
    else if (input.isKnockout && tied && tiebreakerIndex < 0) add('TIEBREAKER_REQUIRED');
  }

  return issues;
}
