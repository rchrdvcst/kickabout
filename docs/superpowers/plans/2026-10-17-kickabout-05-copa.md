# Modo Copa (grupos + mata-mata) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar o formato Copa: fase de grupos sorteada (pontos corridos em cada grupo) e, depois, um mata-mata sorteado entre os classificados, sem confronto do mesmo grupo na primeira rodada.

**Architecture:**
- A copa é um campeonato só, com duas fases (stages) do brackets-manager no mesmo `bracket` JSON:
  - fase 1: `round_robin` com G grupos, montados com `settings.manualOrdering`;
  - fase 2: `single_elimination`, criada no sorteio do mata-mata com `seedingIds` na ordem sorteada.
- Os sorteios são funções puras em `packages/shared`.
- A API decide se um confronto é de mata-mata pela fase da partida, não pelo formato do campeonato.

**Tech Stack:**
- monorepo npm workspaces;
- `packages/shared` (TypeScript puro, Vitest);
- `apps/api` (Fastify, Prisma, Postgres, brackets-manager 1.11.1, brackets-memory-db);
- `apps/web` (React 19, React Router 7, TanStack Query 5, Vitest, Testing Library).

**Spec:** `docs/superpowers/specs/2026-10-17-kickabout-copa-design.md` (base: `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`).

## Global Constraints

- **Idioma:** textos do produto em português do Brasil, frases em caixa normal e erros sem pedir desculpas.
- **Commits:** um commit ao final do plano (preferência do usuário), numa branch nova `feat/cup-mode` criada a partir da `main`. Não há commit por task: os passos "Commit" de cada task viram "registrar no ledger".
- **`docs/VERSOES.md`:** recebe a seção v1.5 no mesmo commit.
- **Regras de confronto:** inalteradas. Nos grupos, 5 duelos e empate vale (`isKnockout = false`). No mata-mata, 6º duelo e pênaltis se empatar (`isKnockout = true`).
- **Desempate nos grupos:** pontos, confronto direto, vitórias, saldo de gols, gols marcados e, por último, a ordem do sorteio (seed). É o `computeStandings` atual.
- **Limites:**
  - `groupCount` de 2 a 16;
  - `qualifiersPerGroup` de 1 até (tamanho do menor grupo − 1);
  - cada grupo com pelo menos 2 times.
- **Mensagens de erro (exatas):**
  - "A copa precisa de pelo menos 2 grupos."
  - "A copa precisa de pelo menos 4 times; há N."
  - "Com N times, dá para ter no máximo X grupos."
  - "Com N times em G grupos, passam no máximo Q por grupo."
  - "Sorteie os grupos antes de iniciar."
  - "Faltam N jogos dos grupos." (singular: "Falta 1 jogo dos grupos.")
  - "Já há resultado lançado no mata-mata; não dá para sortear de novo nem desfazer."
  - "Sorteie o mata-mata antes de encerrar."
  - "Desfaça o sorteio do mata-mata para corrigir jogos dos grupos."
- **Ambiente:**
  - Node 24;
  - Postgres de desenvolvimento em `localhost:5433` (Docker);
  - o banco de testes recebe as migrações sozinho (`apps/api/test/global-setup.ts`);
  - o banco de desenvolvimento precisa de `npx prisma migrate deploy` (em `apps/api`).

## Review Focus

1. **Grupos desiguais** (10 times em 3 grupos dá 4, 3 e 3): classificação e classificados por grupo continuam certos, e o mata-mata de 6 sai com 2 BYEs. Teste na Task 4 ("uneven groups").
2. **Resultado do mata-mata reaberto para rascunho:** continua contando como "mata-mata começou", e sortear de novo ou desfazer é recusado. Teste na Task 4 ("even a reopened draft").
3. **Ida e volta nos grupos:** gera o dobro de confrontos. Teste na Task 3 ("double round robin").
4. **Inscrição ou opções mudadas depois do sorteio dos grupos:** a prévia some e iniciar é recusado. Teste na Task 2 ("forgets the draw").
5. **Só 2 classificados com disputa de 3º marcada:** o mata-mata é só a final e o encerramento gera 2 títulos. Teste na Task 4 ("two qualifiers").

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/cup.ts` (novo) | `cupLayout`, `cupProblem`, `drawGroups`, `drawKnockout` |
| `packages/shared/src/cup.test.ts` (novo) | testes das regras puras |
| `packages/shared/src/index.ts` | exporta `./cup` |
| `apps/api/prisma/schema.prisma` | enum `cup`, coluna `groupDraw` |
| `apps/api/prisma/migrations/20261017180000_cup_mode/migration.sql` (novo) | migração |
| `apps/api/src/tournaments/options.ts` | `groupCount`, `qualifiersPerGroup` |
| `apps/api/src/tournaments/stage.ts` | `MIN_TEAMS.cup`, `cupGroupStageInput`, `cupKnockoutStageInput` |
| `apps/api/src/tournaments/cup.ts` (novo) | fases da copa no bracket: `phaseOf`, `knockoutStageOf`, `groupsPending`, `cupGroups`, `cupStandings`, `assertKnockoutUntouched`, `groupsLockedError` |
| `apps/api/src/tournaments/bracket-view.ts` | `MatchView.phase` |
| `apps/api/src/tournaments/routes.ts` | criar/editar/limpar sorteio, `group-draw`, `start` da copa, `standings` por grupo, `knockout-draw` (POST/DELETE), `finish` da copa, DTO |
| `apps/api/src/fixtures/detail.ts`, `save-result.ts`, `reopen-result.ts` | `isKnockout` pela fase; `GROUPS_LOCKED` |
| `apps/api/test/cup.test.ts` (novo) | integração da copa |
| `apps/web/src/api/types.ts`, `api/admin.ts` | tipos e chamadas novas |
| `apps/web/src/lib/format.ts` | rótulos, `groupLetter`, `phaseData`, `roundCounts(fase)`, `fixtureRoundLabel`, `cupSummary` |
| `apps/web/src/pages/tournament/GroupsTab.tsx` (novo), `TournamentPage.tsx`, `BracketTab.tsx`, `FixturesTab.tsx`, `pages/FixturePage.tsx` | site público |
| `apps/web/src/components/StandingsTable.tsx`, `BracketView.tsx` | rótulo por grupo, classificados, só a fase 2 |
| `apps/web/src/pages/admin/tournament/TournamentFields.tsx`, `EntriesEditor.tsx`, `GroupDraw.tsx` (novo), `KnockoutDraw.tsx` (novo), `pages/admin/AdminTournamentPage.tsx` | admin |
| `apps/web/src/styles/components.css`, `admin.css` | classificados e blocos de sorteio |
| `apps/web/test/cup.test.tsx` (novo), `test/format.test.ts` | testes do site |
| `docs/VERSOES.md`, `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md` | documentação |

---

### Task 1: Regras puras da copa (`packages/shared`)

**Files:**
- Create: `packages/shared/src/cup.ts`
- Create: `packages/shared/src/cup.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `cupLayout(teamCount: number, groupCount: number): { ok: true; sizes: number[]; maxQualifiers: number } | { ok: false; message: string }`
  - `cupProblem(teamCount: number, groupCount: number, qualifiersPerGroup: number): string | null`
  - `drawGroups<T>(items: readonly T[], groupCount: number, random: () => number): T[][]`
  - `interface Qualified<T> { item: T; group: number }`
  - `drawKnockout<T>(qualified: readonly Qualified<T>[], random: () => number): (T | null)[]`: as posições (0,1), (2,3)… são os confrontos da 1ª rodada; `null` = BYE.

- [ ] **Step 1: Write the failing test** (`packages/shared/src/cup.test.ts`)

```ts
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
    [10, 3, [4, 3, 3], 2],
    [7, 2, [4, 3], 2],
    [8, 2, [4, 4], 3],
    [4, 2, [2, 2], 1],
  ])('%i times em %i grupos → %j, até %i por grupo', (teams, groups, sizes, max) => {
    expect(cupLayout(teams, groups)).toEqual({ ok: true, sizes, maxQualifiers: max });
  });

  it('explains layouts that cannot work', () => {
    expect(cupLayout(8, 1)).toEqual({ ok: false, message: 'A copa precisa de pelo menos 2 grupos.' });
    expect(cupLayout(3, 2)).toEqual({ ok: false, message: 'A copa precisa de pelo menos 4 times; há 3.' });
    expect(cupLayout(5, 3)).toEqual({ ok: false, message: 'Com 5 times, dá para ter no máximo 2 grupos.' });
  });
});

describe('cupProblem', () => {
  it('accepts up to the smallest group minus one and explains the limit', () => {
    expect(cupProblem(10, 3, 2)).toBeNull();
    expect(cupProblem(10, 3, 3)).toBe('Com 10 times em 3 grupos, passam no máximo 2 por grupo.');
    expect(cupProblem(10, 3, 0)).toBe('Pelo menos 1 time por grupo precisa se classificar.');
    expect(cupProblem(5, 3, 1)).toBe('Com 5 times, dá para ter no máximo 2 grupos.');
  });
});

describe('drawGroups', () => {
  it('splits every item once into groups as even as possible', () => {
    const items = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const groups = drawGroups(items, 3, seeded(1));
    expect(groups.map((group) => group.length)).toEqual([4, 3, 3]);
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
    for (let groups = 2; groups <= 8; groups++) {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w packages/shared -- cup`
Expected: FAIL com "Failed to resolve import "./cup"".

- [ ] **Step 3: Write minimal implementation** (`packages/shared/src/cup.ts`)

