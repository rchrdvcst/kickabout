# Kickabout — Plano 1: Fundação do monorepo + motor de regras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o monorepo TypeScript e o pacote `@kickabout/shared` com todas as regras de negócio puras do Kickabout (duelos, placar do confronto, validação de resultado, classificação com desempates, estatísticas, telefone/WhatsApp), 100% cobertas por testes.

**Architecture:** npm workspaces com `packages/shared` contendo apenas funções puras (sem I/O), consumidas depois pela API (Plano 2) e pelo web (Plano 3). Cada regra vive num arquivo focado com seu teste ao lado (`*.test.ts`). Tudo escrito com TDD.

**Tech Stack:** Node 20+ (máquina tem 22.11), npm workspaces, TypeScript 5.6 (strict), Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`

## Roadmap (fora deste plano)

- **Plano 2 — API:** Docker Compose/Postgres, Prisma, auth admin, times/jogadores/BID (`PHONE_VISIBILITY`), campeonatos + brackets-manager, lançamento de resultados, estatísticas, títulos.
- **Plano 3 — Web:** React + Vite, telas públicas e admin, brackets-viewer.

## Global Constraints

- Node `>=20`; TypeScript `strict: true` com `noUncheckedIndexedAccess: true`; ESM (`"type": "module"`).
- `packages/shared` não faz I/O: sem banco, sem rede, sem `Date.now()`.
- Máximo de **20 jogadores ativos** por time.
- Duelos regulares: ordens **1 a 5**; desempate: ordem **6**, só no mata-mata e só se o confronto estiver empatado após os 5 duelos.
- Vitória em duelo = 1 ponto para o time; empate/derrota = 0. Pênaltis só no 6º duelo empatado; não podem empatar.
- Classificação: vitória **3**, empate **1**, derrota **0**. Desempate: pontos → confronto direto → vitórias em confrontos → saldo de gols → gols marcados → ordem do seed.
- Pênaltis **não** contam como gols.
- Celular armazenado em E.164 (`+55…`); link WhatsApp: `https://wa.me/<dígitos>`.
- Mensagens de erro para o usuário em **português**.
- Line endings LF (`.gitattributes`).

## Review Focus

1. **Ordem de duelo duplicada ou ausente** (dois duelos "3", ou faltando o "4") — o resultado final deve ser rejeitado (`DUPLICATE_DUEL_ORDER` / `MISSING_DUELS`), nunca contado. Testado na Task 3.
2. **6º duelo lançado quando o confronto não estava empatado**, ou no round robin — rejeitar com `TIEBREAKER_NOT_ALLOWED`. Testado na Task 3.
3. **Pênaltis preenchidos num 6º duelo que já tem vencedor no placar** — rejeitar (`PENALTIES_NOT_ALLOWED`) para não haver dado contraditório. Testado na Task 3.
4. **Empate triplo cíclico na classificação** (A vence B, B vence C, C vence A, tudo igual) — ordem determinística pelo seed, sem loop nem ordem aleatória. Testado na Task 4.
5. **Celular digitado de formas variadas** (`(11) 98765-4321`, `011…`, `+55 …`, estrangeiro, lixo) — normalizar ou retornar `null`, nunca gravar formato inconsistente. Testado na Task 6.

---

## File Structure

```
kickabout/
├── .gitattributes                      # eol=lf
├── .gitignore
├── package.json                        # workspaces, scripts, devDeps (typescript, vitest)
├── tsconfig.base.json                  # opções TS compartilhadas
└── packages/shared/
    ├── package.json                    # @kickabout/shared
    ├── tsconfig.json
    └── src/
        ├── index.ts                    # re-exporta a API pública
        ├── constants.ts                # limites e pontuação
        ├── types.ts                    # DuelInput, FixtureRecord, etc.
        ├── duel.ts / duel.test.ts                      # resultado de um duelo
        ├── fixture-score.ts / fixture-score.test.ts    # placar do confronto, gols
        ├── validate-result.ts / validate-result.test.ts# validação do lançamento
        ├── standings.ts / standings.test.ts            # classificação + desempates
        ├── stats.ts / stats.test.ts                    # estatísticas de jogador e time
        ├── phone.ts / phone.test.ts                    # normalização de celular, link WhatsApp
        └── testing/fixtures.ts                         # helpers de teste (não exportado)
```

---

### Task 1: Scaffold do monorepo + resultado de um duelo

**Files:**
- Create: `.gitattributes`, `.gitignore`, `package.json`, `tsconfig.base.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`, `packages/shared/src/types.ts`, `packages/shared/src/duel.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/duel.test.ts`

