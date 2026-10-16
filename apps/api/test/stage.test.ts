import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/tournaments/options';
import { nextPowerOfTwo, stageInput } from '../src/tournaments/stage';

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ team: { id: `t${i}`, name: `Time ${i}` } }));

describe('nextPowerOfTwo', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [5, 8],
    [8, 8],
    [9, 16],
  ])('%i → %i', (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });
});

describe('stageInput', () => {
  it('pads single elimination with byes and keeps the team id on the participant', () => {
    const input = stageInput({ id: 'x', name: 'Copa', format: 'single_elimination', options: normalizeOptions({ consolationFinal: true }), entries: entries(5) });
    expect(input).toMatchObject({
      tournamentId: 'x',
      name: 'Copa',
      type: 'single_elimination',
      settings: { size: 8, balanceByes: true, consolationFinal: true },
    });
    expect(input.seeding?.[0]).toEqual({ name: 'Time 0', teamId: 't0' });
  });

  it('maps the grand final reset option for double elimination', () => {
    expect(stageInput({ id: 'x', name: 'D', format: 'double_elimination', options: normalizeOptions({ grandFinalReset: true }), entries: entries(3) }).settings).toEqual({
      size: 4,
      balanceByes: true,
      grandFinal: 'double',
    });
    expect(stageInput({ id: 'x', name: 'D', format: 'double_elimination', options: normalizeOptions(), entries: entries(4) }).settings?.grandFinal).toBe('simple');
  });

  it('creates a single round robin group', () => {
    expect(stageInput({ id: 'x', name: 'L', format: 'round_robin', options: normalizeOptions({ roundRobinMode: 'double' }), entries: entries(4) })).toMatchObject({
      type: 'round_robin',
      settings: { groupCount: 1, roundRobinMode: 'double' },
    });
  });
});

describe('normalizeOptions', () => {
  it('fills defaults', () => {
    expect(normalizeOptions()).toEqual({ consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' });
  });
});