```ts
export type CupLayout = { ok: true; sizes: number[]; maxQualifiers: number } | { ok: false; message: string };

/** Tamanhos dos grupos (o mais parelho possível, maiores primeiro) e o máximo de classificados por grupo. */
export function cupLayout(teamCount: number, groupCount: number): CupLayout {
  if (!Number.isInteger(groupCount) || groupCount < 2) return { ok: false, message: 'A copa precisa de pelo menos 2 grupos.' };
  if (teamCount < 4) return { ok: false, message: `A copa precisa de pelo menos 4 times; há ${teamCount}.` };
  const maxGroups = Math.floor(teamCount / 2);
  if (groupCount > maxGroups) return { ok: false, message: `Com ${teamCount} times, dá para ter no máximo ${maxGroups} grupos.` };
  const base = Math.floor(teamCount / groupCount);
  const extra = teamCount % groupCount;
  const sizes = Array.from({ length: groupCount }, (_, index) => base + (index < extra ? 1 : 0));
  return { ok: true, sizes, maxQualifiers: base - 1 };
}

/** O que impede a copa de começar com essas opções, ou null. */
export function cupProblem(teamCount: number, groupCount: number, qualifiersPerGroup: number): string | null {
  const layout = cupLayout(teamCount, groupCount);
  if (!layout.ok) return layout.message;
  if (qualifiersPerGroup < 1) return 'Pelo menos 1 time por grupo precisa se classificar.';
  if (qualifiersPerGroup > layout.maxQualifiers) {
    return `Com ${teamCount} times em ${groupCount} grupos, passam no máximo ${layout.maxQualifiers} por grupo.`;
  }
  return null;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Sorteia os itens nos grupos, na ordem de tamanhos de `cupLayout`. */
export function drawGroups<T>(items: readonly T[], groupCount: number, random: () => number): T[][] {
  const layout = cupLayout(items.length, groupCount);
  if (!layout.ok) throw new Error(layout.message);
  const shuffled = shuffle(items, random);
  const groups: T[][] = [];
  let at = 0;
  for (const size of layout.sizes) {
    groups.push(shuffled.slice(at, at + size));
    at += size;
  }
  return groups;
}

export interface Qualified<T> {
  item: T;
  group: number;
}

/** Tira um item do grupo com mais itens restantes (empate decidido no sorteio). */
function takeFromLargest<T>(pool: Map<number, Qualified<T>[]>, random: () => number, except?: number): Qualified<T> {
  const candidates = [...pool.entries()].filter(([group, list]) => list.length > 0 && group !== except);
  const most = Math.max(...candidates.map(([, list]) => list.length));
  const tied = candidates.filter(([, list]) => list.length === most);
  const [group, list] = tied[Math.floor(random() * tied.length)]!;
  const index = Math.floor(random() * list.length);
  const [taken] = list.splice(index, 1);
  if (list.length === 0) pool.delete(group);
  return taken!;
}

/**
 * Sorteia a chave do mata-mata. Devolve as posições da chave: (0,1), (2,3)… são os confrontos da 1ª rodada,
 * `null` é BYE. Nenhum confronto da 1ª rodada junta dois times do mesmo grupo.
 *
 * Os BYEs saem sempre do grupo com mais times restantes, e cada confronto junta o grupo maior com o segundo
 * maior. Assim nenhum grupo passa da metade dos restantes, e o sorteio sempre termina (com 2+ grupos e o mesmo
 * número de classificados por grupo).
 */
export function drawKnockout<T>(qualified: readonly Qualified<T>[], random: () => number): (T | null)[] {
  if (qualified.length < 2) throw new Error('São necessários pelo menos 2 classificados.');
  let size = 1;
  while (size < qualified.length) size *= 2;

  const pool = new Map<number, Qualified<T>[]>();
  for (const entry of shuffle(qualified, random)) pool.set(entry.group, [...(pool.get(entry.group) ?? []), entry]);

  const pairs: [T, T | null][] = [];
  for (let bye = 0; bye < size - qualified.length; bye++) pairs.push([takeFromLargest(pool, random).item, null]);
  while (pool.size > 0) {
    const first = takeFromLargest(pool, random);
    if (pool.size === 0 || (pool.size === 1 && pool.has(first.group))) {
      throw new Error('Não foi possível sortear o mata-mata sem confronto do mesmo grupo.');
    }
    const second = takeFromLargest(pool, random, first.group);
    pairs.push([first.item, second.item]);
  }
  return shuffle(pairs, random).flatMap(([a, b]) => (random() < 0.5 || b === null ? [a, b] : [b, a]));
}
```

Em `packages/shared/src/index.ts`, acrescente a linha:

```ts
export * from './cup';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w packages/shared`
Expected: PASS em todos (62 anteriores + os novos).

- [ ] **Step 5: Registrar no ledger** (sem commit: um commit no fim do plano)

---

### Task 2: Copa no rascunho (dados, opções e sorteio dos grupos)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enum `TournamentFormat`, model `Tournament`)
- Create: `apps/api/prisma/migrations/20261017180000_cup_mode/migration.sql`
- Modify: `apps/api/src/tournaments/options.ts`
- Modify: `apps/api/src/tournaments/stage.ts`
- Modify: `apps/api/src/tournaments/routes.ts`
- Modify: `apps/api/test/stage.test.ts:51`
- Create: `apps/api/test/cup.test.ts`

**Interfaces:**
- Consumes: `cupProblem`, `drawGroups` (Task 1).
- Produces:
  - **Opções:** `TournamentOptions` com `groupCount: number` e `qualifiersPerGroup: number` (padrões 2 e 2).
  - **`POST /api/tournaments/:id/group-draw`:** devolve `{ groups: TeamRef[][] }`.
  - **`tournamentDto`:**
    - na copa, inclui `groupDraw: TeamRef[][] | null`, `knockoutDrawn: boolean` e `groupsPending: number | null`;
    - nos outros formatos esses campos ficam ausentes.
  - **`MIN_TEAMS.cup = 4`.**
  - **Erros:** `CUP_LAYOUT_INVALID`, `NOT_A_CUP`, `GROUP_DRAW_REQUIRED` (este é usado na Task 3).

- [ ] **Step 1: Write the failing test** (`apps/api/test/cup.test.ts`, primeira parte; as Tasks 3 e 4 acrescentam testes ao mesmo arquivo)

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  TIED_2_2,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  prisma,
  resetDb,
  saveResult,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

interface CupFixture {
  matchId: number;
  phase: 'groups' | 'knockout';
  isKnockout: boolean;
  groupNumber: number;
  roundNumber: number;
  status: string;
  teamA: { id: string };
  teamB: { id: string };
}

async function draftCup(count: number, options: Record<string, unknown> = {}) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie },
    payload: { name: 'Copa Teste', format: 'cup', options: { groupCount: 2, qualifiersPerGroup: 2, ...options } },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  const entries = await app.inject({
    method: 'PUT',
    url: `/api/tournaments/${id}/entries`,
    headers: { cookie },
    payload: { teamIds: squads.map((squad) => squad.team.id) },
  });
  expect(entries.statusCode).toBe(200);
  const playersOf = (teamId: string): TestPlayer[] => squads.find((squad) => squad.team.id === teamId)!.players;
  const post = (path: string) => app.inject({ method: 'POST', url: `/api/tournaments/${id}${path}`, headers: { cookie } });
  const del = (path: string) => app.inject({ method: 'DELETE', url: `/api/tournaments/${id}${path}`, headers: { cookie } });
  const get = (path = '') => app.inject({ method: 'GET', url: `/api/tournaments/${id}${path}` });
  return { cookie, id, squads, playersOf, post, del, get };
}

type Cup = Awaited<ReturnType<typeof draftCup>>;

async function startedCup(count: number, options: Record<string, unknown> = {}) {
  const cup = await draftCup(count, options);
  expect((await cup.post('/group-draw')).statusCode).toBe(200);
  const started = await cup.post('/start');
  expect(started.statusCode, started.body).toBe(200);
  return cup;
}

const listOf = async (cup: Cup) => (await fixtures(app, cup.id)) as unknown as CupFixture[];

async function confirm(cup: Cup, f: CupFixture, scores: [number, number][] = A_WINS_3_1) {
  const res = await saveResult(app, cup.cookie, cup.id, f.matchId, 'final', duelsPayload(cup.playersOf(f.teamA.id), cup.playersOf(f.teamB.id), scores));
  expect(res.statusCode, res.body).toBe(200);
}

async function playPhase(cup: Cup, phase: 'groups' | 'knockout') {
  for (let i = 0; i < 300; i++) {
    const pending = (await listOf(cup)).filter((f) => f.phase === phase && f.status !== 'completed');
    if (pending.length === 0) return;
    await confirm(cup, pending[0]!);
  }
  throw new Error(`playPhase(${phase}): não terminou`);
}

describe('cup draft', () => {
  it('creates a cup with group options and explains layouts that cannot work', async () => {
    const cup = await draftCup(5, { groupCount: 3, qualifiersPerGroup: 1 });
    expect((await cup.get()).json()).toMatchObject({
      format: 'cup',
      options: { groupCount: 3, qualifiersPerGroup: 1, roundRobinMode: 'simple', consolationFinal: false },
      groupDraw: null,
      knockoutDrawn: false,
      groupsPending: null,
    });
    const draw = await cup.post('/group-draw');
    expect(draw.statusCode).toBe(409);
    expect(draw.json()).toMatchObject({ error: { code: 'CUP_LAYOUT_INVALID', message: 'Com 5 times, dá para ter no máximo 2 grupos.' } });
  });

  it('draws the groups, draws again, and forgets the draw when the entries or options change', async () => {
    const cup = await draftCup(8);
    const first = await cup.post('/group-draw');
    expect(first.statusCode).toBe(200);
    const groups = first.json().groups as { id: string }[][];
    expect(groups.map((group) => group.length)).toEqual([4, 4]);
    expect(groups.flat().map((team) => team.id).sort()).toEqual(cup.squads.map((squad) => squad.team.id).sort());
    expect((await cup.get()).json().groupDraw).toEqual(groups);

    expect((await cup.post('/group-draw')).statusCode).toBe(200);

    await app.inject({
      method: 'PATCH',
      url: `/api/tournaments/${cup.id}`,
      headers: { cookie: cup.cookie },
      payload: { options: { qualifiersPerGroup: 1 } },
    });
    expect((await cup.get()).json().groupDraw).toBeNull();

    await cup.post('/group-draw');
    await app.inject({
      method: 'PUT',
      url: `/api/tournaments/${cup.id}/entries`,
      headers: { cookie: cup.cookie },
      payload: { teamIds: cup.squads.slice(0, 7).map((squad) => squad.team.id) },
    });
    expect((await cup.get()).json().groupDraw).toBeNull();
    const start = await cup.post('/start');
    expect(start.statusCode).toBe(409);
    expect(start.json()).toMatchObject({ error: { code: 'GROUP_DRAW_REQUIRED', message: 'Sorteie os grupos antes de iniciar.' } });
  });

  it('only draws groups for a cup in draft', async () => {
    const cookie = await loginAdmin(app);
    const created = await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'Liga', format: 'round_robin' } });
    const res = await app.inject({ method: 'POST', url: `/api/tournaments/${created.json().id}/group-draw`, headers: { cookie } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_A_CUP' } });
  });
});