**Interfaces:**
- Produces:
  - `constants.ts`: `MAX_ACTIVE_ROSTER = 20`, `REGULAR_DUELS = 5`, `TIEBREAKER_ORDER = 6`, `POINTS = { win: 3, draw: 1, loss: 0 }`
  - `types.ts`: `DuelInput`, `DuelOutcome`, `FixtureScore`, `FixtureRecord`
  - `duel.ts`: `hasPenalties(duel): boolean`, `duelOutcome(duel: DuelInput): DuelOutcome`

- [ ] **Step 1: Criar arquivos de configuração da raiz**

`.gitattributes`:
```
* text=auto eol=lf
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
```

`package.json`:
```json
{
  "name": "kickabout",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 2: Criar o pacote shared**

`packages/shared/package.json`:
```json
{
  "name": "@kickabout/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/shared/src/constants.ts`:
```ts
export const MAX_ACTIVE_ROSTER = 20;
export const REGULAR_DUELS = 5;
export const TIEBREAKER_ORDER = 6;
export const POINTS = { win: 3, draw: 1, loss: 0 } as const;
```

`packages/shared/src/types.ts`:
```ts
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
```

Run: `npm install`
Expected: instala `typescript` e `vitest`, cria `package-lock.json`, sem erros.

- [ ] **Step 3: Escrever o teste que falha**

`packages/shared/src/duel.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { duelOutcome } from './duel';
import type { DuelInput } from './types';

const duel = (goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order: 1,
  playerAId: 'pa',
  playerBId: 'pb',
  goalsA,
  goalsB,
  ...extra,
});

describe('duelOutcome', () => {
  it('returns A when A scores more', () => {
    expect(duelOutcome(duel(2, 1))).toBe('A');
  });

  it('returns B when B scores more', () => {
    expect(duelOutcome(duel(0, 3))).toBe('B');
  });

  it('returns draw on equal goals without penalties', () => {
    expect(duelOutcome(duel(1, 1))).toBe('draw');
  });

  it('decides a drawn duel by penalties', () => {
    expect(duelOutcome(duel(1, 1, { order: 6, penaltiesA: 5, penaltiesB: 4 }))).toBe('A');
    expect(duelOutcome(duel(0, 0, { order: 6, penaltiesA: 2, penaltiesB: 3 }))).toBe('B');
  });

  it('ignores penalties when goals already decide', () => {
    expect(duelOutcome(duel(2, 1, { penaltiesA: 0, penaltiesB: 5 }))).toBe('A');
  });

  it('treats tied or one-sided penalties as a draw', () => {
    expect(duelOutcome(duel(1, 1, { penaltiesA: 4, penaltiesB: 4 }))).toBe('draw');
    expect(duelOutcome(duel(1, 1, { penaltiesA: 3 }))).toBe('draw');
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/duel.test.ts`
Expected: FAIL — `Failed to resolve import "./duel"`.

- [ ] **Step 5: Implementar**

`packages/shared/src/duel.ts`:
```ts
import type { DuelInput, DuelOutcome } from './types';

export function hasPenalties(duel: Pick<DuelInput, 'penaltiesA' | 'penaltiesB'>): boolean {
  return duel.penaltiesA != null && duel.penaltiesB != null;
}

export function duelOutcome(duel: DuelInput): DuelOutcome {
  if (duel.goalsA > duel.goalsB) return 'A';
  if (duel.goalsB > duel.goalsA) return 'B';
  if (duel.penaltiesA != null && duel.penaltiesB != null) {
    if (duel.penaltiesA > duel.penaltiesB) return 'A';
    if (duel.penaltiesB > duel.penaltiesA) return 'B';
  }
  return 'draw';
}
```

`packages/shared/src/index.ts`:
```ts
export * from './constants';
export * from './types';
export * from './duel';
```

- [ ] **Step 6: Rodar testes e typecheck**

Run: `npm test -w @kickabout/shared -- src/duel.test.ts && npm run typecheck`
Expected: 6 testes PASS; typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add .gitattributes .gitignore package.json package-lock.json tsconfig.base.json packages/shared
git commit -m "feat(shared): scaffold monorepo and duel outcome rule"
```

---

### Task 2: Placar do confronto e soma de gols

**Files:**
- Create: `packages/shared/src/fixture-score.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/fixture-score.test.ts`

**Interfaces:**
- Consumes: `duelOutcome`, `DuelInput`, `FixtureScore`, `REGULAR_DUELS` (Task 1)
- Produces:
  - `computeFixtureScore(duels: readonly DuelInput[]): FixtureScore`
  - `sumGoals(duels: readonly DuelInput[]): { goalsA: number; goalsB: number }` — pênaltis excluídos
  - `isTiedAfterRegularDuels(duels: readonly DuelInput[]): boolean` — considera só ordens 1–5

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/fixture-score.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeFixtureScore, isTiedAfterRegularDuels, sumGoals } from './fixture-score';
import type { DuelInput } from './types';

const d = (order: number, goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order,
  playerAId: `a${order}`,
  playerBId: `b${order}`,
  goalsA,
  goalsB,
  ...extra,
});

const threeToOne = [d(1, 2, 0), d(2, 1, 1), d(3, 0, 3), d(4, 4, 2), d(5, 1, 0)];
const twoToTwo = [d(1, 1, 0), d(2, 1, 0), d(3, 0, 1), d(4, 0, 2), d(5, 2, 2)];

describe('computeFixtureScore', () => {
  it('gives one point per duel won', () => {
    expect(computeFixtureScore(threeToOne)).toEqual({ scoreA: 3, scoreB: 1, winner: 'A' });
  });

  it('returns null winner when tied', () => {
    expect(computeFixtureScore(twoToTwo)).toEqual({ scoreA: 2, scoreB: 2, winner: null });
  });

  it('counts the tiebreaker decided on penalties', () => {
    const duels = [...twoToTwo, d(6, 1, 1, { penaltiesA: 4, penaltiesB: 5 })];
    expect(computeFixtureScore(duels)).toEqual({ scoreA: 2, scoreB: 3, winner: 'B' });
  });

  it('returns 0x0 for no duels', () => {
    expect(computeFixtureScore([])).toEqual({ scoreA: 0, scoreB: 0, winner: null });
  });
});

describe('sumGoals', () => {
  it('sums duel goals and ignores penalties', () => {
    const duels = [...twoToTwo, d(6, 1, 1, { penaltiesA: 4, penaltiesB: 5 })];
    expect(sumGoals(duels)).toEqual({ goalsA: 5, goalsB: 6 });
  });
});

describe('isTiedAfterRegularDuels', () => {
  it('is true for 2x2 even when a 6th duel exists', () => {
    expect(isTiedAfterRegularDuels([...twoToTwo, d(6, 3, 0)])).toBe(true);
  });

  it('is false for 3x1', () => {
    expect(isTiedAfterRegularDuels(threeToOne)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/fixture-score.test.ts`
Expected: FAIL — `Failed to resolve import "./fixture-score"`.

- [ ] **Step 3: Implementar**

`packages/shared/src/fixture-score.ts`:
```ts
import { REGULAR_DUELS } from './constants';
import { duelOutcome } from './duel';
import type { DuelInput, FixtureScore } from './types';

export function computeFixtureScore(duels: readonly DuelInput[]): FixtureScore {
  let scoreA = 0;
  let scoreB = 0;
  for (const duel of duels) {
    const outcome = duelOutcome(duel);
    if (outcome === 'A') scoreA++;
    else if (outcome === 'B') scoreB++;
  }
  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
  return { scoreA, scoreB, winner };
}

export function sumGoals(duels: readonly DuelInput[]): { goalsA: number; goalsB: number } {
  let goalsA = 0;
  let goalsB = 0;
  for (const duel of duels) {
    goalsA += duel.goalsA;
    goalsB += duel.goalsB;
  }
  return { goalsA, goalsB };
}

export function isTiedAfterRegularDuels(duels: readonly DuelInput[]): boolean {
  const { scoreA, scoreB } = computeFixtureScore(duels.filter((duel) => duel.order <= REGULAR_DUELS));
  return scoreA === scoreB;
}
```

Adicionar em `packages/shared/src/index.ts`:
```ts
export * from './fixture-score';
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/shared && npm run typecheck`
Expected: todos PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): fixture score and goal totals"
```

---

### Task 3: Validação do lançamento de resultado

**Files:**
- Create: `packages/shared/src/validate-result.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/validate-result.test.ts`

**Interfaces:**
- Consumes: `DuelInput`, `REGULAR_DUELS`, `TIEBREAKER_ORDER`, `isTiedAfterRegularDuels`
- Produces:
  - `type ValidationCode = 'INVALID_GOALS' | 'INVALID_DUEL_ORDER' | 'DUPLICATE_DUEL_ORDER' | 'MISSING_DUELS' | 'PLAYER_NOT_IN_ROSTER' | 'PLAYER_REPEATED' | 'TIEBREAKER_NOT_ALLOWED' | 'TIEBREAKER_REQUIRED' | 'PENALTIES_NOT_ALLOWED' | 'PENALTIES_REQUIRED' | 'PENALTIES_TIED'`
  - `interface ValidationIssue { code: ValidationCode; message: string; path?: string }` — `path` no formato `duels.<índice no array>.<campo>`
  - `interface ValidateResultInput { mode: 'draft' | 'final'; isKnockout: boolean; duels: DuelInput[]; rosterA: readonly string[]; rosterB: readonly string[] }` — `rosterA/B` = ids dos jogadores ativos de cada time
  - `validateFixtureResult(input: ValidateResultInput): ValidationIssue[]` — lista vazia = válido
  - `VALIDATION_MESSAGES: Record<ValidationCode, string>`

Regras:
- `draft` valida cada duelo lançado, mas não exige completude (`MISSING_DUELS`, `TIEBREAKER_REQUIRED`, `PENALTIES_REQUIRED` só no `final`).
- Jogador repetido só é proibido entre os duelos 1–5 do mesmo time; o jogador do 6º duelo pode ser qualquer um do elenco.
- 6º duelo exige: mata-mata **e** duelos 1–5 completos **e** empatados.

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/validate-result.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateFixtureResult, type ValidateResultInput } from './validate-result';
import type { DuelInput } from './types';

const rosterA = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
const rosterB = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'];

const d = (order: number, goalsA: number, goalsB: number, extra: Partial<DuelInput> = {}): DuelInput => ({
  order,
  playerAId: `a${order}`,
  playerBId: `b${order}`,
  goalsA,
  goalsB,
  ...extra,
});

// 3x1: A vence 1, 2 e 4; B vence 3; duelo 5 empata.
const threeToOne = (): DuelInput[] => [d(1, 2, 0), d(2, 1, 0), d(3, 0, 1), d(4, 3, 1), d(5, 1, 1)];
// 2x2 após os 5 duelos.
const twoToTwo = (): DuelInput[] => [d(1, 1, 0), d(2, 1, 0), d(3, 0, 1), d(4, 0, 2), d(5, 2, 2)];

const run = (overrides: Partial<ValidateResultInput>) =>
  validateFixtureResult({ mode: 'final', isKnockout: false, duels: threeToOne(), rosterA, rosterB, ...overrides });
const codes = (overrides: Partial<ValidateResultInput>) => run(overrides).map((issue) => issue.code);

describe('validateFixtureResult', () => {
  it('accepts a complete round robin result', () => {
    expect(run({})).toEqual([]);
  });

  it('accepts a round robin draw without a 6th duel', () => {
    expect(run({ duels: twoToTwo() })).toEqual([]);
  });

  it('rejects negative or fractional goals and penalties', () => {
    const duels = threeToOne();
    duels[0] = d(1, -1, 0);
    duels[1] = d(2, 1.5, 0);
    expect(codes({ duels })).toEqual(['INVALID_GOALS', 'INVALID_GOALS']);
  });

  it('rejects duel orders outside 1..6', () => {
    const duels = threeToOne();
    duels[4] = d(7, 1, 1, { playerAId: 'a5', playerBId: 'b5' });
    expect(codes({ duels })).toContain('INVALID_DUEL_ORDER');
  });

  it('rejects duplicated duel orders', () => {
    const duels = threeToOne();
    duels[4] = d(4, 1, 1, { playerAId: 'a5', playerBId: 'b5' });
    expect(codes({ duels })).toContain('DUPLICATE_DUEL_ORDER');
  });

  it('requires duels 1..5 in final mode but not in draft mode', () => {
    const duels = threeToOne().slice(0, 4);
    expect(codes({ duels })).toEqual(['MISSING_DUELS']);
    expect(codes({ duels, mode: 'draft' })).toEqual([]);
  });

  it('rejects players outside the active roster', () => {
    const duels = threeToOne();
    duels[0] = d(1, 2, 0, { playerAId: 'intruder' });
    const issues = run({ duels });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'PLAYER_NOT_IN_ROSTER', path: 'duels.0.playerAId' });
  });

  it('rejects the same player in two regular duels', () => {
    const duels = threeToOne();
    duels[1] = d(2, 1, 0, { playerBId: 'b1' });
    const issues = run({ duels });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'PLAYER_REPEATED', path: 'duels.1.playerBId' });
  });

  it('allows a player who already played to take the 6th duel', () => {
    const duels = [...twoToTwo(), d(6, 1, 0, { playerAId: 'a1', playerBId: 'b3' })];
    expect(run({ isKnockout: true, duels })).toEqual([]);
  });

  it('rejects a 6th duel in round robin', () => {
    const duels = [...twoToTwo(), d(6, 1, 0)];
    expect(codes({ duels })).toEqual(['TIEBREAKER_NOT_ALLOWED']);
  });

  it('rejects a 6th duel when the knockout fixture was not tied', () => {
    const duels = [...threeToOne(), d(6, 1, 0)];
    expect(codes({ isKnockout: true, duels })).toEqual(['TIEBREAKER_NOT_ALLOWED']);
  });

  it('requires a 6th duel for a tied knockout fixture in final mode only', () => {
    expect(codes({ isKnockout: true, duels: twoToTwo() })).toEqual(['TIEBREAKER_REQUIRED']);
    expect(codes({ isKnockout: true, duels: twoToTwo(), mode: 'draft' })).toEqual([]);
  });

  it('rejects penalties on regular duels', () => {
    const duels = threeToOne();
    duels[4] = d(5, 1, 1, { penaltiesA: 5, penaltiesB: 4 });
    expect(codes({ duels })).toEqual(['PENALTIES_NOT_ALLOWED']);
  });

  it('rejects penalties on a 6th duel already decided by goals', () => {
    const duels = [...twoToTwo(), d(6, 2, 1, { penaltiesA: 3, penaltiesB: 4 })];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_NOT_ALLOWED']);
  });

  it('requires penalties when the 6th duel is drawn', () => {
    const duels = [...twoToTwo(), d(6, 1, 1)];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_REQUIRED']);
    const oneSided = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 4 })];
    expect(codes({ isKnockout: true, duels: oneSided })).toEqual(['PENALTIES_REQUIRED']);
  });

  it('rejects tied penalties', () => {
    const duels = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 4, penaltiesB: 4 })];
    expect(codes({ isKnockout: true, duels })).toEqual(['PENALTIES_TIED']);
  });

  it('accepts a 6th duel decided on penalties', () => {
    const duels = [...twoToTwo(), d(6, 1, 1, { penaltiesA: 5, penaltiesB: 4 })];
    expect(run({ isKnockout: true, duels })).toEqual([]);
  });

  it('returns Portuguese messages', () => {
    const [issue] = run({ duels: threeToOne().slice(0, 4) });
    expect(issue?.message).toBe('Para confirmar o resultado, os duelos 1 a 5 precisam estar preenchidos.');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/validate-result.test.ts`
