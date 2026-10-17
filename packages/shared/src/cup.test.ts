import { describe, expect, it } from 'vitest';
import { cupLayout, cupProblem, drawGroups, drawKnockout, type Qualified } from './cup';

/** Gerador determinístico (mulberry32) para os sorteios dos testes. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('cupLayout', () => {
  it.each([
    [10, 4, [3, 3, 2, 2], 1],
    [9, 2, [5, 4], 3],
    [7, 2, [4, 3], 2],
    [8, 2, [4, 4], 3],
    [4, 2, [2, 2], 1],
    [128, 64, Array(64).fill(2), 1],
  ])('%i times em %i grupos → %j, até %i por grupo', (teams, groups, sizes, max) => {
    expect(cupLayout(teams, groups)).toEqual({ ok: true, sizes, maxQualifiers: max });
  });

  it('explains layouts that cannot work', () => {
    for (const groups of [1, 3, 6, 128]) {
      expect(cupLayout(200, groups)).toEqual({ ok: false, message: 'O número de grupos precisa ser 2, 4, 8, 16, 32 ou 64.' });
    }
    expect(cupLayout(3, 2)).toEqual({ ok: false, message: 'A copa precisa de pelo menos 4 times; há 3.' });
    expect(cupLayout(6, 4)).toEqual({ ok: false, message: 'Com 6 times, dá para ter no máximo 2 grupos.' });
    expect(cupLayout(20, 16)).toEqual({ ok: false, message: 'Com 20 times, dá para ter no máximo 8 grupos.' });
  });
});

describe('cupProblem', () => {
  it('accepts up to the smallest group minus one and explains the limit', () => {
    expect(cupProblem(9, 2, 3)).toBeNull();
    expect(cupProblem(10, 4, 2)).toBe('Com 10 times em 4 grupos, passam no máximo 1 por grupo.');
    expect(cupProblem(10, 4, 0)).toBe('Pelo menos 1 time por grupo precisa se classificar.');
    expect(cupProblem(6, 4, 1)).toBe('Com 6 times, dá para ter no máximo 2 grupos.');
  });
});

describe('drawGroups', () => {
  it('splits every item once into groups as even as possible', () => {
    const items = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const groups = drawGroups(items, 4, seeded(1));
    expect(groups.map((group) => group.length)).toEqual([3, 3, 2, 2]);
    expect(groups.flat().sort()).toEqual([...items].sort());
  });

  it('changes with the random source', () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    const draws = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(drawGroups(items, 2, seeded(seed)))));
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('drawKnockout', () => {
  const build = (groups: number, perGroup: number): Qualified<string>[] =>
    Array.from({ length: groups * perGroup }, (_, i) => ({ item: `g${i % groups}-${Math.floor(i / groups)}`, group: i % groups }));

  it('never pairs two teams of the same group in the first round, places byes, and uses every team once', () => {
    for (const groups of [2, 4, 8, 16]) {
      for (let perGroup = 1; perGroup <= 4; perGroup++) {
        const qualified = build(groups, perGroup);
        let size = 1;
        while (size < qualified.length) size *= 2;
        for (let seed = 0; seed < 50; seed++) {
          const slots = drawKnockout(qualified, seeded(seed));
          expect(slots).toHaveLength(size);
          expect(slots.filter((slot) => slot === null)).toHaveLength(size - qualified.length);
          expect(slots.filter((slot) => slot !== null).sort()).toEqual(qualified.map((q) => q.item).sort());
          const groupOf = new Map(qualified.map((q) => [q.item, q.group]));
          for (let i = 0; i < size; i += 2) {
            const [a, b] = [slots[i], slots[i + 1]];
            expect(a === null && b === null, `BYE contra BYE (${groups}×${perGroup}, semente ${seed})`).toBe(false);
            if (a !== null && b !== null && a !== undefined && b !== undefined) {
              expect(groupOf.get(a), `mesmo grupo (${groups}×${perGroup}, semente ${seed})`).not.toBe(groupOf.get(b));
            }
          }
        }
      }
    }
  });

  it('refuses fewer than 2 qualified teams', () => {
    expect(() => drawKnockout([{ item: 'a', group: 0 }], seeded(1))).toThrow();
  });
});
