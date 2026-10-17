# Kickabout — Plano 3b: Site (área do organizador)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao `apps/web` a área do organizador (login + telas da seção 5.2 do spec e o fluxo de lançamento de resultado da seção 6), usando a API do Plano 2 sem mudanças nela.

**Architecture:** Rotas `/entrar` (login) e `/admin/*` dentro do mesmo `Layout` do site público. `AdminLayout` consulta `GET /auth/me`; sem sessão, redireciona para `/entrar?voltar=<página>`. Escritas usam `apiRequest` via `useApiMutation` (TanStack `useMutation` que, ao dar certo, invalida todas as consultas e, num 401, marca o usuário como deslogado). A regra do confronto ao vivo (placar, 6º duelo, pênaltis, validação antes de confirmar) vem de `@kickabout/shared`; a lógica do formulário de resultado fica isolada em `lib/result-form.ts` (funções puras testadas à parte).

**Tech Stack:** o mesmo do Plano 3a (React 19.3.0, React Router 7.18.4, TanStack Query 5.104.0, Vite 8.3.1, Vitest 4 + jsdom + Testing Library). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md` (seções 5.2, 5.3, 6, 7 e 8)

## Contratos da API usados (Plano 2, já no `main`)

Todas as escritas exigem sessão (cookie `kb_session`); sem ela → `401 UNAUTHENTICATED "Faça login para continuar."`. Erros: `{ error: { code, message, details? } }`.

| Método e rota | Corpo | Resposta / erros relevantes |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ user }`; `401 INVALID_CREDENTIALS "Email ou senha inválidos."` |
| `POST /auth/logout` | — | `{ ok: true }` |
| `GET /auth/me` | — | `{ user: { id, email, role } \| null }` |
| `POST /teams` | `{ name (≤60), shortName (≤5, maiúsculas), crestUrl? (http/https ou null) }` | `201 TeamSummary`; `409 TEAM_NAME_TAKEN` |
| `PATCH /teams/:id` | mesmos campos, parciais | `TeamRef` |
| `GET /teams/:id/roster` | — | `{ team, players: RosterPlayer[] }` (com celular quando logado) |
| `GET /players?search=` | — | `AdminPlayer[]` = `{ id, name, phone, whatsappUrl, team: TeamRef \| null }` |
| `POST /players` | `{ name, phone, teamId? }` | `201 AdminPlayer`; `400 INVALID_PHONE`, `409 PHONE_TAKEN`, `409 ROSTER_FULL` |
| `PATCH /players/:id` | `{ name?, phone? }` | `AdminPlayer` |
| `PUT /players/:id/team` | `{ teamId: string \| null }` | `{ playerId, teamId }`; `409 ROSTER_FULL "O time já tem 20 jogadores ativos."` |
| `POST /tournaments` | `{ name (≤80), format, options? }` | `201 Tournament` |
| `PATCH /tournaments/:id` | `{ name?, format?, options? }` (formato/opções só em `draft`) | `Tournament`; `409 TOURNAMENT_LOCKED` |
| `PUT /tournaments/:id/entries` | `{ teamIds }` (a ordem é o seed) | `Tournament`; só em `draft` |
| `POST /tournaments/:id/start` | — | `Tournament`; `409 NOT_ENOUGH_TEAMS` (mínimo 2; 3 na eliminatória dupla) |
| `POST /tournaments/:id/finish` | — | `Tournament`; `409 TOURNAMENT_NOT_COMPLETE "Ainda há confrontos sem resultado."` |
| `GET /tournaments/:id/fixtures/:matchId` | — | `FixtureDetail` + `rosterA`/`rosterB` (`{id,name}[]`) quando logado |
| `PUT /tournaments/:id/fixtures/:matchId/result` | `{ mode: 'draft' \| 'final', duels: DuelInput[] }` | `FixtureDetail`; `400 INVALID_RESULT` (`details`: `{code,message,path}[]` em português); `409 RESULT_LOCKED` (`details.blockingMatchIds: number[]`); `409 FIXTURE_ALREADY_COMPLETED` (rascunho em confronto confirmado) |
| `POST /titles` | `{ teamId, tournamentName, position: 1\|2\|3, year (1990–2100) }` | `201 TitleEntry` |
| `DELETE /titles/:id` | — | `{ ok: true }`; `409 TITLE_FROM_TOURNAMENT` |

## Global Constraints

- Mesmas versões e convenções do Plano 3a; TypeScript strict (`noUncheckedIndexedAccess`); nenhuma dependência nova.
- Texto em português, frases curtas, sem caixa-alta nem "·" (Design do Plano 3a).
- Todo botão que envia algo fica desabilitado enquanto a requisição está em andamento.
- Ações irreversíveis (iniciar campeonato, encerrar campeonato, apagar título) pedem confirmação em dois cliques (`ConfirmButton`), nunca `window.confirm`.
- O celular aparece no admin (spec 5.3) e continua fora das páginas públicas que não são BID.
- Validações do front são conveniência; a decisão é sempre do servidor (spec 7). Mensagens de erro da API são mostradas como vieram.
- Mobile-first: as telas do admin funcionam em 320px sem rolagem horizontal da página.
- Commit único ao final do plano (preferência do usuário); passos de checkpoint fazem só `git add`.

## Fora deste plano (decisão)

- **Apagar time:** a API não tem `DELETE /teams/:id` e apagar um time apagaria o histórico de confrontos e títulos. O "CRUD" de times do spec 5.2 fica como criar, listar e editar; para tirar um time de uso, basta não inscrevê-lo.
- Os 6 itens "minor" adiados da revisão do Plano 3a continuam fora.

## Review Focus

1. **Endereço de retorno malicioso no login** (`/entrar?voltar=//evil.com`, `https://…`, `/\evil.com`) — depois de entrar, vai sempre para `/admin`. Testado na Task 1.
2. **Sessão expirada no meio do uso** (qualquer escrita devolve `401`) — volta para `/entrar?voltar=<página atual>`, sem tela quebrada. Testado na Task 2.
3. **Duplo clique em "Confirmar resultado"** — uma única requisição. Testado na Task 6.
4. **Correção bloqueada no mata-mata** (`RESULT_LOCKED`) — mensagem do servidor e links para os confrontos que precisam ser desfeitos. Testado na Task 6.
5. **Elenco com 20 jogadores** — aviso e controles de adicionar escondidos; se o servidor recusar (`ROSTER_FULL`), a mensagem aparece. Testado na Task 2.

---

## File Structure

```
apps/web/src/
├── admin-routes.tsx                 # filhos de /admin (cada task acrescenta antes do *)
├── router.tsx                       # + /entrar e /admin
├── main.tsx                         # + styles/admin.css
├── styles/admin.css                 # formulários, botões, linhas do admin, grade de resultado
├── api/
│   ├── types.ts                     # + AuthUser, AdminPlayer, TournamentOptions
│   ├── queries.ts                   # + useMe, useAdminPlayers
│   ├── admin.ts                     # funções de escrita (uma por rota)
│   └── mutation.ts                  # useApiMutation
├── lib/
│   ├── redirect.ts                  # safeRedirect
│   ├── format.ts                    # + MIN_TEAMS
│   └── result-form.ts               # lógica pura do formulário de resultado
├── components/
│   ├── Layout.tsx                   # + rodapé "Área do organizador"
│   ├── FormError.tsx · ConfirmButton.tsx
└── pages/
    ├── LoginPage.tsx
    ├── FixturePage.tsx              # + atalho "Lançar/Corrigir resultado" para o admin
    ├── tournament/FixturesTab.tsx   # + prop fixtureUrl
    └── admin/
        ├── AdminLayout.tsx · AdminHome.tsx
        ├── AdminTeamsPage.tsx · AdminTeamPage.tsx
        ├── team/{TeamFields,TeamEditForm,RosterManager}.tsx
        ├── AdminPlayersPage.tsx
        ├── AdminTournamentsPage.tsx · AdminTournamentPage.tsx
        ├── tournament/{TournamentFields,EntriesEditor}.tsx
        ├── AdminFixturePage.tsx · ResultForm.tsx
        └── AdminTitlesPage.tsx
apps/web/test/
├── utils.tsx                        # mockApi por método + sentBodies; renderRoute devolve o router
├── data.ts                          # + ADMIN, SIGNED_IN
└── auth.test.tsx · admin-teams.test.tsx · admin-players.test.tsx · admin-tournaments.test.tsx
    · result-form.test.ts · admin-result.test.tsx · admin-titles.test.tsx
```

---

### Task 1: Login, sessão e base do admin

**Files:**
- Modify: `apps/web/test/utils.tsx`, `apps/web/test/data.ts`, `apps/web/test/app.test.tsx`
- Modify: `apps/web/src/api/types.ts`, `apps/web/src/api/queries.ts`, `apps/web/src/components/Layout.tsx`, `apps/web/src/router.tsx`, `apps/web/src/main.tsx`
- Create: `apps/web/src/api/admin.ts`, `apps/web/src/api/mutation.ts`, `apps/web/src/lib/redirect.ts`, `apps/web/src/components/FormError.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/admin/AdminLayout.tsx`, `apps/web/src/pages/admin/AdminHome.tsx`, `apps/web/src/admin-routes.tsx`, `apps/web/src/styles/admin.css`
- Test: `apps/web/test/auth.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `apiGet`, `ApiError` (Plano 3a, `api/client.ts`); `QueryState`; `NotFoundPage`.
- Produces:
  - test utils: `mockApi(routes)` — chave `MÉTODO /caminho` (para GET também só `/caminho`), valor fixo, `Response` ou função `(body) => valor | Response`; `sentBodies(fetchMock, 'MÉTODO /caminho'): unknown[]`; `renderRoute(path)` devolve `{ ...render, router }`
  - `test/data.ts`: `ADMIN`, `SIGNED_IN` (`{ '/auth/me': { user: ADMIN } }`)
  - tipos `AuthUser`, `AdminPlayer`, `TournamentOptions`
  - `useMe()`, `useAdminPlayers(search, enabled?)`
  - `api/admin.ts`: `TeamInput`, `PlayerInput`, `TournamentInput`, `TitleInput`; `login`, `logout`, `createTeam`, `updateTeam`, `createPlayer`, `updatePlayer`, `setPlayerTeam`, `createTournament`, `updateTournament`, `setEntries`, `startTournament`, `finishTournament`, `saveResult`, `createTitle`, `deleteTitle`
  - `useApiMutation<TVars, TResult>(fn)`; `FormError({ error })`; `safeRedirect(target)`
  - `adminRoutes: RouteObject[]` (as próximas tasks acrescentam rotas antes do `*`)
  - classes CSS: `form`, `field`, `check`, `button`, `button-secondary`, `button-danger`, `button-small`, `actions`, `confirm`, `issue-list`, `narrow`, `admin-bar`, `admin-row`, `footer`, `result-grid`, `duel-label`

- [ ] **Step 1: Utilitários de teste por método**

`apps/web/test/utils.tsx` (substitui o arquivo):
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/router';

/** Valor fixo, `Response` (devolvida como está) ou função que recebe o corpo JSON enviado. */
export type ApiRoutes = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Simula a API. Chave = `MÉTODO /caminho` (sem `/api`); para GET também vale só `/caminho`.
 * Com query string tem prioridade sobre sem.
 */
export function mockApi(routes: ApiRoutes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const keys = [`${method} ${path}${url.search}`, `${method} ${path}`];
    if (method === 'GET') keys.push(path + url.search, path);
    const key = keys.find((candidate) => routes[candidate] !== undefined);
    if (key === undefined) return json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, 404);
    let handler = routes[key];
    if (typeof handler === 'function') {
      handler = (handler as (body: unknown) => unknown)(init?.body ? JSON.parse(String(init.body)) : undefined);
    }
    if (handler instanceof Response) return handler;
    return json(handler);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type FetchMock = ReturnType<typeof mockApi>;

/** Corpos JSON enviados para `MÉTODO /caminho`, na ordem (sem corpo → `undefined`). */
export function sentBodies(fetchMock: FetchMock, key: string): unknown[] {
  const [method, path] = key.split(' ');
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        (init?.method ?? 'GET').toUpperCase() === method && new URL(String(input), 'http://localhost').pathname === `/api${path}`,
    )
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
}

export function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}
```