Expected: FAIL — `Failed to resolve import "./validate-result"`.

- [ ] **Step 3: Implementar**

`packages/shared/src/validate-result.ts`:
```ts
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
```

Adicionar em `packages/shared/src/index.ts`:
```ts
export * from './validate-result';
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/shared && npm run typecheck`
Expected: todos PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): fixture result validation"
```

---

### Task 4: Classificação com critérios de desempate

**Files:**
- Create: `packages/shared/src/testing/fixtures.ts`
- Create: `packages/shared/src/standings.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/standings.test.ts`

**Interfaces:**
- Consumes: `FixtureRecord`, `POINTS`, `computeFixtureScore`, `sumGoals`
- Produces:
  - `interface StandingRow { position: number; teamId: string; played: number; wins: number; draws: number; losses: number; points: number; duelsWon: number; duelsLost: number; goalsFor: number; goalsAgainst: number; goalDiff: number }`
  - `computeStandings(teamIdsBySeed: readonly string[], fixtures: readonly FixtureRecord[]): StandingRow[]` — `fixtures` = apenas confrontos **confirmados**; lança `Error` se um confronto citar time fora de `teamIdsBySeed`
  - `testing/fixtures.ts` (só para testes): `type DuelTuple`, `fx(teamAId, teamBId, results: DuelTuple[]): FixtureRecord`, `W`, `L`, `D`

Algoritmo de desempate: ordenar por pontos; dentro de cada grupo com os mesmos pontos, ordenar por (1) pontos no confronto direto **entre os times do grupo** (3/1/0), (2) vitórias em confrontos, (3) saldo de gols, (4) gols marcados, (5) posição no seed (menor primeiro). Critérios são aplicados lexicograficamente sobre o grupo inteiro empatado em pontos.

- [ ] **Step 1: Criar helper de teste**

`packages/shared/src/testing/fixtures.ts`:
```ts
import type { FixtureRecord } from '../types';

