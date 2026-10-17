import { describe, expect, it } from 'vitest';
import {
  eliminationRoundName,
  fixtureRoundLabel,
  formatPhone,
  groupLetter,
  phaseData,
  percent,
  positionLabel,
  roundCounts,
  roundLabel,
  viewerRoundName,
} from '../src/lib/format';

describe('format', () => {
  it('names elimination rounds from the end', () => {
    expect([1, 2, 3, 4, 5].map((n) => eliminationRoundName(n, 5))).toEqual([
      '1ª rodada',
      'Oitavas de final',
      'Quartas de final',
      'Semifinal',
      'Final',
    ]);
  });

  it('labels rounds per format and group', () => {
    expect(roundLabel('round_robin', 1, 3, 5)).toBe('Rodada 3');
    expect(roundLabel('single_elimination', 1, 2, 2)).toBe('Final');
    expect(roundLabel('single_elimination', 2, 1, 1)).toBe('Disputa de 3º lugar');
    expect(roundLabel('double_elimination', 1, 1, 2)).toBe('Chave superior, 1ª rodada');
    expect(roundLabel('double_elimination', 1, 2, 2)).toBe('Final da chave superior');
    expect(roundLabel('double_elimination', 2, 2, 2)).toBe('Final da chave inferior');
    expect(roundLabel('double_elimination', 3, 1, 2)).toBe('Grande final');
    expect(roundLabel('double_elimination', 3, 2, 2)).toBe('Final de desempate');
  });

  it('counts rounds per group number from the bracket data', () => {
    const counts = roundCounts({
      stage: [],
      group: [
        { id: 0, stage_id: 0, number: 1 },
        { id: 1, stage_id: 0, number: 2 },
      ],
      round: [
        { id: 0, stage_id: 0, group_id: 0, number: 1 },
        { id: 1, stage_id: 0, group_id: 0, number: 2 },
        { id: 2, stage_id: 0, group_id: 1, number: 1 },
      ],
      match: [],
      match_game: [],
      participant: [],
    });
    expect([...counts]).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(roundCounts(null).size).toBe(0);
  });

  it('translates brackets-viewer round names', () => {
    expect(viewerRoundName({ groupType: 'single-bracket', roundNumber: 3, roundCount: 3 })).toBe('Final');
    expect(viewerRoundName({ groupType: 'round-robin', roundNumber: 2, roundCount: 3 })).toBe('Rodada 2');
    expect(viewerRoundName({ groupType: 'final-group', roundNumber: 1, roundCount: 1, finalType: 'consolation-final' })).toBe('Disputa de 3º lugar');
    expect(viewerRoundName({ groupType: 'final-group', roundNumber: 1, roundCount: 2, finalType: 'grand-final' })).toBe('Grande final');
    expect(viewerRoundName({ groupType: 'loser-bracket', roundNumber: 1, roundCount: 2 })).toBe('Chave inferior, 1ª rodada');
  });

  it('formats Brazilian phones and keeps foreign ones', () => {
    expect(formatPhone('+5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('+551134567890')).toBe('(11) 3456-7890');
    expect(formatPhone('+351912345678')).toBe('+351 912 345 678');
    expect(formatPhone('+558496773612')).toBe('(84) 9677-3612');
  });

  it('formats percentages and podium positions', () => {
    expect(percent(2 / 3)).toBe('67%');
    expect(percent(0)).toBe('0%');
    expect([1, 2, 3].map(positionLabel)).toEqual(['Campeão', 'Vice', '3º lugar']);
  });
});
describe('cup labels', () => {
  const data = {
    stage: [
      { id: 0, number: 1, type: 'round_robin' },
      { id: 1, number: 2, type: 'single_elimination' },
    ],
    group: [
      { id: 0, stage_id: 0, number: 1 },
      { id: 1, stage_id: 0, number: 2 },
      { id: 2, stage_id: 1, number: 1 },
    ],
    round: [
      { id: 0, stage_id: 0, group_id: 0, number: 1 },
      { id: 1, stage_id: 0, group_id: 0, number: 2 },
      { id: 2, stage_id: 0, group_id: 1, number: 1 },
      { id: 3, stage_id: 1, group_id: 2, number: 1 },
      { id: 4, stage_id: 1, group_id: 2, number: 2 },
    ],
    match: [
      { id: 0, stage_id: 0 },
      { id: 9, stage_id: 1 },
    ],
    match_game: [],
    participant: [],
  };

  it('names cup rounds by phase', () => {
    expect(groupLetter(1)).toBe('A');
    expect(groupLetter(3)).toBe('C');
    expect(fixtureRoundLabel('cup', data, { phase: 'groups', groupNumber: 2, roundNumber: 1 })).toBe('Grupo B, 1ª rodada');
    expect(fixtureRoundLabel('cup', data, { phase: 'knockout', groupNumber: 1, roundNumber: 1 })).toBe('Semifinal');
    expect(fixtureRoundLabel('cup', data, { phase: 'knockout', groupNumber: 1, roundNumber: 2 })).toBe('Final');
    expect(fixtureRoundLabel('cup', data, { phase: 'knockout', groupNumber: 2, roundNumber: 1 })).toBe('Disputa de 3º lugar');
  });

  it('keeps only one phase of the bracket', () => {
    const knockout = phaseData(data, 'knockout')!;
    expect(knockout.stage).toHaveLength(1);
    expect(knockout.match).toEqual([{ id: 9, stage_id: 1 }]);
    expect(knockout.round.map((round) => round.id)).toEqual([3, 4]);
    expect(phaseData({ ...data, stage: [data.stage[0]!] }, 'knockout')).toBeNull();
  });
});
