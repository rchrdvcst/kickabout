# Kickabout — Plano 4: Fechamento da v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a v1 do spec: reabrir resultado confirmado (spec 6.1), corrigir as pendências das revisões dos Planos 3a e 3b que afetam o uso, trocar o logo pelo oficial, verificar no navegador a eliminatória dupla e os pontos corridos, e escrever `docs/VERSOES.md`.

**Architecture:** Nova rota da API `POST /tournaments/:id/fixtures/:matchId/reopen` (transação + trava do campeonato, como o lançamento de resultado). Ela usa o `reset.matchResults` do brackets-manager duas vezes: a biblioteca mantém o placar e deixa a partida "em andamento", o que mantém as partidas anteriores arquivadas (bloqueadas). Por isso, entre as duas chamadas, o placar é apagado via `manager.storage`; na 2ª chamada a partida fica "pronta" e as anteriores voltam a "concluída". Comportamento conferido num script contra brackets-manager 1.11.1 nos três formatos. O confronto volta a `draft` mantendo os duelos. No site: botão "Reabrir confronto" no admin e correções pequenas (fábrica de `QueryClient` com política de retry e 401 em leituras, mutações que sempre atualizam o cache, etc.).

**Tech Stack:** o mesmo dos planos anteriores; nenhuma dependência nova. Imagens do logo geradas com `System.Drawing` (PowerShell do Windows).

**Spec:** `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md` (critérios de sucesso, seções 5.1, 6.1 e 8)

## Global Constraints

- Mesmas versões e convenções dos planos anteriores; TypeScript strict; nenhuma dependência nova.
- Texto em português, frases curtas, sem caixa-alta nem "·".
- Reabrir só com o campeonato `in_progress` (encerrado já gerou títulos).
- Um confronto reaberto volta a `draft` com os duelos preservados: não conta em chave, classificação nem estatísticas até ser confirmado de novo.
- Mobile-first: nada rola na horizontal a partir de 320px.
- Commit único ao final do plano (preferência do usuário); passos de checkpoint fazem só `git add`.

## Fora deste plano

- `BracketView` não se recupera sozinho depois de uma falha ao desenhar a chave (minor do Plano 3a): o aviso já manda para a aba Jogos e recarregar a página resolve.
- Busca de jogador que contém dígitos também casa celulares (comportamento da API do Plano 2).
- O que o spec deixa fora da v1: contas abertas, capitães, reporte de resultado pelos times, notificações, prints, E2E automatizado, deploy definitivo.

## Review Focus

1. **Reabrir na eliminatória dupla** quando o perdedor já jogou na chave inferior — bloqueado, listando o confronto da chave inferior. Testado na Task 1.
2. **Reabrir e mudar o vencedor** — o rascunho antigo do confronto seguinte (com o time errado) some. Testado na Task 1.
3. **Reabrir em campeonato encerrado** — recusado (os títulos já foram gerados). Testado na Task 1.
4. **Sessão expirada numa página do admin que só lê** (ex.: `/admin/jogadores`) — vai para o login e volta. Testado na Task 3.
5. **Gols digitados errado** ("a", "-1") — mensagem clara e nada é salvo; antes o duelo sumia em silêncio. Testado na Task 2.

---

## File Structure

```
apps/api/src/fixtures/
├── reopen-result.ts            # novo: reopenMatch (brackets-manager) + reopenResult (transação)
├── save-result.ts              # exporta pruneStaleDrafts; mensagem do RESULT_LOCKED fala em reabrir
└── routes.ts                   # + POST /tournaments/:id/fixtures/:matchId/reopen
apps/api/test/reopen.test.ts    # novo

apps/web/
├── index.html                  # + ícones
├── public/{logo.png, icon-192.png, favicon-32.png}   # gerados do logo oficial
├── scripts/brand-assets.ps1    # gera as imagens acima a partir de docs/brand/LOGO_KICKABOUT.png
└── src/
    ├── api/{admin.ts, queries.ts, mutation.ts, query-client.ts (novo)}
    ├── lib/result-form.ts      # + invalidScoreLabels
    ├── components/{Layout.tsx, ConfirmButton.tsx}
    ├── styles/components.css
    ├── main.tsx
    └── pages/{FixturePage, HomePage, PlayerPage}.tsx, pages/tournament/TournamentPage.tsx,
        pages/admin/{AdminFixturePage, ResultForm, AdminLayout, AdminTournamentPage}.tsx, pages/admin/team/TeamEditForm.tsx
apps/web/test/{utils.tsx, app.test.tsx, result-form.test.ts, admin-result.test.tsx, session.test.tsx (novo), polish.test.tsx (novo)}

docs/brand/LOGO_KICKABOUT.png   # original (1536×1024, fundo transparente)
docs/VERSOES.md                 # novo: o que a v1 entrega; cada versão nova acrescenta uma seção
docs/superpowers/specs/2026-10-15-kickabout-v1-design.md   # 6.1: como desfazer = reabrir
```

---

### Task 1: API — reabrir resultado confirmado

**Files:**
- Create: `apps/api/src/fixtures/reopen-result.ts`
- Modify: `apps/api/src/fixtures/save-result.ts`, `apps/api/src/fixtures/routes.ts`
- Test: `apps/api/test/reopen.test.ts`

**Interfaces:**
- Consumes: `lockTournament`, `withBracket` (`tournaments/bracket-store.ts`); `findMatch`, `laterCompletedMatchIds` (`tournaments/bracket-view.ts`); `getFixtureDetail` (`fixtures/detail.ts`); helpers de teste (`setup` como em `results.test.ts`, `saveResult`, `fixtures`, `duelsPayload`, `A_WINS_3_1`, `B_WINS_3_1`).
- Produces:
  - `POST /api/tournaments/:id/fixtures/:matchId/reopen` (admin) → `FixtureDetail` (com elencos), `status: 'draft'`, placar `null`, duelos mantidos
  - erros: `409 FIXTURE_NOT_COMPLETED "Este confronto não tem resultado confirmado."`, `409 RESULT_LOCKED` (`details.blockingMatchIds`), `409 TOURNAMENT_NOT_IN_PROGRESS`, `401`
  - `export async function pruneStaleDrafts(tx, tournamentId, data)` em `save-result.ts`
  - nova mensagem do `RESULT_LOCKED` (salvar e reabrir): `"… há confrontos seguintes com resultado lançado. Reabra-os primeiro."`

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/test/reopen.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  B_WINS_3_1,
  createStartedTournament,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
  type TestFixture,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

type Format = 'single_elimination' | 'double_elimination' | 'round_robin';