/** [golsA, golsB, pênaltisA?, pênaltisB?] — a posição no array define a ordem do duelo. */
export type DuelTuple = [goalsA: number, goalsB: number, penaltiesA?: number, penaltiesB?: number];

export const W: DuelTuple = [1, 0];
export const L: DuelTuple = [0, 1];
export const D: DuelTuple = [0, 0];

export function fx(teamAId: string, teamBId: string, results: DuelTuple[]): FixtureRecord {
  return {
    teamAId,
    teamBId,
    duels: results.map(([goalsA, goalsB, penaltiesA, penaltiesB], index) => ({
      order: index + 1,
      playerAId: `${teamAId}-p${index + 1}`,
      playerBId: `${teamBId}-p${index + 1}`,
      goalsA,
      goalsB,
      ...(penaltiesA !== undefined ? { penaltiesA, penaltiesB: penaltiesB ?? null } : {}),
    })),
  };
}
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/shared/src/standings.test.ts`:
```ts
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
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/standings.test.ts`
Expected: FAIL — `Failed to resolve import "./standings"`.

- [ ] **Step 4: Implementar**

`packages/shared/src/standings.ts`:
```ts
import { POINTS } from './constants';
import { computeFixtureScore, sumGoals } from './fixture-score';
import type { FixtureRecord } from './types';