Em `apps/web/test/data.ts`, acrescentar ao final:
```ts
export const ADMIN = { id: 'u1', email: 'admin@kickabout.local', role: 'admin' };

/** Rotas de API de um organizador logado. */
export const SIGNED_IN = { '/auth/me': { user: ADMIN } };
```

Run: `npm test -w @kickabout/web`
Expected: os 39 testes do Plano 3a continuam PASS (o `mockApi` antigo era um caso particular do novo).

- [ ] **Step 2: Escrever os testes que falham**

`apps/web/test/auth.test.tsx`:
```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../src/lib/redirect';
import { ADMIN, SIGNED_IN } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

function signIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('safeRedirect', () => {
  it('keeps internal paths and rejects anything that could leave the site', () => {
    expect(safeRedirect('/admin/times?x=1')).toBe('/admin/times?x=1');
    expect(['//evil.com', 'https://evil.com', '/\\evil.com', 'admin', '', null, '/\n/evil.com'].map(safeRedirect)).toEqual(
      Array(7).fill('/admin'),
    );
  });
});

describe('sign in', () => {
  it('sends signed-out visitors to the login page, remembering where they were going', async () => {
    mockApi({ '/auth/me': { user: null } });
    const { router } = renderRoute('/admin');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toBe('?voltar=%2Fadmin');
  });

  it('signs in and returns to the requested page', async () => {
    let user: typeof ADMIN | null = null;
    const fetchMock = mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/login': () => {
        user = ADMIN;
        return { user: ADMIN };
      },
    });
    renderRoute('/entrar?voltar=%2Fadmin');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('admin@kickabout.local', 'segredo123');
    expect(await screen.findByRole('heading', { name: 'Área do organizador' })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /auth/login')).toEqual([{ email: 'admin@kickabout.local', password: 'segredo123' }]);
  });

  it('shows the API message for wrong credentials', async () => {
    mockApi({
      '/auth/me': { user: null },
      'POST /auth/login': () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } }), { status: 401 }),
    });
    renderRoute('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('admin@kickabout.local', 'errada');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos.');
  });

  it('never follows an external return address', async () => {
    mockApi(SIGNED_IN);
    const { router } = renderRoute('/entrar?voltar=%2F%2Fevil.com');
    expect(await screen.findByRole('heading', { name: 'Área do organizador' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('signs out back to the public home', async () => {
    let user: typeof ADMIN | null = ADMIN;
    const fetchMock = mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/logout': () => {
        user = null;
        return { ok: true };
      },
      '/fixtures/recent?limit=8': [],
      '/tournaments?status=in_progress': [],
    });
    const { router } = renderRoute('/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/logout')).toHaveLength(1);
  });
});
```

Em `apps/web/test/app.test.tsx`, dentro de `describe('layout')`, acrescentar:
```tsx
  it('links to the organizer area from the footer', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    expect(await screen.findByRole('link', { name: 'Área do organizador' })).toHaveAttribute('href', '/admin');
  });
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/auth.test.tsx test/app.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/lib/redirect"` e o link do rodapé não existe.

- [ ] **Step 4: Tipos, consultas e funções de escrita**

Em `apps/web/src/api/types.ts`, acrescentar ao final:
```ts
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/** Jogador como o admin vê (sempre com celular). */
export interface AdminPlayer {
  id: string;
  name: string;
  phone: string;
  whatsappUrl: string;
  team: TeamRef | null;
}

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
}
```

Em `apps/web/src/api/queries.ts`:
- trocar a primeira linha por `import { keepPreviousData, useQuery } from '@tanstack/react-query';`
- acrescentar `AdminPlayer` e `AuthUser` ao `import type { … } from './types';`
- acrescentar ao final:
```ts
export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => apiGet<{ user: AuthUser | null }>('/auth/me'), staleTime: 60_000 });

export const useAdminPlayers = (search: string, enabled = true) =>
  useQuery({
    queryKey: ['players', 'admin', search],
    queryFn: () => apiGet<AdminPlayer[]>(search ? `/players?search=${encodeURIComponent(search)}` : '/players'),
    placeholderData: keepPreviousData,
    enabled,
  });
```

`apps/web/src/api/admin.ts`:
```ts
import type { DuelInput } from '@kickabout/shared';
import { apiRequest } from './client';
import type {
  AdminPlayer,
  AuthUser,
  FixtureDetail,
  TeamRef,
  TeamSummary,
  TitleEntry,
  Tournament,
  TournamentFormat,
  TournamentOptions,
} from './types';

export interface TeamInput {
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface PlayerInput {
  name: string;
  phone: string;
  teamId: string | null;
}

export interface TournamentInput {
  name: string;
  format: TournamentFormat;
  options: Partial<TournamentOptions>;
}

export interface TitleInput {
  teamId: string;
  tournamentName: string;
  position: 1 | 2 | 3;
  year: number;
}

export const login = (email: string, password: string) =>
  apiRequest<{ user: AuthUser }>('POST', '/auth/login', { email, password });
export const logout = () => apiRequest<{ ok: true }>('POST', '/auth/logout');

export const createTeam = (input: TeamInput) => apiRequest<TeamSummary>('POST', '/teams', input);
export const updateTeam = (id: string, input: TeamInput) => apiRequest<TeamRef>('PATCH', `/teams/${id}`, input);

export const createPlayer = (input: PlayerInput) => apiRequest<AdminPlayer>('POST', '/players', input);
export const updatePlayer = (id: string, input: { name: string; phone: string }) =>
  apiRequest<AdminPlayer>('PATCH', `/players/${id}`, input);
export const setPlayerTeam = (playerId: string, teamId: string | null) =>
  apiRequest<{ playerId: string; teamId: string | null }>('PUT', `/players/${playerId}/team`, { teamId });

export const createTournament = (input: TournamentInput) => apiRequest<Tournament>('POST', '/tournaments', input);
export const updateTournament = (id: string, input: Partial<TournamentInput>) =>
  apiRequest<Tournament>('PATCH', `/tournaments/${id}`, input);
export const setEntries = (id: string, teamIds: string[]) =>
  apiRequest<Tournament>('PUT', `/tournaments/${id}/entries`, { teamIds });
export const startTournament = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/start`);
export const finishTournament = (id: string) => apiRequest<Tournament>('POST', `/tournaments/${id}/finish`);

export const saveResult = (id: string, matchId: number, mode: 'draft' | 'final', duels: DuelInput[]) =>
  apiRequest<FixtureDetail>('PUT', `/tournaments/${id}/fixtures/${matchId}/result`, { mode, duels });

export const createTitle = (input: TitleInput) => apiRequest<TitleEntry>('POST', '/titles', input);
export const deleteTitle = (id: string) => apiRequest<{ ok: true }>('DELETE', `/titles/${id}`);
```

`apps/web/src/api/mutation.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Escrita na API. Ao dar certo, marca todas as consultas como desatualizadas (o site é pequeno: simples e sempre correto).
 * Num 401 (sessão expirada), marca o usuário como deslogado; o `AdminLayout` leva para o login e volta para a mesma página.
 */
export function useApiMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSuccess: () => client.invalidateQueries(),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) client.setQueryData(['me'], { user: null });
    },
  });
}
```

`apps/web/src/lib/redirect.ts`:
```ts
/** Só aceita caminhos internos (`/algo`); qualquer outro destino volta para o admin. */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\') || /[\u0000-\u001f\u007f]/.test(target)) {
    return '/admin';
  }
  return target;
}
```

`apps/web/src/components/FormError.tsx`:
```tsx
import { ApiError } from '../api/client';

interface Issue {
  message: string;
}

const isIssue = (value: unknown): value is Issue =>
  typeof value === 'object' && value !== null && typeof (value as Issue).message === 'string';

/** Erro de uma escrita: mensagem da API e, no resultado, a lista de regras quebradas (já em português). */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const issues =
    apiError?.code === 'INVALID_RESULT' && Array.isArray(apiError.details)
      ? [...new Set((apiError.details as unknown[]).filter(isIssue).map((issue) => issue.message))]
      : [];
  return (
    <div className="state state-error" role="alert">
      <p>{apiError?.message ?? 'Não foi possível salvar. Tente de novo.'}</p>
      {issues.length > 0 && (
        <ul className="issue-list">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Login, admin e rotas**

`apps/web/src/pages/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { login } from '../api/admin';
import { useApiMutation } from '../api/mutation';
import { useMe } from '../api/queries';
import { FormError } from '../components/FormError';
import { safeRedirect } from '../lib/redirect';

export function LoginPage() {
  const [params] = useSearchParams();
  const target = safeRedirect(params.get('voltar'));
  const navigate = useNavigate();
  const me = useMe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useApiMutation((vars: { email: string; password: string }) => login(vars.email, vars.password));

  if (me.data?.user) return <Navigate to={target} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ email, password }, { onSuccess: () => navigate(target, { replace: true }) });
  };

  return (
    <section className="narrow">
      <h1>Entrar</h1>
      <p className="muted">Área do organizador: cadastro de times, jogadores, campeonatos e resultados.</p>
      <form className="form" aria-label="Entrar" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <FormError error={mutation.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={mutation.isPending}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
```

`apps/web/src/pages/admin/AdminLayout.tsx`:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../../api/admin';
import { useMe } from '../../api/queries';
import { QueryState } from '../../components/QueryState';

/** Tudo em /admin exige login; sem sessão, vai para /entrar e volta para cá depois. */
export function AdminLayout() {
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const exit = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      navigate('/');
      client.setQueryData(['me'], { user: null });
      void client.invalidateQueries();
    },
  });

  return (
    <QueryState query={me}>
      {({ user }) =>
        user ? (
          <>
            <div className="admin-bar">
              <nav aria-label="Administração" className="tabs">
                <NavLink to="/admin/campeonatos">Campeonatos</NavLink>
                <NavLink to="/admin/times">Times</NavLink>
                <NavLink to="/admin/jogadores">Jogadores</NavLink>
                <NavLink to="/admin/titulos">Títulos</NavLink>
              </nav>
              <button type="button" className="button button-secondary button-small" disabled={exit.isPending} onClick={() => exit.mutate()}>
                Sair
              </button>
            </div>
            <Outlet />
          </>
        ) : (
          <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
        )
      }
    </QueryState>
  );
}
```

`apps/web/src/pages/admin/AdminHome.tsx`:
```tsx
import { Link } from 'react-router';