async function setup(format: Format, count: number) {
  const cookie = await loginAdmin(app);
  const squads: Awaited<ReturnType<typeof createTeamWithPlayers>>[] = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team) });
  const playersOf = (teamId: string): TestPlayer[] => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function confirm(ctx: Ctx, f: TestFixture, scores = A_WINS_3_1) {
  const res = await saveResult(app, ctx.cookie, ctx.tournament.id, f.matchId, 'final', duelsPayload(ctx.playersOf(f.teamA.id), ctx.playersOf(f.teamB.id), scores));
  expect(res.statusCode).toBe(200);
}

const reopen = (ctx: Ctx, matchId: number) =>
  app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/fixtures/${matchId}/reopen`, headers: { cookie: ctx.cookie } });

describe('reopen result', () => {
  it('turns a confirmed result back into a draft, keeping the duels', async () => {
    const ctx = await setup('round_robin', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    await confirm(ctx, f!);
    const res = await reopen(ctx, f!.matchId);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'draft', scoreA: null, scoreB: null });
    expect(res.json().duels).toHaveLength(5);
    const standings = (await app.inject({ method: 'GET', url: `/api/tournaments/${ctx.tournament.id}/standings` })).json();
    expect(standings.every((row: { played: number }) => row.played === 0)).toBe(true);
  });

  it('unlocks the previous round of a knockout once the later result is reopened', async () => {
    const ctx = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, ctx.tournament.id);
    await confirm(ctx, semi1!);
    await confirm(ctx, semi2!);
    const final = (await fixtures(app, ctx.tournament.id)).find((f) => f.roundNumber === 2)!;
    await confirm(ctx, final);

    const blocked = await reopen(ctx, semi1!.matchId);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: { code: 'RESULT_LOCKED', details: { blockingMatchIds: [final.matchId] } } });
    expect(blocked.json().error.message).toContain('Reabra-os primeiro.');

    expect((await reopen(ctx, final.matchId)).statusCode).toBe(200);
    expect((await reopen(ctx, semi1!.matchId)).statusCode).toBe(200);

    // Novo resultado da semifinal: o outro time vai à final e o rascunho antigo da final some.
    await confirm(ctx, semi1!, B_WINS_3_1);
    const updatedFinal = (await fixtures(app, ctx.tournament.id)).find((f) => f.roundNumber === 2)!;
    expect(updatedFinal.teamA.id).toBe(semi1!.teamB.id);
    expect(updatedFinal.status).toBe('pending');
  });

  it('blocks a double elimination match whose loser already played in the losers bracket', async () => {
    const ctx = await setup('double_elimination', 4);
    const wbRound1 = (await fixtures(app, ctx.tournament.id)).filter((f) => f.groupNumber === 1 && f.roundNumber === 1);
    for (const f of wbRound1) await confirm(ctx, f);
    const lb = (await fixtures(app, ctx.tournament.id)).find((f) => f.groupNumber === 2)!;
    await confirm(ctx, lb);
    const res = await reopen(ctx, wbRound1[0]!.matchId);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.blockingMatchIds).toContain(lb.matchId);
  });

  it('refuses fixtures without a confirmed result and finished tournaments', async () => {
    const ctx = await setup('single_elimination', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    expect((await reopen(ctx, f!.matchId)).json()).toMatchObject({ error: { code: 'FIXTURE_NOT_COMPLETED' } });
    await confirm(ctx, f!);
    await app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/finish`, headers: { cookie: ctx.cookie } });
    expect((await reopen(ctx, f!.matchId)).json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_IN_PROGRESS' } });
  });

  it('requires login', async () => {
    const ctx = await setup('round_robin', 2);
    const [f] = await fixtures(app, ctx.tournament.id);
    const res = await app.inject({ method: 'POST', url: `/api/tournaments/${ctx.tournament.id}/fixtures/${f!.matchId}/reopen` });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/reopen.test.ts` (Postgres no ar)
Expected: FAIL — `404 Rota não encontrada` (a rota não existe).

- [ ] **Step 3: Implementar**

Em `apps/api/src/fixtures/save-result.ts`:
- trocar `async function pruneStaleDrafts(` por `export async function pruneStaleDrafts(`
- trocar `'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Desfaça-os primeiro.'` por `'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Reabra-os primeiro.'`

`apps/api/src/fixtures/reopen-result.ts`:
```ts
import type { PrismaClient } from '@prisma/client';
import type { BracketsManager } from 'brackets-manager';
import type { ParticipantResult } from 'brackets-model';
import { AppError, notFound } from '../errors';
import { lockTournament, withBracket } from '../tournaments/bracket-store';
import { findMatch, laterCompletedMatchIds } from '../tournaments/bracket-view';
import { pruneStaleDrafts } from './save-result';

const withoutScore = (opponent: ParticipantResult | null): ParticipantResult | null =>
  opponent ? { id: opponent.id, position: opponent.position } : opponent;

/**
 * Volta uma partida do brackets-manager para "a jogar" e libera as partidas anteriores.
 * `reset.matchResults` tira o resultado e recusa ("The match is locked.") se uma partida seguinte já começou,
 * mas mantém o placar: a partida fica "em andamento" e as anteriores continuam arquivadas (bloqueadas).
 * Por isso o placar é apagado e o reset roda de novo: sem placar, a partida fica "pronta" e as anteriores voltam a "concluída".
 */
export async function reopenMatch(manager: BracketsManager, matchId: number) {
  await manager.reset.matchResults(matchId);
  const stored = await manager.storage.select('match', matchId);
  if (!stored) throw notFound('Confronto');
  await manager.storage.update('match', matchId, {
    ...stored,
    opponent1: withoutScore(stored.opponent1),
    opponent2: withoutScore(stored.opponent2),
  });
  await manager.reset.matchResults(matchId);
}

/** Reabre um resultado confirmado: volta a rascunho (duelos mantidos), sai da chave, da classificação e das estatísticas. */
export async function reopenResult(prisma: PrismaClient, tournamentId: string, matchId: number) {
  await prisma.$transaction(
    async (tx) => {
      await lockTournament(tx, tournamentId);
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw notFound('Campeonato');
      if (tournament.status !== 'in_progress') {
        throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      }
      const key = { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } };
      const fixture = await tx.fixture.findUnique({ where: key });
      if (fixture?.status !== 'completed') {
        throw new AppError(409, 'FIXTURE_NOT_COMPLETED', 'Este confronto não tem resultado confirmado.');
      }

      await withBracket(tx, tournamentId, async (manager) => {
        const data = await manager.export();
        if (!findMatch(data, matchId)) throw notFound('Confronto');
        try {
          await reopenMatch(manager, matchId);
        } catch (error) {
          if (error instanceof Error && /locked/i.test(error.message)) {
            throw new AppError(
              409,
              'RESULT_LOCKED',
              'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Reabra-os primeiro.',
              { blockingMatchIds: laterCompletedMatchIds(data, matchId) },
            );
          }
          throw error;
        }
        await tx.fixture.update({
          where: key,
          data: { status: 'draft', scoreA: null, scoreB: null, winnerTeamId: null, playedAt: null },
        });
        await pruneStaleDrafts(tx, tournamentId, await manager.export());
      });
    },
    { timeout: 15_000 },
  );
}
```

Em `apps/api/src/fixtures/routes.ts`:
- acrescentar `import { reopenResult } from './reopen-result';`
- depois da rota `app.put('/tournaments/:id/fixtures/:matchId/result', …)` acrescentar:
```ts
  app.post('/tournaments/:id/fixtures/:matchId/reopen', { preHandler: requireAdmin }, async (request) => {
    const { id, matchId } = parse(fixtureParams, request.params);
    await reopenResult(prisma, id, matchId);
    return getFixtureDetail(prisma, id, matchId, true);
  });
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS (71 anteriores + 5 novos); sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/api
```

---

### Task 2: Tela do confronto — reabrir, placar inválido e detalhes

**Files:**
- Modify: `apps/web/src/api/admin.ts`, `apps/web/src/api/queries.ts`, `apps/web/src/lib/result-form.ts`
- Modify: `apps/web/src/pages/admin/ResultForm.tsx` (substitui o arquivo), `apps/web/src/pages/admin/AdminFixturePage.tsx` (substitui o arquivo), `apps/web/src/pages/FixturePage.tsx`
- Test: `apps/web/test/result-form.test.ts`, `apps/web/test/admin-result.test.tsx`

**Interfaces:**
- Consumes: rota de reabrir (Task 1); `ConfirmButton`, `FormError`, `useApiMutation`, `NotFoundPage`.
- Produces:
  - `reopenResult(id, matchId): Promise<FixtureDetail>` em `api/admin.ts`
  - `useFixture(id, matchId, enabled = true)`
  - `invalidScoreLabels(rows, includeTiebreak): string[]` em `lib/result-form.ts` — rótulos ("1º duelo", "Desempate") com gols, ou pênaltis visíveis, que não são números de 0 a 99
  - botão "Reabrir confronto" (2 cliques: "Confirmar: o resultado volta a rascunho") em confrontos confirmados
  - `/admin/campeonatos/:id/jogos/:matchId` e `/campeonatos/:id/jogos/:matchId` com `matchId` não numérico → "Página não encontrada"
  - formulário com `key` `${id}:${matchId}`; espera o campeonato carregar antes de decidir entre formulário e aviso
  - atalho público "Lançar/Corrigir resultado" só com o campeonato em andamento

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/web/test/result-form.test.ts`:
- acrescentar `invalidScoreLabels` ao import de `'../src/lib/result-form'`
- dentro de `describe('result form')`, acrescentar:
```ts
  it('names the duels whose score is not a number from 0 to 99', () => {
    const rows = [row('a1', 'b1', 'a', '0'), row('', '', '', ''), row('a3', '', '-1', ''), emptyRow(), emptyRow(), row('a1', 'b1', '1', '1', 'x', '4')];
    expect(invalidScoreLabels(rows, false)).toEqual(['1º duelo', '3º duelo']);
    expect(invalidScoreLabels(rows, true)).toEqual(['1º duelo', '3º duelo', 'Desempate']);
    expect(invalidScoreLabels([row('a1', 'b1', '2', '0'), emptyRow(), emptyRow(), emptyRow(), emptyRow(), row('a1', 'b1', '2', '1', 'x', '')], true)).toEqual([]);
  });
```

Em `apps/web/test/admin-result.test.tsx`, acrescentar ao final do arquivo:
```tsx
describe('fixture page details', () => {
  const confirmed = [1, 2, 3, 4, 5].map((order) => ({
    order,
    playerA: rosterA[order - 1]!,
    playerB: rosterB[order - 1]!,
    goalsA: order <= 3 ? 1 : 0,
    goalsB: order <= 3 ? 0 : 1,
    penaltiesA: null,
    penaltiesB: null,
  }));

  it('reopens a confirmed result as a draft after confirming', async () => {
    let status: 'completed' | 'draft' = 'completed';
    const done = fixture({ status: 'completed', scoreA: 3, scoreB: 2, duels: confirmed });
    const fetchMock = setup(done, {
      '/tournaments/c1/fixtures/0': () => ({ ...done, status, scoreA: status === 'completed' ? 3 : null, scoreB: status === 'completed' ? 2 : null }),
      'POST /tournaments/c1/fixtures/0/reopen': () => {
        status = 'draft';
        return { ...done, status: 'draft', scoreA: null, scoreB: null };
      },
    });
    await ready();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir confronto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: o resultado volta a rascunho' }));
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /tournaments/c1/fixtures/0/reopen')).toHaveLength(1);
    expect(screen.getByLabelText('1º duelo: jogador de Leões')).toHaveValue('a1');
  });

  it('lists the results that block reopening', async () => {
    setup(fixture({ status: 'completed', scoreA: 3, scoreB: 2, duels: confirmed }), {
      '/tournaments/c1/fixtures': [
        { matchId: 2, groupNumber: 1, roundNumber: 2, number: 1, isKnockout: true, status: 'completed', teamA: LEOES, teamB: FALCOES, scoreA: 3, scoreB: 1 },
      ],
      'POST /tournaments/c1/fixtures/0/reopen': () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'RESULT_LOCKED',
              message: 'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Reabra-os primeiro.',
              details: { blockingMatchIds: [2] },
            },
          }),
          { status: 409 },
        ),
    });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir confronto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: o resultado volta a rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Reabra-os primeiro.');
    expect(await screen.findByRole('link', { name: 'Leões × Falcões' })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/2');
  });

  it('flags invalid scores instead of dropping the duel', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillDuel('1º duelo', 'a1', 'b1', 'a', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Placar inválido em 1º duelo: use números de 0 a 99.');
    expect(sentBodies(fetchMock, RESULT)).toHaveLength(0);
  });

  it('does not reuse the form of another tournament with the same match number', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament('in_progress'),
      '/tournaments/c1/fixtures/0': fixture({ status: 'completed', scoreA: 3, scoreB: 2, duels: confirmed }),
      '/tournaments/c2': { ...tournament('in_progress'), id: 'c2', name: 'Copa Novembro' },
      '/tournaments/c2/fixtures/0': fixture(),
    });
    const { router } = renderRoute('/admin/campeonatos/c1/jogos/0');
    expect(await ready()).toHaveValue('a1');
    await act(() => router.navigate('/admin/campeonatos/c2/jogos/0'));
    await screen.findByRole('link', { name: 'Copa Novembro' });
    expect(screen.getByLabelText('1º duelo: jogador de Leões')).toHaveValue('');
  });

  it('waits for the tournament before choosing what to show', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments/c1/fixtures/0': fixture() });
    renderRoute('/admin/campeonatos/c1/jogos/0');
    expect(await screen.findByRole('alert')).toHaveTextContent('Rota não encontrada.');
    expect(screen.queryByRole('form', { name: 'Resultado do confronto' })).toBeNull();
  });

  it('answers not found for a match number that is not a number', async () => {
    mockApi(SIGNED_IN);
    renderRoute('/admin/campeonatos/c1/jogos/abc');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    renderRoute('/campeonatos/c1/jogos/abc');
    expect(await screen.findAllByRole('heading', { name: 'Página não encontrada' })).toHaveLength(2);
  });

  it('hides the admin shortcut on finished tournaments', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament('finished'),
      '/tournaments/c1/bracket': { data: null },
      '/tournaments/c1/fixtures/0': fixture({ status: 'completed', scoreA: 3, scoreB: 2 }),
    });
    renderRoute('/campeonatos/c1/jogos/0');
    await screen.findByRole('link', { name: 'Copa Outubro' });
    expect(screen.queryByRole('link', { name: 'Corrigir resultado' })).toBeNull();
  });
});
```
e trocar a primeira linha do arquivo por `import { act, fireEvent, screen, within } from '@testing-library/react';`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/result-form.test.ts test/admin-result.test.tsx`
Expected: FAIL — `invalidScoreLabels` não existe; sem botão "Reabrir confronto"; formulário reaproveitado; formulário aparece sem campeonato; atalho em campeonato encerrado.

- [ ] **Step 3: Implementar**

Em `apps/web/src/api/admin.ts`, depois de `saveResult`:
```ts
export const reopenResult = (id: string, matchId: number) =>
  apiRequest<FixtureDetail>('POST', `/tournaments/${id}/fixtures/${matchId}/reopen`);
```

Em `apps/web/src/api/queries.ts`, trocar `useFixture` por:
```ts
export const useFixture = (id: string, matchId: number, enabled = true) =>
  useQuery({
    queryKey: ['tournament', id, 'fixture', matchId],
    queryFn: () => apiGet<FixtureDetail>(`/tournaments/${id}/fixtures/${matchId}`),
    enabled,
  });
```

Em `apps/web/src/lib/result-form.ts`, ao final:
```ts
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
```

`apps/web/src/pages/admin/ResultForm.tsx` (substitui o arquivo):
```tsx
import { validateFixtureResult, type DuelInput } from '@kickabout/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { reopenResult, saveResult } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useApiMutation } from '../../api/mutation';
import { useTournamentFixtures } from '../../api/queries';
import type { FixtureDetail, PlayerRef } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { Scoreboard } from '../../components/Scoreboard';
import {
  TIEBREAK_INDEX,
  duelsToSend,
  invalidScoreLabels,
  liveScore,
  penaltiesNeeded,
  playerOptions,
  rowsFromDuels,
  tiebreakNeeded,
  type DuelRow,
} from '../../lib/result-form';

type Mode = 'draft' | 'final';

interface Props {
  tournamentId: string;
  fixture: FixtureDetail;
  rosterA: PlayerRef[];
  rosterB: PlayerRef[];
}

/** Confrontos que precisam ser reabertos antes (erro RESULT_LOCKED). */
const blockingOf = (error: unknown): number[] =>
  error instanceof ApiError && error.code === 'RESULT_LOCKED'
    ? ((error.details as { blockingMatchIds?: number[] } | undefined)?.blockingMatchIds ?? [])
    : [];

export function ResultForm({ tournamentId, fixture, rosterA, rosterB }: Props) {
  const [rows, setRows] = useState(() => rowsFromDuels(fixture.duels));
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState<Mode | null>(null);
  const busy = useRef(false);
  const fixtures = useTournamentFixtures(tournamentId);
  const save = useApiMutation((vars: { mode: Mode; duels: DuelInput[] }) => saveResult(tournamentId, fixture.matchId, vars.mode, vars.duels));
  const reopen = useApiMutation(() => reopenResult(tournamentId, fixture.matchId));

  const knockout = fixture.isKnockout;
  const showTiebreak = tiebreakNeeded(rows, knockout);
  const score = liveScore(rows, knockout);
  const teamA = fixture.teamA.name;
  const teamB = fixture.teamB.name;

  const update = (index: number, patch: Partial<DuelRow>) => {
    setSaved(null);
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const send = (mode: Mode) => {
    if (busy.current) return;
    const invalid = invalidScoreLabels(rows, showTiebreak);
    if (invalid.length > 0) {
      setIssues([`Placar inválido em ${invalid.join(', ')}: use números de 0 a 99.`]);
      return;
    }
    const duels = duelsToSend(rows, knockout);
    if (mode === 'final') {
      const found = validateFixtureResult({
        mode,
        isKnockout: knockout,
        duels,
        rosterA: rosterA.map((player) => player.id),
        rosterB: rosterB.map((player) => player.id),
      });
      const messages = [...new Set(found.map((issue) => issue.message))];
      setIssues(messages);
      if (messages.length > 0) return;
    } else {
      setIssues([]);
    }
    busy.current = true;
    save.mutate(
      { mode, duels },
      {
        onSuccess: () => setSaved(mode),
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  };

  const blocking = [save.error, reopen.error].map(blockingOf).find((ids) => ids.length > 0) ?? [];
  const fixtureName = (matchId: number) => {
    const found = fixtures.data?.find((item) => item.matchId === matchId);
    return found ? `${found.teamA.name} × ${found.teamB.name}` : `Confronto ${matchId}`;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send('final');
  };

  return (
    <form aria-label="Resultado do confronto" onSubmit={submit}>
      <Scoreboard teamA={fixture.teamA} teamB={fixture.teamB} scoreA={score.scoreA} scoreB={score.scoreB} />
      <ol className="result-grid">
        {rows.slice(0, TIEBREAK_INDEX).map((row, index) => (
          <DuelFields
            key={index}
            index={index}
            row={row}
            rows={rows}
            teamA={teamA}
            teamB={teamB}
            rosterA={rosterA}
            rosterB={rosterB}
            onChange={(patch) => update(index, patch)}
          />
        ))}
        {showTiebreak && (
          <DuelFields
            index={TIEBREAK_INDEX}
            row={rows[TIEBREAK_INDEX]!}
            rows={rows}
            teamA={teamA}
            teamB={teamB}
            rosterA={rosterA}
            rosterB={rosterB}
            onChange={(patch) => update(TIEBREAK_INDEX, patch)}
          />
        )}
      </ol>

      {issues.length > 0 && (
        <div className="state state-error" role="alert">
          <p>Confira o resultado:</p>
          <ul className="issue-list">
            {issues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <FormError error={save.error ?? reopen.error} />
      {blocking.length > 0 && (
        <ul className="list" aria-label="Confrontos que precisam ser reabertos antes">
          {blocking.map((matchId) => (
            <li key={matchId}>
              <Link to={`/admin/campeonatos/${tournamentId}/jogos/${matchId}`} className="row-link">
                <span className="row-title">{fixtureName(matchId)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {saved && (
        <p className="notice" role="status">
          {saved === 'final' ? 'Resultado confirmado.' : 'Rascunho salvo.'}
        </p>
      )}

      <div className="actions">
        {fixture.status !== 'completed' && (
          <button type="button" className="button button-secondary" disabled={save.isPending} onClick={() => send('draft')}>
            Salvar rascunho
          </button>
        )}
        <button type="submit" className="button" disabled={save.isPending || reopen.isPending}>
          Confirmar resultado
        </button>
        {fixture.status === 'completed' && (
          <ConfirmButton
            label="Reabrir confronto"
            confirmLabel="Confirmar: o resultado volta a rascunho"
            disabled={reopen.isPending || save.isPending}
            onConfirm={() => reopen.mutate(undefined, { onSuccess: () => setSaved(null) })}
          />
        )}
      </div>
      {fixture.status === 'completed' ? (
        <p className="muted">Reabrir tira o resultado da chave, da classificação e das estatísticas até ele ser confirmado de novo.</p>
      ) : (
        <p className="muted">O rascunho guarda só os duelos completos (jogadores e placar) e não conta nas estatísticas nem na chave.</p>
      )}
    </form>
  );
}

interface FieldsProps {
  index: number;
  row: DuelRow;
  rows: DuelRow[];
  teamA: string;
  teamB: string;
  rosterA: PlayerRef[];
  rosterB: PlayerRef[];
  onChange: (patch: Partial<DuelRow>) => void;
}

function DuelFields({ index, row, rows, teamA, teamB, rosterA, rosterB, onChange }: FieldsProps) {
  const tiebreak = index === TIEBREAK_INDEX;
  const label = tiebreak ? 'Desempate' : `${index + 1}º duelo`;
  const goals = (side: 'A' | 'B') => (
    <input
      className={side === 'A' ? 'duel-ga' : 'duel-gb'}
      aria-label={`${label}: gols de ${side === 'A' ? teamA : teamB}`}
      inputMode="numeric"
      maxLength={2}
      value={side === 'A' ? row.goalsA : row.goalsB}
      onChange={(e) => onChange(side === 'A' ? { goalsA: e.target.value } : { goalsB: e.target.value })}
    />
  );
  const player = (side: 'A' | 'B') => (
    <select
      className={side === 'A' ? 'duel-pa' : 'duel-pb'}
      aria-label={`${label}: jogador de ${side === 'A' ? teamA : teamB}`}
      value={side === 'A' ? row.playerAId : row.playerBId}
      onChange={(e) => onChange(side === 'A' ? { playerAId: e.target.value } : { playerBId: e.target.value })}
    >
      <option value="">Jogador</option>
      {playerOptions(side === 'A' ? rosterA : rosterB, rows, side, index).map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );

  return (
    <li className={tiebreak ? 'duel-tiebreak' : undefined}>
      <span className="duel-label">{tiebreak ? 'Desempate (6º duelo): qualquer jogador do elenco' : label}</span>
      {player('A')}
      {goals('A')}
      {goals('B')}
      {player('B')}
      {tiebreak && penaltiesNeeded(row) && (
        <>
          <span className="duel-pen-label">Pênaltis</span>
          <input
            className="duel-pena"
            aria-label={`Pênaltis de ${teamA}`}
            inputMode="numeric"
            maxLength={2}
            value={row.penaltiesA}
            onChange={(e) => onChange({ penaltiesA: e.target.value })}
          />
          <input
            className="duel-penb"
            aria-label={`Pênaltis de ${teamB}`}
            inputMode="numeric"
            maxLength={2}
            value={row.penaltiesB}
            onChange={(e) => onChange({ penaltiesB: e.target.value })}
          />
        </>
      )}
    </li>
  );
}
```

`apps/web/src/pages/admin/AdminFixturePage.tsx` (substitui o arquivo):
```tsx
import { Link, useParams } from 'react-router';
import { useFixture, useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { NotFoundPage } from '../NotFoundPage';
import { ResultForm } from './ResultForm';

export function AdminFixturePage() {
  const { id = '', matchId = '' } = useParams();
  const valid = /^\d+$/.test(matchId);
  const fixture = useFixture(id, Number(matchId), valid);
  const tournament = useTournament(id);

  if (!valid) return <NotFoundPage />;

  return (
    <QueryState query={fixture}>
      {(f) => (
        <QueryState query={tournament}>
          {(t) => (
            <>
              <p className="hero-context">
                <Link to={`/admin/campeonatos/${id}`}>{t.name}</Link>
              </p>
              <h1>
                {f.teamA.name} contra {f.teamB.name}
              </h1>
              {t.status !== 'in_progress' ? (
                <p className="notice">Só é possível lançar resultados com o campeonato em andamento.</p>
              ) : f.rosterA && f.rosterB ? (
                <ResultForm key={`${id}:${f.matchId}`} tournamentId={id} fixture={f} rosterA={f.rosterA} rosterB={f.rosterB} />
              ) : (
                <p className="state">Carregando elencos…</p>
              )}
            </>
          )}
        </QueryState>
      )}
    </QueryState>
  );
}
```

Em `apps/web/src/pages/FixturePage.tsx`:
- acrescentar `import { NotFoundPage } from './NotFoundPage';`
- trocar `  const fixture = useFixture(id, Number(matchId));` por:
```tsx
  const valid = /^\d+$/.test(matchId);
  const fixture = useFixture(id, Number(matchId), valid);
```
- depois de `  const me = useMe();` acrescentar:
```tsx

  if (!valid) return <NotFoundPage />;
```
- trocar `{me.data?.user && (` por `{me.data?.user && tournament.data?.status === 'in_progress' && (`

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS (os testes do Plano 3b que procuram links de bloqueio continuam passando: a lista agora se chama "Confrontos que precisam ser reabertos antes", mas eles buscam o link pelo nome dos times); sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 3: Sessão e cache — retry, 401 em leituras, falha ao sair, atualização depois de erro

**Files:**
- Create: `apps/web/src/api/query-client.ts`
- Modify: `apps/web/src/main.tsx`, `apps/web/test/utils.tsx`, `apps/web/src/api/mutation.ts` (substitui o arquivo), `apps/web/src/pages/admin/AdminLayout.tsx`
- Test: `apps/web/test/session.test.tsx`

**Interfaces:**
- Consumes: `ApiError`, `forgetSession` (`api/session.ts`), `FormError`.
- Produces:
  - `shouldRetry(failureCount, error): boolean` — não repete 4xx; repete uma vez o resto
  - `createQueryClient({ retry?, staleTime? } = {})` — `QueryCache.onError`: 401 numa consulta que não seja `['me']` → `forgetSession`
  - `useApiMutation` invalida as consultas em `onSettled` (sucesso ou erro); num 401, `forgetSession` no lugar de invalidar
  - "Sair" mostra o erro se o logout falhar

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/session.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client';
import { shouldRetry } from '../src/api/query-client';
import type { AdminPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const failure = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status });

describe('session and cache', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'Time não encontrado.'))).toBe(false);
    expect(shouldRetry(0, new ApiError(502, 'HTTP_ERROR', '…'))).toBe(true);
    expect(shouldRetry(1, new ApiError(502, 'HTTP_ERROR', '…'))).toBe(false);
  });

  it('goes to the login page when a read-only admin page finds the session expired', async () => {
    mockApi({ ...SIGNED_IN, '/teams': [], '/players': () => failure(401, 'UNAUTHENTICATED', 'Faça login para continuar.') });
    const { router } = renderRoute('/admin/jogadores');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?voltar=%2Fadmin%2Fjogadores');
  });

  it('tells when signing out fails', async () => {
    mockApi({ ...SIGNED_IN, 'POST /auth/logout': () => failure(500, 'INTERNAL', 'Erro interno.') });
    const { router } = renderRoute('/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno.');
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('refreshes the list even when the second step of an edit fails', async () => {
    let name = 'Ana';
    const player = (): AdminPlayer => ({ id: 'p1', name, phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321', team: LEOES });
    mockApi({
      ...SIGNED_IN,
      '/players': () => [player()],
      '/teams': [
        { ...LEOES, playerCount: 1 },
        { ...TIGRES, playerCount: 20 },
      ],
      'PATCH /players/p1': (body: { name: string }) => {
        name = body.name;
        return player();
      },
      'PUT /players/p1/team': () => failure(409, 'ROSTER_FULL', 'O time já tem 20 jogadores ativos.'),
    });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    const form = screen.getByRole('form', { name: 'Editar Ana' });
    await within(form).findByRole('option', { name: 'Tigres' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Ana Paula' } });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O time já tem 20 jogadores ativos.');
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Editar Ana Paula' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/session.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/api/query-client"`.

- [ ] **Step 3: Implementar**

`apps/web/src/api/query-client.ts`:
```ts
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { forgetSession } from './session';

/** Não repete erros do cliente (4xx): "não encontrado" aparece na hora. O resto tenta mais uma vez. */
export const shouldRetry = (failureCount: number, error: unknown): boolean =>
  !(error instanceof ApiError && error.status < 500) && failureCount < 1;

export function createQueryClient({ retry = true, staleTime = 30_000 }: { retry?: boolean; staleTime?: number } = {}) {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Sessão expirada numa página do admin que só lê: vai para o login, como numa escrita.
        if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== 'me') forgetSession(client);
      },
    }),
    defaultOptions: { queries: { staleTime, retry: retry ? shouldRetry : false } },
  });
  return client;
}
```

Em `apps/web/src/main.tsx`:
- trocar `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';` por `import { QueryClientProvider } from '@tanstack/react-query';`
- depois de `import { routes } from './router';` acrescentar `import { createQueryClient } from './api/query-client';`
- trocar `const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });` por `const queryClient = createQueryClient();`

Em `apps/web/test/utils.tsx`:
- trocar `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';` por `import { QueryClientProvider } from '@tanstack/react-query';`
- depois de `import { routes } from '../src/router';` acrescentar `import { createQueryClient } from '../src/api/query-client';`
- trocar `const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });` por `const client = createQueryClient({ retry: false, staleTime: 0 });`

`apps/web/src/api/mutation.ts` (substitui o arquivo):
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { forgetSession } from './session';

/**
 * Escrita na API. Ao terminar (com sucesso ou erro), marca todas as consultas como desatualizadas: uma edição em
 * duas etapas pode ter salvo a primeira. Num 401 (sessão expirada), esquece a sessão; o `AdminLayout` leva para o login.
 */
export function useApiMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSettled: (_data, error) => {
      if (error instanceof ApiError && error.status === 401) return forgetSession(client);
      return client.invalidateQueries();
    },
  });
}
```

Em `apps/web/src/pages/admin/AdminLayout.tsx`:
- acrescentar `import { FormError } from '../../components/FormError';`
- depois do `</div>` que fecha `admin-bar` (antes de `<Outlet />`) acrescentar `<FormError error={exit.error} />`

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 4: Acabamentos (foco, avisos, chaves, textos, atalho para títulos)

**Files:**
- Modify: `apps/web/src/components/ConfirmButton.tsx`, `apps/web/src/pages/admin/team/TeamEditForm.tsx`, `apps/web/src/pages/admin/AdminTournamentPage.tsx`
- Modify: `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/pages/tournament/TournamentPage.tsx`, `apps/web/src/pages/HomePage.tsx`
- Test: `apps/web/test/polish.test.tsx`

**Interfaces:**
- Consumes: componentes e páginas existentes.
- Produces: foco no botão de confirmação; avisos "salvo" somem ao editar de novo; chave única por título no jogador; "A tabela aparece…" nos pontos corridos em preparação; link "Ver campeões e ranking de títulos" no início (spec 5.1).

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/polish.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerPageData, Tournament } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES, fixtureSummary } from './data';
import { mockApi, renderRoute } from './utils';

const draft = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'draft',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '2026-10-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  entries: [LEOES, TIGRES].map((t, i) => ({ seed: i + 1, team: t })),
  ...overrides,
});

describe('polish', () => {
  it('moves keyboard focus to the confirmation step', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments/c1': draft(), '/teams': [LEOES, TIGRES].map((t) => ({ ...t, playerCount: 6 })) });
    renderRoute('/admin/campeonatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar campeonato' }));
    expect(screen.getByRole('button', { name: 'Confirmar início: a chave não pode ser refeita' })).toHaveFocus();
  });

  it('clears the saved notice once the form changes again', async () => {
    mockApi({ ...SIGNED_IN, '/teams/t1/roster': { team: LEOES, players: [] }, 'PATCH /teams/t1': LEOES });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Dados do time' });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Leões FC' } });
    expect(screen.queryByText('Alterações salvas.')).toBeNull();
  });

  it('keeps one entry per historical title on the player page', async () => {
    const player: PlayerPageData = {
      player: { id: 'p1', name: 'Ana' },
      currentTeam: LEOES,
      teamHistory: [{ team: LEOES, joinedAt: '2026-01-01T00:00:00.000Z', leftAt: null }],
      stats: { playerId: 'p1', duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 },
      duels: [],
      titles: [
        { position: 1, year: 2019, tournamentId: null, tournamentName: 'Liga 2019', team: LEOES },
        { position: 1, year: 2018, tournamentId: null, tournamentName: 'Liga 2018', team: LEOES },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ '/players/p1': player });
    renderRoute('/jogadores/p1');
    expect(await screen.findByText('Liga 2018')).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    consoleError.mockRestore();
  });

  it('talks about the table for a round robin in preparation', async () => {
    mockApi({ '/tournaments/c1': draft({ format: 'round_robin' }) });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByText('A tabela aparece quando o campeonato começar.')).toBeInTheDocument();
  });

  it('links the home page to the titles', async () => {
    mockApi({ '/fixtures/recent?limit=8': [fixtureSummary()], '/tournaments?status=in_progress': [] });
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Ver campeões e ranking de títulos' })).toHaveAttribute('href', '/titulos');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/polish.test.tsx`
Expected: FAIL nos 5 (sem foco, aviso permanece, aviso de chave repetida, texto da chave, sem link).

- [ ] **Step 3: Implementar**

Em `apps/web/src/components/ConfirmButton.tsx`, no botão de confirmação (o que chama `onConfirm`), acrescentar `autoFocus` logo depois de `type="button"`.

Em `apps/web/src/pages/admin/team/TeamEditForm.tsx`, trocar `<TeamFields value={form} onChange={setForm} />` por:
```tsx
      <TeamFields
        value={form}
        onChange={(value) => {
          update.reset();
          setForm(value);
        }}
      />
```

Em `apps/web/src/pages/admin/AdminTournamentPage.tsx`:
- trocar `<TournamentFields value={form} onChange={setForm} />` por:
```tsx
      <TournamentFields
        value={form}
        onChange={(value) => {
          update.reset();
          setForm(value);
        }}
      />
```
- trocar `onChange={(e) => setName(e.target.value)}` por:
```tsx
onChange={(e) => {
            update.reset();
            setName(e.target.value);
          }}
```

Em `apps/web/src/pages/PlayerPage.tsx`, trocar ``<li key={`${title.tournamentId}-${title.position}`} className="row-link">`` por:
```tsx
                  <li key={`${title.tournamentId ?? title.tournamentName}-${title.year}-${title.position}-${title.team.id}`} className="row-link">
```

Em `apps/web/src/pages/tournament/TournamentPage.tsx`, trocar `<p className="state">A chave aparece quando o campeonato começar.</p>` por:
```tsx
              <p className="state">
                {t.format === 'round_robin' ? 'A tabela aparece quando o campeonato começar.' : 'A chave aparece quando o campeonato começar.'}
              </p>
```

Em `apps/web/src/pages/HomePage.tsx`, depois do `</section>` que fecha "Em andamento" (último antes de `</>`), acrescentar:
```tsx

      <p>
        <Link to="/titulos">Ver campeões e ranking de títulos</Link>
      </p>
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 5: Logo oficial

**Files:**
- Create: `docs/brand/LOGO_KICKABOUT.png` (cópia de `C:\Users\rich2\Downloads\LOGO_KICKABOUT.png`), `apps/web/scripts/brand-assets.ps1`
- Create (gerados): `apps/web/public/logo.png` (240×160), `apps/web/public/icon-192.png`, `apps/web/public/favicon-32.png`
- Modify: `apps/web/src/components/Layout.tsx`, `apps/web/src/styles/components.css`, `apps/web/index.html`
- Test: `apps/web/test/app.test.tsx`

**Interfaces:**
- Produces: link "Kickabout, início" com `<img src="/logo.png">`; ícone da aba e do celular a partir do recorte do "K" com o jogador e a bola (região 440,0 → 820×820 do original).

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/web/test/app.test.tsx`, dentro de `describe('layout')`, acrescentar:
```tsx
  it('shows the Kickabout logo as the home link', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    const home = await screen.findByRole('link', { name: 'Kickabout, início' });
    expect(home.querySelector('img')).toHaveAttribute('src', '/logo.png');
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/app.test.tsx`
Expected: FAIL — o link não tem imagem.

- [ ] **Step 3: Gerar as imagens**

`apps/web/scripts/brand-assets.ps1`:
```powershell
# Gera as imagens do site a partir do logo oficial (docs/brand/LOGO_KICKABOUT.png, 1536x1024, fundo transparente).
# Uso (na raiz do repositório): powershell -NoProfile -File apps/web/scripts/brand-assets.ps1
Add-Type -AssemblyName System.Drawing
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$source = Join-Path $root 'docs\brand\LOGO_KICKABOUT.png'
$public = Join-Path $root 'apps\web\public'
New-Item -ItemType Directory -Force $public | Out-Null

function Save-Resized($dest, $cx, $cy, $cw, $ch, $w, $h) {
  $img = [System.Drawing.Image]::FromFile($source)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $public $dest), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

Save-Resized 'logo.png' 0 0 1536 1024 240 160          # cabeçalho (exibido com 40px de altura, nitidez até 4x)
Save-Resized 'icon-192.png' 440 0 820 820 192 192      # ícone do celular: o "K" com o jogador e a bola
Save-Resized 'favicon-32.png' 440 0 820 820 32 32      # ícone da aba
```

Run:
```bash
mkdir -p docs/brand && cp "/c/Users/rich2/Downloads/LOGO_KICKABOUT.png" docs/brand/LOGO_KICKABOUT.png
powershell -NoProfile -File apps/web/scripts/brand-assets.ps1 && ls -la apps/web/public
```
Expected: `logo.png` (~35 KB), `icon-192.png` (~40 KB), `favicon-32.png` (~3 KB). Abrir `icon-192.png` e conferir que a bola não ficou cortada.

- [ ] **Step 4: Implementar**

Em `apps/web/src/components/Layout.tsx`, trocar:
```tsx
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          kickabout
        </Link>
```
por:
```tsx
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          <img src="/logo.png" alt="" width={60} height={40} />
        </Link>
```

Em `apps/web/src/styles/components.css`:
- no bloco `.topbar`, trocar `align-items: baseline;` por `align-items: center;`
- depois do bloco `.wordmark { … }`, acrescentar:
```css
.wordmark img {
  display: block;
  width: auto;
  height: 2.5rem;
}
```

Em `apps/web/index.html`, depois de `<meta name="theme-color" content="#0d1813" />`:
```html
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
```

- [ ] **Step 5: Rodar testes, typecheck e build**

Run: `npm test -w @kickabout/web && npm run typecheck && npm run build -w @kickabout/web && ls apps/web/dist`
Expected: todos PASS; build copia `logo.png`, `icon-192.png` e `favicon-32.png` para `dist/`.

- [ ] **Step 6: Checkpoint**

```bash
git add docs/brand apps/web
```

---

### Task 6: Verificação da v1, spec e documento de versões

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md` (6.1)
- Create: `docs/VERSOES.md`

- [ ] **Step 1: Suíte completa e build**

Run: `npm test && npm run typecheck && npm run build -w @kickabout/web`
Expected: shared, api e web PASS; typecheck limpo; build sem erros.

- [ ] **Step 2: Verificação no navegador**

Com Postgres, API e site no ar, logado no admin, em 1280px e 320px:
1. Logo no cabeçalho (sem estourar a largura em 320px) e ícone na aba.
2. **Eliminatória dupla** com 4 times criada pelo admin: lançar a chave superior, a inferior e a grande final; a chave (aba Chave) mostra as duas chaves com nomes de rodada em português; encerrar e conferir campeão e vice em `/titulos`.
3. **Pontos corridos** com 3 times (ida e volta): lançar todos os confrontos, incluindo um empate; a aba Tabela mostra a classificação com os critérios; encerrar e conferir o pódio.
4. **Reabrir**: num mata-mata com final lançada, tentar reabrir a semifinal (bloqueio com link da final), reabrir a final, corrigir a semifinal trocando o vencedor e conferir que a final passa a ter o outro time; nada rola na horizontal.
5. Console sem erros.

Registrar no ledger o que foi visto; problemas viram correções com teste na task correspondente.

- [ ] **Step 3: Spec 6.1**

Em `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`, ao final do item "**Mata-mata:** …" da seção 6.1, acrescentar a frase:
```
Para desfazer, o admin **reabre** o confronto seguinte (`POST /tournaments/:id/fixtures/:matchId/reopen`): o resultado volta a rascunho (duelos mantidos), sai da chave, da classificação e das estatísticas, e libera a correção do anterior. Só com o campeonato em andamento.
```

- [ ] **Step 4: Documento de versões**

Criar `docs/VERSOES.md` com o texto abaixo, trocando `DATA` pela saída de `date +%F` no dia da conclusão:

````markdown
# Kickabout — versões

Este documento registra o que cada versão entrega. A cada nova versão, acrescente uma seção no topo (a mais recente primeiro) dizendo o que mudou em relação à anterior; as seções antigas não são reescritas.

---

## v1.0 — DATA

Primeira versão: plataforma de campeonatos de eFootball mobile entre times. Um organizador (admin) cadastra tudo; o público acompanha sem login.

### Regras do jogo
- Confronto entre dois times = 5 duelos individuais (1 × 1), cada um com placar próprio; vitória no duelo vale 1 ponto e o placar do confronto é a soma.
- Mata-mata empatado depois dos 5 duelos: 6º duelo com qualquer jogador do elenco; se empatar, pênaltis (não podem terminar empatados).
- Pontos corridos: vitória 3, empate 1; desempate por pontos, confronto direto, vitórias, saldo de gols e gols marcados; depois, ordem do seed.
- Elenco com até 20 jogadores ativos; um jogador pertence a um time por vez; transferências preservam o histórico.

### Formatos de campeonato
- Eliminatória simples (com disputa de 3º lugar opcional), eliminatória dupla (com final com reset opcional) e pontos corridos (turno único ou ida e volta).
- Chaves com número de times que não é potência de 2 são completadas com BYEs.

### Site público (sem login)
- **Início:** último resultado em destaque, resultados recentes, campeonatos em andamento e atalho para os títulos.
- **Campeonatos:** lista por situação (em andamento, encerrados, em preparação).
- **Campeonato:** abas Chave (desenho da chave) ou Tabela (classificação nos pontos corridos), Jogos (por rodada, com nomes em português), Times (link para o BID de cada time) e Estatísticas (artilharia, mais vitórias em duelos e melhor aproveitamento).
- **Confronto:** placar grande, barra dos duelos (6º em destaque) e lista dos duelos com pênaltis.
- **Times, time e BID:** elenco com nome e celular; o celular é um link para o WhatsApp do jogador. O celular só aparece nas listas de BID.
- **Jogador:** time atual, histórico de times, números, histórico de duelos e títulos.
- **Títulos:** ranking de times por títulos e pódio de cada campeonato.
- Mobile-first (funciona a partir de 320px), tema escuro, logo oficial; mensagens de erro em português.

### Área do organizador (`/admin`, com login)
- **Login** pelo link "Área do organizador" no rodapé; a sessão expirada leva de volta ao login e depois à mesma página.
- **Times:** cadastro e edição; elenco com remover, buscar e transferir jogador já cadastrado ou cadastrar um novo direto no time; contador "n de 20" e aviso de elenco cheio.
- **Jogadores:** busca por nome ou celular, cadastro, edição e troca de time.
- **Campeonatos:** criar com as opções do formato, inscrever times e ordenar os seeds, iniciar (com confirmação), acompanhar os confrontos e encerrar (gera campeão, vice e 3º).
- **Lançamento de resultado:** jogadores já escalados somem dos outros duelos, placar ao vivo, 6º duelo e pênaltis quando necessários, rascunho ou confirmação, validação das regras antes de enviar.
- **Correções:** pontos corridos podem ser corrigidos livremente; no mata-mata, um confronto com resultados seguintes lançados fica bloqueado e a tela mostra quais reabrir. **Reabrir** volta um resultado confirmado a rascunho.
- **Títulos históricos:** cadastro manual e exclusão (só dos manuais).

### Privacidade do celular
- `PHONE_VISIBILITY=public` (padrão da v1): BID público. Com `authenticated`, a API só envia celulares para quem está logado, e o site esquece esses dados ao sair.

### Como rodar
- Requisitos: Node 22.12 ou mais novo (testado no 24) e Docker.
- `docker compose up -d` (Postgres), `npm install`, `npm run db:migrate -w @kickabout/api` na primeira vez.
- Admin: definir `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `apps/api/.env` e rodar `npm run create-admin -w @kickabout/api`.
- `npm run dev:api` e `npm run dev:web`; o site fica em http://localhost:5173.
- Testes: `npm test`; tipos: `npm run typecheck`.

### Tecnologia
- Monorepo npm workspaces: `packages/shared` (regras puras), `apps/api` (Fastify, Prisma, PostgreSQL, brackets-manager) e `apps/web` (React 19, Vite 8, React Router 7, TanStack Query, brackets-viewer).

### Limitações conhecidas
- Se o desenho da chave falhar, ele só volta recarregando a página (os confrontos continuam na aba Jogos).
- A busca de jogador com números também procura nos celulares.
- Fora da v1 (spec): contas abertas, capitães, reporte de resultado pelos times, notificações, prints de resultado, E2E automatizado e deploy definitivo.
````

- [ ] **Step 5: Commit do plano**

```bash
git add -A
git commit -m "feat: reopen results, v1 polish, official logo and versions doc"
```