export interface StandingRow {
  position: number;
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  duelsWon: number;
  duelsLost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

const emptyRow = (teamId: string): StandingRow => ({
  position: 0,
  teamId,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  duelsWon: 0,
  duelsLost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
});

function fixturePoints(own: number, opponent: number): number {
  if (own > opponent) return POINTS.win;
  if (own === opponent) return POINTS.draw;
  return POINTS.loss;
}

function applyFixture(row: StandingRow, own: number, opponent: number, goalsFor: number, goalsAgainst: number) {
  row.played++;
  row.duelsWon += own;
  row.duelsLost += opponent;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.points += fixturePoints(own, opponent);
  if (own > opponent) row.wins++;
  else if (own === opponent) row.draws++;
  else row.losses++;
}

function headToHeadPoints(teamIds: ReadonlySet<string>, fixtures: readonly FixtureRecord[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const fixture of fixtures) {
    if (!teamIds.has(fixture.teamAId) || !teamIds.has(fixture.teamBId)) continue;
    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    points.set(fixture.teamAId, (points.get(fixture.teamAId) ?? 0) + fixturePoints(scoreA, scoreB));
    points.set(fixture.teamBId, (points.get(fixture.teamBId) ?? 0) + fixturePoints(scoreB, scoreA));
  }
  return points;
}

export function computeStandings(
  teamIdsBySeed: readonly string[],
  fixtures: readonly FixtureRecord[],
): StandingRow[] {
  const rows = new Map(teamIdsBySeed.map((teamId) => [teamId, emptyRow(teamId)]));
  const rowFor = (teamId: string): StandingRow => {
    const row = rows.get(teamId);
    if (!row) throw new Error(`Time desconhecido: ${teamId}`);
    return row;
  };

  for (const fixture of fixtures) {
    const rowA = rowFor(fixture.teamAId);
    const rowB = rowFor(fixture.teamBId);
    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    const { goalsA, goalsB } = sumGoals(fixture.duels);
    applyFixture(rowA, scoreA, scoreB, goalsA, goalsB);
    applyFixture(rowB, scoreB, scoreA, goalsB, goalsA);
  }

  const seedIndex = new Map(teamIdsBySeed.map((teamId, index) => [teamId, index]));
  const seed = (row: StandingRow) => seedIndex.get(row.teamId) ?? Number.MAX_SAFE_INTEGER;

  for (const row of rows.values()) row.goalDiff = row.goalsFor - row.goalsAgainst;

  const byPoints = [...rows.values()].sort((a, b) => b.points - a.points || seed(a) - seed(b));
  const ordered: StandingRow[] = [];

  for (let start = 0; start < byPoints.length; ) {
    const points = byPoints[start]!.points;
    let end = start;
    while (end < byPoints.length && byPoints[end]!.points === points) end++;
    const group = byPoints.slice(start, end);

    if (group.length > 1) {
      const h2h = headToHeadPoints(new Set(group.map((row) => row.teamId)), fixtures);
      const h2hOf = (row: StandingRow) => h2h.get(row.teamId) ?? 0;
      group.sort(
        (a, b) =>
          h2hOf(b) - h2hOf(a) ||
          b.wins - a.wins ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          seed(a) - seed(b),
      );
    }

    ordered.push(...group);
    start = end;
  }

  return ordered.map((row, index) => ({ ...row, position: index + 1 }));
}
```

Adicionar em `packages/shared/src/index.ts`:
```ts
export * from './standings';
```

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/shared && npm run typecheck`
Expected: todos PASS; typecheck sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): standings with head-to-head tiebreakers"
```

---

### Task 5: Estatísticas de jogador e de time

**Files:**
- Create: `packages/shared/src/stats.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/stats.test.ts`

**Interfaces:**
- Consumes: `DuelInput`, `FixtureRecord`, `duelOutcome`, `computeFixtureScore`, `sumGoals`, `fx` (testes)
- Produces:
  - `interface PlayerStats { playerId: string; duels: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDiff: number; winRate: number }` — `winRate` = `wins / duels` (0 a 1; 0 sem duelos). Vitória nos pênaltis conta como vitória.
  - `aggregatePlayerStats(duels: readonly DuelInput[]): PlayerStats[]` — uma linha por jogador que aparece; ordenado por gols marcados ↓, saldo ↓, vitórias ↓, `playerId` ↑ (serve direto como artilharia)
  - `interface RecordTally { played: number; wins: number; draws: number; losses: number }`
  - `interface TeamStats { teamId: string; fixtures: RecordTally; duels: RecordTally; goalsFor: number; goalsAgainst: number; goalDiff: number }`
  - `aggregateTeamStats(teamId: string, fixtures: readonly FixtureRecord[]): TeamStats` — ignora confrontos de outros times

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/stats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { aggregatePlayerStats, aggregateTeamStats } from './stats';
import { D, L, W, fx } from './testing/fixtures';
import type { DuelInput } from './types';

describe('aggregatePlayerStats', () => {
  const duels: DuelInput[] = [
    { order: 1, playerAId: 'p1', playerBId: 'q1', goalsA: 2, goalsB: 0 },
    { order: 1, playerAId: 'p1', playerBId: 'q2', goalsA: 1, goalsB: 1 },
    { order: 6, playerAId: 'p1', playerBId: 'q1', goalsA: 0, goalsB: 0, penaltiesA: 3, penaltiesB: 4 },
  ];

  it('aggregates both sides and counts penalty results as wins/losses', () => {
    const stats = aggregatePlayerStats(duels);
    expect(stats.map((s) => s.playerId)).toEqual(['p1', 'q2', 'q1']);
    expect(stats[0]).toEqual({
      playerId: 'p1',
      duels: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDiff: 2,
      winRate: 1 / 3,
    });
    expect(stats[2]).toMatchObject({ playerId: 'q1', duels: 2, wins: 1, losses: 1, goalsFor: 0, goalsAgainst: 2 });
  });

  it('returns an empty list for no duels', () => {
    expect(aggregatePlayerStats([])).toEqual([]);
  });
});

describe('aggregateTeamStats', () => {
  it('aggregates fixtures and duels from the team perspective on either side', () => {
    const fixtures = [
      fx('X', 'Y', [W, W, W, L, D]),
      fx('Y', 'X', [W, W, L, L, D, [1, 1, 4, 5]]),
      fx('Z', 'W', [W, W, W, D, D]),
    ];
    expect(aggregateTeamStats('X', fixtures)).toEqual({
      teamId: 'X',
      fixtures: { played: 2, wins: 2, draws: 0, losses: 0 },
      duels: { played: 11, wins: 6, draws: 2, losses: 3 },
      goalsFor: 6,
      goalsAgainst: 4,
      goalDiff: 2,
    });
  });

  it('returns zeros for a team without fixtures', () => {
    expect(aggregateTeamStats('X', [])).toEqual({
      teamId: 'X',
      fixtures: { played: 0, wins: 0, draws: 0, losses: 0 },
      duels: { played: 0, wins: 0, draws: 0, losses: 0 },
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`.