const SECTIONS = [
  { to: '/admin/campeonatos', label: 'Campeonatos', hint: 'Criar, inscrever times, iniciar e lançar resultados' },
  { to: '/admin/times', label: 'Times', hint: 'Cadastro e elenco (BID)' },
  { to: '/admin/jogadores', label: 'Jogadores', hint: 'Nome, celular e transferências' },
  { to: '/admin/titulos', label: 'Títulos', hint: 'Histórico anterior ao Kickabout' },
];

export function AdminHome() {
  return (
    <section>
      <h1>Área do organizador</h1>
      <ul className="list">
        {SECTIONS.map((section) => (
          <li key={section.to}>
            <Link to={section.to} className="row-link">
              <span className="row-title">{section.label}</span>
              <span className="row-meta">{section.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/admin-routes.tsx`:
```tsx
import type { RouteObject } from 'react-router';
import { AdminHome } from './pages/admin/AdminHome';
import { NotFoundPage } from './pages/NotFoundPage';

/** Filhos de `/admin` (todos exigem login). Cada task acrescenta as suas rotas antes do `*`. */
export const adminRoutes: RouteObject[] = [
  { index: true, element: <AdminHome /> },
  { path: '*', element: <NotFoundPage /> },
];
```

Em `apps/web/src/router.tsx`:
- acrescentar os imports `import { adminRoutes } from './admin-routes';`, `import { LoginPage } from './pages/LoginPage';` e `import { AdminLayout } from './pages/admin/AdminLayout';`
- antes de `{ path: '*', element: <NotFoundPage /> },` acrescentar:
```tsx
          { path: 'entrar', element: <LoginPage /> },
          { path: 'admin', element: <AdminLayout />, children: adminRoutes },
```

Em `apps/web/src/components/Layout.tsx`, depois de `</main>`:
```tsx
      <footer className="footer">
        <Link to="/admin">Área do organizador</Link>
      </footer>
```

Em `apps/web/src/main.tsx`, depois de `import './styles/components.css';`:
```ts
import './styles/admin.css';
```

`apps/web/src/styles/admin.css`:
```css
/* Formulários */
.form {
  display: grid;
  gap: var(--space-4);
  max-width: 32rem;
  margin-bottom: var(--space-5);
}

.field {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.field > span {
  color: var(--muted);
  font-size: var(--step--1);
  font-weight: 500;
}

.check {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

input,
select {
  width: 100%;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  font: inherit;
  color: var(--chalk);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.check input {
  width: auto;
}

.narrow {
  max-width: 26rem;
}

/* Botões */
.button {
  padding: var(--space-2) var(--space-4);
  font: inherit;
  font-weight: 600;
  color: var(--grass-ink);
  background: var(--grass);
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.button-secondary {
  color: var(--chalk);
  background: var(--surface-2);
}

.button-danger {
  color: #2a0703;
  background: var(--flag);
}

.button-small {
  padding: var(--space-1) var(--space-3);
  font-size: var(--step--1);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.confirm {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.issue-list {
  margin-top: var(--space-2);
  padding-left: var(--space-5);
  list-style: disc;
}

/* Estrutura do admin */
.admin-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.admin-bar .tabs {
  margin-bottom: 0;
}

.admin-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.admin-row .row-title {
  flex: 1 1 10rem;
}

.footer {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-5) 16px var(--space-6);
  border-top: 1px solid var(--line);
  font-size: var(--step--1);
}

.footer a {
  color: var(--muted);
}

/* Lançamento de resultado */
.result-grid > li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.25rem 3.25rem minmax(0, 1fr);
  align-items: end;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.result-grid .duel-label {
  grid-column: 1 / -1;
  color: var(--muted);
  font-size: var(--step--1);
}

.result-grid .duel-tiebreak .duel-label {
  color: var(--amber);
  font-weight: 600;
}

.result-grid input {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS (39 anteriores + 7 novos); sem erros de tipo.

- [ ] **Step 7: Checkpoint**

```bash
git add apps/web
```

---

### Task 2: Times e elenco (BID) no admin

**Files:**
- Create: `apps/web/src/pages/admin/AdminTeamsPage.tsx`, `apps/web/src/pages/admin/AdminTeamPage.tsx`
- Create: `apps/web/src/pages/admin/team/TeamFields.tsx`, `apps/web/src/pages/admin/team/TeamEditForm.tsx`, `apps/web/src/pages/admin/team/RosterManager.tsx`
- Modify: `apps/web/src/admin-routes.tsx`
- Test: `apps/web/test/admin-teams.test.tsx`

**Interfaces:**
- Consumes: `useTeams`, `useRoster`, `useAdminPlayers`, `createTeam`, `updateTeam`, `createPlayer`, `setPlayerTeam`, `useApiMutation`, `FormError`, `formatPhone`, `MAX_ACTIVE_ROSTER` (`@kickabout/shared`), `SIGNED_IN`, `sentBodies`.
- Produces: rotas `/admin/times` e `/admin/times/:id`; `TeamFields({ value, onChange })` + `emptyTeam`.

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/admin-teams.test.tsx`:
```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES, team } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const ana: RosterPlayer = { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' };
const roster = (players: RosterPlayer[]) => ({ '/teams/t1/roster': { team: LEOES, players } });

function fillNewTeam(name: string, shortName: string) {
  const form = screen.getByRole('form', { name: 'Novo time' });
  fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: name } });
  fireEvent.change(within(form).getByLabelText('Sigla (até 5 letras)'), { target: { value: shortName } });
  fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar time' }));
}

describe('admin teams', () => {
  it('lists teams with roster size and creates a new team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/teams': [{ ...LEOES, playerCount: 12 }],
      'POST /teams': (body: { name: string }) => ({ ...team('t9', body.name), playerCount: 0 }),
      '/teams/t9/roster': { team: team('t9', 'Panteras'), players: [] },
    });
    renderRoute('/admin/times');
    expect(await screen.findByRole('link', { name: /Leões.*12 de 20 jogadores/ })).toHaveAttribute('href', '/admin/times/t1');
    fillNewTeam('Panteras', 'pan');
    expect(await screen.findByRole('heading', { name: 'Panteras', level: 1 })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /teams')).toEqual([{ name: 'Panteras', shortName: 'PAN', crestUrl: null }]);
  });

  it('edits the team data', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, ...roster([]), 'PATCH /teams/t1': (body: object) => ({ ...LEOES, ...body }) });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Dados do time' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Leões FC' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /teams/t1')).toEqual([{ name: 'Leões FC', shortName: 'LEÕ', crestUrl: null }]);
  });

  it('shows the roster with phones and removes a player', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, ...roster([ana]), 'PUT /players/p1/team': { playerId: 'p1', teamId: null } });
    renderRoute('/admin/times/t1');
    const list = await screen.findByRole('list', { name: 'Elenco atual' });
    expect(list).toHaveTextContent('(11) 98765-4321');
    expect(screen.getByText('1 de 20 jogadores ativos.')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Remover Ana do elenco' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /players/p1/team')).toEqual([{ teamId: null }]));
  });

  it('transfers an existing player from another team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      ...roster([]),
      '/players?search=bia': [{ id: 'p5', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000', team: TIGRES }],
      'PUT /players/p5/team': { playerId: 'p5', teamId: 't1' },
    });
    renderRoute('/admin/times/t1');
    fireEvent.change(await screen.findByLabelText('Buscar por nome ou celular'), { target: { value: 'bia' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Transferir Bia de Tigres para este time' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /players/p5/team')).toEqual([{ teamId: 't1' }]));
  });

  it('registers a new player straight into the roster', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      ...roster([]),
      'POST /players': (body: { name: string }) => ({ id: 'p9', name: body.name, phone: '+5511912345678', whatsappUrl: 'https://wa.me/5511912345678', team: LEOES }),
    });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Novo jogador no elenco' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '(11) 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar e adicionar' }));
    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST /players')).toEqual([{ name: 'Caio', phone: '(11) 91234-5678', teamId: 't1' }]),
    );
  });

  it('warns when the roster is full and hides the add controls', async () => {
    const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Jogador ${i}` }));
    mockApi({ ...SIGNED_IN, ...roster(players) });
    renderRoute('/admin/times/t1');
    expect(await screen.findByText('Elenco cheio: 20 jogadores ativos. Remova alguém para adicionar outro.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar por nome ou celular')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Novo jogador no elenco' })).toBeNull();
  });

  it('shows the server refusal when the roster filled up meanwhile', async () => {
    mockApi({
      ...SIGNED_IN,
      ...roster([]),
      'POST /players': () =>
        new Response(JSON.stringify({ error: { code: 'ROSTER_FULL', message: 'O time já tem 20 jogadores ativos.' } }), { status: 409 }),
    });
    renderRoute('/admin/times/t1');
    const form = await screen.findByRole('form', { name: 'Novo jogador no elenco' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '(11) 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar e adicionar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O time já tem 20 jogadores ativos.');
  });

  it('goes to the login page and back when the session expired while saving', async () => {
    mockApi({
      ...SIGNED_IN,
      '/teams': [],
      'POST /teams': () =>
        new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' } }), { status: 401 }),
    });
    const { router } = renderRoute('/admin/times');
    await screen.findByRole('form', { name: 'Novo time' });
    fillNewTeam('Panteras', 'PAN');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?voltar=%2Fadmin%2Ftimes');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/admin-teams.test.tsx`
Expected: FAIL — `/admin/times` cai no "Página não encontrada" do admin.

- [ ] **Step 3: Implementar**

`apps/web/src/pages/admin/team/TeamFields.tsx`:
```tsx
import type { TeamInput } from '../../../api/admin';

export const emptyTeam: TeamInput = { name: '', shortName: '', crestUrl: null };

export function TeamFields({ value, onChange }: { value: TeamInput; onChange: (value: TeamInput) => void }) {
  return (
    <>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Sigla (até 5 letras)</span>
        <input
          required
          maxLength={5}
          value={value.shortName}
          onChange={(e) => onChange({ ...value, shortName: e.target.value.toUpperCase() })}
        />
      </label>
      <label className="field">
        <span>Endereço do escudo (opcional)</span>
        <input
          type="url"
          placeholder="https://…"
          value={value.crestUrl ?? ''}
          onChange={(e) => onChange({ ...value, crestUrl: e.target.value.trim() === '' ? null : e.target.value.trim() })}
        />
      </label>
    </>
  );
}
```

`apps/web/src/pages/admin/team/TeamEditForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { updateTeam, type TeamInput } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { TeamRef } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { TeamFields } from './TeamFields';

export function TeamEditForm({ team }: { team: TeamRef }) {
  const [form, setForm] = useState<TeamInput>({ name: team.name, shortName: team.shortName, crestUrl: team.crestUrl });
  const update = useApiMutation((input: TeamInput) => updateTeam(team.id, input));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(form);
  };

  return (
    <form className="form" aria-label="Dados do time" onSubmit={submit}>
      <TeamFields value={form} onChange={setForm} />
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Alterações salvas.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
```

`apps/web/src/pages/admin/team/RosterManager.tsx`:
```tsx
import { MAX_ACTIVE_ROSTER } from '@kickabout/shared';
import { useState, type FormEvent } from 'react';
import { createPlayer, setPlayerTeam } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { useAdminPlayers } from '../../../api/queries';
import type { RosterPlayer } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { QueryState } from '../../../components/QueryState';
import { formatPhone } from '../../../lib/format';

interface Move {
  playerId: string;
  teamId: string | null;
}

export function RosterManager({ teamId, players }: { teamId: string; players: RosterPlayer[] }) {
  const full = players.length >= MAX_ACTIVE_ROSTER;
  const move = useApiMutation((vars: Move) => setPlayerTeam(vars.playerId, vars.teamId));

  return (
    <section>
      <h2>Elenco</h2>
      <p className="muted">
        {players.length} de {MAX_ACTIVE_ROSTER} jogadores ativos.
      </p>
      {full && (
        <p className="notice" role="status">
          Elenco cheio: {MAX_ACTIVE_ROSTER} jogadores ativos. Remova alguém para adicionar outro.
        </p>
      )}
      <FormError error={move.error} />
      {players.length === 0 ? (
        <p className="state">Nenhum jogador no elenco.</p>
      ) : (
        <ul aria-label="Elenco atual">
          {players.map((player) => (
            <li key={player.id} className="admin-row">
              <span className="row-title">{player.name}</span>
              {player.phone && <span className="muted num">{formatPhone(player.phone)}</span>}
              <button
                type="button"
                className="button button-secondary button-small"
                aria-label={`Remover ${player.name} do elenco`}
                disabled={move.isPending}
                onClick={() => move.mutate({ playerId: player.id, teamId: null })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <>
          <AddExistingPlayer
            rosterIds={players.map((player) => player.id)}
            pending={move.isPending}
            onAdd={(playerId) => move.mutate({ playerId, teamId })}
          />
          <NewPlayerForm teamId={teamId} />
        </>
      )}
    </section>
  );
}

function AddExistingPlayer({ rosterIds, pending, onAdd }: { rosterIds: string[]; pending: boolean; onAdd: (playerId: string) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const results = useAdminPlayers(term, term.length >= 2);

  return (
    <section>
      <h3>Adicionar jogador já cadastrado</h3>
      <label className="field">
        <span>Buscar por nome ou celular</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {term.length >= 2 && (
        <QueryState
          query={results}
          isEmpty={(list) => list.every((player) => rosterIds.includes(player.id))}
          empty={<p className="muted">Nenhum jogador encontrado fora deste elenco.</p>}
        >
          {(list) => (
            <ul aria-label="Jogadores encontrados">
              {list
                .filter((player) => !rosterIds.includes(player.id))
                .map((player) => (
                  <li key={player.id} className="admin-row">
                    <span className="row-title">{player.name}</span>
                    <span className="muted">{player.team ? player.team.name : 'Sem time'}</span>
                    <button
                      type="button"
                      className="button button-small"
                      disabled={pending}
                      aria-label={player.team ? `Transferir ${player.name} de ${player.team.name} para este time` : `Adicionar ${player.name}`}
                      onClick={() => onAdd(player.id)}
                    >
                      {player.team ? 'Transferir' : 'Adicionar'}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </QueryState>
      )}
    </section>
  );
}

function NewPlayerForm({ teamId }: { teamId: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const create = useApiMutation(createPlayer);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, phone, teamId },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
        },
      },
    );
  };

  return (
    <form className="form" aria-label="Novo jogador no elenco" onSubmit={submit}>
      <h3>Cadastrar jogador novo</h3>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Celular com DDD</span>
        <input type="tel" inputMode="tel" required placeholder="(11) 98765-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <FormError error={create.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={create.isPending}>
          Cadastrar e adicionar
        </button>
      </div>
    </form>
  );
}
```

`apps/web/src/pages/admin/AdminTeamsPage.tsx`:
```tsx
import { MAX_ACTIVE_ROSTER } from '@kickabout/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createTeam, type TeamInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTeams } from '../../api/queries';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { TeamBadge } from '../../components/TeamBadge';
import { TeamFields, emptyTeam } from './team/TeamFields';

export function AdminTeamsPage() {
  const teams = useTeams();
  const navigate = useNavigate();
  const [form, setForm] = useState<TeamInput>(emptyTeam);
  const create = useApiMutation(createTeam);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form, { onSuccess: (team) => navigate(`/admin/times/${team.id}`) });
  };

  return (
    <>
      <h1>Times</h1>
      <QueryState query={teams} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum time cadastrado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((team) => (
              <li key={team.id}>
                <Link to={`/admin/times/${team.id}`} className="row-link">
                  <TeamBadge team={team} />
                  <span className="row-title">{team.name}</span>
                  <span className="row-meta">
                    {team.playerCount} de {MAX_ACTIVE_ROSTER} jogadores
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <h2>Novo time</h2>
      <form className="form" aria-label="Novo time" onSubmit={submit}>
        <TeamFields value={form} onChange={setForm} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar time
          </button>
        </div>
      </form>
    </>
  );
}
```

`apps/web/src/pages/admin/AdminTeamPage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useRoster } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { TeamBadge } from '../../components/TeamBadge';
import { RosterManager } from './team/RosterManager';
import { TeamEditForm } from './team/TeamEditForm';

export function AdminTeamPage() {
  const { id = '' } = useParams();
  const roster = useRoster(id);

  return (
    <QueryState query={roster}>
      {({ team, players }) => (
        <>
          <header className="team-header">
            <TeamBadge team={team} size="lg" />
            <h1>{team.name}</h1>
          </header>
          <p>
            <Link to={`/times/${team.id}`}>Ver página pública</Link>
          </p>
          <TeamEditForm key={team.id} team={team} />
          <RosterManager teamId={team.id} players={players} />
        </>
      )}
    </QueryState>
  );
}
```

Em `apps/web/src/admin-routes.tsx`, acrescentar os imports das duas páginas e, antes do `*`:
```tsx
  { path: 'times', element: <AdminTeamsPage /> },
  { path: 'times/:id', element: <AdminTeamPage /> },
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 3: Jogadores no admin

**Files:**
- Create: `apps/web/src/pages/admin/AdminPlayersPage.tsx`
- Modify: `apps/web/src/admin-routes.tsx`
- Test: `apps/web/test/admin-players.test.tsx`

**Interfaces:**
- Consumes: `useAdminPlayers`, `useTeams`, `createPlayer`, `updatePlayer`, `setPlayerTeam`, `useApiMutation`, `FormError`, `QueryState`, `formatPhone`.
- Produces: rota `/admin/jogadores`.

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/admin-players.test.tsx`:
```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const players: AdminPlayer[] = [
  { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321', team: LEOES },
  { id: 'p2', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000', team: null },
];
const teams = [
  { ...LEOES, playerCount: 1 },
  { ...TIGRES, playerCount: 0 },
];

describe('admin players', () => {
  it('lists players with phone and team, and searches', async () => {
    mockApi({ ...SIGNED_IN, '/players': players, '/players?search=bia': [players[1]], '/teams': teams });
    renderRoute('/admin/jogadores');
    const items = within(await screen.findByRole('list', { name: 'Jogadores' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ana(11) 98765-4321Leões');
    expect(items[1]).toHaveTextContent('Sem time');
    fireEvent.change(screen.getByLabelText('Buscar por nome ou celular'), { target: { value: 'bia' } });
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Jogadores' })).getAllByRole('listitem')).toHaveLength(1));
  });

  it('edits a player and transfers them to another team', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/players': players,
      '/teams': teams,
      'PATCH /players/p1': { ...players[0]!, name: 'Ana Paula' },
      'PUT /players/p1/team': { playerId: 'p1', teamId: 't2' },
    });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    const form = screen.getByRole('form', { name: 'Editar Ana' });
    await within(form).findByRole('option', { name: 'Tigres' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Ana Paula' } });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('button', { name: 'Editar Ana' })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /players/p1')).toEqual([{ name: 'Ana Paula', phone: '(11) 98765-4321' }]);
    expect(sentBodies(fetchMock, 'PUT /players/p1/team')).toEqual([{ teamId: 't2' }]);
  });

  it('only sends what changed', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/players': players, '/teams': teams, 'PUT /players/p2/team': { playerId: 'p2', teamId: 't1' } });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Bia' }));
    const form = screen.getByRole('form', { name: 'Editar Bia' });
    await within(form).findByRole('option', { name: 'Leões' });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('button', { name: 'Editar Bia' });
    expect(sentBodies(fetchMock, 'PATCH /players/p2')).toEqual([]);
    expect(sentBodies(fetchMock, 'PUT /players/p2/team')).toEqual([{ teamId: 't1' }]);
  });

  it('creates a player without team and shows phone errors from the API', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/players': [],
      '/teams': teams,
      'POST /players': () =>
        new Response(JSON.stringify({ error: { code: 'PHONE_TAKEN', message: 'Já existe um jogador com esse celular.' } }), { status: 409 }),
    });
    renderRoute('/admin/jogadores');
    const form = await screen.findByRole('form', { name: 'Novo jogador' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.change(within(form).getByLabelText('Celular com DDD'), { target: { value: '11 91234-5678' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar jogador' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Já existe um jogador com esse celular.');
    expect(sentBodies(fetchMock, 'POST /players')).toEqual([{ name: 'Caio', phone: '11 91234-5678', teamId: null }]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/admin-players.test.tsx`
Expected: FAIL — `/admin/jogadores` cai no "Página não encontrada".

- [ ] **Step 3: Implementar**

`apps/web/src/pages/admin/AdminPlayersPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { createPlayer, setPlayerTeam, updatePlayer } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useAdminPlayers, useTeams } from '../../api/queries';
import type { AdminPlayer, TeamSummary } from '../../api/types';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { formatPhone } from '../../lib/format';

export function AdminPlayersPage() {
  const [search, setSearch] = useState('');
  const players = useAdminPlayers(search.trim());
  const teams = useTeams();
  const [editing, setEditing] = useState<string | null>(null);
  const teamList = teams.data ?? [];

  return (
    <>
      <h1>Jogadores</h1>
      <label className="field">
        <span>Buscar por nome ou celular</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <QueryState query={players} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum jogador encontrado.</p>}>
        {(list) => (
          <ul aria-label="Jogadores">
            {list.map((player) =>
              editing === player.id ? (
                <li key={player.id}>
                  <PlayerEditor player={player} teams={teamList} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={player.id} className="admin-row">
                  <Link to={`/jogadores/${player.id}`} className="row-title">
                    {player.name}
                  </Link>
                  <span className="muted num">{formatPhone(player.phone)}</span>
                  <span className="muted">{player.team?.name ?? 'Sem time'}</span>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    aria-label={`Editar ${player.name}`}
                    onClick={() => setEditing(player.id)}
                  >
                    Editar
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </QueryState>
      <NewPlayer teams={teamList} />
    </>
  );
}

function TeamSelect({ label, teams, value, onChange }: { label: string; teams: TeamSummary[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem time</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlayerEditor({ player, teams, onDone }: { player: AdminPlayer; teams: TeamSummary[]; onDone: () => void }) {
  const initialPhone = formatPhone(player.phone);
  const [name, setName] = useState(player.name);
  const [phone, setPhone] = useState(initialPhone);
  const [teamId, setTeamId] = useState(player.team?.id ?? '');
  const save = useApiMutation(async () => {
    if (name !== player.name || phone !== initialPhone) await updatePlayer(player.id, { name, phone });
    const target = teamId === '' ? null : teamId;
    if (target !== (player.team?.id ?? null)) await setPlayerTeam(player.id, target);
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(undefined, { onSuccess: onDone });
  };

  return (
    <form className="form" aria-label={`Editar ${player.name}`} onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Celular com DDD</span>
        <input type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <TeamSelect label="Time" teams={teams} value={teamId} onChange={setTeamId} />
      <FormError error={save.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={save.isPending}>
          Salvar
        </button>
        <button type="button" className="button button-secondary" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NewPlayer({ teams }: { teams: TeamSummary[] }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [teamId, setTeamId] = useState('');
  const create = useApiMutation(createPlayer);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, phone, teamId: teamId === '' ? null : teamId },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
        },
      },
    );
  };

  return (
    <>
      <h2>Novo jogador</h2>
      <form className="form" aria-label="Novo jogador" onSubmit={submit}>
        <label className="field">
          <span>Nome</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Celular com DDD</span>
          <input type="tel" inputMode="tel" required placeholder="(11) 98765-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <TeamSelect label="Time (opcional)" teams={teams} value={teamId} onChange={setTeamId} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar jogador
          </button>
        </div>
      </form>
    </>
  );
}
```

Em `apps/web/src/admin-routes.tsx`, acrescentar o import e, antes do `*`:
```tsx
  { path: 'jogadores', element: <AdminPlayersPage /> },
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 4: Campeonatos no admin (criar, inscrever, iniciar, acompanhar, encerrar)

**Files:**
- Create: `apps/web/src/components/ConfirmButton.tsx`
- Create: `apps/web/src/pages/admin/AdminTournamentsPage.tsx`, `apps/web/src/pages/admin/AdminTournamentPage.tsx`
- Create: `apps/web/src/pages/admin/tournament/TournamentFields.tsx`, `apps/web/src/pages/admin/tournament/EntriesEditor.tsx`
- Modify: `apps/web/src/lib/format.ts`, `apps/web/src/pages/tournament/FixturesTab.tsx`, `apps/web/src/admin-routes.tsx`
- Test: `apps/web/test/admin-tournaments.test.tsx`

**Interfaces:**
- Consumes: `useTournaments`, `useTournament`, `useTeams`, `createTournament`, `updateTournament`, `setEntries`, `startTournament`, `finishTournament`, `useApiMutation`, `FormError`, `FORMAT_LABEL`, `STATUS_LABEL`, `FixturesTab`.
- Produces:
  - `ConfirmButton({ label, confirmLabel, onConfirm, disabled?, danger?, name? })` — 1º clique mostra `confirmLabel` + "Cancelar"; `name` é o `aria-label` do 1º botão
  - `MIN_TEAMS: Record<TournamentFormat, number>` em `lib/format.ts` (espelha `apps/api/src/tournaments/stage.ts`)
  - `FixturesTab({ tournament, fixtureUrl? })` — `fixtureUrl(matchId)` define o link de cada confronto (padrão: página pública)
  - rotas `/admin/campeonatos` e `/admin/campeonatos/:id`

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/admin-tournaments.test.tsx`:
```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureListItem, Tournament } from '../src/api/types';
import { FALCOES, LEOES, SIGNED_IN, TIGRES, tournamentListItem } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

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

const teams = [LEOES, TIGRES, FALCOES].map((t) => ({ ...t, playerCount: 6 }));

const pending: FixtureListItem = {
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  isKnockout: true,
  status: 'pending',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: null,
  scoreB: null,
};

const bracket = {
  data: { stage: [], group: [{ id: 0, stage_id: 0, number: 1 }], round: [{ id: 0, group_id: 0, number: 1 }], match: [], match_game: [], participant: [] },
};

describe('admin tournaments', () => {
  it('creates a tournament with the options of its format', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments': [tournamentListItem()],
      '/teams': teams,
      'POST /tournaments': (body: { name: string }) => draft({ id: 'c9', name: body.name, entries: [] }),
      '/tournaments/c9': draft({ id: 'c9', name: 'Copa Novembro', entries: [] }),
    });
    renderRoute('/admin/campeonatos');
    expect(await screen.findByRole('link', { name: /Copa Outubro/ })).toHaveAttribute('href', '/admin/campeonatos/c1');
    const form = screen.getByRole('form', { name: 'Novo campeonato' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Novembro' } });
    expect(within(form).getByLabelText('Disputa de 3º lugar')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'round_robin' } });
    expect(within(form).queryByLabelText('Disputa de 3º lugar')).toBeNull();
    fireEvent.change(within(form).getByLabelText('Turnos'), { target: { value: 'double' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar campeonato' }));
    expect(await screen.findByRole('heading', { name: 'Copa Novembro', level: 1 })).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST /tournaments')).toEqual([
      { name: 'Copa Novembro', format: 'round_robin', options: { roundRobinMode: 'double' } },
    ]);
  });

  it('saves the configuration of a tournament in preparation', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft(),
      '/teams': teams,
      'PATCH /tournaments/c1': (body: object) => ({ ...draft(), ...body }),
    });
    renderRoute('/admin/campeonatos/c1');
    const form = await screen.findByRole('form', { name: 'Configuração' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Outubro 2026' } });
    fireEvent.click(within(form).getByLabelText('Disputa de 3º lugar'));
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar configuração' }));
    expect(await screen.findByText('Configuração salva.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, 'PATCH /tournaments/c1')).toEqual([
      {
        name: 'Copa Outubro 2026',
        format: 'single_elimination',
        options: { consolationFinal: true, grandFinalReset: false, roundRobinMode: 'simple' },
      },
    ]);
  });

  it('orders the seeds and saves the entries', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/tournaments/c1': draft(), '/teams': teams, 'PUT /tournaments/c1/entries': () => draft() });
    renderRoute('/admin/campeonatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: 'Descer Leões' }));
    fireEvent.change(await screen.findByLabelText('Inscrever time'), { target: { value: 't3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar inscrições' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'PUT /tournaments/c1/entries')).toEqual([{ teamIds: ['t2', 't1', 't3'] }]));
  });

  it('starts only with saved entries and enough teams, after confirming', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft(),
      '/teams': teams,
      'POST /tournaments/c1/start': () => draft({ status: 'in_progress' }),
    });
    renderRoute('/admin/campeonatos/c1');
    await screen.findByLabelText('Inscrever time');
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Tirar Tigres' }));
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeDisabled();
    expect(screen.getByText('Salve as inscrições antes de iniciar.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Inscrever time'), { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar campeonato' }));
    expect(sentBodies(fetchMock, 'POST /tournaments/c1/start')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar início: a chave não pode ser refeita' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'POST /tournaments/c1/start')).toHaveLength(1));
  });

  it('links fixtures to the result screen and explains why it cannot finish yet', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft({ status: 'in_progress', startedAt: '2026-10-02T00:00:00.000Z' }),
      '/tournaments/c1/bracket': bracket,
      '/tournaments/c1/fixtures': [pending],
      'POST /tournaments/c1/finish': () =>
        new Response(JSON.stringify({ error: { code: 'TOURNAMENT_NOT_COMPLETE', message: 'Ainda há confrontos sem resultado.' } }), {
          status: 409,
        }),
    });
    renderRoute('/admin/campeonatos/c1');
    expect(await screen.findByRole('link', { name: /Leões.*A jogar.*Tigres/ })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/0');
    expect(screen.queryByRole('form', { name: 'Configuração' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar campeonato' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda há confrontos sem resultado.');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/admin-tournaments.test.tsx`
Expected: FAIL — `/admin/campeonatos` cai no "Página não encontrada".

- [ ] **Step 3: Implementar componentes de apoio**

`apps/web/src/components/ConfirmButton.tsx`:
```tsx
import { useState } from 'react';

interface Props {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Nome acessível do 1º botão, quando o rótulo visível se repete na página. */
  name?: string;
}

/** Ação irreversível em dois cliques, sem caixa de diálogo do navegador. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, danger, name }: Props) {
  const [asking, setAsking] = useState(false);
  const className = danger ? 'button button-danger' : 'button';
  if (!asking) {
    return (
      <button type="button" className={className} aria-label={name} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="button button-secondary" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  );
}
```

Em `apps/web/src/lib/format.ts`, depois de `STATUS_LABEL`:
```ts
/** Mínimo de times para iniciar (igual a `apps/api/src/tournaments/stage.ts`). */
export const MIN_TEAMS: Record<TournamentFormat, number> = {
  single_elimination: 2,
  double_elimination: 3,
  round_robin: 2,
};
```

Em `apps/web/src/pages/tournament/FixturesTab.tsx`:
- trocar `export function FixturesTab({ tournament }: { tournament: Tournament }) {` por:
```tsx
interface Props {
  tournament: Tournament;
  /** Endereço de cada confronto (o admin aponta para a tela de lançamento). */
  fixtureUrl?: (matchId: number) => string;
}

export function FixturesTab({ tournament, fixtureUrl = (matchId) => `/campeonatos/${tournament.id}/jogos/${matchId}` }: Props) {
```
- trocar ``to={`/campeonatos/${tournament.id}/jogos/${fixture.matchId}`}`` por `to={fixtureUrl(fixture.matchId)}`.

`apps/web/src/pages/admin/tournament/TournamentFields.tsx`:
```tsx
import type { TournamentInput } from '../../../api/admin';
import type { TournamentFormat, TournamentOptions } from '../../../api/types';
import { FORMAT_LABEL } from '../../../lib/format';

const FORMATS: TournamentFormat[] = ['single_elimination', 'double_elimination', 'round_robin'];

/** Nome, formato e só as opções que valem para o formato escolhido. */
export function TournamentFields({ value, onChange }: { value: TournamentInput; onChange: (value: TournamentInput) => void }) {
  const set = (patch: Partial<TournamentInput>) => onChange({ ...value, ...patch });
  const setOption = (patch: Partial<TournamentOptions>) => set({ options: { ...value.options, ...patch } });

  return (
    <>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={80} value={value.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>Formato</span>
        <select value={value.format} onChange={(e) => set({ format: e.target.value as TournamentFormat })}>
          {FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_LABEL[format]}
            </option>
          ))}
        </select>
      </label>
      {value.format === 'single_elimination' && (
        <label className="check">
          <input
            type="checkbox"
            checked={value.options.consolationFinal ?? false}
            onChange={(e) => setOption({ consolationFinal: e.target.checked })}
          />
          <span>Disputa de 3º lugar</span>
        </label>
      )}
      {value.format === 'double_elimination' && (
        <label className="check">
          <input
            type="checkbox"
            checked={value.options.grandFinalReset ?? false}
            onChange={(e) => setOption({ grandFinalReset: e.target.checked })}
          />
          <span>Final com reset (quem vem da chave inferior precisa vencer duas vezes)</span>
        </label>
      )}
      {value.format === 'round_robin' && (
        <label className="field">
          <span>Turnos</span>
          <select
            value={value.options.roundRobinMode ?? 'simple'}
            onChange={(e) => setOption({ roundRobinMode: e.target.value as TournamentOptions['roundRobinMode'] })}
          >
            <option value="simple">Turno único</option>
            <option value="double">Ida e volta</option>
          </select>
        </label>
      )}
    </>
  );
}
```

`apps/web/src/pages/admin/tournament/EntriesEditor.tsx`:
```tsx
import { useState } from 'react';
import { setEntries, startTournament } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { useTeams } from '../../../api/queries';
import type { Tournament } from '../../../api/types';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { FormError } from '../../../components/FormError';
import { MIN_TEAMS } from '../../../lib/format';

/** Times inscritos em ordem de seed; iniciar só com as inscrições salvas. */
export function EntriesEditor({ tournament }: { tournament: Tournament }) {
  const teams = useTeams();
  const saved = tournament.entries.map((entry) => entry.team.id);
  const [ids, setIds] = useState<string[]>(saved);
  const save = useApiMutation((teamIds: string[]) => setEntries(tournament.id, teamIds));
  const start = useApiMutation(() => startTournament(tournament.id));

  const dirty = ids.join() !== saved.join();
  const min = MIN_TEAMS[tournament.format];
  const names = new Map<string, string>([
    ...(teams.data ?? []).map((team) => [team.id, team.name] as const),
    ...tournament.entries.map((entry) => [entry.team.id, entry.team.name] as const),
  ]);
  const available = (teams.data ?? []).filter((team) => !ids.includes(team.id));

  const swap = (from: number, to: number) =>
    setIds((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });

  return (
    <section aria-label="Times inscritos">
      <h2>Times inscritos</h2>
      <p className="muted">A ordem define os seeds: o primeiro é o cabeça de chave. Mínimo de {min} times para iniciar.</p>
      {ids.length === 0 ? (
        <p className="state">Nenhum time inscrito.</p>
      ) : (
        <ol aria-label="Ordem dos seeds">
          {ids.map((teamId, index) => {
            const name = names.get(teamId) ?? teamId;
            return (
              <li key={teamId} className="admin-row">
                <span className="muted num">{index + 1}</span>
                <span className="row-title">{name}</span>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Subir ${name}`}
                  disabled={index === 0}
                  onClick={() => swap(index, index - 1)}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Descer ${name}`}
                  disabled={index === ids.length - 1}
                  onClick={() => swap(index, index + 1)}
                >
                  Descer
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Tirar ${name}`}
                  onClick={() => setIds((current) => current.filter((id) => id !== teamId))}
                >
                  Tirar
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {available.length > 0 && (
        <label className="field">
          <span>Inscrever time</span>
          <select value="" onChange={(e) => e.target.value && setIds((current) => [...current, e.target.value])}>
            <option value="">Escolha um time…</option>
            {available.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <FormError error={save.error ?? start.error} />
      <div className="actions">
        <button type="button" className="button button-secondary" disabled={!dirty || save.isPending} onClick={() => save.mutate(ids)}>
          Salvar inscrições
        </button>
        <ConfirmButton
          label="Iniciar campeonato"
          confirmLabel="Confirmar início: a chave não pode ser refeita"
          disabled={dirty || ids.length < min || start.isPending}
          onConfirm={() => start.mutate(undefined)}
        />
      </div>
      {dirty && <p className="muted">Salve as inscrições antes de iniciar.</p>}
    </section>
  );
}
```

- [ ] **Step 4: Implementar as páginas**

`apps/web/src/pages/admin/AdminTournamentsPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createTournament, type TournamentInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTournaments } from '../../api/queries';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { TournamentFields } from './tournament/TournamentFields';

