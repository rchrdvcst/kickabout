/** Um duelo individual: jogador do time A × jogador do time B. */
export interface DuelInput {
  /** 1–5 duelos regulares; 6 = desempate do mata-mata. */
  order: number;
  playerAId: string;
  playerBId: string;
  goalsA: number;
  goalsB: number;
  /** Só no 6º duelo terminado empatado. */
  penaltiesA?: number | null;
  penaltiesB?: number | null;
}

export type DuelOutcome = 'A' | 'B' | 'draw';

/** Placar do confronto em pontos de duelo. */
export interface FixtureScore {
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | null;
}

/** Um confronto com seus duelos, usado para classificação e estatísticas. */
export interface FixtureRecord {
  teamAId: string;
  teamBId: string;
  duels: DuelInput[];
}