- [ ] **Step 3: Implementar**

`packages/shared/src/stats.ts`:
```ts
import { duelOutcome } from './duel';
import { computeFixtureScore, sumGoals } from './fixture-score';
import type { DuelInput, FixtureRecord } from './types';

export interface PlayerStats {
  playerId: string;
  duels: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  /** wins / duels, de 0 a 1. */
  winRate: number;
}

export interface RecordTally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TeamStats {
  teamId: string;
  fixtures: RecordTally;
  duels: RecordTally;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

type Result = 'win' | 'draw' | 'loss';

const emptyTally = (): RecordTally => ({ played: 0, wins: 0, draws: 0, losses: 0 });

function tally(target: RecordTally, result: Result) {
  target.played++;
  if (result === 'win') target.wins++;
  else if (result === 'draw') target.draws++;
  else target.losses++;
}

const resultFor = (side: 'A' | 'B', outcome: 'A' | 'B' | 'draw'): Result =>
  outcome === 'draw' ? 'draw' : outcome === side ? 'win' : 'loss';

export function aggregatePlayerStats(duels: readonly DuelInput[]): PlayerStats[] {
  const byPlayer = new Map<string, PlayerStats>();
  const statsFor = (playerId: string): PlayerStats => {
    let stats = byPlayer.get(playerId);
    if (!stats) {
      stats = { playerId, duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 };
      byPlayer.set(playerId, stats);
    }
    return stats;
  };
  const apply = (stats: PlayerStats, result: Result, goalsFor: number, goalsAgainst: number) => {
    stats.duels++;
    if (result === 'win') stats.wins++;
    else if (result === 'draw') stats.draws++;
    else stats.losses++;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
  };

  for (const duel of duels) {
    const outcome = duelOutcome(duel);
    apply(statsFor(duel.playerAId), resultFor('A', outcome), duel.goalsA, duel.goalsB);
    apply(statsFor(duel.playerBId), resultFor('B', outcome), duel.goalsB, duel.goalsA);
  }

  return [...byPlayer.values()]
    .map((stats) => ({
      ...stats,
      goalDiff: stats.goalsFor - stats.goalsAgainst,
      winRate: stats.duels === 0 ? 0 : stats.wins / stats.duels,
    }))
    .sort(
      (a, b) =>
        b.goalsFor - a.goalsFor ||
        b.goalDiff - a.goalDiff ||
        b.wins - a.wins ||
        a.playerId.localeCompare(b.playerId),
    );
}

export function aggregateTeamStats(teamId: string, fixtures: readonly FixtureRecord[]): TeamStats {
  const stats: TeamStats = {
    teamId,
    fixtures: emptyTally(),
    duels: emptyTally(),
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
  };

  for (const fixture of fixtures) {
    const side = fixture.teamAId === teamId ? 'A' : fixture.teamBId === teamId ? 'B' : null;
    if (!side) continue;

    const { scoreA, scoreB } = computeFixtureScore(fixture.duels);
    const own = side === 'A' ? scoreA : scoreB;
    const opponent = side === 'A' ? scoreB : scoreA;
    tally(stats.fixtures, own > opponent ? 'win' : own === opponent ? 'draw' : 'loss');

    for (const duel of fixture.duels) tally(stats.duels, resultFor(side, duelOutcome(duel)));

    const { goalsA, goalsB } = sumGoals(fixture.duels);
    stats.goalsFor += side === 'A' ? goalsA : goalsB;
    stats.goalsAgainst += side === 'A' ? goalsB : goalsA;
  }

  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;
  return stats;
}
```