export function AdminTournamentsPage() {
  const tournaments = useTournaments();
  const navigate = useNavigate();
  const [form, setForm] = useState<TournamentInput>({ name: '', format: 'single_elimination', options: {} });
  const create = useApiMutation(createTournament);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form, { onSuccess: (tournament) => navigate(`/admin/campeonatos/${tournament.id}`) });
  };

  return (
    <>
      <h1>Campeonatos</h1>
      <QueryState query={tournaments} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum campeonato criado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((tournament) => (
              <li key={tournament.id}>
                <Link to={`/admin/campeonatos/${tournament.id}`} className="row-link">
                  <span className="row-title">{tournament.name}</span>
                  <span className="row-meta">
                    {FORMAT_LABEL[tournament.format]}, {STATUS_LABEL[tournament.status].toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <h2>Novo campeonato</h2>
      <form className="form" aria-label="Novo campeonato" onSubmit={submit}>
        <TournamentFields value={form} onChange={setForm} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Criar campeonato
          </button>
        </div>
      </form>
    </>
  );
}
```

`apps/web/src/pages/admin/AdminTournamentPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { finishTournament, updateTournament, type TournamentInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTournament } from '../../api/queries';
import type { Tournament } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { FixturesTab } from '../tournament/FixturesTab';
import { EntriesEditor } from './tournament/EntriesEditor';
import { TournamentFields } from './tournament/TournamentFields';

export function AdminTournamentPage() {
  const { id = '' } = useParams();
  const tournament = useTournament(id);

  return (
    <QueryState query={tournament}>
      {(t) => (
        <>
          <header className="page-header">
            <h1>{t.name}</h1>
            <p className="muted">
              {FORMAT_LABEL[t.format]}, {STATUS_LABEL[t.status].toLowerCase()}. <Link to={`/campeonatos/${t.id}`}>Ver página pública</Link>
            </p>
          </header>
          {t.status === 'draft' ? (
            <>
              <SettingsForm key={t.id} tournament={t} />
              <EntriesEditor key={t.entries.map((entry) => entry.team.id).join()} tournament={t} />
            </>
          ) : (
            <>
              <RenameForm key={t.id} tournament={t} />
              <h2>Confrontos</h2>
              <p className="muted">Abra um confronto para lançar ou corrigir o resultado.</p>
              <FixturesTab tournament={t} fixtureUrl={(matchId) => `/admin/campeonatos/${t.id}/jogos/${matchId}`} />
              {t.status === 'in_progress' ? (
                <FinishSection tournament={t} />
              ) : (
                <p className="notice">Campeonato encerrado. Os títulos já foram gerados.</p>
              )}
            </>
          )}
        </>
      )}
    </QueryState>
  );
}

function SettingsForm({ tournament }: { tournament: Tournament }) {
  const [form, setForm] = useState<TournamentInput>({ name: tournament.name, format: tournament.format, options: tournament.options });
  const update = useApiMutation((input: TournamentInput) => updateTournament(tournament.id, input));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(form);
  };

  return (
    <form className="form" aria-label="Configuração" onSubmit={submit}>
      <h2>Configuração</h2>
      <TournamentFields value={form} onChange={setForm} />
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Configuração salva.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar configuração
        </button>
      </div>
    </form>
  );
}

function RenameForm({ tournament }: { tournament: Tournament }) {
  const [name, setName] = useState(tournament.name);
  const update = useApiMutation((value: string) => updateTournament(tournament.id, { name: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(name);
  };

  return (
    <form className="form" aria-label="Nome do campeonato" onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Nome salvo.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar nome
        </button>
      </div>
    </form>
  );
}

function FinishSection({ tournament }: { tournament: Tournament }) {
  const finish = useApiMutation(() => finishTournament(tournament.id));
  return (
    <section>
      <h2>Encerrar</h2>
      <p className="muted">Com todos os confrontos lançados, encerre para gerar os títulos (campeão, vice e 3º).</p>
      <FormError error={finish.error} />
      <ConfirmButton
        label="Encerrar campeonato"
        confirmLabel="Confirmar encerramento"
        danger
        disabled={finish.isPending}
        onConfirm={() => finish.mutate(undefined)}
      />
    </section>
  );
}
```

Em `apps/web/src/admin-routes.tsx`, acrescentar os imports e, antes do `*`:
```tsx
  { path: 'campeonatos', element: <AdminTournamentsPage /> },
  { path: 'campeonatos/:id', element: <AdminTournamentPage /> },
```

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS (incluindo os do Plano 3a que usam `FixturesTab`); sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/web
```

---

### Task 5: Lógica do formulário de resultado

**Files:**
- Create: `apps/web/src/lib/result-form.ts`
- Test: `apps/web/test/result-form.test.ts`

**Interfaces:**
- Consumes: `computeFixtureScore`, `DuelInput`, `FixtureScore` (`@kickabout/shared`); `DuelView`, `PlayerRef`.
- Produces:
  - `interface DuelRow { playerAId; playerBId; goalsA; goalsB; penaltiesA; penaltiesB }` (todos `string`; vazio = não preenchido)
  - `TIEBREAK_INDEX = 5`, `emptyRow()`, `rowsFromDuels(duels): DuelRow[]` (sempre 6 linhas, índice = ordem − 1)
  - `rowToDuel(row, order): DuelInput | null` — exige os dois jogadores e gols inteiros de 0 a 99; pênaltis só no 6º empatado
  - `playerOptions(roster, rows, side: 'A' | 'B', index): PlayerRef[]`
  - `tiebreakNeeded(rows, isKnockout): boolean`, `penaltiesNeeded(row): boolean`
  - `duelsToSend(rows, isKnockout): DuelInput[]`, `liveScore(rows, isKnockout): FixtureScore`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/result-form.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  duelsToSend,
  emptyRow,
  liveScore,
  penaltiesNeeded,
  playerOptions,
  rowToDuel,
  rowsFromDuels,
  tiebreakNeeded,
  type DuelRow,
} from '../src/lib/result-form';

const row = (a: string, b: string, goalsA: string, goalsB: string, penaltiesA = '', penaltiesB = ''): DuelRow => ({
  playerAId: a,
  playerBId: b,
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});
const five = (scores: [string, string][]) => scores.map(([goalsA, goalsB], i) => row(`a${i + 1}`, `b${i + 1}`, goalsA, goalsB));
const roster = (side: string) => Array.from({ length: 6 }, (_, i) => ({ id: `${side}${i + 1}`, name: `${side}${i + 1}` }));
const TIED: [string, string][] = [['1', '0'], ['1', '0'], ['0', '1'], ['0', '1'], ['2', '2']];
const NOT_TIED: [string, string][] = [['1', '0'], ['1', '0'], ['1', '0'], ['0', '1'], ['2', '2']];

describe('result form', () => {
  it('turns saved duels into six editable rows', () => {
    const rows = rowsFromDuels([
      { order: 6, playerA: { id: 'a1', name: 'A' }, playerB: { id: 'b1', name: 'B' }, goalsA: 1, goalsB: 1, penaltiesA: 5, penaltiesB: 4 },
    ]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual(emptyRow());
    expect(rows[5]).toEqual(row('a1', 'b1', '1', '1', '5', '4'));
  });

  it('only turns rows with both players and a valid score into duels', () => {
    expect(rowToDuel(row('a1', 'b1', '2', '0'), 1)).toEqual({ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 0 });
    expect(rowToDuel(row('a1', '', '2', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', '2a', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', '100', '0'), 1)).toBeNull();
    expect(rowToDuel(row('a1', 'b1', ' 3 ', '0'), 1)).toMatchObject({ goalsA: 3 });
    expect(rowToDuel(row('a1', 'b1', '2', '0', '5', '4'), 6)).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 0 });
  });

  it('hides players already picked by the same team in duels 1 to 5', () => {
    const rows = [row('a1', 'b1', '', ''), row('a2', '', '', ''), emptyRow(), emptyRow(), emptyRow(), emptyRow()];
    expect(playerOptions(roster('a'), rows, 'A', 1).map((p) => p.id)).toEqual(['a2', 'a3', 'a4', 'a5', 'a6']);
    expect(playerOptions(roster('b'), rows, 'B', 1).map((p) => p.id)).toEqual(['b2', 'b3', 'b4', 'b5', 'b6']);
    expect(playerOptions(roster('a'), rows, 'A', 5)).toHaveLength(6);
  });

  it('needs the tiebreak only in a tied knockout with all five duels', () => {
    const tied = [...five(TIED), emptyRow()];
    expect(tiebreakNeeded(tied, true)).toBe(true);
    expect(tiebreakNeeded(tied, false)).toBe(false);
    expect(tiebreakNeeded([...tied.slice(0, 4), emptyRow(), emptyRow()], true)).toBe(false);
    expect(tiebreakNeeded([...five(NOT_TIED), emptyRow()], true)).toBe(false);
  });

  it('requires penalties when the tiebreak ends level and lets them decide the score', () => {
    const tiebreak = row('a1', 'b1', '1', '1', '5', '4');
    expect(penaltiesNeeded(tiebreak)).toBe(true);
    expect(penaltiesNeeded(row('a1', 'b1', '2', '1'))).toBe(false);
    expect(penaltiesNeeded(emptyRow())).toBe(false);
    const rows = [...five(TIED), tiebreak];
    expect(duelsToSend(rows, true)[5]).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 1, penaltiesA: 5, penaltiesB: 4 });
    expect(liveScore(rows, true)).toEqual({ scoreA: 3, scoreB: 2, winner: 'A' });
  });

  it('drops a leftover tiebreak once the regular duels are no longer tied', () => {
    const rows = [...five(NOT_TIED), row('a1', 'b1', '1', '0')];
    expect(duelsToSend(rows, true)).toHaveLength(5);
    expect(liveScore(rows, true)).toEqual({ scoreA: 3, scoreB: 1, winner: 'A' });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/result-form.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/result-form"`.

- [ ] **Step 3: Implementar**

`apps/web/src/lib/result-form.ts`:
```ts
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
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 6: Tela de lançamento de resultado

**Files:**
- Create: `apps/web/src/pages/admin/AdminFixturePage.tsx`, `apps/web/src/pages/admin/ResultForm.tsx`
- Modify: `apps/web/src/admin-routes.tsx`, `apps/web/src/pages/FixturePage.tsx`
- Test: `apps/web/test/admin-result.test.tsx`

**Interfaces:**
- Consumes: `useFixture`, `useTournament`, `useTournamentFixtures`, `useMe`, `saveResult`, `useApiMutation`, `ApiError`, `FormError`, `Scoreboard`, `validateFixtureResult` (`@kickabout/shared`), tudo de `lib/result-form.ts`.
- Produces: rota `/admin/campeonatos/:id/jogos/:matchId`; atalho "Lançar resultado"/"Corrigir resultado" na página pública do confronto, visível só para o admin.

Comportamento (spec 6):
- Duelos 1 a 5: seletor de jogador de cada time (quem já foi escolhido em outro duelo some da lista), gols de cada lado. Rótulos: `"<N>º duelo: jogador de <time>"`, `"<N>º duelo: gols de <time>"`.
- Placar do confronto ao vivo no `Scoreboard`.
- Mata-mata empatado depois dos 5 duelos: aparece o 6º (`"Desempate: …"`, qualquer jogador do elenco). 6º empatado: aparecem `"Pênaltis de <time>"`.
- "Salvar rascunho" (só enquanto o confronto não foi confirmado) envia os duelos completos com `mode: 'draft'`. "Confirmar resultado" roda `validateFixtureResult` antes; com problemas, lista as mensagens e não envia.
- Uma requisição por vez: o envio é bloqueado por um `ref` até a resposta (botões também ficam desabilitados).
- `RESULT_LOCKED`: além da mensagem, links para os confrontos de `details.blockingMatchIds` com o nome dos times.
- Campeonato fora de `in_progress`: aviso no lugar do formulário.

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/admin-result.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDetail, Tournament } from '../src/api/types';
import { FALCOES, LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies, type ApiRoutes } from './utils';

const rosterA = Array.from({ length: 6 }, (_, i) => ({ id: `a${i + 1}`, name: `Ana ${i + 1}` }));
const rosterB = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, name: `Bia ${i + 1}` }));
const RESULT = 'PUT /tournaments/c1/fixtures/0/result';

const tournament = (status: Tournament['status']): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status,
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '',
  startedAt: '',
  finishedAt: null,
  entries: [],
});

const fixture = (overrides: Partial<FixtureDetail> = {}): FixtureDetail => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  isKnockout: true,
  status: 'pending',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: null,
  scoreB: null,
  duels: [],
  rosterA,
  rosterB,
  ...overrides,
});

function setup(detail: FixtureDetail, extra: ApiRoutes = {}, status: Tournament['status'] = 'in_progress') {
  const fetchMock = mockApi({
    ...SIGNED_IN,
    '/tournaments/c1': tournament(status),
    '/tournaments/c1/fixtures/0': detail,
    '/tournaments/c1/fixtures': [],
    [RESULT]: (body: { mode: string }) => ({ ...detail, status: body.mode === 'final' ? 'completed' : 'draft' }),
    ...extra,
  });
  renderRoute('/admin/campeonatos/c1/jogos/0');
  return fetchMock;
}

function fillDuel(label: string, a: string, b: string, goalsA: string, goalsB: string) {
  fireEvent.change(screen.getByLabelText(`${label}: jogador de Leões`), { target: { value: a } });
  fireEvent.change(screen.getByLabelText(`${label}: gols de Leões`), { target: { value: goalsA } });
  fireEvent.change(screen.getByLabelText(`${label}: gols de Tigres`), { target: { value: goalsB } });
  fireEvent.change(screen.getByLabelText(`${label}: jogador de Tigres`), { target: { value: b } });
}

const fillRegular = (scores: [string, string][]) =>
  scores.forEach(([goalsA, goalsB], i) => fillDuel(`${i + 1}º duelo`, `a${i + 1}`, `b${i + 1}`, goalsA, goalsB));

const ready = () => screen.findByLabelText('1º duelo: jogador de Leões');
const scoreText = () => document.querySelector('.scoreboard-score')?.textContent ?? '';
const WIN_3_2: [string, string][] = [['1', '0'], ['1', '0'], ['1', '0'], ['0', '1'], ['0', '1']];

describe('result entry', () => {
  it('computes the score live and confirms the result', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular(WIN_3_2);
    expect(scoreText()).toMatch(/3\s*×\s*a\s*2/);
    expect(screen.queryByLabelText('Desempate: jogador de Leões')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByText('Resultado confirmado.')).toBeInTheDocument();
    const [body] = sentBodies(fetchMock, RESULT) as { mode: string; duels: unknown[] }[];
    expect(body?.mode).toBe('final');
    expect(body?.duels).toHaveLength(5);
    expect(body?.duels[0]).toEqual({ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 0 });
  });

  it('removes players already chosen from the other duels of the same team', async () => {
    setup(fixture());
    fireEvent.change(await ready(), { target: { value: 'a1' } });
    expect(within(screen.getByLabelText('2º duelo: jogador de Leões')).queryByRole('option', { name: 'Ana 1' })).toBeNull();
    expect(within(screen.getByLabelText('1º duelo: jogador de Leões')).getByRole('option', { name: 'Ana 1' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('2º duelo: jogador de Tigres')).getByRole('option', { name: 'Bia 1' })).toBeInTheDocument();
  });

  it('asks for the tiebreak duel and then penalties when a knockout is tied', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular([['1', '0'], ['1', '0'], ['0', '1'], ['0', '1'], ['2', '2']]);
    expect(scoreText()).toMatch(/2\s*×\s*a\s*2/);
    fillDuel('Desempate', 'a1', 'b1', '1', '1');
    fireEvent.change(screen.getByLabelText('Pênaltis de Leões'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Pênaltis de Tigres'), { target: { value: '3' } });
    expect(scoreText()).toMatch(/3\s*×\s*a\s*2/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    await screen.findByText('Resultado confirmado.');
    const [body] = sentBodies(fetchMock, RESULT) as { duels: unknown[] }[];
    expect(body?.duels[5]).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 1, penaltiesA: 4, penaltiesB: 3 });
  });

  it('checks the rules before confirming an incomplete result', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillDuel('1º duelo', 'a1', 'b1', '1', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Para confirmar o resultado, os duelos 1 a 5 precisam estar preenchidos.');
    expect(sentBodies(fetchMock, RESULT)).toHaveLength(0);
  });

  it('saves a draft with only the complete duels', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillDuel('1º duelo', 'a1', 'b1', '2', '1');
    fireEvent.change(screen.getByLabelText('2º duelo: jogador de Leões'), { target: { value: 'a2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, RESULT)).toEqual([
      { mode: 'draft', duels: [{ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 1 }] },
    ]);
  });

  it('sends a single request when confirm is clicked twice', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular(WIN_3_2);
    const confirm = screen.getByRole('button', { name: 'Confirmar resultado' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await screen.findByText('Resultado confirmado.');
    expect(sentBodies(fetchMock, RESULT)).toHaveLength(1);
  });

  it('prefills a confirmed fixture and explains when a knockout correction is locked', async () => {
    const duels = [1, 2, 3, 4, 5].map((order) => ({
      order,
      playerA: rosterA[order - 1]!,
      playerB: rosterB[order - 1]!,
      goalsA: order <= 3 ? 1 : 0,
      goalsB: order <= 3 ? 0 : 1,
      penaltiesA: null,
      penaltiesB: null,
    }));
    setup(fixture({ status: 'completed', scoreA: 3, scoreB: 2, duels }), {
      '/tournaments/c1/fixtures': [
        { matchId: 2, groupNumber: 1, roundNumber: 2, number: 1, isKnockout: true, status: 'completed', teamA: LEOES, teamB: FALCOES, scoreA: 3, scoreB: 1 },
      ],
      [RESULT]: () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'RESULT_LOCKED',
              message: 'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Desfaça-os primeiro.',
              details: { blockingMatchIds: [2] },
            },
          }),
          { status: 409 },
        ),
    });
    expect(await ready()).toHaveValue('a1');
    expect(screen.getByLabelText('5º duelo: gols de Tigres')).toHaveValue('1');
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull();
    fireEvent.change(screen.getByLabelText('5º duelo: gols de Tigres'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('há confrontos seguintes com resultado lançado');
    expect(await screen.findByRole('link', { name: 'Leões × Falcões' })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/2');
  });

  it('only accepts results while the tournament is in progress', async () => {
    setup(fixture(), {}, 'finished');
    expect(await screen.findByText('Só é possível lançar resultados com o campeonato em andamento.')).toBeInTheDocument();
  });

  it('offers admins a shortcut from the public fixture page', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament('in_progress'),
      '/tournaments/c1/bracket': { data: null },
      '/tournaments/c1/fixtures/0': fixture({ status: 'completed', scoreA: 3, scoreB: 2 }),
    });
    renderRoute('/campeonatos/c1/jogos/0');
    expect(await screen.findByRole('link', { name: 'Corrigir resultado' })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/0');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/admin-result.test.tsx`
Expected: FAIL — a rota do admin não existe e o atalho público não aparece.

- [ ] **Step 3: Implementar o formulário**

`apps/web/src/pages/admin/ResultForm.tsx`:
```tsx
import { validateFixtureResult, type DuelInput } from '@kickabout/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { saveResult } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useApiMutation } from '../../api/mutation';
import { useTournamentFixtures } from '../../api/queries';
import type { FixtureDetail, PlayerRef } from '../../api/types';
import { FormError } from '../../components/FormError';
import { Scoreboard } from '../../components/Scoreboard';
import {
  TIEBREAK_INDEX,
  duelsToSend,
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

export function ResultForm({ tournamentId, fixture, rosterA, rosterB }: Props) {
  const [rows, setRows] = useState(() => rowsFromDuels(fixture.duels));
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState<Mode | null>(null);
  const busy = useRef(false);
  const fixtures = useTournamentFixtures(tournamentId);
  const save = useApiMutation((vars: { mode: Mode; duels: DuelInput[] }) => saveResult(tournamentId, fixture.matchId, vars.mode, vars.duels));

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

  const blocking =
    save.error instanceof ApiError && save.error.code === 'RESULT_LOCKED'
      ? ((save.error.details as { blockingMatchIds?: number[] } | undefined)?.blockingMatchIds ?? [])
      : [];
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
      <FormError error={save.error} />
      {blocking.length > 0 && (
        <ul className="list" aria-label="Confrontos que precisam ser desfeitos antes">
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
        <button type="submit" className="button" disabled={save.isPending}>
          Confirmar resultado
        </button>
      </div>
      <p className="muted">O rascunho guarda só os duelos completos (jogadores e placar) e não conta nas estatísticas nem na chave.</p>
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
      aria-label={`${label}: gols de ${side === 'A' ? teamA : teamB}`}
      inputMode="numeric"
      maxLength={2}
      value={side === 'A' ? row.goalsA : row.goalsB}
      onChange={(e) => onChange(side === 'A' ? { goalsA: e.target.value } : { goalsB: e.target.value })}
    />
  );
  const player = (side: 'A' | 'B') => (
    <select
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
          <span className="duel-label">Pênaltis</span>
          <span />
          <input
            aria-label={`Pênaltis de ${teamA}`}
            inputMode="numeric"
            maxLength={2}
            value={row.penaltiesA}
            onChange={(e) => onChange({ penaltiesA: e.target.value })}
          />
          <input
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

- [ ] **Step 4: Implementar a página e o atalho público**

`apps/web/src/pages/admin/AdminFixturePage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useFixture, useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { ResultForm } from './ResultForm';

export function AdminFixturePage() {
  const { id = '', matchId = '' } = useParams();
  const fixture = useFixture(id, Number(matchId));
  const tournament = useTournament(id);

  return (
    <QueryState query={fixture}>
      {(f) => (
        <>
          <p className="hero-context">
            <Link to={`/admin/campeonatos/${id}`}>{tournament.data?.name ?? 'Campeonato'}</Link>
          </p>
          <h1>
            {f.teamA.name} contra {f.teamB.name}
          </h1>
          {tournament.data && tournament.data.status !== 'in_progress' ? (
            <p className="notice">Só é possível lançar resultados com o campeonato em andamento.</p>
          ) : f.rosterA && f.rosterB ? (
            <ResultForm key={f.matchId} tournamentId={id} fixture={f} rosterA={f.rosterA} rosterB={f.rosterB} />
          ) : (
            <p className="state">Carregando elencos…</p>
          )}
        </>
      )}
    </QueryState>
  );
}
```

Em `apps/web/src/pages/FixturePage.tsx`:
- trocar `import { useBracket, useFixture, useTournament } from '../api/queries';` por `import { useBracket, useFixture, useMe, useTournament } from '../api/queries';`
- depois de `const bracket = useBracket(id);` acrescentar `const me = useMe();`
- antes de `<Scoreboard teamA={f.teamA} teamB={f.teamB} scoreA={f.scoreA} scoreB={f.scoreB} />` acrescentar:
```tsx
            {me.data?.user && (
              <p>
                <Link to={`/admin/campeonatos/${id}/jogos/${f.matchId}`} className="button-link">
                  {f.status === 'completed' ? 'Corrigir resultado' : 'Lançar resultado'}
                </Link>
              </p>
            )}
```

Em `apps/web/src/admin-routes.tsx`, acrescentar o import e, antes do `*`:
```tsx
  { path: 'campeonatos/:id/jogos/:matchId', element: <AdminFixturePage /> },
```

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS (inclusive `fixture.test.tsx` do Plano 3a: sem `/auth/me` simulado, o atalho não aparece); sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/web
```

---

### Task 7: Títulos históricos no admin

**Files:**
- Create: `apps/web/src/pages/admin/AdminTitlesPage.tsx`
- Modify: `apps/web/src/admin-routes.tsx`
- Test: `apps/web/test/admin-titles.test.tsx`

**Interfaces:**
- Consumes: `useTitles`, `useTeams`, `createTitle`, `deleteTitle`, `TitleInput`, `useApiMutation`, `ConfirmButton`, `FormError`, `QueryState`, `positionLabel`.
- Produces: rota `/admin/titulos`.

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/admin-titles.test.tsx`:
```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TitlesData } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const titles: TitlesData = {
  ranking: [],
  titles: [
    { id: 'h1', position: 1, year: 2019, tournamentId: null, tournamentName: 'Liga 2019', team: LEOES },
    { id: 'g1', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: TIGRES },
  ],
};
const teams = [LEOES, TIGRES].map((t) => ({ ...t, playerCount: 6 }));

describe('admin titles', () => {
  it('registers a historical title', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/titles': titles,
      '/teams': teams,
      'POST /titles': (body: object) => ({ id: 'h2', tournamentId: null, team: LEOES, ...body }),
    });
    renderRoute('/admin/titulos');
    const form = await screen.findByRole('form', { name: 'Novo título' });
    await within(form).findByRole('option', { name: 'Leões' });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't1' } });
    fireEvent.change(within(form).getByLabelText('Campeonato'), { target: { value: 'Liga 2018' } });
    fireEvent.change(within(form).getByLabelText('Posição'), { target: { value: '2' } });
    fireEvent.change(within(form).getByLabelText('Ano'), { target: { value: '2018' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar título' }));
    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST /titles')).toEqual([{ teamId: 't1', tournamentName: 'Liga 2018', position: 2, year: 2018 }]),
    );
  });

  it('deletes only manual titles, after confirming', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/titles': titles, '/teams': teams, 'DELETE /titles/h1': { ok: true } });
    renderRoute('/admin/titulos');
    const list = await screen.findByRole('list', { name: 'Títulos cadastrados' });
    expect(within(list).getAllByRole('button', { name: /^Apagar título/ })).toHaveLength(1);
    expect(list).toHaveTextContent('Gerado pelo campeonato');
    fireEvent.click(within(list).getByRole('button', { name: 'Apagar título Liga 2019 (2019)' }));
    expect(sentBodies(fetchMock, 'DELETE /titles/h1')).toHaveLength(0);
    fireEvent.click(within(list).getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'DELETE /titles/h1')).toHaveLength(1));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/admin-titles.test.tsx`
Expected: FAIL — `/admin/titulos` cai no "Página não encontrada".

- [ ] **Step 3: Implementar**

`apps/web/src/pages/admin/AdminTitlesPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { createTitle, deleteTitle, type TitleInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTeams, useTitles } from '../../api/queries';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { positionLabel } from '../../lib/format';