void [TIED_2_2, prisma, startedCup, playPhase];
```

(A última linha evita aviso de variável não usada até as Tasks 3 e 4 usarem esses nomes; apague-a na Task 4.)

Em `apps/api/test/stage.test.ts:51`, troque a expectativa pela nova forma (as opções novas entram nos padrões):

```ts
    expect(normalizeOptions()).toEqual({
      consolationFinal: false,
      grandFinalReset: false,
      roundRobinMode: 'simple',
      groupCount: 2,
      qualifiersPerGroup: 2,
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/api -- cup stage`
Expected: FAIL. O `POST /tournaments` com `format: 'cup'` dá 400, e o `normalizeOptions` não tem os campos novos.

- [ ] **Step 3: Write minimal implementation**

`apps/api/prisma/schema.prisma`: no enum, acrescente `cup`; no model `Tournament`, acrescente a coluna depois de `bracket`:

```prisma
enum TournamentFormat {
  single_elimination
  double_elimination
  round_robin
  cup
}
```

```prisma
  bracket    Json?
  /// Copa em rascunho: prévia do sorteio dos grupos (lista de grupos, cada um com ids de time).
  groupDraw  Json?
```

`apps/api/prisma/migrations/20261017180000_cup_mode/migration.sql`:

```sql
-- Modo copa: novo formato e a prévia do sorteio dos grupos.
ALTER TYPE "TournamentFormat" ADD VALUE 'cup';
ALTER TABLE "Tournament" ADD COLUMN "groupDraw" JSONB;
```

Depois rode em `apps/api`: `npx prisma generate` e `npx prisma migrate deploy` (este último no banco de desenvolvimento; o de testes migra sozinho).

`apps/api/src/tournaments/options.ts` (arquivo inteiro):

```ts
import { z } from 'zod';

export const optionsSchema = z.object({
  consolationFinal: z.boolean().optional(),
  grandFinalReset: z.boolean().optional(),
  roundRobinMode: z.enum(['simple', 'double']).optional(),
  groupCount: z.number().int().min(2).max(16).optional(),
  qualifiersPerGroup: z.number().int().min(1).max(16).optional(),
});

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
  /** Copa: número de grupos. */
  groupCount: number;
  /** Copa: quantos de cada grupo vão para o mata-mata. */
  qualifiersPerGroup: number;
}

export const normalizeOptions = (input: z.infer<typeof optionsSchema> = {}): TournamentOptions => ({
  consolationFinal: input.consolationFinal ?? false,
  grandFinalReset: input.grandFinalReset ?? false,
  roundRobinMode: input.roundRobinMode ?? 'simple',
  groupCount: input.groupCount ?? 2,
  qualifiersPerGroup: input.qualifiersPerGroup ?? 2,
});
```

`apps/api/src/tournaments/stage.ts`:
- Em `MIN_TEAMS`, acrescente `cup: 4,`.
- No `switch` de `stageInput`, acrescente antes do fim:

```ts
    case 'cup':
      throw new Error('A copa cria as fases com cupGroupStageInput e cupKnockoutStageInput.');
```

`apps/api/src/tournaments/routes.ts`:

1. Os imports mudam assim:
   - `import type { Prisma } from '@prisma/client';` vira `import { Prisma } from '@prisma/client';`, porque `Prisma.DbNull` é usado como valor;
   - acrescente `cupProblem, drawGroups` ao import de `@kickabout/shared`;
   - acrescente `import { groupsPending, knockoutStageOf } from './cup';`. Esse arquivo é criado na Task 3; até lá, crie `apps/api/src/tournaments/cup.ts` com só estas duas funções:

```ts
import type { BracketData } from './bracket-store';
import { MATCH_STATUS } from './bracket-view';

/** Fase 2 da copa (mata-mata), se já foi sorteada. */
export const knockoutStageOf = (data: BracketData | null) => data?.stage.find((stage) => stage.number === 2) ?? null;

/** Confrontos da fase de grupos (fase 1) ainda sem resultado confirmado. */
export function groupsPending(data: BracketData): number {
  const groupStage = data.stage.find((stage) => stage.number === 1);
  return data.match.filter((match) => match.stage_id === groupStage?.id && match.status < MATCH_STATUS.Completed).length;
}
```

2. `formatSchema` passa a ser `z.enum(['single_elimination', 'double_elimination', 'round_robin', 'cup'])`.

3. Acima de `tournamentDto`, acrescente:

```ts
/** Prévia do sorteio como times; null se não houver ou se não bater mais com a inscrição. */
function groupDrawDto(t: TournamentWithEntries) {
  const draw = t.groupDraw as string[][] | null;
  if (!draw) return null;
  const teams = new Map(t.entries.map((entry) => [entry.team.id, teamRef(entry.team)]));
  if (!draw.flat().every((teamId) => teams.has(teamId))) return null;
  return draw.map((group) => group.map((teamId) => teams.get(teamId)!));
}
```

   E, em `tournamentDto`, depois de `entries: …`, acrescente:

```ts
    ...(t.format === 'cup'
      ? {
          groupDraw: groupDrawDto(t),
          knockoutDrawn: knockoutStageOf(t.bracket as unknown as BracketData | null) !== null,
          groupsPending: t.bracket ? groupsPending(t.bracket as unknown as BracketData) : null,
        }
      : {}),
```

4. No `PATCH /tournaments/:id`, o `data` do `update` ganha a limpeza da prévia quando formato ou opções mudam:

```ts
        groupDraw: body.format !== undefined || body.options !== undefined ? Prisma.DbNull : undefined,
```

5. No `PUT /tournaments/:id/entries`, logo depois do `createMany`, limpe a prévia:

```ts
      await tx.tournament.update({ where: { id }, data: { groupDraw: Prisma.DbNull } });
```

6. Novo endpoint, depois do `PUT …/entries`:

```ts
  app.post('/tournaments/:id/group-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const t = await loadTournament(tx, id);
      if (t.format !== 'cup') throw new AppError(409, 'NOT_A_CUP', 'Este campeonato não é uma copa.');
      if (t.status !== 'draft') throw lockedError('O sorteio dos grupos só pode ser feito antes do início.');
      const options = t.options as unknown as TournamentOptions;
      const problem = cupProblem(t.entries.length, options.groupCount, options.qualifiersPerGroup);
      if (problem) throw new AppError(409, 'CUP_LAYOUT_INVALID', problem);
      const draw = drawGroups(
        t.entries.map((entry) => entry.team.id),
        options.groupCount,
        Math.random,
      );
      await tx.tournament.update({ where: { id }, data: { groupDraw: draw } });
    });
    return { groups: groupDrawDto(await loadTournament(prisma, id)) };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/api -- cup stage tournaments`
Expected: PASS. O teste do sorteio desatualizado ainda falha na parte do `start` (`GROUP_DRAW_REQUIRED`), que vem na Task 3. Se só essa expectativa falhar, comente-a temporariamente com `// Task 3` e devolva na Task 3.

- [ ] **Step 5: Registrar no ledger**

---

### Task 3: Iniciar a copa, fase por partida e classificação por grupo

**Files:**
- Modify: `apps/api/src/tournaments/cup.ts`
- Modify: `apps/api/src/tournaments/stage.ts`
- Modify: `apps/api/src/tournaments/bracket-view.ts:6-45`
- Modify: `apps/api/src/tournaments/routes.ts` (`start`, `standings`)
- Modify: `apps/api/src/fixtures/detail.ts`
- Modify: `apps/api/src/fixtures/save-result.ts:41-65`
- Modify: `apps/api/src/fixtures/reopen-result.ts:48-57`
- Test: `apps/api/test/cup.test.ts`

**Interfaces:**
- Consumes: `knockoutStageOf`, `groupsPending` (Task 2).
- Produces:
  - **`MatchView.phase`:** `'groups' | 'knockout'`; os itens de `GET /fixtures` e o detalhe ganham `phase`, e `isKnockout` passa a ser `phase === 'knockout'`.
  - **`cupGroupStageInput(t: { id: string; name: string; options: TournamentOptions }, groups: { name: string; teamId: string }[][]): InputStage`.**
  - **`cupGroups(data: BracketData, seedOf: Map<string, number>): { groupNumber: number; teamIds: string[]; matchIds: number[] }[]`.**
  - **`cupStandings(db: Db, t: TournamentWithEntries, data: BracketData)`:** devolve `(StandingRow & { groupNumber: number; qualified: boolean })[]`.
  - **`GET /standings`:**
    - nos pontos corridos, cada linha ganha `groupNumber: 1`;
    - na copa, as linhas vêm de todos os grupos (grupo 1 primeiro), com `groupNumber` e `qualified`.

- [ ] **Step 1: Write the failing test** (acrescente ao fim de `apps/api/test/cup.test.ts`)

```ts
describe('cup group stage', () => {
  it('starts with exactly the drawn groups, allows draws, and ranks each group', async () => {
    const cup = await draftCup(8);
    const groups = (await cup.post('/group-draw')).json().groups as { id: string }[][];
    expect((await cup.post('/start')).statusCode).toBe(200);

    const list = await listOf(cup);
    expect(list).toHaveLength(12);
    const groupOf = new Map(groups.flatMap((group, index) => group.map((team) => [team.id, index + 1] as const)));
    for (const f of list) {
      expect(f).toMatchObject({ phase: 'groups', isKnockout: false });
      expect(groupOf.get(f.teamA.id)).toBe(groupOf.get(f.teamB.id));
      expect(f.groupNumber).toBe(groupOf.get(f.teamA.id));
    }

    await confirm(cup, list[0]!, TIED_2_2);
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; played: number; team: { id: string } }[];
    expect(standings.map((row) => row.groupNumber)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    for (const row of standings) expect(groupOf.get(row.team.id)).toBe(row.groupNumber);
    expect(standings.filter((row) => row.qualified)).toHaveLength(4);
    expect((await cup.get()).json()).toMatchObject({ status: 'in_progress', groupsPending: 11, knockoutDrawn: false, groupDraw: null });
  });

  it('plays a double round robin in the groups when asked', async () => {
    const cup = await startedCup(6, { groupCount: 2, qualifiersPerGroup: 1, roundRobinMode: 'double' });
    expect(await listOf(cup)).toHaveLength(12);
  });

  it('keeps the standings of plain round robin tournaments with groupNumber 1', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeamWithPlayers(app, cookie, 'Liga A');
    const b = await createTeamWithPlayers(app, cookie, 'Liga B');
    const created = await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'Liga', format: 'round_robin' } });
    const id = created.json().id;
    await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: [a.team.id, b.team.id] } });
    await app.inject({ method: 'POST', url: `/api/tournaments/${id}/start`, headers: { cookie } });
    const rows = (await app.inject({ method: 'GET', url: `/api/tournaments/${id}/standings` })).json();
    expect(rows.map((row: { groupNumber: number }) => row.groupNumber)).toEqual([1, 1]);
    expect(rows[0].qualified).toBeUndefined();
  });
});
```