Adicionar em `packages/shared/src/index.ts`:
```ts
export * from './stats';
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/shared && npm run typecheck`
Expected: todos PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): player and team statistics"
```

---

### Task 6: Celular (normalização E.164) e link do WhatsApp

**Files:**
- Create: `packages/shared/src/phone.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/phone.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(input: string): string | null` — retorna E.164 (`+<dígitos>`) ou `null` se inválido. Regras: com `+` inicial → aceita 8–15 dígitos como estão; sem `+` → remove zeros à esquerda (prefixos `0`/`00`), aceita 10–11 dígitos como número brasileiro (prefixa `55`) ou 12–13 dígitos começando com `55`.
  - `whatsappUrl(e164: string): string` — `https://wa.me/<dígitos>`

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/phone.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { normalizePhone, whatsappUrl } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['11 3456-7890', '+551134567890'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['5511987654321', '+5511987654321'],
    ['011 98765-4321', '+5511987654321'],
    ['0055 11 98765-4321', '+5511987654321'],
    ['55 98765-4321', '+5555987654321'], // DDD 55 (RS), sem código do país
    ['+351 912 345 678', '+351912345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '   ', '12345', '+1', '123456789012345678', 'abc'])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('whatsappUrl', () => {
  it('builds a wa.me link with digits only', () => {
    expect(whatsappUrl('+5511987654321')).toBe('https://wa.me/5511987654321');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/shared -- src/phone.test.ts`
Expected: FAIL — `Failed to resolve import "./phone"`.

- [ ] **Step 3: Implementar**

`packages/shared/src/phone.ts`:
```ts
const BRAZIL_COUNTRY_CODE = '55';

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  digits = digits.replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) return `+${BRAZIL_COUNTRY_CODE}${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith(BRAZIL_COUNTRY_CODE)) return `+${digits}`;
  return null;
}

export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}
```

Adicionar em `packages/shared/src/index.ts`:
```ts
export * from './phone';
```

- [ ] **Step 4: Rodar a suíte completa e typecheck**

Run: `npm test && npm run typecheck`
Expected: todas as suítes de `@kickabout/shared` PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): phone normalization and WhatsApp link"
```
