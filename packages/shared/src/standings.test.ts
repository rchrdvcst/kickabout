import { describe, expect, it } from 'vitest';
import { computeStandings } from './standings';
import { D, L, W, fx } from './testing/fixtures';

const order = (rows: { teamId: string }[]) => rows.map((row) => row.teamId);

describe('computeStandings', () => {
  it('computes totals and orders by points', () => {
    const rows = computeStandings(
      ['A', 'B', 'C'],
      [fx('A', 'B', [W, W, W, D, D]), fx('A', 'C', [W, W, W, D, D]), fx('B', 'C', [W, W, W, D, D])],
    );
    expect(order(rows)).toEqual(['A', 'B', 'C']);
    expect(rows[0]).toEqual({
      position: 1,
      teamId: 'A',
      played: 2,
      wins: 2,
      draws: 0,
      losses: 0,
      points: 6,
      duelsWon: 6,
      duelsLost: 0,
      goalsFor: 6,
      goalsAgainst: 0,
      goalDiff: 6,
    });
  });

  it('gives one point each for a drawn fixture', () => {
    const rows = computeStandings(['A', 'B'], [fx('A', 'B', [W, L, D, D, D])]);
    expect(rows.map((row) => [row.teamId, row.points, row.draws])).toEqual([
      ['A', 1, 1],
      ['B', 1, 1],
    ]);
  });

  it('lists teams without fixtures with zeros, in seed order', () => {
    const rows = computeStandings(['B', 'A'], []);
    expect(order(rows)).toEqual(['B', 'A']);
    expect(rows[0]).toMatchObject({ position: 1, played: 0, points: 0 });
  });

  it('uses head-to-head before goal difference', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D'],
      [
        fx('A', 'B', [W, W, W, L, L]),
        fx('B', 'C', [[5, 0], [5, 0], [5, 0], [5, 0], [5, 0]]),
        fx('A', 'C', [W, L, D, D, D]),
        fx('B', 'D', [W, L, D, D, D]),
      ],
    );
    // A e B com 4 pts: A venceu o confronto direto apesar do saldo menor.
    // C e D com 1 pt, sem confronto direto, 0 vitórias: D tem saldo melhor.
    expect(order(rows)).toEqual(['A', 'B', 'D', 'C']);
  });

  it('uses fixture wins after head-to-head', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      [
        fx('A', 'C', [W, W, W, D, D]),
        fx('D', 'A', [W, W, W, D, D]),
        fx('B', 'E', [D, D, D, D, D]),
        fx('B', 'F', [D, D, D, D, D]),
        fx('B', 'G', [D, D, D, D, D]),
      ],
    );
    // A, B e D com 3 pts: D venceu A no confronto direto; A (1 vitória) à frente de B (0).
    expect(order(rows)).toEqual(['D', 'A', 'B', 'E', 'F', 'G', 'C']);
  });

  it('uses goal difference after wins', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D'],
      [fx('A', 'C', [[2, 0], W, W, D, D]), fx('B', 'D', [[5, 1], W, W, D, D])],
    );
    expect(order(rows)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('uses goals scored after goal difference', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D'],
      [fx('A', 'C', [[2, 0], W, W, D, D]), fx('B', 'D', [[3, 1], W, W, D, D])],
    );
    // A e B: saldo +4, B marcou 5 contra 4. C e D: saldo -4, D marcou 1 contra 0.
    expect(order(rows)).toEqual(['B', 'A', 'D', 'C']);
  });

  it('falls back to seed order on a fully cyclic tie', () => {
    const same = [W, W, W, D, D];
    const rows = computeStandings(['C', 'A', 'B'], [fx('A', 'B', same), fx('B', 'C', same), fx('C', 'A', same)]);
    expect(order(rows)).toEqual(['C', 'A', 'B']);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
  });

  it('does not count tiebreaker penalties as goals', () => {
    const rows = computeStandings(['A', 'B'], [fx('A', 'B', [W, W, L, L, D, [1, 1, 5, 4]])]);
    expect(rows[0]).toMatchObject({ teamId: 'A', wins: 1, goalsFor: 3, goalsAgainst: 3 });
  });

  it('throws when a fixture references an unknown team', () => {
    expect(() => computeStandings(['A'], [fx('A', 'X', [W, W, W, D, D])])).toThrow('Time desconhecido: X');
  });
});