Na Task 2, se você comentou a expectativa `GROUP_DRAW_REQUIRED`, devolva-a agora.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/api -- cup`
Expected: FAIL. Iniciar a copa estoura o `throw` de `stageInput` (500), e não existe `phase` nos confrontos.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/tournaments/stage.ts`: acrescente ao fim:

```ts
/** Copa, fase 1: um pontos corridos com exatamente os grupos sorteados (seeds 1..n na ordem dos grupos). */
export function cupGroupStageInput(
  t: { id: string; name: string; options: TournamentOptions },
  groups: { name: string; teamId: string }[][],
): InputStage {
  let seed = 0;
  return {
    tournamentId: t.id,
    name: 'Fase de grupos',
    type: 'round_robin',
    seeding: groups.flat(),
    settings: {
      groupCount: groups.length,
      roundRobinMode: t.options.roundRobinMode,
      manualOrdering: groups.map((group) => group.map(() => ++seed)),
    },
  };
}
```

`apps/api/src/tournaments/bracket-view.ts`:
- Em `MatchView`, acrescente `phase: 'groups' | 'knockout';`.
- Em `matchView`, dentro do objeto devolvido, acrescente:

```ts
    phase: data.stage.find((stage) => stage.id === match.stage_id)?.type === 'round_robin' ? 'groups' : 'knockout',
```

`apps/api/src/tournaments/cup.ts`: acrescente:

```ts
import { computeStandings, type StandingRow } from '@kickabout/shared';
import type { Db } from '../db';
import { completedFixtures, toFixtureRecord } from '../stats/queries';
import type { TournamentOptions } from './options';
import type { TournamentWithEntries } from './routes';
import { teamIdByParticipant } from './bracket-view';

/** Grupos da fase 1: times (na ordem do seed) e partidas de cada grupo. */
export function cupGroups(data: BracketData, seedOf: Map<string, number>) {
  const groupStage = data.stage.find((stage) => stage.number === 1);
  const teamOf = teamIdByParticipant(data);
  return data.group
    .filter((group) => group.stage_id === groupStage?.id)
    .sort((a, b) => a.number - b.number)
    .map((group) => {
      const matches = data.match.filter((match) => match.group_id === group.id);
      const participantIds = new Set(matches.flatMap((match) => [match.opponent1?.id, match.opponent2?.id]).filter((pid) => pid != null).map(Number));
      const teamIds = [...participantIds].map((pid) => teamOf.get(pid)!).sort((a, b) => (seedOf.get(a) ?? 0) - (seedOf.get(b) ?? 0));
      return { groupNumber: group.number, teamIds, matchIds: matches.map((match) => Number(match.id)) };
    });
}

export type CupStandingRow = StandingRow & { groupNumber: number; qualified: boolean };

/** Classificação de cada grupo com os classificados marcados. */
export async function cupStandings(db: Db, t: TournamentWithEntries, data: BracketData): Promise<CupStandingRow[]> {
  const options = t.options as unknown as TournamentOptions;
  const fixtures = await completedFixtures(db, { tournamentId: t.id });
  const byMatch = new Map(fixtures.map((fixture) => [fixture.bmMatchId, fixture]));
  const seedOf = new Map(t.entries.map((entry) => [entry.team.id, entry.seed]));
  return cupGroups(data, seedOf).flatMap((group) => {
    const records = group.matchIds.flatMap((matchId) => {
      const fixture = byMatch.get(matchId);
      return fixture ? [toFixtureRecord(fixture)] : [];
    });
    return computeStandings(group.teamIds, records).map((row) => ({
      ...row,
      groupNumber: group.groupNumber,
      qualified: row.position <= options.qualifiersPerGroup,
    }));
  });
}
```

O `import type { TournamentWithEntries } from './routes'` é só de tipo e não cria ciclo em tempo de execução.

`apps/api/src/tournaments/routes.ts`:

1. Imports: acrescente `cupGroupStageInput` ao import de `./stage` e `cupStandings` ao import de `./cup`.

2. No `POST /tournaments/:id/start`, troque o bloco a partir de `await withBracket(tx, id, (manager) =>` (até o `update` de status, exclusive) por:

```ts
      if (t.format === 'cup') {
        const options = t.options as unknown as TournamentOptions;
        const problem = cupProblem(t.entries.length, options.groupCount, options.qualifiersPerGroup);
        if (problem) throw new AppError(409, 'CUP_LAYOUT_INVALID', problem);
        const draw = t.groupDraw as string[][] | null;
        const entered = new Set(t.entries.map((entry) => entry.team.id));
        const drawn = draw?.flat() ?? [];
        if (!draw || draw.length !== options.groupCount || drawn.length !== entered.size || !drawn.every((teamId) => entered.has(teamId))) {
          throw new AppError(409, 'GROUP_DRAW_REQUIRED', 'Sorteie os grupos antes de iniciar.');
        }
        // O seed passa a ser a ordem do sorteio (último critério de desempate). Recria as inscrições de uma vez por
        // causa da chave única (tournamentId, seed).
        await tx.tournamentEntry.deleteMany({ where: { tournamentId: id } });
        await tx.tournamentEntry.createMany({ data: drawn.map((teamId, index) => ({ tournamentId: id, teamId, seed: index + 1 })) });
        const names = new Map(t.entries.map((entry) => [entry.team.id, entry.team.name]));
        await withBracket(tx, id, (manager) =>
          manager.create.stage(
            cupGroupStageInput(
              { id, name: t.name, options },
              draw.map((group) => group.map((teamId) => ({ name: names.get(teamId)!, teamId }))),
            ),
          ),
        );
        await tx.tournament.update({ where: { id }, data: { groupDraw: Prisma.DbNull } });
      } else {
        await withBracket(tx, id, (manager) =>
          manager.create.stage(stageInput({ ...t, options: t.options as unknown as TournamentOptions })),
        );
      }
```

3. Substitua o corpo do `GET /tournaments/:id/standings` por:

```ts
    const { id } = parse(idParams, request.params);
    const t = await loadTournament(prisma, id);
    const teams = new Map(t.entries.map((e) => [e.team.id, teamRef(e.team)]));
    if (t.format === 'cup') {
      const data = t.bracket as unknown as BracketData | null;
      if (!data) return [];
      return (await cupStandings(prisma, t, data)).map((row) => ({ ...row, team: teams.get(row.teamId)! }));
    }
    if (t.format !== 'round_robin') return [];
    const fixtures = await completedFixtures(prisma, { tournamentId: id });
    const rows = computeStandings(t.entries.map((e) => e.team.id), fixtures.map(toFixtureRecord));
    return rows.map((row) => ({ ...row, groupNumber: 1, team: teams.get(row.teamId)! }));
```

`apps/api/src/fixtures/detail.ts`:
- Em `FixtureListItem`, acrescente `phase: 'groups' | 'knockout';`.
- `toItem` perde o parâmetro `isKnockout` e passa a usar a fase:

```ts
const toItem = (view: MatchView, status: FixtureStatusView, teams: Map<string, TeamRef>): FixtureListItem => ({
  matchId: view.matchId,
  groupNumber: view.groupNumber,
  roundNumber: view.roundNumber,
  number: view.number,
  phase: view.phase,
  isKnockout: view.phase === 'knockout',
  status,
  teamA: teams.get(view.teamAId)!,
  teamB: teams.get(view.teamBId)!,
  scoreA: status === 'completed' ? view.scoreA : null,
  scoreB: status === 'completed' ? view.scoreB : null,
});
```

- Em `listFixtures`: apague `const isKnockout = …` e chame `toItem(v, statusByMatch.get(v.matchId) ?? 'pending', teams)`. A variável `tournament` deixa de ser usada ali: troque `const { tournament, data } = …` por `const { data } = …`.
- Em `getFixtureDetail`: `const item = toItem(view, fixture?.status ?? 'pending', teams);` e `const { data } = await bracketOf(…)`.

`apps/api/src/fixtures/save-result.ts`:
- Apague a linha `const isKnockout = tournament.format !== 'round_robin';` (linha 41).
- Logo depois de `if (!view) throw …FIXTURE_NOT_READY…`, acrescente:

```ts
        const isKnockout = view.phase === 'knockout';
```

`apps/api/src/fixtures/reopen-result.ts`:
- Apague `const roundRobin = tournament.format === 'round_robin';`.
- Dentro do `withBracket`, logo depois de `if (!findMatch(data, matchId)) throw notFound('Confronto');`, troque por:

```ts
        const raw = findMatch(data, matchId);
        if (!raw) throw notFound('Confronto');
        const roundRobin = matchView(data, raw)?.phase === 'groups';
```