const POSITIONS: TitleInput['position'][] = [1, 2, 3];

export function AdminTitlesPage() {
  const titles = useTitles();
  const teams = useTeams();
  const [teamId, setTeamId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [position, setPosition] = useState<TitleInput['position']>(1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const create = useApiMutation(createTitle);
  const remove = useApiMutation(deleteTitle);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ teamId, tournamentName, position, year: Number(year) }, { onSuccess: () => setTournamentName('') });
  };

  return (
    <>
      <h1>Títulos</h1>
      <p className="muted">Os títulos dos campeonatos encerrados aqui são gerados sozinhos. Use este cadastro para o histórico anterior ao Kickabout.</p>

      <h2>Novo título histórico</h2>
      <form className="form" aria-label="Novo título" onSubmit={submit}>
        <label className="field">
          <span>Time</span>
          <select required value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Escolha um time…</option>
            {(teams.data ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Campeonato</span>
          <input required maxLength={80} value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} />
        </label>
        <label className="field">
          <span>Posição</span>
          <select value={position} onChange={(e) => setPosition(Number(e.target.value) as TitleInput['position'])}>
            {POSITIONS.map((value) => (
              <option key={value} value={value}>
                {positionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ano</span>
          <input type="number" required min={1990} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar título
          </button>
        </div>
      </form>

      <h2>Todos os títulos</h2>
      <FormError error={remove.error} />
      <QueryState query={titles} isEmpty={(data) => data.titles.length === 0} empty={<p className="state">Nenhum título cadastrado.</p>}>
        {(data) => (
          <ul aria-label="Títulos cadastrados">
            {data.titles.map((title) => (
              <li key={title.id} className="admin-row">
                <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                <span className="row-title">
                  {title.tournamentName} ({title.year})
                </span>
                <span className="muted">{title.team.name}</span>
                {title.tournamentId === null ? (
                  <ConfirmButton
                    name={`Apagar título ${title.tournamentName} (${title.year})`}
                    label="Apagar"
                    confirmLabel="Confirmar exclusão"
                    danger
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutate(title.id)}
                  />
                ) : (
                  <span className="muted">Gerado pelo campeonato</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
```

Em `apps/web/src/admin-routes.tsx`, acrescentar o import e, antes do `*`:
```tsx
  { path: 'titulos', element: <AdminTitlesPage /> },
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 8: Build, verificação no navegador e commit

**Files:**
- Nenhuma alteração de código esperada (correções encontradas aqui entram com teste na task correspondente).

- [ ] **Step 1: Suíte completa e build**

Run: `npm test && npm run typecheck && npm run build -w @kickabout/web`
Expected: shared, api e web PASS; typecheck limpo; build sem erros.

- [ ] **Step 2: Servidores e acesso**

Com o Postgres no ar (`docker compose up -d`), subir API (`npm run dev:api`) e site (`npm run dev:web`). Para ter um admin: definir `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 8 caracteres) em `apps/api/.env` e rodar `npm run create-admin -w @kickabout/api`.

- [ ] **Step 3: Verificação ponta a ponta**

Em `http://localhost:5173`, a 1280px e a 320px:
1. Rodapé "Área do organizador" leva ao login; entrar volta para `/admin`.
2. Criar 4 times e 6 jogadores em cada (um time de nome longo); transferir um jogador; conferir o contador "n de 20".
3. Criar uma eliminatória simples, ordenar os seeds, salvar, iniciar com confirmação.
4. Lançar uma semifinal 3 × 2; lançar a outra empatada nos 5 duelos, com 6º duelo empatado e pênaltis; conferir placar ao vivo e o confronto na página pública (6º segmento âmbar, pênaltis).
5. Lançar a final; tentar corrigir uma semifinal e ver o bloqueio com o link da final.
6. Encerrar o campeonato e ver campeão, vice e títulos em `/titulos`; cadastrar e apagar um título histórico.
7. Sair e confirmar que `/admin` volta a pedir login.
8. Em 320px: nenhuma tela do admin rola na horizontal (`document.documentElement.scrollWidth === clientWidth`), inclusive a grade de resultado.

Registrar no ledger o que foi visto; problemas viram correções com teste.

- [ ] **Step 4: Commit do plano**

```bash
git add -A
git commit -m "feat(web): organizer area for teams, players, tournaments, results and titles"
```