- Acrescente `matchView` ao import de `../tournaments/bracket-view`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/api`
Expected: PASS em todos, incluindo os testes antigos de reabrir nos pontos corridos e nas eliminatórias.

- [ ] **Step 5: Registrar no ledger**

---

### Task 4: Sorteio do mata-mata, travas, encerramento e títulos da copa

**Files:**
- Modify: `apps/api/src/tournaments/cup.ts`
- Modify: `apps/api/src/tournaments/stage.ts`
- Modify: `apps/api/src/tournaments/routes.ts` (`knockout-draw`, `finish`)
- Modify: `apps/api/src/fixtures/save-result.ts`, `apps/api/src/fixtures/reopen-result.ts`
- Test: `apps/api/test/cup.test.ts`

**Interfaces:**
- Consumes: `drawKnockout` (Task 1), `cupStandings`, `knockoutStageOf`, `groupsPending`, `MatchView.phase` (Tasks 2 e 3).
- Produces:
  - **`POST /api/tournaments/:id/knockout-draw`:** devolve `tournamentDto`.
  - **`DELETE /api/tournaments/:id/knockout-draw`:** devolve `tournamentDto`.
  - **Erros:** `GROUPS_PENDING`, `KNOCKOUT_STARTED`, `KNOCKOUT_NOT_DRAWN`, `GROUPS_LOCKED`.
  - **`groupsLockedError()`.**

- [ ] **Step 1: Write the failing test** (acrescente ao fim de `apps/api/test/cup.test.ts` e apague a linha `void [...]`)

```ts
describe('cup knockout', () => {
  it('waits for the groups, never pairs teams of the same group, locks the groups, redraws and undoes', async () => {
    const cup = await startedCup(8);
    const early = await cup.post('/knockout-draw');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'GROUPS_PENDING', message: 'Faltam 12 jogos dos grupos.' } });

    await playPhase(cup, 'groups');
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; team: { id: string } }[];
    const groupOf = new Map(standings.map((row) => [row.team.id, row.groupNumber]));
    const qualified = new Set(standings.filter((row) => row.qualified).map((row) => row.team.id));

    const drawn = await cup.post('/knockout-draw');
    expect(drawn.statusCode, drawn.body).toBe(200);
    expect(drawn.json()).toMatchObject({ knockoutDrawn: true, groupsPending: 0 });
    const semis = (await listOf(cup)).filter((f) => f.phase === 'knockout');
    expect(semis).toHaveLength(2);
    for (const f of semis) {
      expect(f.isKnockout).toBe(true);
      expect(qualified.has(f.teamA.id) && qualified.has(f.teamB.id)).toBe(true);
      expect(groupOf.get(f.teamA.id)).not.toBe(groupOf.get(f.teamB.id));
    }

    const group = (await listOf(cup)).find((f) => f.phase === 'groups')!;
    const edit = await saveResult(app, cup.cookie, cup.id, group.matchId, 'final', duelsPayload(cup.playersOf(group.teamA.id), cup.playersOf(group.teamB.id), TIED_2_2));
    expect(edit.statusCode).toBe(409);
    expect(edit.json()).toMatchObject({ error: { code: 'GROUPS_LOCKED', message: 'Desfaça o sorteio do mata-mata para corrigir jogos dos grupos.' } });
    expect((await cup.post(`/fixtures/${group.matchId}/reopen`)).json()).toMatchObject({ error: { code: 'GROUPS_LOCKED' } });

    expect((await cup.post('/knockout-draw')).statusCode).toBe(200);
    const undone = await cup.del('/knockout-draw');
    expect(undone.statusCode).toBe(200);
    expect(undone.json()).toMatchObject({ knockoutDrawn: false });
    expect((await listOf(cup)).some((f) => f.phase === 'knockout')).toBe(false);
    expect((await cup.post(`/fixtures/${group.matchId}/reopen`)).statusCode).toBe(200);
  });

  it('cannot redraw or undo once the knockout has a result, even a reopened draft', async () => {
    const cup = await startedCup(8);
    await playPhase(cup, 'groups');
    await cup.post('/knockout-draw');
    const semi = (await listOf(cup)).find((f) => f.phase === 'knockout')!;
    await confirm(cup, semi);
    const again = await cup.post('/knockout-draw');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({
      error: { code: 'KNOCKOUT_STARTED', message: 'Já há resultado lançado no mata-mata; não dá para sortear de novo nem desfazer.' },
    });
    expect((await cup.post(`/fixtures/${semi.matchId}/reopen`)).statusCode).toBe(200);
    expect((await cup.post('/knockout-draw')).json()).toMatchObject({ error: { code: 'KNOCKOUT_STARTED' } });
    expect((await cup.del('/knockout-draw')).json()).toMatchObject({ error: { code: 'KNOCKOUT_STARTED' } });
  });

  it('ranks uneven groups and fills the knockout with byes', async () => {
    const cup = await startedCup(10, { groupCount: 3, qualifiersPerGroup: 2 });
    const sizes = (await cup.get('/standings')).json().reduce((acc: Record<number, number>, row: { groupNumber: number }) => {
      acc[row.groupNumber] = (acc[row.groupNumber] ?? 0) + 1;
      return acc;
    }, {});
    expect(sizes).toEqual({ 1: 4, 2: 3, 3: 3 });
    await playPhase(cup, 'groups');
    expect((await cup.post('/knockout-draw')).statusCode).toBe(200);
    const standings = (await cup.get('/standings')).json() as { groupNumber: number; qualified: boolean; team: { id: string } }[];
    expect(standings.filter((row) => row.qualified)).toHaveLength(6);
    const groupOf = new Map(standings.map((row) => [row.team.id, row.groupNumber]));
    const firstRound = (await listOf(cup)).filter((f) => f.phase === 'knockout' && f.roundNumber === 1);
    expect(firstRound).toHaveLength(2); // 8 posições, 2 BYEs: 2 jogos na 1ª rodada (os BYEs não aparecem)
    for (const f of firstRound) expect(groupOf.get(f.teamA.id)).not.toBe(groupOf.get(f.teamB.id));
  });

  it('finishes from the knockout and gives the titles', async () => {
    const cup = await startedCup(8);
    await playPhase(cup, 'groups');
    const early = await cup.post('/finish');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'KNOCKOUT_NOT_DRAWN', message: 'Sorteie o mata-mata antes de encerrar.' } });
    await cup.post('/knockout-draw');
    await playPhase(cup, 'knockout');
    expect((await cup.post('/finish')).statusCode).toBe(200);
    const titles = await prisma.title.findMany({ where: { tournamentId: cup.id }, orderBy: { position: 'asc' } });
    expect(titles.map((title) => title.position)).toEqual([1, 2]);
  });

  it('with two qualifiers the knockout is just the final, even with the 3rd place option', async () => {
    const cup = await startedCup(4, { groupCount: 2, qualifiersPerGroup: 1, consolationFinal: true });
    await playPhase(cup, 'groups');
    await cup.post('/knockout-draw');
    expect((await listOf(cup)).filter((f) => f.phase === 'knockout')).toHaveLength(1);
    await playPhase(cup, 'knockout');
    expect((await cup.post('/finish')).statusCode).toBe(200);
    expect(await prisma.title.count({ where: { tournamentId: cup.id } })).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/api -- cup`
Expected: FAIL. `POST /knockout-draw` dá 404 e salvar jogo dos grupos dá 200.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/tournaments/stage.ts`: acrescente ao fim:

```ts
/**
 * Copa, fase 2: eliminatória simples com as posições já sorteadas (ids de participante; null = BYE).
 * Ordem natural sem rebalancear BYEs: as posições (0,1), (2,3)… viram os jogos da 1ª rodada.
 */
export function cupKnockoutStageInput(t: { id: string; options: TournamentOptions }, slots: (number | null)[]): InputStage {
  const teams = slots.filter((slot) => slot !== null).length;
  return {
    tournamentId: t.id,
    name: 'Mata-mata',
    type: 'single_elimination',
    seedingIds: slots,
    settings: {
      size: slots.length,
      seedOrdering: ['natural'],
      balanceByes: false,
      consolationFinal: t.options.consolationFinal && teams >= 4,
    },
  };
}
```

`apps/api/src/tournaments/cup.ts`: acrescente (e inclua `AppError` em um import de `'../errors'`):

```ts
export const groupsLockedError = () =>
  new AppError(409, 'GROUPS_LOCKED', 'Desfaça o sorteio do mata-mata para corrigir jogos dos grupos.');

/** Recusa sortear de novo ou desfazer quando algum confronto do mata-mata tem resultado (confirmado ou rascunho). */
export async function assertKnockoutUntouched(db: Db, tournamentId: string, data: BracketData) {
  const knockout = knockoutStageOf(data);
  if (!knockout) return;
  const matchIds = data.match.filter((match) => match.stage_id === knockout.id).map((match) => Number(match.id));
  const touched = await db.fixture.count({ where: { tournamentId, bmMatchId: { in: matchIds } } });
  if (touched > 0) {
    throw new AppError(409, 'KNOCKOUT_STARTED', 'Já há resultado lançado no mata-mata; não dá para sortear de novo nem desfazer.');
  }
}

export const groupsPendingError = (pending: number) =>
  new AppError(409, 'GROUPS_PENDING', pending === 1 ? 'Falta 1 jogo dos grupos.' : `Faltam ${pending} jogos dos grupos.`);
```

`apps/api/src/tournaments/routes.ts`:

1. Imports: `drawKnockout` em `@kickabout/shared`; `cupKnockoutStageInput` em `./stage`; `assertKnockoutUntouched, groupsPendingError` em `./cup`.

2. Novo helper, acima de `registerTournamentRoutes`:

```ts
async function cupInProgress(tx: Prisma.TransactionClient, id: string) {
  await lockTournament(tx, id);
  const t = await loadTournament(tx, id);
  if (t.format !== 'cup') throw new AppError(409, 'NOT_A_CUP', 'Este campeonato não é uma copa.');
  if (t.status !== 'in_progress') throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
  return t;
}
```

3. Novos endpoints, depois do `start`:

```ts
  app.post('/tournaments/:id/knockout-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(
      async (tx) => {
        const t = await cupInProgress(tx, id);
        await withBracket(tx, id, async (manager) => {
          const data = await manager.export();
          const pending = groupsPending(data);
          if (pending > 0) throw groupsPendingError(pending);
          await assertKnockoutUntouched(tx, id, data);
          const previous = knockoutStageOf(data);
          if (previous) await manager.delete.stage(previous.id);
          const participantOf = new Map([...teamIdByParticipant(data)].map(([participantId, teamId]) => [teamId, participantId]));
          const qualified = (await cupStandings(tx, t, data))
            .filter((row) => row.qualified)
            .map((row) => ({ item: participantOf.get(row.teamId)!, group: row.groupNumber }));
          const slots = drawKnockout(qualified, Math.random);
          await manager.create.stage(cupKnockoutStageInput({ id, options: t.options as unknown as TournamentOptions }, slots));
        });
      },
      { timeout: 15_000 },
    );
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.delete('/tournaments/:id/knockout-draw', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(
      async (tx) => {
        await cupInProgress(tx, id);
        await withBracket(tx, id, async (manager) => {
          const data = await manager.export();
          const knockout = knockoutStageOf(data);
          if (!knockout) throw new AppError(409, 'KNOCKOUT_NOT_DRAWN', 'O mata-mata ainda não foi sorteado.');
          await assertKnockoutUntouched(tx, id, data);
          await manager.delete.stage(knockout.id);
        });
      },
      { timeout: 15_000 },
    );
    return tournamentDto(await loadTournament(prisma, id));
  });
```

4. No `POST /tournaments/:id/finish`, logo depois de `const data = t.bracket as unknown as BracketData;`, acrescente:

```ts
      const knockout = t.format === 'cup' ? knockoutStageOf(data) : null;
      if (t.format === 'cup' && !knockout) throw new AppError(409, 'KNOCKOUT_NOT_DRAWN', 'Sorteie o mata-mata antes de encerrar.');
```

   E troque o `else` do pódio por:

```ts
      } else {
        const manager = await managerFor(data);
        const standings = await manager.get.finalStandings((knockout ?? data.stage[0]!).id);
        podium = eliminationPodium(standings, teamIdByParticipant(data));
      }
```

`apps/api/src/fixtures/save-result.ts`: logo depois de `const isKnockout = view.phase === 'knockout';` (Task 3), acrescente:

```ts
        if (tournament.format === 'cup' && view.phase === 'groups' && knockoutStageOf(data)) throw groupsLockedError();
```

Acrescente o import `import { groupsLockedError, knockoutStageOf } from '../tournaments/cup';`.

`apps/api/src/fixtures/reopen-result.ts`: logo depois de `const roundRobin = matchView(data, raw)?.phase === 'groups';` (Task 3), acrescente:

```ts
        if (tournament.format === 'cup' && roundRobin && knockoutStageOf(data)) throw groupsLockedError();
```

E o mesmo import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/api` e `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: PASS em todos; typecheck limpo.

- [ ] **Step 5: Registrar no ledger**

---

### Task 5: Site público da copa

**Files:**
- Modify: `apps/web/src/api/types.ts`
- Modify: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/pages/tournament/GroupsTab.tsx`
- Modify: `apps/web/src/pages/tournament/TournamentPage.tsx`
- Modify: `apps/web/src/pages/tournament/BracketTab.tsx`
- Modify: `apps/web/src/pages/tournament/FixturesTab.tsx:16-33`
- Modify: `apps/web/src/pages/FixturePage.tsx:46-50`
- Modify: `apps/web/src/components/StandingsTable.tsx`
- Modify: `apps/web/src/styles/components.css`
- Test: `apps/web/test/cup.test.tsx`, `apps/web/test/format.test.ts`

**Interfaces:**
- Consumes: os campos da API das Tasks 2 a 4 (`phase`, `groupNumber`, `qualified`, `groupsPending`, `knockoutDrawn`).
- Produces:
  - `groupLetter(n: number): string`
  - `phaseData(data: BracketData, phase: Phase): BracketData | null`
  - `roundCounts(data: BracketData | null, phase?: Phase)`
  - `fixtureRoundLabel(format: TournamentFormat, data: BracketData | null, f: { phase: Phase; groupNumber: number; roundNumber: number }): string`
  - `StandingsTable` com a prop opcional `label`
  - `BracketTab({ tournament }: { tournament: Tournament })`

- [ ] **Step 1: Write the failing test**

`apps/web/test/format.test.ts`: acrescente ao fim (e `fixtureRoundLabel, groupLetter, phaseData` ao import de `../src/lib/format`):

```ts
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
```

`apps/web/test/cup.test.tsx` (novo):

```tsx
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../src/api/types';
import { FALCOES, LEOES, TIGRES, team } from './data';
import { mockApi, renderRoute } from './utils';

const ONCAS = team('t4', 'Onças');

export const cupTournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Verão',
  format: 'cup',
  status: 'in_progress',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple', groupCount: 2, qualifiersPerGroup: 1 },
  createdAt: '',
  startedAt: '',
  finishedAt: null,
  entries: [LEOES, TIGRES, FALCOES, ONCAS].map((t, i) => ({ seed: i + 1, team: t })),
  groupDraw: null,
  knockoutDrawn: false,
  groupsPending: 3,
  ...overrides,
});

const row = (t: typeof LEOES, groupNumber: number, position: number, qualified: boolean) => ({
  position,
  teamId: t.id,
  team: t,
  groupNumber,
  qualified,
  played: 1,
  wins: position === 1 ? 1 : 0,
  draws: 0,
  losses: position === 1 ? 0 : 1,
  points: position === 1 ? 3 : 0,
  duelsWon: 3,
  duelsLost: 2,
  goalsFor: 5,
  goalsAgainst: 3,
  goalDiff: 2,
});

describe('cup public page', () => {
  it('opens on the groups tab with one table per group and marks the qualifiers', async () => {
    mockApi({
      '/tournaments/c1': cupTournament(),
      '/tournaments/c1/standings': [row(LEOES, 1, 1, true), row(TIGRES, 1, 2, false), row(FALCOES, 2, 1, true), row(ONCAS, 2, 2, false)],
    });
    renderRoute('/campeonatos/c1');
    const tabs = await screen.findByRole('navigation', { name: 'Seções do campeonato' });
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['Grupos', 'Chave', 'Jogos', 'Times', 'Estatísticas']);
    expect(within(tabs).getByRole('link', { name: 'Grupos' })).toHaveAttribute('aria-current', 'page');
    const groupA = await screen.findByRole('table', { name: 'Classificação do Grupo A' });
    const groupB = screen.getByRole('table', { name: 'Classificação do Grupo B' });
    expect(within(groupA).getAllByRole('row')[1]).toHaveClass('qualified');
    expect(within(groupA).getAllByRole('row')[2]).not.toHaveClass('qualified');
    expect(within(groupB).getByText('Falcões')).toBeInTheDocument();
    expect(screen.getByText('O primeiro de cada grupo vai para o mata-mata.')).toBeInTheDocument();
  });

  it('tells how many group matches are left before the knockout draw', async () => {
    mockApi({ '/tournaments/c1': cupTournament(), '/tournaments/c1/bracket': { data: null } });
    renderRoute('/campeonatos/c1?aba=chave');
    expect(await screen.findByText('A chave é sorteada quando a fase de grupos terminar. Faltam 3 jogos.')).toBeInTheDocument();
  });

  it('says the knockout is about to be drawn when the groups are over', async () => {
    mockApi({ '/tournaments/c1': cupTournament({ groupsPending: 0 }), '/tournaments/c1/bracket': { data: null } });
    renderRoute('/campeonatos/c1?aba=chave');
    expect(await screen.findByText('A fase de grupos terminou. A chave aparece assim que o mata-mata for sorteado.')).toBeInTheDocument();
  });

  it('labels group fixtures with the group and the round', async () => {
    mockApi({
      '/tournaments/c1': cupTournament(),
      '/tournaments/c1/bracket': { data: null },
      '/tournaments/c1/fixtures': [
        { matchId: 0, groupNumber: 2, roundNumber: 1, number: 1, phase: 'groups', isKnockout: false, status: 'pending', teamA: FALCOES, teamB: ONCAS, scoreA: null, scoreB: null },
      ],
    });
    renderRoute('/campeonatos/c1?aba=jogos');
    expect(await screen.findByRole('heading', { name: 'Grupo B, 1ª rodada' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/web -- cup format`
Expected: FAIL. `groupLetter` e `phaseData` não existem, e a aba "Grupos" não existe.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/api/types.ts`:
- `export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'cup';`
- `export type Phase = 'groups' | 'knockout';`
- Em `Tournament`, troque o tipo de `options` por `options: TournamentOptions;` e acrescente:

```ts
  /** Copa em rascunho: prévia do sorteio dos grupos. */
  groupDraw?: TeamRef[][] | null;
  /** Copa: o mata-mata já foi sorteado. */
  knockoutDrawn?: boolean;
  /** Copa: confrontos dos grupos ainda sem resultado confirmado (null antes de começar). */
  groupsPending?: number | null;
```

- Em `FixtureListItem`, acrescente `phase: Phase;`.
- Em `StandingRow`, acrescente `groupNumber: number;` e `qualified?: boolean;`.
- Em `TournamentOptions`, acrescente `groupCount?: number;` e `qualifiersPerGroup?: number;`.
- Troque `BracketData` por:

```ts
export interface BracketData {
  stage: { id: number; number: number; type: string }[];
  group: { id: number; stage_id: number; number: number }[];
  round: { id: number; stage_id: number; group_id: number; number: number }[];
  match: { id: number; stage_id: number }[];
  match_game: { stage_id: number }[];
  participant: { id: number; name: string }[];
}
```

  O brackets-manager devolve esses campos e mais outros. O objeto continua indo inteiro para o brackets-viewer.

`apps/web/src/lib/format.ts`:
- Em `FORMAT_LABEL`, acrescente `cup: 'Copa (grupos + mata-mata)',`.
- Em `MIN_TEAMS`, acrescente `cup: 4,`.
- Acrescente `Phase` ao import de tipos e o código abaixo:

```ts
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
```

- `roundLabel`: o primeiro `if` passa a cobrir a copa, que não deve chegar aqui sem a fase. Troque por `if (format === 'round_robin' || format === 'cup') return \`Rodada ${roundNumber}\`;`.
- `roundCounts` ganha a fase:

```ts
export function roundCounts(data: BracketData | null, phase?: Phase): Map<number, number> {
  const counts = new Map<number, number>();
  const scoped = data && phase ? phaseData(data, phase) : data;
  if (!scoped) return counts;
  for (const group of scoped.group) {
    counts.set(group.number, scoped.round.filter((round) => round.group_id === group.id).length);
  }
  return counts;
}
```

`apps/web/src/components/StandingsTable.tsx`:
- A assinatura vira `export function StandingsTable({ rows, label = 'Classificação' }: { rows: StandingRow[]; label?: string })`.
- O `<table aria-label="Classificação">` vira `<table aria-label={label}>`.
- O `<tr key={row.teamId}>` vira `<tr key={row.teamId} className={row.qualified ? 'qualified' : undefined}>`.

`apps/web/src/pages/tournament/GroupsTab.tsx` (novo):

```tsx
import { useStandings } from '../../api/queries';
import type { StandingRow, Tournament } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { StandingsTable } from '../../components/StandingsTable';
import { groupLetter } from '../../lib/format';

/** Copa: uma tabela por grupo, com os classificados marcados. */
export function GroupsTab({ tournament }: { tournament: Tournament }) {
  const standings = useStandings(tournament.id);
  const qualifiers = tournament.options.qualifiersPerGroup ?? 1;
  return (
    <QueryState query={standings}>
      {(rows) => {
        const groups = new Map<number, StandingRow[]>();
        for (const row of rows) groups.set(row.groupNumber, [...(groups.get(row.groupNumber) ?? []), row]);
        return (
          <>
            <p className="muted">
              {qualifiers === 1 ? 'O primeiro de cada grupo vai para o mata-mata.' : `Os ${qualifiers} primeiros de cada grupo vão para o mata-mata.`}
            </p>
            {[...groups.entries()].map(([number, list]) => (
              <section key={number}>
                <h2>Grupo {groupLetter(number)}</h2>
                <StandingsTable rows={list} label={`Classificação do Grupo ${groupLetter(number)}`} />
              </section>
            ))}
            <p className="muted">Vitória vale 3 pontos e empate 1. Desempate: confronto direto, vitórias, saldo de gols e gols marcados.</p>
          </>
        );
      }}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/BracketTab.tsx` (arquivo inteiro):

```tsx
import { useBracket } from '../../api/queries';
import type { Tournament } from '../../api/types';
import { BracketView } from '../../components/BracketView';
import { QueryState } from '../../components/QueryState';
import { phaseData } from '../../lib/format';

function waitingText(tournament: Tournament): string {
  const pending = tournament.groupsPending ?? 0;
  if (pending === 0) return 'A fase de grupos terminou. A chave aparece assim que o mata-mata for sorteado.';
  return `A chave é sorteada quando a fase de grupos terminar. ${pending === 1 ? 'Falta 1 jogo.' : `Faltam ${pending} jogos.`}`;
}

export function BracketTab({ tournament }: { tournament: Tournament }) {
  const bracket = useBracket(tournament.id);
  const cup = tournament.format === 'cup';
  return (
    <QueryState query={bracket}>
      {({ data }) => {
        const shown = data && cup ? phaseData(data, 'knockout') : data;
        if (shown) return <BracketView data={shown} />;
        return <p className="state">{cup ? waitingText(tournament) : 'A chave aparece quando o campeonato começar.'}</p>;
      }}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/TournamentPage.tsx`:
- Importe `GroupsTab` e monte as abas pelo formato:

```tsx
        const cup = t.format === 'cup';
        const tabs = [
          ...(cup ? [{ id: 'grupos', label: 'Grupos' }] : []),
          { id: 'chave', label: t.format === 'round_robin' ? 'Tabela' : 'Chave' },
          { id: 'jogos', label: 'Jogos' },
          { id: 'times', label: 'Times' },
          { id: 'estatisticas', label: 'Estatísticas' },
        ];
        const current = tabs.find((tab) => tab.id === params.get('aba'))?.id ?? tabs[0]!.id;
```

- No aviso de "não começou", acrescente a copa: `cup ? 'Os grupos aparecem quando o campeonato começar.' : t.format === 'round_robin' ? … : …`.
- Na escolha do conteúdo, antes do ramo `current === 'chave'`, acrescente `current === 'grupos' ? <GroupsTab tournament={t} /> :`. O ramo da chave passa a ser `t.format === 'round_robin' ? <StandingsTab id={t.id} /> : <BracketTab tournament={t} />`.

`apps/web/src/pages/tournament/FixturesTab.tsx`:
- Troque o import de `roundCounts, roundLabel` por `fixtureRoundLabel`.
- Apague `const counts = …`.
- A chave do agrupamento passa a ser `` const key = `${fixture.phase}-${fixture.groupNumber}-${fixture.roundNumber}`; ``.
- `const title = fixtureRoundLabel(tournament.format, bracket.data?.data ?? null, first);`
- A `key` da `<section>` vira `` `${first.phase}-${first.groupNumber}-${first.roundNumber}` ``.

`apps/web/src/pages/FixturePage.tsx`:
- Troque o import `roundCounts, roundLabel` por `fixtureRoundLabel`.
- Troque as linhas 47–50 por:

```tsx
        const round = tournament.data ? fixtureRoundLabel(tournament.data.format, bracket.data?.data ?? null, f) : null;
```

`apps/web/src/styles/components.css`: acrescente ao fim:

```css
/* Copa: classificados do grupo, com um filete verde à esquerda */
tr.qualified td:first-child {
  box-shadow: inset 3px 0 0 var(--grass);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/web` e `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: PASS em todos. Se outro `Record<TournamentFormat, …>` do site reclamar no typecheck, acrescente a entrada `cup` com o rótulo ou valor equivalente ao da eliminatória simples. Se algum teste antigo montar `StandingRow` ou `FixtureListItem` com tipo explícito e o typecheck reclamar de `groupNumber` ou `phase` ausentes, acrescente `groupNumber: 1` e `phase` (`'knockout'` nas eliminatórias, `'groups'` nos pontos corridos) ao dado de teste. É ruling de dado de teste, não de produto.

- [ ] **Step 5: Registrar no ledger**

---

### Task 6: Admin da copa (formulário, sorteio dos grupos e do mata-mata)

**Files:**
- Modify: `apps/web/src/api/admin.ts`
- Modify: `apps/web/src/lib/format.ts`
- Modify: `apps/web/src/pages/admin/tournament/TournamentFields.tsx`
- Create: `apps/web/src/pages/admin/tournament/GroupDraw.tsx`
- Create: `apps/web/src/pages/admin/tournament/KnockoutDraw.tsx`
- Modify: `apps/web/src/pages/admin/tournament/EntriesEditor.tsx`
- Modify: `apps/web/src/pages/admin/AdminTournamentPage.tsx`
- Modify: `apps/web/src/styles/admin.css`
- Test: `apps/web/test/cup.test.tsx`

**Interfaces:**
- Consumes:
  - `cupLayout`, `cupProblem` (Task 1, via `@kickabout/shared`);
  - `groupLetter`, `cupTournament` (o builder exportado do teste da Task 5);
  - os endpoints das Tasks 2 e 4.
- Produces:
  - `drawGroups(id)`, `drawKnockout(id)`, `undoKnockoutDraw(id)` em `api/admin.ts`;
  - `cupSummary(teamCount: number, groupCount: number, qualifiers: number): string`;
  - `TournamentFields` com a prop opcional `teamCount`.

- [ ] **Step 1: Write the failing test** (acrescente a `apps/web/test/cup.test.tsx`; acrescente `fireEvent` ao import de `@testing-library/react`, `cupSummary` de `../src/lib/format`, e `SIGNED_IN` de `./data`, além de `sentBodies` de `./utils`)

```tsx
describe('cupSummary', () => {
  it('describes the layout or the problem', () => {
    expect(cupSummary(10, 3, 2)).toBe('10 times: grupos de 4, 3 e 3; passam 6; mata-mata de 8 com 2 BYEs.');
    expect(cupSummary(8, 2, 2)).toBe('8 times: 2 grupos de 4; passam 4; mata-mata de 4.');
    expect(cupSummary(10, 3, 3)).toBe('Com 10 times em 3 grupos, passam no máximo 2 por grupo.');
  });
});

describe('cup admin', () => {
  it('shows the cup options when creating and sends them', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments': [],
      'POST /tournaments': cupTournament({ status: 'draft' }),
      '/tournaments/c1': cupTournament({ status: 'draft', groupsPending: null }),
      '/teams': [],
    });
    renderRoute('/admin/campeonatos');
    const form = await screen.findByRole('form', { name: 'Novo campeonato' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Verão' } });
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'cup' } });
    fireEvent.change(within(form).getByLabelText('Número de grupos'), { target: { value: '4' } });
    fireEvent.change(within(form).getByLabelText('Classificados por grupo'), { target: { value: '1' } });
    fireEvent.click(within(form).getByLabelText('Disputa de 3º lugar'));
    fireEvent.click(within(form).getByRole('button', { name: 'Criar campeonato' }));
    await screen.findByRole('heading', { name: 'Copa Verão' });
    expect(sentBodies(fetchMock, 'POST /tournaments')).toEqual([
      { name: 'Copa Verão', format: 'cup', options: { groupCount: 4, qualifiersPerGroup: 1, consolationFinal: true } },
    ]);
  });

  it('draws the groups in the draft and starts only with a draw', async () => {
    const draft = cupTournament({ status: 'draft', groupsPending: null });
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft,
      '/teams': [],
      'POST /tournaments/c1/group-draw': { groups: [[LEOES, FALCOES], [TIGRES, ONCAS]] },
    });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeDisabled();
    expect(screen.getByText('Sorteie os grupos antes de iniciar.')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Sortear grupos' }));
    await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(sentBodies(fetchMock, 'POST /tournaments/c1/group-draw')).toHaveLength(1);
  });

  it('shows the drawn groups with a button to draw again', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments/c1': cupTournament({ status: 'draft', groupsPending: null, groupDraw: [[LEOES, FALCOES], [TIGRES, ONCAS]] }), '/teams': [] });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(within(section).getByRole('heading', { name: 'Grupo A' })).toBeInTheDocument();
    expect(within(section).getByText('Falcões')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Sortear de novo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeEnabled();
  });

  const inProgress = { ...SIGNED_IN, '/tournaments/c1/fixtures': [], '/tournaments/c1/bracket': { data: null } };

  it('waits for the groups before offering the knockout draw, and hides the finish button', async () => {
    mockApi({ ...inProgress, '/tournaments/c1': cupTournament() });
    renderRoute('/admin/campeonatos/c1');
    const waiting = await screen.findByRole('region', { name: 'Mata-mata' });
    expect(within(waiting).getByText('O sorteio do mata-mata fica disponível quando a fase de grupos terminar. Faltam 3 jogos.')).toBeInTheDocument();
    expect(within(waiting).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Encerrar campeonato' })).toBeNull();
  });

  it('draws the knockout when the groups are over', async () => {
    const fetchMock = mockApi({
      ...inProgress,
      '/tournaments/c1': cupTournament({ groupsPending: 0 }),
      'POST /tournaments/c1/knockout-draw': cupTournament({ groupsPending: 0, knockoutDrawn: true }),
    });
    renderRoute('/admin/campeonatos/c1');
    const ready = await screen.findByRole('region', { name: 'Mata-mata' });
    fireEvent.click(within(ready).getByRole('button', { name: 'Sortear mata-mata' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'POST /tournaments/c1/knockout-draw')).toHaveLength(1));
  });

  it('offers redraw, undo and finish once the knockout is drawn', async () => {
    mockApi({ ...inProgress, '/tournaments/c1': cupTournament({ groupsPending: 0, knockoutDrawn: true }) });
    renderRoute('/admin/campeonatos/c1');
    const drawn = await screen.findByRole('region', { name: 'Mata-mata' });
    expect(within(drawn).getByRole('button', { name: 'Sortear de novo' })).toBeInTheDocument();
    expect(within(drawn).getByRole('button', { name: 'Desfazer sorteio do mata-mata' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar campeonato' })).toBeInTheDocument();
  });
});
```

(Acrescente `waitFor` ao import de `@testing-library/react`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/web -- cup`
Expected: FAIL. `cupSummary` não existe e não há campo "Número de grupos".

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/api/admin.ts`: acrescente (e `TeamRef` ao import de tipos, se faltar):

```ts
export const drawGroups = (id: string) => apiRequest<{ groups: TeamRef[][] }>('POST', `/tournaments/${id}/group-draw`);
export const drawKnockout = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/knockout-draw`);
export const undoKnockoutDraw = (id: string) => apiRequest<Tournament>('DELETE', `/tournaments/${id}/knockout-draw`);
```

`apps/web/src/lib/format.ts`: acrescente `cupLayout, cupProblem` ao import de `@kickabout/shared` e:

```ts
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
```

`apps/web/src/pages/admin/tournament/TournamentFields.tsx`:
- Em `FORMATS`, acrescente `'cup'`.
- A assinatura passa a ser `export function TournamentFields({ value, onChange, teamCount }: { value: TournamentInput; onChange: (value: TournamentInput) => void; teamCount?: number })`.
- Importe `cupSummary`.
- O bloco do 3º lugar passa a valer também para a copa: `{(value.format === 'single_elimination' || value.format === 'cup') && (…)}`.
- O bloco de turnos passa a valer também para a copa, com rótulo próprio: `{(value.format === 'round_robin' || value.format === 'cup') && (<label className="field"><span>{value.format === 'cup' ? 'Fase de grupos' : 'Turnos'}</span> …` (o resto igual).
- Depois do bloco de turnos, acrescente:

```tsx
      {value.format === 'cup' && (
        <>
          <label className="field">
            <span>Número de grupos</span>
            <input
              type="number"
              min={2}
              max={16}
              required
              value={value.options.groupCount ?? 2}
              onChange={(e) => setOption({ groupCount: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Classificados por grupo</span>
            <input
              type="number"
              min={1}
              max={16}
              required
              value={value.options.qualifiersPerGroup ?? 2}
              onChange={(e) => setOption({ qualifiersPerGroup: Number(e.target.value) })}
            />
          </label>
          <p className="muted" role="status">
            {teamCount === undefined
              ? 'Os grupos são sorteados depois da inscrição dos times.'
              : cupSummary(teamCount, value.options.groupCount ?? 2, value.options.qualifiersPerGroup ?? 2)}
          </p>
        </>
      )}
```

`apps/web/src/pages/admin/AdminTournamentPage.tsx`:
- No `SettingsForm`, passe `teamCount={tournament.entries.length}` ao `<TournamentFields>`.
- Importe `KnockoutDraw`.
- No ramo de campeonato iniciado, logo depois de `<p className="muted">Abra um confronto…</p>`, acrescente:

```tsx
              {t.format === 'cup' && t.status === 'in_progress' && <KnockoutDraw tournament={t} />}
```

- O `FinishSection` só aparece fora da copa ou com o mata-mata sorteado: `{t.status === 'in_progress' ? ((t.format !== 'cup' || t.knockoutDrawn) && <FinishSection tournament={t} />) : (…)}`.

`apps/web/src/pages/admin/tournament/GroupDraw.tsx` (novo):

```tsx
import { drawGroups } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { Tournament } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { TeamBadge } from '../../../components/TeamBadge';
import { groupLetter } from '../../../lib/format';

/** Copa em rascunho: sorteio dos grupos com prévia, dá para sortear de novo até iniciar. */
export function GroupDraw({ tournament }: { tournament: Tournament }) {
  const draw = useApiMutation(() => drawGroups(tournament.id));
  const groups = tournament.groupDraw ?? null;

  return (
    <section aria-labelledby="group-draw-title" className="draw-block">
      <h2 id="group-draw-title">Sorteio dos grupos</h2>
      {groups ? (
        <div className="draw-groups">
          {groups.map((group, index) => (
            <div key={index}>
              <h3>Grupo {groupLetter(index + 1)}</h3>
              <ul className="list">
                {group.map((team) => (
                  <li key={team.id} className="admin-row">
                    <TeamBadge team={team} />
                    <span className="row-title">{team.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Com as inscrições salvas, sorteie os times nos grupos. Dá para sortear de novo até iniciar.</p>
      )}
      <FormError error={draw.error} />
      <div className="actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={draw.isPending || tournament.entries.length === 0}
          onClick={() => draw.mutate(undefined)}
        >
          {groups ? 'Sortear de novo' : 'Sortear grupos'}
        </button>
      </div>
    </section>
  );
}
```

`apps/web/src/pages/admin/tournament/EntriesEditor.tsx`:
- Importe `GroupDraw`.
- Acrescente `const needsDraw = tournament.format === 'cup' && !tournament.groupDraw;` depois de `const min = …`.
- Antes de `<FormError error={save.error ?? start.error} />`, acrescente `{tournament.format === 'cup' && !dirty && <GroupDraw tournament={tournament} />}`.
- O `disabled` do `ConfirmButton` de iniciar vira `dirty || ids.length < min || needsDraw || start.isPending`.
- Depois de `{dirty && <p className="muted">Salve as inscrições antes de iniciar.</p>}`, acrescente `{!dirty && needsDraw && <p className="muted">Sorteie os grupos antes de iniciar.</p>}`.

`apps/web/src/pages/admin/tournament/KnockoutDraw.tsx` (novo):

```tsx
import { drawKnockout, undoKnockoutDraw } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { Tournament } from '../../../api/types';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { FormError } from '../../../components/FormError';

/** Copa em andamento: sortear o mata-mata quando os grupos acabam; sortear de novo ou desfazer antes do 1º resultado. */
export function KnockoutDraw({ tournament }: { tournament: Tournament }) {
  const draw = useApiMutation(() => drawKnockout(tournament.id));
  const undo = useApiMutation(() => undoKnockoutDraw(tournament.id));
  const pending = tournament.groupsPending ?? 0;
  const busy = draw.isPending || undo.isPending;

  return (
    <section aria-labelledby="knockout-draw-title" className="draw-block">
      <h2 id="knockout-draw-title">Mata-mata</h2>
      {tournament.knockoutDrawn ? (
        <>
          <p className="muted">
            Chave sorteada. Enquanto nenhum jogo do mata-mata tiver resultado, dá para sortear de novo ou desfazer o sorteio
            para voltar a corrigir os grupos.
          </p>
          <div className="actions">
            <ConfirmButton label="Sortear de novo" confirmLabel="Confirmar novo sorteio" disabled={busy} onConfirm={() => draw.mutate(undefined)} />
            <ConfirmButton
              label="Desfazer sorteio do mata-mata"
              confirmLabel="Confirmar: volta para a fase de grupos"
              danger
              disabled={busy}
              onConfirm={() => undo.mutate(undefined)}
            />
          </div>
        </>
      ) : pending > 0 ? (
        <p className="muted">
          O sorteio do mata-mata fica disponível quando a fase de grupos terminar. {pending === 1 ? 'Falta 1 jogo.' : `Faltam ${pending} jogos.`}
        </p>
      ) : (
        <>
          <p>A fase de grupos terminou. Sorteie o mata-mata: times do mesmo grupo não se enfrentam na primeira rodada.</p>
          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => draw.mutate(undefined)}>
              Sortear mata-mata
            </button>
          </div>
        </>
      )}
      <FormError error={draw.error ?? undo.error} />
    </section>
  );
}
```

`apps/web/src/styles/admin.css`: acrescente ao fim:

```css
/* Sorteios da copa */
.draw-block {
  margin: var(--space-5) 0;
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 3px solid var(--grass);
  border-radius: var(--radius-sm);
}

.draw-block h2 {
  margin-top: 0;
}

.draw-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.draw-groups h3 {
  margin: 0 0 var(--space-1);
  color: var(--muted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/web` e `npm run typecheck`
Expected: PASS em todos; typecheck limpo.

- [ ] **Step 5: Registrar no ledger**

---

### Task 7: Documentação, verificação completa e commit

**Files:**
- Modify: `docs/VERSOES.md`
- Modify: `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 6.
- Produces: o commit único do plano.

- [ ] **Step 1: `docs/VERSOES.md`**: acrescente no topo, antes da seção v1.4:

```markdown
## v1.5 — 2026-10-17

Novo formato **Copa (grupos + mata-mata)**. Spec: `docs/superpowers/specs/2026-10-17-kickabout-copa-design.md`.

- **Criação:** o organizador escolhe o número de grupos, quantos passam por grupo, o turno da fase de grupos (único ou ida e volta) e se há disputa de 3º lugar. Um resumo mostra os tamanhos dos grupos e o tamanho do mata-mata (com BYEs).
- **Sorteio dos grupos:** feito no rascunho, com prévia e "Sortear de novo". Mudar inscrições ou opções apaga a prévia, e o campeonato só inicia com um sorteio feito.
- **Fase de grupos:** pontos corridos dentro de cada grupo, com as regras de sempre (empate vale, mesmo desempate). No site, a aba **Grupos** mostra uma tabela por grupo, com os classificados marcados.
- **Sorteio do mata-mata:** com os grupos encerrados, o organizador sorteia a chave. Times do mesmo grupo não se enfrentam na primeira rodada, e os BYEs também são sorteados. Dá para sortear de novo ou desfazer enquanto nenhum jogo do mata-mata tiver resultado. Depois do sorteio, os jogos dos grupos ficam travados para correção.
- **Mata-mata e títulos:** eliminatória simples (6º duelo e pênaltis, 3º lugar opcional). Campeão, vice e 3º saem do mata-mata.
- **API:**
  - formato `cup`;
  - opções `groupCount` e `qualifiersPerGroup`;
  - endpoints `POST /tournaments/:id/group-draw`, `POST` e `DELETE /tournaments/:id/knockout-draw`;
  - os confrontos ganham `phase`;
  - a classificação ganha `groupNumber` e `qualified`.
- **Migração:** `20261017180000_cup_mode`.
```

- [ ] **Step 2: spec da v1**: na seção de formatos de `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`, acrescente uma linha: "Copa (grupos + mata-mata): ver `2026-10-17-kickabout-copa-design.md`."

- [ ] **Step 3: Verificação completa**

Run: `npm test` (raiz), `npm run typecheck` e `npm run build -w apps/web`
Expected: todas as suítes passam (shared, api e web) e o build termina sem erros.

- [ ] **Step 4: Conferência no navegador** (servidores de desenvolvimento, `npx prisma migrate deploy` já rodado em `apps/api`)
1. Criar uma copa com 8 times de demonstração, 2 grupos e 2 classificados.
2. Sortear os grupos, sortear de novo e iniciar.
3. Lançar todos os jogos dos grupos e ver a aba Grupos com os classificados marcados.
4. Sortear o mata-mata, conferir que nenhum confronto junta times do mesmo grupo, sortear de novo e desfazer.
5. Sortear de novo, jogar o mata-mata e encerrar. Conferir os títulos.
6. Em 375px, nenhuma página rola para o lado.

- [ ] **Step 5: Commit único do plano**

```bash
git add -A packages apps docs
git commit -m "feat: cup format with drawn groups and a drawn knockout (v1.5)"
```
