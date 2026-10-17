# Kickabout — Plano 3a: Site (base + telas públicas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/web`: site React mobile-first, tema escuro esportivo, com todas as telas públicas do spec (início, campeonatos, campeonato com abas, confronto, times, time, BID com WhatsApp, jogador, títulos) consumindo a API do Plano 2.

**Architecture:** React 19 + Vite 8 + React Router 7 (modo data, `createBrowserRouter`) + TanStack Query para leitura da API. Vite faz proxy de `/api` para a API (`localhost:3333`), então cookies de sessão funcionam no Plano 3b sem CORS. Regras de duelo vêm de `@kickabout/shared`. A chave de mata-mata é desenhada pelo `brackets-viewer` (script de navegador que registra `window.bracketsViewer`), carregado sob demanda. Testes com Vitest + jsdom + Testing Library, com `fetch` simulado.

**Tech Stack:** react 19.3.0, react-dom 19.3.0, react-router 7.18.4, @tanstack/react-query 5.104.0, vite 8.3.1, @vitejs/plugin-react 6.1.1, brackets-viewer 1.9.1, @fontsource/barlow + barlow-condensed 5.3.0, vitest 4 (raiz), jsdom 30.1.1, @testing-library/react 16.3.3, @testing-library/jest-dom 6.10.0, @types/react(-dom) 19.3.0.

**Spec:** `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md` (seção 5.1 e 5.3)

## Design

- **Cores** (tema único escuro, escolha do usuário): fundo `--bg #0d1813` (gramado à noite), superfícies `--surface #13231b` / `--surface-2 #1a2e23`, linhas `--line #26402f`, texto `--chalk #eef4ee`, secundário `--muted #94ab9b`, destaque/vitória `--grass #3ddc84`, pendente/desempate `--amber #f5b942`, derrota `--flag #ff6b5e`.
- **Tipografia:** Barlow Condensed 600/700 para títulos, nomes de time e placares (estilo placar de TV); Barlow 400/500/600 para texto. Números sempre `tabular-nums`.
- **Layout:** coluna única alinhada à esquerda, largura máxima 760px, gutter de 16px; cabeçalho com marca + 3 links (Campeonatos, Times, Títulos), sem menu hambúrguer. Tabelas largas rolam dentro do próprio contêiner, nunca a página.
- **Elemento marcante:** o placar grande + **barra de duelos** (5 segmentos como refletores: verde = time A venceu o duelo, vermelho = time B, neutro = empate; 6º duelo em âmbar). Única animação automática do site: os segmentos acendem em sequência na página do confronto (desligada com `prefers-reduced-motion`).
- **Texto:** português, frases curtas, sem rótulos em caixa-alta, sem "·" separando metadados, sem setas em links.

## Global Constraints

- Node 22, TypeScript strict (`noUncheckedIndexedAccess`), ESM; versões exatamente as do Tech Stack.
- Todas as chamadas passam por `apiGet` (`/api` + caminho, `credentials: 'include'`); erros viram `ApiError` com a mensagem em português do envelope da API.
- Celular só aparece em listas de BID (página do time e `/times/:id/bid`), formatado `(11) 98765-4321`, como link `wa.me` aberto em nova aba; se a API omitir o celular, mostrar só o nome.
- Mobile-first: funciona a partir de 320px de largura sem rolagem horizontal da página; foco visível; `prefers-reduced-motion` respeitado.
- Rotas: `/`, `/campeonatos`, `/campeonatos/:id` (abas via `?aba=chave|jogos|times|estatisticas`), `/campeonatos/:id/jogos/:matchId`, `/times`, `/times/:id`, `/times/:id/bid`, `/jogadores/:id`, `/titulos`, `*` (404).
- Commit único ao final do plano (preferência do usuário); passos de checkpoint fazem só `git add`.

## Review Focus

1. **API fora do ar ou respondendo HTML (502 do proxy)** — telas mostram mensagem de erro em português, nunca tela branca. Testado na Task 1 (`apiGet`) e Task 3 (página).
2. **Campeonato em preparação (sem chave)** — abas Chave/Jogos/Estatísticas explicam que a chave aparece quando começar; aba Times funciona. Testado na Task 4.
3. **Confronto com 6º duelo e pênaltis** — desempate rotulado, pênaltis visíveis, segmento âmbar. Testado na Task 5.
4. **`PHONE_VISIBILITY=authenticated`** (API omite `phone`) — BID mostra só nomes, sem link quebrado. Testado na Task 6.
5. **Nomes longos de time** em 320px — placar e linhas de confronto quebram/encurtam sem estourar a largura (CSS com `min-width: 0` + `overflow-wrap`). Verificado no Step manual da Task 8.

---

## File Structure

```
apps/web/
├── package.json · tsconfig.json · vite.config.ts · index.html
├── src/
│   ├── main.tsx                 # QueryClient + RouterProvider
│   ├── router.tsx               # routes (exportado para testes)
│   ├── vite-env.d.ts            # tipos do Vite + módulo do brackets-viewer
│   ├── styles/{tokens,base,components}.css
│   ├── api/{client,types,queries}.ts
│   ├── lib/format.ts            # rótulos, rodadas, celular, percentuais, datas
│   ├── components/
│   │   ├── Layout.tsx · QueryState.tsx · Tabs.tsx · TeamBadge.tsx
│   │   ├── Scoreboard.tsx · DuelStrip.tsx · MatchRow.tsx · StatusChip.tsx
│   │   ├── StandingsTable.tsx · BracketView.tsx · RosterList.tsx · TournamentList.tsx
│   └── pages/
│       ├── HomePage.tsx · TournamentsPage.tsx · NotFoundPage.tsx
│       ├── tournament/{TournamentPage,BracketTab,StandingsTab,FixturesTab,TeamsTab,StatsTab}.tsx
│       ├── FixturePage.tsx · TeamsPage.tsx · TeamPage.tsx · TeamBidPage.tsx
│       └── PlayerPage.tsx · TitlesPage.tsx
└── test/
    ├── setup.ts · utils.tsx · data.ts
    └── *.test.ts(x)
```

---

### Task 1: Scaffold do site, layout, cliente da API e 404

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/main.tsx`, `apps/web/src/router.tsx`, `apps/web/src/api/client.ts`
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/components.css`
- Create: `apps/web/src/components/Layout.tsx`, `apps/web/src/pages/NotFoundPage.tsx`
- Create: `apps/web/test/setup.ts`, `apps/web/test/utils.tsx`
- Modify: `package.json` (raiz: scripts `dev:api`, `dev:web`)
- Test: `apps/web/test/client.test.ts`, `apps/web/test/app.test.tsx`

**Interfaces:**
- Produces:
  - `class ApiError(status: number, code: string, message: string, details?: unknown)`; `apiGet<T>(path: string): Promise<T>`; `apiRequest<T>(method: string, path: string, body?: unknown): Promise<T>`
  - `routes: RouteObject[]` (filhos do `Layout`; cada task acrescenta suas rotas antes do `*`)
  - test utils: `mockApi(routes: Record<string, unknown>)` (chave = caminho sem `/api`, com ou sem query string; valor `Response` é devolvido como está), `renderRoute(path: string)`

- [ ] **Step 1: Pacote, configuração e HTML**

`apps/web/package.json`:
```json
{
  "name": "@kickabout/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@fontsource/barlow": "5.3.0",
    "@fontsource/barlow-condensed": "5.3.0",
    "@kickabout/shared": "*",
    "@tanstack/react-query": "5.104.0",
    "brackets-viewer": "1.9.1",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-router": "7.18.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.10.0",
    "@testing-library/react": "16.3.3",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "30.1.1",
    "vite": "8.3.1"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3333' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0d1813" />
    <title>Kickabout</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

declare module 'brackets-viewer/dist/brackets-viewer.min.js';
```

Na raiz, `package.json` → `scripts` ganha:
```json
    "dev:api": "npm run dev -w @kickabout/api",
    "dev:web": "npm run dev -w @kickabout/web",
```

Run: `npm install`
Expected: instala sem erros; `npm audit` sem vulnerabilidades altas/críticas (se houver, registrar ruling).

- [ ] **Step 2: Estilos**

`apps/web/src/styles/tokens.css`:
```css
:root {
  color-scheme: dark;

  --bg: #0d1813;
  --surface: #13231b;
  --surface-2: #1a2e23;
  --line: #26402f;
  --chalk: #eef4ee;
  --muted: #94ab9b;
  --grass: #3ddc84;
  --grass-ink: #06210f;
  --amber: #f5b942;
  --flag: #ff6b5e;

  --font-body: 'Barlow', system-ui, sans-serif;
  --font-display: 'Barlow Condensed', 'Barlow', system-ui, sans-serif;

  --step--1: 0.875rem;
  --step-0: 1rem;
  --step-1: 1.25rem;
  --step-2: 1.625rem;
  --step-3: 2.25rem;
  --step-4: 3.5rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2.5rem;

  --radius-sm: 6px;
  --radius: 10px;
}
```

`apps/web/src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--chalk);
  font-family: var(--font-body);
  font-size: var(--step-0);
  line-height: 1.5;
}

a {
  color: inherit;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 var(--space-3);
}

h1 {
  font-size: var(--step-3);
}

h2 {
  font-size: var(--step-2);
  margin-top: var(--space-6);
}

h3 {
  font-size: var(--step-1);
}

p {
  margin: 0 0 var(--space-3);
}

ul,
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

:focus-visible {
  outline: 2px solid var(--grass);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.muted {
  color: var(--muted);
}

.num {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

`apps/web/src/styles/components.css`:
```css
/* Estrutura */
.shell {
  min-height: 100vh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-3) 16px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(6px);
}

.wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-style: italic;
  font-size: var(--step-1);
  color: var(--grass);
  text-decoration: none;
}

.mainnav {
  display: flex;
  gap: var(--space-4);
  margin-left: auto;
}

.mainnav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
}

.mainnav a[aria-current='page'],
.mainnav a:hover {
  color: var(--chalk);
}

.page {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-5) 16px var(--space-6);
}

.page-header p {
  margin-bottom: var(--space-4);
}

/* Estados */
.state {
  padding: var(--space-5) var(--space-4);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  color: var(--muted);
}

.state-error {
  border-color: var(--flag);
  color: var(--chalk);
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--amber);
  background: var(--surface);
  border-radius: var(--radius-sm);
}

/* Abas (links) */
.tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  overflow-x: auto;
}

.tabs a {
  flex: none;
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
}

.tabs a[aria-current='page'] {
  background: var(--grass);
  color: var(--grass-ink);
}

/* Escudo */
.badge {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2.25rem;
  background: var(--surface-2);
  clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--chalk);
  overflow: hidden;
}

.badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-lg {
  width: 3.5rem;
  height: 4rem;
  font-size: var(--step-1);
}

/* Listas e linhas de confronto */
.list > li + li {
  border-top: 1px solid var(--line);
}

.row-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  text-decoration: none;
}

.row-link:hover .row-title {
  color: var(--grass);
}

.row-title {
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.row-meta {
  margin-left: auto;
  color: var(--muted);
  font-size: var(--step--1);
  text-align: right;
}

.match-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  text-decoration: none;
}

.match-caption {
  grid-column: 1 / -1;
  color: var(--muted);
  font-size: var(--step--1);
}

.match-team {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--step-1);
  overflow-wrap: anywhere;
}

.match-team-b {
  justify-content: flex-end;
  text-align: right;
}

.match-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--step-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.match-score .sep {
  color: var(--muted);
  padding: 0 var(--space-1);
}

/* Chips */
.chip {
  display: inline-block;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: var(--step--1);
  font-weight: 600;
  background: var(--surface-2);
  color: var(--muted);
}

.chip-draft {
  background: color-mix(in srgb, var(--amber) 18%, transparent);
  color: var(--amber);
}

.chip-win {
  background: color-mix(in srgb, var(--grass) 18%, transparent);
  color: var(--grass);
}

.chip-loss {
  background: color-mix(in srgb, var(--flag) 18%, transparent);
  color: var(--flag);
}

/* Placar grande (elemento marcante) */
.scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-4);
  background: radial-gradient(120% 140% at 50% 0%, var(--surface-2), var(--surface));
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.scoreboard-team {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-width: 0;
  text-align: center;
}

.scoreboard-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--step-1);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.scoreboard-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--step-4);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.scoreboard-sep {
  color: var(--muted);
  font-size: 0.5em;
  padding: 0 var(--space-2);
  vertical-align: middle;
}

.hero {
  margin-bottom: var(--space-5);
}

.hero-context {
  color: var(--muted);
}

.hero-link {
  display: block;
  text-decoration: none;
}

/* Barra de duelos */
.duel-strip {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-4) 0;
}

.duel-seg {
  flex: 1;
  height: 0.6rem;
  border-radius: 999px;
  background: var(--line);
  animation: floodlight 400ms ease-out both;
  animation-delay: calc(var(--i, 0) * 120ms);
}

.duel-seg-a {
  background: var(--grass);
}

.duel-seg-b {
  background: var(--flag);
}

.duel-seg-draw {
  background: var(--muted);
}

.duel-seg-tiebreak {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}

@keyframes floodlight {
  from {
    opacity: 0.15;
  }
  to {
    opacity: 1;
  }
}

.duel-list > li {
  display: grid;
  grid-template-columns: 4.5rem 1fr auto 1fr;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.duel-order {
  color: var(--muted);
  font-size: var(--step--1);
}

.duel-tiebreak .duel-order {
  color: var(--amber);
  font-weight: 600;
}

.duel-player {
  min-width: 0;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.duel-player-b {
  text-align: right;
}

.duel-winner {
  font-weight: 600;
  color: var(--grass);
}

.duel-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--step-1);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.duel-score small {
  display: block;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: var(--step--1);
  color: var(--amber);
}

/* Tabelas */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: var(--space-2) var(--space-3);
  text-align: right;
  white-space: nowrap;
}

th {
  color: var(--muted);
  font-weight: 500;
  font-size: var(--step--1);
  border-bottom: 1px solid var(--line);
}

td.name,
th.name {
  text-align: left;
  white-space: normal;
}

tbody tr + tr td {
  border-top: 1px solid var(--line);
}

td.name a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  font-weight: 600;
}

/* Números */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-3);
}

.stat {
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border-radius: var(--radius-sm);
}

.stat-value {
  display: block;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--step-2);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  color: var(--muted);
  font-size: var(--step--1);
}

/* BID */
.roster > li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.roster a {
  text-decoration: none;
}

.roster-name {
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.roster-phone {
  flex: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--grass) 14%, transparent);
  color: var(--grass);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* Cabeçalho de time */
.team-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.team-header h1 {
  margin: 0;
}

.button-link {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--grass);
  color: var(--grass-ink);
  font-weight: 600;
  text-decoration: none;
}

/* Chave (brackets-viewer) */
.bracket.brackets-viewer {
  --primary-background: var(--bg);
  --secondary-background: var(--surface);
  --match-background: var(--surface);
  --font-color: var(--chalk);
  --win-color: var(--grass);
  --loss-color: var(--flag);
  --label-color: var(--muted);
  --hint-color: var(--muted);
  --connector-color: var(--line);
  --border-color: var(--line);
  --border-hover-color: var(--grass);
  --border-selected-color: var(--grass);
  overflow-x: auto;
  padding: 0;
  font-family: var(--font-body);
}
```

- [ ] **Step 3: Setup e utilitários de teste**

`apps/web/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```

`apps/web/test/utils.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/router';

export type ApiRoutes = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Simula a API: chave = caminho sem `/api` (com query string tem prioridade sobre sem). */
export function mockApi(routes: ApiRoutes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const handler = routes[path + url.search] ?? routes[path];
    if (handler === undefined) return json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, 404);
    if (handler instanceof Response) return handler;
    return json(handler);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
```

- [ ] **Step 4: Escrever os testes que falham**

`apps/web/test/client.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ApiError, apiGet } from '../src/api/client';
import { mockApi } from './utils';

describe('apiGet', () => {
  it('returns the parsed body', async () => {
    mockApi({ '/health': { ok: true } });
    await expect(apiGet('/health')).resolves.toEqual({ ok: true });
  });

  it('turns the error envelope into an ApiError with the Portuguese message', async () => {
    mockApi({});
    const error = await apiGet('/nao-existe').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });

  it('handles a non-JSON gateway error', async () => {
    mockApi({ '/health': new Response('<html>Bad Gateway</html>', { status: 502 }) });
    await expect(apiGet('/health')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Não foi possível falar com o servidor. Tente de novo em instantes.',
    });
  });
});
```

`apps/web/test/app.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './utils';

describe('layout', () => {
  it('shows the main navigation', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Campeonatos');
    expect(nav).toHaveTextContent('Times');
    expect(nav).toHaveTextContent('Títulos');
    expect(screen.getByRole('link', { name: 'Kickabout, início' })).toHaveAttribute('href', '/');
  });

  it('shows a 404 page for unknown routes', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
  });
});
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web`
Expected: FAIL — `Cannot find module '../src/api/client'` / `'../src/router'`.

- [ ] **Step 6: Implementar**

`apps/web/src/api/client.ts`:
```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const GENERIC_MESSAGE = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = parseJson(await response.text()) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(response.status, error?.code ?? 'HTTP_ERROR', error?.message ?? GENERIC_MESSAGE, error?.details);
  }
  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiRequest<T>('GET', path);
```

`apps/web/src/components/Layout.tsx`:
```tsx
import { Link, NavLink, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          kickabout
        </Link>
        <nav aria-label="Principal" className="mainnav">
          <NavLink to="/campeonatos">Campeonatos</NavLink>
          <NavLink to="/times">Times</NavLink>
          <NavLink to="/titulos">Títulos</NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
```

`apps/web/src/pages/NotFoundPage.tsx`:
```tsx
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p className="muted">Confira o endereço ou volte para o início.</p>
      <Link to="/" className="button-link">
        Voltar para o início
      </Link>
    </section>
  );
}
```

`apps/web/src/router.tsx`:
```tsx
import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
];
```

`apps/web/src/main.tsx`:
```tsx
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { routes } from './router';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: Rodar testes, typecheck e build**

Run: `npm test -w @kickabout/web && npm run typecheck && npm run build -w @kickabout/web`
Expected: 5 testes PASS; typecheck sem erros nos 3 pacotes; build gera `apps/web/dist`.

- [ ] **Step 8: Checkpoint**

```bash
git add package.json package-lock.json apps/web
```

Adicionar `apps/web/dist` ao `.gitignore` já coberto por `dist/`.

---

### Task 2: Tipos da API, consultas, formatação e componentes base

**Files:**
- Create: `apps/web/src/api/types.ts`, `apps/web/src/api/queries.ts`, `apps/web/src/lib/format.ts`
- Create: `apps/web/src/components/{QueryState,Tabs,TeamBadge,Scoreboard,DuelStrip,MatchRow,StatusChip,TournamentList}.tsx`
- Create: `apps/web/test/data.ts`
- Test: `apps/web/test/format.test.ts`, `apps/web/test/components.test.tsx`

**Interfaces:**
- Consumes: `apiGet`, `ApiError`, `duelOutcome` (`@kickabout/shared`)
- Produces:
  - Tipos em `api/types.ts` (espelham as respostas do Plano 2): `TeamRef`, `TeamSummary`, `PlayerRef`, `RosterPlayer`, `TournamentFormat`, `TournamentStatus`, `TournamentListItem`, `Tournament`, `FixtureStatus`, `FixtureListItem`, `DuelView`, `FixtureDetail`, `StandingRow`, `PlayerStats`, `LeaderboardRow`, `FixtureSummary`, `RecordTally`, `TeamPageData`, `PlayerDuel`, `PlayerPageData`, `TitleEntry`, `TitlesData`, `BracketData`
  - Hooks em `api/queries.ts`: `useRecentFixtures(limit)`, `useTournaments(status?)`, `useTournament(id)`, `useBracket(id)`, `useTournamentFixtures(id)`, `useStandings(id)`, `useTournamentStats(id)`, `useFixture(id, matchId)`, `useTeams()`, `useTeam(id)`, `useRoster(id)`, `usePlayer(id)`, `useTitles()`
  - `lib/format.ts`: `FORMAT_LABEL`, `STATUS_LABEL`, `percent(rate)`, `formatDate(iso)`, `formatPhone(e164)`, `eliminationRoundName(round, count)`, `roundLabel(format, groupNumber, roundNumber, roundCount)`, `roundCounts(data)`, `viewerRoundName(info)`, `positionLabel(position)`, `outcomeOf(duel: DuelView)`
  - Componentes: `QueryState`, `Tabs`, `TeamBadge`, `Scoreboard`, `DuelStrip`, `MatchRow`, `StatusChip`, `TournamentList`
  - `test/data.ts`: factories `team(id, name)`, `fixtureSummary(...)`, `tournamentListItem(...)`

- [ ] **Step 1: Tipos e consultas**

`apps/web/src/api/types.ts`:
```ts
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'draft' | 'in_progress' | 'finished';
export type FixtureStatus = 'pending' | 'draft' | 'completed';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface TeamSummary extends TeamRef {
  playerCount: number;
}

export interface PlayerRef {
  id: string;
  name: string;
}

export interface RosterPlayer extends PlayerRef {
  phone?: string;
  whatsappUrl?: string;
}

export interface TournamentListItem {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  teamCount: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  options: { consolationFinal: boolean; grandFinalReset: boolean; roundRobinMode: 'simple' | 'double' };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  entries: { seed: number; team: TeamRef }[];
}

export interface FixtureListItem {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  isKnockout: boolean;
  status: FixtureStatus;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

export interface DuelView {
  order: number;
  playerA: PlayerRef;
  playerB: PlayerRef;
  goalsA: number;
  goalsB: number;
  penaltiesA: number | null;
  penaltiesB: number | null;
}

export interface FixtureDetail extends FixtureListItem {
  duels: DuelView[];
  rosterA?: PlayerRef[];
  rosterB?: PlayerRef[];
}

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
  team: TeamRef;
}

export interface PlayerStats {
  playerId: string;
  duels: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number;
}

export interface LeaderboardRow extends PlayerStats {
  player: PlayerRef;
  team: TeamRef | null;
}

export interface FixtureSummary {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number;
  scoreB: number;
  playedAt: string | null;
}

export interface RecordTally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TeamPageData {
  team: TeamRef;
  roster: RosterPlayer[];
  stats: { teamId: string; fixtures: RecordTally; duels: RecordTally; goalsFor: number; goalsAgainst: number; goalDiff: number };
  titles: { id: string; position: number; year: number; tournamentId: string | null; tournamentName: string }[];
  recentFixtures: FixtureSummary[];
  tournaments: { id: string; name: string; format: TournamentFormat; status: TournamentStatus }[];
}

export interface PlayerDuel {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  order: number;
  team: TeamRef;
  opponentTeam: TeamRef;
  opponent: PlayerRef;
  goalsFor: number;
  goalsAgainst: number;
  penaltiesFor: number | null;
  penaltiesAgainst: number | null;
  result: 'win' | 'draw' | 'loss';
  playedAt: string | null;
}

export interface PlayerPageData {
  player: PlayerRef;
  currentTeam: TeamRef | null;
  teamHistory: { team: TeamRef; joinedAt: string; leftAt: string | null }[];
  stats: PlayerStats;
  duels: PlayerDuel[];
  titles: { position: number; year: number; tournamentId: string | null; tournamentName: string; team: TeamRef }[];
}

export interface TitleEntry {
  id: string;
  position: number;
  year: number;
  tournamentId: string | null;
  tournamentName: string;
  team: TeamRef;
}

export interface TitlesData {
  ranking: { team: TeamRef; champion: number; runnerUp: number; third: number }[];
  titles: TitleEntry[];
}

/** Estado do brackets-manager (só os campos usados pelo site; o resto vai direto para o brackets-viewer). */
export interface BracketData {
  stage: unknown[];
  group: { id: number; stage_id: number; number: number }[];
  round: { id: number; group_id: number; number: number }[];
  match: unknown[];
  match_game: unknown[];
  participant: { id: number; name: string }[];
}
```

`apps/web/src/api/queries.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  BracketData,
  FixtureDetail,
  FixtureListItem,
  FixtureSummary,
  LeaderboardRow,
  PlayerPageData,
  RosterPlayer,
  StandingRow,
  TeamPageData,
  TeamRef,
  TeamSummary,
  TitlesData,
  Tournament,
  TournamentListItem,
  TournamentStatus,
} from './types';

export const useRecentFixtures = (limit: number) =>
  useQuery({ queryKey: ['fixtures', 'recent', limit], queryFn: () => apiGet<FixtureSummary[]>(`/fixtures/recent?limit=${limit}`) });

export const useTournaments = (status?: TournamentStatus) =>
  useQuery({
    queryKey: ['tournaments', status ?? 'all'],
    queryFn: () => apiGet<TournamentListItem[]>(status ? `/tournaments?status=${status}` : '/tournaments'),
  });

export const useTournament = (id: string) =>
  useQuery({ queryKey: ['tournament', id], queryFn: () => apiGet<Tournament>(`/tournaments/${id}`) });

export const useBracket = (id: string, enabled = true) =>
  useQuery({ queryKey: ['tournament', id, 'bracket'], queryFn: () => apiGet<{ data: BracketData | null }>(`/tournaments/${id}/bracket`), enabled });

export const useTournamentFixtures = (id: string) =>
  useQuery({ queryKey: ['tournament', id, 'fixtures'], queryFn: () => apiGet<FixtureListItem[]>(`/tournaments/${id}/fixtures`) });

export const useStandings = (id: string) =>
  useQuery({ queryKey: ['tournament', id, 'standings'], queryFn: () => apiGet<StandingRow[]>(`/tournaments/${id}/standings`) });

export const useTournamentStats = (id: string) =>
  useQuery({ queryKey: ['tournament', id, 'stats'], queryFn: () => apiGet<LeaderboardRow[]>(`/tournaments/${id}/stats`) });

export const useFixture = (id: string, matchId: number) =>
  useQuery({ queryKey: ['tournament', id, 'fixture', matchId], queryFn: () => apiGet<FixtureDetail>(`/tournaments/${id}/fixtures/${matchId}`) });

export const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: () => apiGet<TeamSummary[]>('/teams') });

export const useTeam = (id: string) => useQuery({ queryKey: ['team', id], queryFn: () => apiGet<TeamPageData>(`/teams/${id}`) });

export const useRoster = (id: string) =>
  useQuery({ queryKey: ['team', id, 'roster'], queryFn: () => apiGet<{ team: TeamRef; players: RosterPlayer[] }>(`/teams/${id}/roster`) });

export const usePlayer = (id: string) => useQuery({ queryKey: ['player', id], queryFn: () => apiGet<PlayerPageData>(`/players/${id}`) });

export const useTitles = () => useQuery({ queryKey: ['titles'], queryFn: () => apiGet<TitlesData>('/titles') });
```

- [ ] **Step 2: Escrever os testes que falham**

`apps/web/test/data.ts`:
```ts
import type { FixtureSummary, TeamRef, TournamentListItem } from '../src/api/types';

export const team = (id: string, name: string, crestUrl: string | null = null): TeamRef => ({
  id,
  name,
  shortName: name.slice(0, 3).toUpperCase(),
  crestUrl,
});

export const LEOES = team('t1', 'Leões');
export const TIGRES = team('t2', 'Tigres');
export const FALCOES = team('t3', 'Falcões');

export const fixtureSummary = (overrides: Partial<FixtureSummary> = {}): FixtureSummary => ({
  tournamentId: 'c1',
  tournamentName: 'Copa Outubro',
  matchId: 0,
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 3,
  scoreB: 2,
  playedAt: '2026-10-10T22:00:00.000Z',
  ...overrides,
});

export const tournamentListItem = (overrides: Partial<TournamentListItem> = {}): TournamentListItem => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'in_progress',
  teamCount: 8,
  startedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: null,
  ...overrides,
});
```

`apps/web/test/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  eliminationRoundName,
  formatPhone,
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
        { id: 0, group_id: 0, number: 1 },
        { id: 1, group_id: 0, number: 2 },
        { id: 2, group_id: 1, number: 1 },
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
    expect(formatPhone('+351912345678')).toBe('+351912345678');
  });

  it('formats percentages and podium positions', () => {
    expect(percent(2 / 3)).toBe('67%');
    expect(percent(0)).toBe('0%');
    expect([1, 2, 3].map(positionLabel)).toEqual(['Campeão', 'Vice', '3º lugar']);
  });
});
```

`apps/web/test/components.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DuelStrip } from '../src/components/DuelStrip';
import { MatchRow } from '../src/components/MatchRow';
import { TeamBadge } from '../src/components/TeamBadge';
import { LEOES, TIGRES, team } from './data';

const duel = (order: number, goalsA: number, goalsB: number, penaltiesA: number | null = null, penaltiesB: number | null = null) => ({
  order,
  playerA: { id: `a${order}`, name: `A${order}` },
  playerB: { id: `b${order}`, name: `B${order}` },
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});

describe('DuelStrip', () => {
  it('renders one segment per duel colored by the winner, with accessible labels', () => {
    render(
      <DuelStrip
        teamA="Leões"
        teamB="Tigres"
        duels={[duel(1, 2, 0), duel(2, 0, 1), duel(3, 1, 1), duel(4, 0, 0), duel(5, 3, 3), duel(6, 1, 1, 4, 5)]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.className)).toEqual([
      'duel-seg duel-seg-a',
      'duel-seg duel-seg-b',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-b duel-seg-tiebreak',
    ]);
    expect(items[0]).toHaveTextContent('1º duelo: Leões venceu');
    expect(items[2]).toHaveTextContent('3º duelo: empate');
    expect(items[5]).toHaveTextContent('Desempate: Tigres venceu');
  });
});

describe('TeamBadge', () => {
  it('uses the crest when present and the short name otherwise', () => {
    const { container, rerender } = render(<TeamBadge team={team('x', 'Leões', 'https://example.com/l.png')} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/l.png');
    rerender(<TeamBadge team={LEOES} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('LEÕ')).toBeInTheDocument();
  });
});

describe('MatchRow', () => {
  it('shows the score for completed matches and a chip otherwise', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={3} scoreB={1} status="completed" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Leões\s*3\s*a\s*1\s*Tigres/ })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={null} scoreB={null} status="pending" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveTextContent('A jogar');
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/format.test.ts test/components.test.tsx`
Expected: FAIL — `Cannot find module '../src/lib/format'`.

- [ ] **Step 4: Implementar formatação e componentes**

`apps/web/src/lib/format.ts`:
```ts
import { duelOutcome, type DuelOutcome } from '@kickabout/shared';
import type { BracketData, DuelView, TournamentFormat, TournamentStatus } from '../api/types';

/** Resultado do duelo pelas regras do shared (que recebe ids, não objetos de jogador). */
export const outcomeOf = (duel: DuelView): DuelOutcome =>
  duelOutcome({
    order: duel.order,
    playerAId: duel.playerA.id,
    playerBId: duel.playerB.id,
    goalsA: duel.goalsA,
    goalsB: duel.goalsB,
    penaltiesA: duel.penaltiesA,
    penaltiesB: duel.penaltiesB,
  });

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  single_elimination: 'Eliminatória simples',
  double_elimination: 'Eliminatória dupla',
  round_robin: 'Pontos corridos',
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Em preparação',
  in_progress: 'Em andamento',
  finished: 'Encerrado',
};

export const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

export function formatPhone(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

export const positionLabel = (position: number): string =>
  position === 1 ? 'Campeão' : position === 2 ? 'Vice' : `${position}º lugar`;

export function eliminationRoundName(roundNumber: number, roundCount: number): string {
  const names = ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'];
  return names[roundCount - roundNumber] ?? `${roundNumber}ª rodada`;
}

export function roundLabel(format: TournamentFormat, groupNumber: number, roundNumber: number, roundCount: number): string {
  if (format === 'round_robin') return `Rodada ${roundNumber}`;
  if (format === 'single_elimination') {
    return groupNumber === 2 ? 'Disputa de 3º lugar' : eliminationRoundName(roundNumber, roundCount);
  }
  if (groupNumber === 1) {
    return roundNumber === roundCount ? 'Final da chave superior' : `Chave superior, ${roundNumber}ª rodada`;
  }
  if (groupNumber === 2) {
    return roundNumber === roundCount ? 'Final da chave inferior' : `Chave inferior, ${roundNumber}ª rodada`;
  }
  return roundNumber === 1 ? 'Grande final' : 'Final de desempate';
}

/** Número de rodadas por número de grupo (1 = chave principal/superior, 2 = inferior/3º lugar, 3 = final). */
export function roundCounts(data: BracketData | null): Map<number, number> {
  const counts = new Map<number, number>();
  if (!data) return counts;
  for (const group of data.group) {
    counts.set(group.number, data.round.filter((round) => round.group_id === group.id).length);
  }
  return counts;
}

export interface ViewerRoundInfo {
  groupType: string;
  roundNumber: number;
  roundCount: number;
  finalType?: string;
}

/** Nomes de rodada em português para o brackets-viewer (`customRoundName`). */
export function viewerRoundName(info: ViewerRoundInfo): string {
  switch (info.groupType) {
    case 'round-robin':
      return `Rodada ${info.roundNumber}`;
    case 'winner-bracket':
      return roundLabel('double_elimination', 1, info.roundNumber, info.roundCount);
    case 'loser-bracket':
      return roundLabel('double_elimination', 2, info.roundNumber, info.roundCount);
    case 'final-group':
      return info.finalType === 'consolation-final' ? 'Disputa de 3º lugar' : roundLabel('double_elimination', 3, info.roundNumber, info.roundCount);
    default:
      return eliminationRoundName(info.roundNumber, info.roundCount);
  }
}
```

`apps/web/src/components/QueryState.tsx`:
```tsx
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

interface Props<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}

export function QueryState<T>({ query, children, isEmpty, empty }: Props<T>) {
  if (query.isPending) {
    return (
      <p className="state" role="status">
        Carregando…
      </p>
    );
  }
  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : 'Não foi possível carregar esta página.';
    return (
      <p className="state state-error" role="alert">
        {message}
      </p>
    );
  }
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
```

`apps/web/src/components/Tabs.tsx`:
```tsx
import { Link } from 'react-router';

interface Props {
  param: string;
  items: { id: string; label: string }[];
  current: string;
  label: string;
}

/** Abas como links (`?param=id`): o endereço guarda a aba e o botão voltar funciona. */
export function Tabs({ param, items, current, label }: Props) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <Link key={item.id} to={`?${param}=${item.id}`} aria-current={item.id === current ? 'page' : undefined} replace>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

`apps/web/src/components/TeamBadge.tsx`:
```tsx
import type { TeamRef } from '../api/types';

export function TeamBadge({ team, size = 'sm' }: { team: TeamRef; size?: 'sm' | 'lg' }) {
  return (
    <span className={size === 'lg' ? 'badge badge-lg' : 'badge'} aria-hidden="true">
      {team.crestUrl ? <img src={team.crestUrl} alt="" /> : team.shortName}
    </span>
  );
}
```

`apps/web/src/components/StatusChip.tsx`:
```tsx
import type { FixtureStatus } from '../api/types';

export function StatusChip({ status }: { status: FixtureStatus }) {
  if (status === 'draft') return <span className="chip chip-draft">Parcial</span>;
  if (status === 'pending') return <span className="chip">A jogar</span>;
  return <span className="chip chip-win">Encerrado</span>;
}
```

`apps/web/src/components/Scoreboard.tsx`:
```tsx
import type { TeamRef } from '../api/types';
import { TeamBadge } from './TeamBadge';

interface Props {
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

export function Scoreboard({ teamA, teamB, scoreA, scoreB }: Props) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-team">
        <TeamBadge team={teamA} size="lg" />
        <span className="scoreboard-name">{teamA.name}</span>
      </div>
      <div className="scoreboard-score">
        {scoreA === null || scoreB === null ? (
          <span className="muted">vs</span>
        ) : (
          <>
            {scoreA}
            <span className="scoreboard-sep" aria-hidden="true">
              ×
            </span>
            <span className="visually-hidden"> a </span>
            {scoreB}
          </>
        )}
      </div>
      <div className="scoreboard-team">
        <TeamBadge team={teamB} size="lg" />
        <span className="scoreboard-name">{teamB.name}</span>
      </div>
    </div>
  );
}
```

`apps/web/src/components/DuelStrip.tsx`:
```tsx
import type { CSSProperties } from 'react';
import type { DuelView } from '../api/types';
import { outcomeOf } from '../lib/format';

interface Props {
  duels: DuelView[];
  teamA: string;
  teamB: string;
}

export function DuelStrip({ duels, teamA, teamB }: Props) {
  return (
    <ol className="duel-strip" aria-label="Resultado de cada duelo">
      {duels.map((duel, index) => {
        const outcome = outcomeOf(duel);
        const side = outcome === 'A' ? 'a' : outcome === 'B' ? 'b' : 'draw';
        const name = duel.order === 6 ? 'Desempate' : `${duel.order}º duelo`;
        const result = outcome === 'draw' ? 'empate' : `${outcome === 'A' ? teamA : teamB} venceu`;
        return (
          <li
            key={duel.order}
            className={`duel-seg duel-seg-${side}${duel.order === 6 ? ' duel-seg-tiebreak' : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span className="visually-hidden">
              {name}: {result}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

`apps/web/src/components/MatchRow.tsx`:
```tsx
import { Link } from 'react-router';
import type { FixtureStatus, TeamRef } from '../api/types';
import { StatusChip } from './StatusChip';
import { TeamBadge } from './TeamBadge';

interface Props {
  to: string;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
  status: FixtureStatus;
  caption?: string;
}

export function MatchRow({ to, teamA, teamB, scoreA, scoreB, status, caption }: Props) {
  return (
    <Link to={to} className="match-row">
      {caption && <span className="match-caption">{caption}</span>}
      <span className="match-team">
        <TeamBadge team={teamA} />
        {teamA.name}
      </span>
      <span className="match-score">
        {status === 'completed' && scoreA !== null && scoreB !== null ? (
          <>
            {scoreA}
            <span className="sep" aria-hidden="true">
              ×
            </span>
            <span className="visually-hidden"> a </span>
            {scoreB}
          </>
        ) : (
          <StatusChip status={status} />
        )}
      </span>
      <span className="match-team match-team-b">
        {teamB.name}
        <TeamBadge team={teamB} />
      </span>
    </Link>
  );
}
```

`apps/web/src/components/TournamentList.tsx`:
```tsx
import { Link } from 'react-router';
import type { TournamentListItem } from '../api/types';
import { FORMAT_LABEL } from '../lib/format';

export function TournamentList({ items }: { items: TournamentListItem[] }) {
  return (
    <ul className="list">
      {items.map((tournament) => (
        <li key={tournament.id}>
          <Link to={`/campeonatos/${tournament.id}`} className="row-link">
            <span className="row-title">{tournament.name}</span>
            <span className="row-meta">
              {FORMAT_LABEL[tournament.format]}, {tournament.teamCount} times
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/web
```

---

### Task 3: Início e lista de campeonatos

**Files:**
- Create: `apps/web/src/pages/HomePage.tsx`, `apps/web/src/pages/TournamentsPage.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/test/home.test.tsx`

**Interfaces:**
- Consumes: `useRecentFixtures`, `useTournaments`, `QueryState`, `Scoreboard`, `MatchRow`, `TournamentList`, `Tabs`, `STATUS_LABEL`
- Produces: rotas `/` (index) e `/campeonatos` (`?status=in_progress|finished|draft`, padrão `in_progress`)

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/home.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FALCOES, fixtureSummary, tournamentListItem } from './data';
import { mockApi, renderRoute } from './utils';

describe('home', () => {
  it('opens with the latest result as a big scoreboard and lists the rest', async () => {
    mockApi({
      '/fixtures/recent?limit=8': [fixtureSummary(), fixtureSummary({ matchId: 1, teamB: FALCOES, scoreA: 1, scoreB: 3 })],
      '/tournaments?status=in_progress': [tournamentListItem()],
    });
    renderRoute('/');
    const hero = await screen.findByRole('link', { name: /Leões\s*3\s*×?\s*a\s*2\s*Tigres/ });
    expect(hero).toHaveAttribute('href', '/campeonatos/c1/jogos/0');
    expect(screen.getByRole('heading', { name: 'Resultados recentes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Falcões/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/1');
    expect(await screen.findByRole('link', { name: /Copa Outubro.*Eliminatória simples, 8 times/ })).toHaveAttribute('href', '/campeonatos/c1');
  });

  it('invites to browse tournaments when nothing was played yet', async () => {
    mockApi({ '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] });
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Nenhum resultado ainda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver campeonatos' })).toHaveAttribute('href', '/campeonatos');
    expect(await screen.findByText('Nenhum campeonato em andamento.')).toBeInTheDocument();
  });

  it('shows the API error message instead of a blank page', async () => {
    mockApi({
      '/fixtures/recent?limit=8': new Response('<html>Bad Gateway</html>', { status: 502 }),
      '/tournaments?status=in_progress': [],
    });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor. Tente de novo em instantes.');
  });
});

describe('tournaments list', () => {
  it('filters by status through tabs and explains empty lists', async () => {
    mockApi({
      '/tournaments?status=in_progress': [tournamentListItem()],
      '/tournaments?status=finished': [],
    });
    renderRoute('/campeonatos');
    expect(await screen.findByRole('heading', { name: 'Campeonatos', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Em andamento' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('link', { name: /Copa Outubro/ })).toBeInTheDocument();

    renderRoute('/campeonatos?status=finished');
    expect(await screen.findByText('Nenhum campeonato encerrado.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/home.test.tsx`
Expected: FAIL — página 404 renderizada (rotas inexistentes), `findByRole` não encontra o placar.

- [ ] **Step 3: Implementar**

`apps/web/src/pages/HomePage.tsx`:
```tsx
import { Link } from 'react-router';
import { useRecentFixtures, useTournaments } from '../api/queries';
import { MatchRow } from '../components/MatchRow';
import { QueryState } from '../components/QueryState';
import { Scoreboard } from '../components/Scoreboard';
import { TournamentList } from '../components/TournamentList';

const fixtureUrl = (tournamentId: string, matchId: number) => `/campeonatos/${tournamentId}/jogos/${matchId}`;

export function HomePage() {
  const recent = useRecentFixtures(8);
  const live = useTournaments('in_progress');

  return (
    <>
      <h1 className="visually-hidden">Kickabout</h1>
      <QueryState
        query={recent}
        isEmpty={(fixtures) => fixtures.length === 0}
        empty={
          <section className="hero">
            <h2>Nenhum resultado ainda</h2>
            <p className="muted">Os confrontos aparecem aqui assim que o primeiro resultado for lançado.</p>
            <Link to="/campeonatos" className="button-link">
              Ver campeonatos
            </Link>
          </section>
        }
      >
        {([latest, ...rest]) => (
          <>
            {latest && (
              <section className="hero">
                <p className="hero-context">
                  <Link to={`/campeonatos/${latest.tournamentId}`}>{latest.tournamentName}</Link>
                </p>
                <Link to={fixtureUrl(latest.tournamentId, latest.matchId)} className="hero-link">
                  <Scoreboard teamA={latest.teamA} teamB={latest.teamB} scoreA={latest.scoreA} scoreB={latest.scoreB} />
                </Link>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                <h2>Resultados recentes</h2>
                <ul className="list">
                  {rest.map((fixture) => (
                    <li key={`${fixture.tournamentId}-${fixture.matchId}`}>
                      <MatchRow
                        to={fixtureUrl(fixture.tournamentId, fixture.matchId)}
                        teamA={fixture.teamA}
                        teamB={fixture.teamB}
                        scoreA={fixture.scoreA}
                        scoreB={fixture.scoreB}
                        status="completed"
                        caption={fixture.tournamentName}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </QueryState>

      <section>
        <h2>Em andamento</h2>
        <QueryState
          query={live}
          isEmpty={(list) => list.length === 0}
          empty={<p className="muted">Nenhum campeonato em andamento.</p>}
        >
          {(list) => <TournamentList items={list} />}
        </QueryState>
      </section>
    </>
  );
}
```

`apps/web/src/pages/TournamentsPage.tsx`:
```tsx
import { useSearchParams } from 'react-router';
import { useTournaments } from '../api/queries';
import type { TournamentStatus } from '../api/types';
import { QueryState } from '../components/QueryState';
import { Tabs } from '../components/Tabs';
import { TournamentList } from '../components/TournamentList';

const FILTERS: { id: TournamentStatus; label: string; empty: string }[] = [
  { id: 'in_progress', label: 'Em andamento', empty: 'Nenhum campeonato em andamento.' },
  { id: 'finished', label: 'Encerrados', empty: 'Nenhum campeonato encerrado.' },
  { id: 'draft', label: 'Em preparação', empty: 'Nenhum campeonato em preparação.' },
];

export function TournamentsPage() {
  const [params] = useSearchParams();
  const filter = FILTERS.find((f) => f.id === params.get('status')) ?? FILTERS[0]!;
  const tournaments = useTournaments(filter.id);

  return (
    <>
      <h1>Campeonatos</h1>
      <Tabs param="status" items={FILTERS} current={filter.id} label="Situação do campeonato" />
      <QueryState query={tournaments} isEmpty={(list) => list.length === 0} empty={<p className="state">{filter.empty}</p>}>
        {(list) => <TournamentList items={list} />}
      </QueryState>
    </>
  );
}
```

Em `apps/web/src/router.tsx`, `children` passa a ser:
```tsx
    children: [
      { index: true, element: <HomePage /> },
      { path: 'campeonatos', element: <TournamentsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
```
com `import { HomePage } from './pages/HomePage';` e `import { TournamentsPage } from './pages/TournamentsPage';`.

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 4: Página do campeonato com abas

**Files:**
- Create: `apps/web/src/components/StandingsTable.tsx`, `apps/web/src/components/BracketView.tsx`
- Create: `apps/web/src/pages/tournament/{TournamentPage,BracketTab,StandingsTab,FixturesTab,TeamsTab,StatsTab}.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/test/tournament.test.tsx`

**Interfaces:**
- Consumes: `useTournament`, `useBracket`, `useStandings`, `useTournamentFixtures`, `useTournamentStats`, `roundLabel`, `roundCounts`, `viewerRoundName`, `FORMAT_LABEL`, `STATUS_LABEL`, `percent`, `MatchRow`, `TeamBadge`, `Tabs`, `QueryState`
- Produces:
  - rota `/campeonatos/:id` com `?aba=chave|jogos|times|estatisticas` (padrão `chave`; rótulo "Tabela" no round robin)
  - `BracketView({ data })` — carrega `brackets-viewer/dist/brackets-viewer.min.js` + `.css` sob demanda e chama `window.bracketsViewer.render(...)`
  - `StandingsTable({ rows })`

Em campeonato `draft`: abas Chave, Jogos e Estatísticas mostram "A chave aparece quando o campeonato começar."; aba Times lista os inscritos.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/tournament.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BracketData, FixtureListItem, Tournament } from '../src/api/types';
import { FALCOES, LEOES, TIGRES, team } from './data';
import { mockApi, renderRoute } from './utils';

vi.mock('brackets-viewer/dist/brackets-viewer.min.js', () => ({}));
vi.mock('brackets-viewer/dist/brackets-viewer.min.css', () => ({}));

const ONCAS = team('t4', 'Onças');

const tournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status: 'in_progress',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '2026-10-01T00:00:00.000Z',
  startedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: null,
  entries: [LEOES, TIGRES, FALCOES, ONCAS].map((t, i) => ({ seed: i + 1, team: t })),
  ...overrides,
});

const bracket: BracketData = {
  stage: [{ id: 0 }],
  group: [{ id: 0, stage_id: 0, number: 1 }],
  round: [
    { id: 0, group_id: 0, number: 1 },
    { id: 1, group_id: 0, number: 2 },
  ],
  match: [],
  match_game: [],
  participant: [],
};

const fixture = (overrides: Partial<FixtureListItem>): FixtureListItem => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  isKnockout: true,
  status: 'completed',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 3,
  scoreB: 1,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal('bracketsViewer', { render: vi.fn().mockResolvedValue(undefined) });
});

describe('tournament page', () => {
  it('draws the bracket for elimination formats', async () => {
    mockApi({ '/tournaments/c1': tournament(), '/tournaments/c1/bracket': { data: bracket } });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByRole('heading', { name: 'Copa Outubro' })).toBeInTheDocument();
    expect(screen.getByText('Eliminatória simples, 4 times, em andamento.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chave' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(window.bracketsViewer.render).toHaveBeenCalledTimes(1));
    const [data, config] = vi.mocked(window.bracketsViewer.render).mock.calls[0]!;
    expect(data).toMatchObject({ stages: bracket.stage, matches: [], participants: [] });
    expect(config).toMatchObject({ clear: true, selector: expect.stringMatching(/^#bracket-/) });
  });

  it('shows the standings table for round robin', async () => {
    mockApi({
      '/tournaments/c1': tournament({ format: 'round_robin' }),
      '/tournaments/c1/standings': [
        { position: 1, teamId: 't1', team: LEOES, played: 2, wins: 2, draws: 0, losses: 0, points: 6, duelsWon: 7, duelsLost: 3, goalsFor: 12, goalsAgainst: 5, goalDiff: 7 },
        { position: 2, teamId: 't2', team: TIGRES, played: 2, wins: 0, draws: 1, losses: 1, points: 1, duelsWon: 4, duelsLost: 6, goalsFor: 6, goalsAgainst: 9, goalDiff: -3 },
      ],
    });
    renderRoute('/campeonatos/c1');
    const table = await screen.findByRole('table', { name: 'Classificação' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Leões6220+7');
    expect(screen.getByRole('link', { name: 'Tabela' })).toHaveAttribute('aria-current', 'page');
  });

  it('groups fixtures by round with Portuguese round names', async () => {
    mockApi({
      '/tournaments/c1': tournament(),
      '/tournaments/c1/bracket': { data: bracket },
      '/tournaments/c1/fixtures': [
        fixture({ matchId: 0 }),
        fixture({ matchId: 1, teamA: FALCOES, teamB: ONCAS, status: 'draft', scoreA: null, scoreB: null }),
        fixture({ matchId: 2, roundNumber: 2, teamB: FALCOES, status: 'pending', scoreA: null, scoreB: null }),
      ],
    });
    renderRoute('/campeonatos/c1?aba=jogos');
    expect(await screen.findByRole('heading', { name: 'Semifinal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Falcões.*Parcial.*Onças/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/1');
  });

  it('lists the teams linking to each BID', async () => {
    mockApi({ '/tournaments/c1': tournament() });
    renderRoute('/campeonatos/c1?aba=times');
    expect(await screen.findByRole('link', { name: /Leões/ })).toHaveAttribute('href', '/times/t1/bid');
    expect(screen.getAllByRole('link', { name: /Ver BID/ })).toHaveLength(4);
  });

  it('shows the player leaderboard', async () => {
    mockApi({
      '/tournaments/c1': tournament(),
      '/tournaments/c1/stats': [
        { playerId: 'p1', player: { id: 'p1', name: 'Ana' }, team: LEOES, duels: 3, wins: 2, draws: 1, losses: 0, goalsFor: 7, goalsAgainst: 2, goalDiff: 5, winRate: 2 / 3 },
      ],
    });
    renderRoute('/campeonatos/c1?aba=estatisticas');
    const table = await screen.findByRole('table', { name: 'Artilharia' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('1AnaLeões73267%');
    expect(within(table).getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/jogadores/p1');
  });

  it('explains that the bracket appears once a draft starts, but lists its teams', async () => {
    mockApi({ '/tournaments/c1': tournament({ status: 'draft', startedAt: null }) });
    renderRoute('/campeonatos/c1');
    expect(await screen.findByText('A chave aparece quando o campeonato começar.')).toBeInTheDocument();
    renderRoute('/campeonatos/c1?aba=times');
    expect(await screen.findAllByRole('link', { name: /Ver BID/ })).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/tournament.test.tsx`
Expected: FAIL — rota inexistente (404) e `window.bracketsViewer` sem tipo/uso.

- [ ] **Step 3: Implementar componentes**

`apps/web/src/components/BracketView.tsx`:
```tsx
import { useEffect, useId, useState } from 'react';
import type { BracketData } from '../api/types';
import { viewerRoundName, type ViewerRoundInfo } from '../lib/format';

declare global {
  interface Window {
    bracketsViewer: {
      render(data: unknown, config?: Record<string, unknown>): Promise<void>;
    };
  }
}

export function BracketView({ data }: { data: BracketData }) {
  const id = `bracket-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import('brackets-viewer/dist/brackets-viewer.min.js');
      await import('brackets-viewer/dist/brackets-viewer.min.css');
      if (cancelled) return;
      await window.bracketsViewer.render(
        { stages: data.stage, matches: data.match, matchGames: data.match_game, participants: data.participant },
        {
          selector: `#${id}`,
          clear: true,
          participantOriginPlacement: 'none',
          customRoundName: (info: ViewerRoundInfo) => viewerRoundName(info),
        },
      );
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [data, id]);

  if (failed) {
    return (
      <p className="state state-error" role="alert">
        Não foi possível desenhar a chave. Os confrontos continuam na aba Jogos.
      </p>
    );
  }
  return <div id={id} className="brackets-viewer bracket" />;
}
```

`apps/web/src/components/StandingsTable.tsx`:
```tsx
import { Link } from 'react-router';
import type { StandingRow } from '../api/types';
import { TeamBadge } from './TeamBadge';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="table-wrap">
      <table aria-label="Classificação">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="name">
              Time
            </th>
            <th scope="col" title="Pontos">
              P
            </th>
            <th scope="col" title="Confrontos jogados">
              J
            </th>
            <th scope="col" title="Vitórias">
              V
            </th>
            <th scope="col" title="Empates">
              E
            </th>
            <th scope="col" title="Saldo de gols">
              SG
            </th>
            <th scope="col" title="Duelos vencidos e perdidos">
              Duelos
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>{row.position}</td>
              <td className="name">
                <Link to={`/times/${row.team.id}`}>
                  <TeamBadge team={row.team} />
                  {row.team.name}
                </Link>
              </td>
              <td>
                <strong>{row.points}</strong>
              </td>
              <td>{row.played}</td>
              <td>{row.wins}</td>
              <td>{row.draws}</td>
              <td>{signed(row.goalDiff)}</td>
              <td className="muted">
                {row.duelsWon}–{row.duelsLost}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implementar as abas e a página**

`apps/web/src/pages/tournament/BracketTab.tsx`:
```tsx
import { useBracket } from '../../api/queries';
import { BracketView } from '../../components/BracketView';
import { QueryState } from '../../components/QueryState';

export function BracketTab({ id }: { id: string }) {
  const bracket = useBracket(id);
  return (
    <QueryState query={bracket}>
      {({ data }) => (data ? <BracketView data={data} /> : <p className="state">A chave aparece quando o campeonato começar.</p>)}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/StandingsTab.tsx`:
```tsx
import { useStandings } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { StandingsTable } from '../../components/StandingsTable';

export function StandingsTab({ id }: { id: string }) {
  const standings = useStandings(id);
  return (
    <QueryState query={standings}>
      {(rows) => (
        <>
          <StandingsTable rows={rows} />
          <p className="muted">
            Vitória vale 3 pontos e empate 1. Desempate: confronto direto, vitórias, saldo de gols e gols marcados.
          </p>
        </>
      )}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/FixturesTab.tsx`:
```tsx
import { useBracket, useTournamentFixtures } from '../../api/queries';
import type { FixtureListItem, Tournament } from '../../api/types';
import { MatchRow } from '../../components/MatchRow';
import { QueryState } from '../../components/QueryState';
import { roundCounts, roundLabel } from '../../lib/format';

export function FixturesTab({ tournament }: { tournament: Tournament }) {
  const fixtures = useTournamentFixtures(tournament.id);
  const bracket = useBracket(tournament.id);
  const counts = roundCounts(bracket.data?.data ?? null);

  return (
    <QueryState
      query={fixtures}
      isEmpty={(list) => list.length === 0}
      empty={<p className="state">Nenhum confronto definido ainda.</p>}
    >
      {(list) => {
        const rounds = new Map<string, FixtureListItem[]>();
        for (const fixture of list) {
          const key = `${fixture.groupNumber}-${fixture.roundNumber}`;
          rounds.set(key, [...(rounds.get(key) ?? []), fixture]);
        }
        return [...rounds.values()].map((round) => {
          const first = round[0]!;
          const title = roundLabel(tournament.format, first.groupNumber, first.roundNumber, counts.get(first.groupNumber) ?? first.roundNumber);
          return (
            <section key={`${first.groupNumber}-${first.roundNumber}`}>
              <h2>{title}</h2>
              <ul className="list">
                {round.map((fixture) => (
                  <li key={fixture.matchId}>
                    <MatchRow
                      to={`/campeonatos/${tournament.id}/jogos/${fixture.matchId}`}
                      teamA={fixture.teamA}
                      teamB={fixture.teamB}
                      scoreA={fixture.scoreA}
                      scoreB={fixture.scoreB}
                      status={fixture.status}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        });
      }}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/TeamsTab.tsx`:
```tsx
import { Link } from 'react-router';
import type { Tournament } from '../../api/types';
import { TeamBadge } from '../../components/TeamBadge';

export function TeamsTab({ tournament }: { tournament: Tournament }) {
  if (tournament.entries.length === 0) return <p className="state">Nenhum time inscrito ainda.</p>;
  return (
    <ul className="list">
      {tournament.entries.map(({ team }) => (
        <li key={team.id}>
          <Link to={`/times/${team.id}/bid`} className="row-link">
            <TeamBadge team={team} />
            <span className="row-title">{team.name}</span>
            <span className="row-meta">Ver BID</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/pages/tournament/StatsTab.tsx`:
```tsx
import { Link } from 'react-router';
import { useTournamentStats } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { percent } from '../../lib/format';

export function StatsTab({ id }: { id: string }) {
  const stats = useTournamentStats(id);
  return (
    <QueryState
      query={stats}
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="state">As estatísticas aparecem depois do primeiro resultado.</p>}
    >
      {(rows) => (
        <div className="table-wrap">
          <table aria-label="Artilharia">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="name">
                  Jogador
                </th>
                <th scope="col" className="name">
                  Time
                </th>
                <th scope="col">Gols</th>
                <th scope="col">Duelos</th>
                <th scope="col">Vitórias</th>
                <th scope="col">Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, index) => (
                <tr key={row.playerId}>
                  <td>{index + 1}</td>
                  <td className="name">
                    <Link to={`/jogadores/${row.player.id}`}>{row.player.name}</Link>
                  </td>
                  <td className="name muted">{row.team?.name ?? ''}</td>
                  <td>
                    <strong>{row.goalsFor}</strong>
                  </td>
                  <td>{row.duels}</td>
                  <td>{row.wins}</td>
                  <td>{percent(row.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QueryState>
  );
}
```

`apps/web/src/pages/tournament/TournamentPage.tsx`:
```tsx
import { useParams, useSearchParams } from 'react-router';
import { useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { Tabs } from '../../components/Tabs';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { BracketTab } from './BracketTab';
import { FixturesTab } from './FixturesTab';
import { StandingsTab } from './StandingsTab';
import { StatsTab } from './StatsTab';
import { TeamsTab } from './TeamsTab';

export function TournamentPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const tournament = useTournament(id);

  return (
    <QueryState query={tournament}>
      {(t) => {
        const tabs = [
          { id: 'chave', label: t.format === 'round_robin' ? 'Tabela' : 'Chave' },
          { id: 'jogos', label: 'Jogos' },
          { id: 'times', label: 'Times' },
          { id: 'estatisticas', label: 'Estatísticas' },
        ];
        const current = tabs.find((tab) => tab.id === params.get('aba'))?.id ?? 'chave';
        const notStarted = t.status === 'draft' && current !== 'times';

        return (
          <>
            <header className="page-header">
              <h1>{t.name}</h1>
              <p className="muted">
                {FORMAT_LABEL[t.format]}, {t.entries.length} times, {STATUS_LABEL[t.status].toLowerCase()}.
              </p>
            </header>
            <Tabs param="aba" items={tabs} current={current} label="Seções do campeonato" />
            {notStarted ? (
              <p className="state">A chave aparece quando o campeonato começar.</p>
            ) : current === 'chave' ? (
              t.format === 'round_robin' ? <StandingsTab id={t.id} /> : <BracketTab id={t.id} />
            ) : current === 'jogos' ? (
              <FixturesTab tournament={t} />
            ) : current === 'times' ? (
              <TeamsTab tournament={t} />
            ) : (
              <StatsTab id={t.id} />
            )}
          </>
        );
      }}
    </QueryState>
  );
}
```

Em `apps/web/src/router.tsx`, antes do `*`:
```tsx
      { path: 'campeonatos/:id', element: <TournamentPage /> },
```
com `import { TournamentPage } from './pages/tournament/TournamentPage';`.

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/web
```

---

### Task 5: Página do confronto

**Files:**
- Create: `apps/web/src/pages/FixturePage.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/test/fixture.test.tsx`

**Interfaces:**
- Consumes: `useFixture`, `useTournament`, `useBracket`, `Scoreboard`, `DuelStrip`, `roundLabel`, `roundCounts`, `outcomeOf`
- Produces: rota `/campeonatos/:id/jogos/:matchId`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/fixture.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDetail } from '../src/api/types';
import { LEOES, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const duel = (order: number, goalsA: number, goalsB: number, penaltiesA: number | null = null, penaltiesB: number | null = null) => ({
  order,
  playerA: { id: `a${order}`, name: `Ana ${order}` },
  playerB: { id: `b${order}`, name: `Bia ${order}` },
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});

const detail = (overrides: Partial<FixtureDetail> = {}): FixtureDetail => ({
  matchId: 2,
  groupNumber: 1,
  roundNumber: 2,
  number: 1,
  isKnockout: true,
  status: 'completed',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 2,
  scoreB: 3,
  duels: [duel(1, 1, 0), duel(2, 1, 0), duel(3, 0, 1), duel(4, 0, 2), duel(5, 2, 2), duel(6, 1, 1, 3, 4)],
  ...overrides,
});

const base = {
  '/tournaments/c1': {
    id: 'c1',
    name: 'Copa Outubro',
    format: 'single_elimination',
    status: 'in_progress',
    options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
    createdAt: '',
    startedAt: '',
    finishedAt: null,
    entries: [],
  },
  '/tournaments/c1/bracket': {
    data: { stage: [], group: [{ id: 0, stage_id: 0, number: 1 }], round: [{ id: 0, group_id: 0, number: 1 }, { id: 1, group_id: 0, number: 2 }], match: [], match_game: [], participant: [] },
  },
};

describe('fixture page', () => {
  it('shows the scoreboard, the duel strip and every duel with the tiebreak', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail() });
    renderRoute('/campeonatos/c1/jogos/2');
    await screen.findByRole('list', { name: 'Duelos' });
    expect(document.querySelector('.scoreboard-score')).toHaveTextContent(/2\s*×\s*a\s*3/);
    expect(await screen.findByRole('link', { name: 'Copa Outubro' })).toHaveAttribute('href', '/campeonatos/c1?aba=jogos');
    expect(await screen.findByText(', Final')).toBeInTheDocument();

    const strip = screen.getByRole('list', { name: 'Resultado de cada duelo' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(6);

    const duels = screen.getByRole('list', { name: 'Duelos' });
    const items = within(duels).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1ºAna 11 × 0Bia 1');
    expect(items[5]).toHaveTextContent('DesempateAna 61 × 1(3 × 4 nos pênaltis)Bia 6');
    expect(within(items[5]!).getByRole('link', { name: 'Bia 6' })).toHaveClass('duel-winner');
    expect(within(items[0]!).getByRole('link', { name: 'Ana 1' })).toHaveAttribute('href', '/jogadores/a1');
  });

  it('marks partial results', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail({ status: 'draft', scoreA: null, scoreB: null, duels: [duel(1, 1, 0)] }) });
    renderRoute('/campeonatos/c1/jogos/2');
    expect(await screen.findByText('Resultado parcial: ainda faltam duelos.')).toBeInTheDocument();
  });

  it('waits for the result of pending fixtures', async () => {
    mockApi({ ...base, '/tournaments/c1/fixtures/2': detail({ status: 'pending', scoreA: null, scoreB: null, duels: [] }) });
    renderRoute('/campeonatos/c1/jogos/2');
    expect(await screen.findByText('Aguardando resultado.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Duelos' })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/fixture.test.tsx`
Expected: FAIL — rota inexistente (404).

- [ ] **Step 3: Implementar**

`apps/web/src/pages/FixturePage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useBracket, useFixture, useTournament } from '../api/queries';
import type { DuelView } from '../api/types';
import { DuelStrip } from '../components/DuelStrip';
import { QueryState } from '../components/QueryState';
import { Scoreboard } from '../components/Scoreboard';
import { outcomeOf, roundCounts, roundLabel } from '../lib/format';

function DuelItem({ duel }: { duel: DuelView }) {
  const outcome = outcomeOf(duel);
  const playerClass = (side: 'A' | 'B') => `duel-player${side === 'B' ? ' duel-player-b' : ''}${outcome === side ? ' duel-winner' : ''}`;
  return (
    <li className={duel.order === 6 ? 'duel-tiebreak' : undefined}>
      <span className="duel-order">{duel.order === 6 ? 'Desempate' : `${duel.order}º`}</span>
      <Link to={`/jogadores/${duel.playerA.id}`} className={playerClass('A')}>
        {duel.playerA.name}
      </Link>
      <span className="duel-score">
        {duel.goalsA} × {duel.goalsB}
        {duel.penaltiesA !== null && duel.penaltiesB !== null && (
          <small>
            ({duel.penaltiesA} × {duel.penaltiesB} nos pênaltis)
          </small>
        )}
      </span>
      <Link to={`/jogadores/${duel.playerB.id}`} className={playerClass('B')}>
        {duel.playerB.name}
      </Link>
    </li>
  );
}

export function FixturePage() {
  const { id = '', matchId = '' } = useParams();
  const fixture = useFixture(id, Number(matchId));
  const tournament = useTournament(id);
  const bracket = useBracket(id);

  return (
    <QueryState query={fixture}>
      {(f) => {
        const counts = roundCounts(bracket.data?.data ?? null);
        const round = tournament.data
          ? roundLabel(tournament.data.format, f.groupNumber, f.roundNumber, counts.get(f.groupNumber) ?? f.roundNumber)
          : null;
        return (
          <>
            <p className="hero-context">
              <Link to={`/campeonatos/${id}?aba=jogos`}>{tournament.data?.name ?? 'Campeonato'}</Link>
              {round && <span>, {round}</span>}
            </p>
            <h1 className="visually-hidden">
              {f.teamA.name} contra {f.teamB.name}
            </h1>
            <Scoreboard teamA={f.teamA} teamB={f.teamB} scoreA={f.scoreA} scoreB={f.scoreB} />
            {f.status === 'pending' ? (
              <p className="state">Aguardando resultado.</p>
            ) : (
              <>
                {f.status === 'draft' && <p className="notice">Resultado parcial: ainda faltam duelos.</p>}
                <DuelStrip duels={f.duels} teamA={f.teamA.name} teamB={f.teamB.name} />
                <ol className="duel-list" aria-label="Duelos">
                  {f.duels.map((duel) => (
                    <DuelItem key={duel.order} duel={duel} />
                  ))}
                </ol>
              </>
            )}
          </>
        );
      }}
    </QueryState>
  );
}
```

Em `apps/web/src/router.tsx`, antes do `*`:
```tsx
      { path: 'campeonatos/:id/jogos/:matchId', element: <FixturePage /> },
```
com `import { FixturePage } from './pages/FixturePage';`.

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 6: Times, página do time e BID

**Files:**
- Create: `apps/web/src/components/RosterList.tsx`
- Create: `apps/web/src/pages/TeamsPage.tsx`, `apps/web/src/pages/TeamPage.tsx`, `apps/web/src/pages/TeamBidPage.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/test/teams.test.tsx`

**Interfaces:**
- Consumes: `useTeams`, `useTeam`, `useRoster`, `formatPhone`, `positionLabel`, `FORMAT_LABEL`, `STATUS_LABEL`, `MatchRow`, `TeamBadge`
- Produces:
  - `RosterList({ players })` — nome (link para o jogador) + celular formatado como link `wa.me` (`target="_blank"`, `rel="noopener noreferrer"`, `aria-label="Abrir WhatsApp de <nome>"`); sem celular → só o nome
  - rotas `/times`, `/times/:id`, `/times/:id/bid`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/teams.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TeamPageData } from '../src/api/types';
import { LEOES, TIGRES, fixtureSummary } from './data';
import { mockApi, renderRoute } from './utils';

const roster = [
  { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' },
  { id: 'p2', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000' },
];

const teamPage = (overrides: Partial<TeamPageData> = {}): TeamPageData => ({
  team: LEOES,
  roster,
  stats: {
    teamId: 't1',
    fixtures: { played: 3, wins: 2, draws: 0, losses: 1 },
    duels: { played: 15, wins: 8, draws: 3, losses: 4 },
    goalsFor: 20,
    goalsAgainst: 12,
    goalDiff: 8,
  },
  titles: [{ id: 'x', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro' }],
  recentFixtures: [fixtureSummary()],
  tournaments: [{ id: 'c1', name: 'Copa Outubro', format: 'single_elimination', status: 'finished' }],
  ...overrides,
});

describe('teams', () => {
  it('lists every team with its player count', async () => {
    mockApi({ '/teams': [{ ...LEOES, playerCount: 12 }, { ...TIGRES, playerCount: 1 }] });
    renderRoute('/times');
    expect(await screen.findByRole('link', { name: /Leões.*12 jogadores/ })).toHaveAttribute('href', '/times/t1');
    expect(screen.getByRole('link', { name: /Tigres.*1 jogador$/ })).toBeInTheDocument();
  });

  it('shows the team page with numbers, titles, recent fixtures and roster', async () => {
    mockApi({ '/teams/t1': teamPage() });
    renderRoute('/times/t1');
    expect(await screen.findByRole('heading', { name: 'Leões', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver BID' })).toHaveAttribute('href', '/times/t1/bid');
    expect(screen.getByText('2-0-1')).toBeInTheDocument();
    expect(screen.getByText('8-3-4')).toBeInTheDocument();
    expect(screen.getByText('Campeão')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Leões\s*3\s*×?\s*a\s*2\s*Tigres/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/0');
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp de Ana' })).toHaveAttribute('href', 'https://wa.me/5511987654321');
  });

  it('shows the BID with formatted phones opening WhatsApp in a new tab', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: roster } });
    renderRoute('/times/t1/bid');
    expect(await screen.findByRole('heading', { name: 'Leões', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('BID com 2 jogadores.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir WhatsApp de Ana' });
    expect(link).toHaveTextContent('(11) 98765-4321');
    expect(link).toHaveAttribute('href', 'https://wa.me/5511987654321');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows only names when the API hides phones', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: [{ id: 'p1', name: 'Ana' }] } });
    renderRoute('/times/t1/bid');
    const list = await screen.findByRole('list', { name: 'Jogadores do BID' });
    expect(within(list).getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/jogadores/p1');
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull();
  });

  it('explains an empty roster', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: [] } });
    renderRoute('/times/t1/bid');
    expect(await screen.findByText('Nenhum jogador no elenco.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/teams.test.tsx`
Expected: FAIL — rotas inexistentes (404).

- [ ] **Step 3: Implementar**

`apps/web/src/components/RosterList.tsx`:
```tsx
import { Link } from 'react-router';
import type { RosterPlayer } from '../api/types';
import { formatPhone } from '../lib/format';

export function RosterList({ players }: { players: RosterPlayer[] }) {
  if (players.length === 0) return <p className="state">Nenhum jogador no elenco.</p>;
  return (
    <ul className="roster" aria-label="Jogadores do BID">
      {players.map((player) => (
        <li key={player.id}>
          <Link to={`/jogadores/${player.id}`} className="roster-name">
            {player.name}
          </Link>
          {player.phone && player.whatsappUrl && (
            <a
              href={player.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="roster-phone"
              aria-label={`Abrir WhatsApp de ${player.name}`}
            >
              {formatPhone(player.phone)}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/pages/TeamsPage.tsx`:
```tsx
import { Link } from 'react-router';
import { useTeams } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { TeamBadge } from '../components/TeamBadge';

export function TeamsPage() {
  const teams = useTeams();
  return (
    <>
      <h1>Times</h1>
      <QueryState query={teams} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum time cadastrado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((team) => (
              <li key={team.id}>
                <Link to={`/times/${team.id}`} className="row-link">
                  <TeamBadge team={team} />
                  <span className="row-title">{team.name}</span>
                  <span className="row-meta">
                    {team.playerCount} {team.playerCount === 1 ? 'jogador' : 'jogadores'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
```

`apps/web/src/pages/TeamPage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useTeam } from '../api/queries';
import type { RecordTally } from '../api/types';
import { MatchRow } from '../components/MatchRow';
import { QueryState } from '../components/QueryState';
import { RosterList } from '../components/RosterList';
import { TeamBadge } from '../components/TeamBadge';
import { STATUS_LABEL, positionLabel } from '../lib/format';

const record = (tally: RecordTally) => `${tally.wins}-${tally.draws}-${tally.losses}`;

export function TeamPage() {
  const { id = '' } = useParams();
  const team = useTeam(id);

  return (
    <QueryState query={team}>
      {(data) => (
        <>
          <header className="team-header">
            <TeamBadge team={data.team} size="lg" />
            <h1>{data.team.name}</h1>
          </header>
          <Link to={`/times/${data.team.id}/bid`} className="button-link">
            Ver BID
          </Link>

          <h2>Números</h2>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{record(data.stats.fixtures)}</span>
              <span className="stat-label">Confrontos (V-E-D)</span>
            </div>
            <div className="stat">
              <span className="stat-value">{record(data.stats.duels)}</span>
              <span className="stat-label">Duelos (V-E-D)</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.goalsFor}/{data.stats.goalsAgainst}
              </span>
              <span className="stat-label">Gols marcados/sofridos</span>
            </div>
          </div>

          <h2>Títulos</h2>
          {data.titles.length === 0 ? (
            <p className="muted">Nenhum título ainda.</p>
          ) : (
            <ul className="list">
              {data.titles.map((title) => (
                <li key={title.id} className="row-link">
                  <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                  <span className="row-title">{title.tournamentName}</span>
                  <span className="row-meta">{title.year}</span>
                </li>
              ))}
            </ul>
          )}

          <h2>Últimos confrontos</h2>
          {data.recentFixtures.length === 0 ? (
            <p className="muted">Nenhum confronto jogado ainda.</p>
          ) : (
            <ul className="list">
              {data.recentFixtures.map((fixture) => (
                <li key={`${fixture.tournamentId}-${fixture.matchId}`}>
                  <MatchRow
                    to={`/campeonatos/${fixture.tournamentId}/jogos/${fixture.matchId}`}
                    teamA={fixture.teamA}
                    teamB={fixture.teamB}
                    scoreA={fixture.scoreA}
                    scoreB={fixture.scoreB}
                    status="completed"
                    caption={fixture.tournamentName}
                  />
                </li>
              ))}
            </ul>
          )}

          <h2>Elenco</h2>
          <RosterList players={data.roster} />

          {data.tournaments.length > 0 && (
            <>
              <h2>Campeonatos</h2>
              <ul className="list">
                {data.tournaments.map((tournament) => (
                  <li key={tournament.id}>
                    <Link to={`/campeonatos/${tournament.id}`} className="row-link">
                      <span className="row-title">{tournament.name}</span>
                      <span className="row-meta">{STATUS_LABEL[tournament.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </QueryState>
  );
}
```

`apps/web/src/pages/TeamBidPage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useRoster } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { RosterList } from '../components/RosterList';
import { TeamBadge } from '../components/TeamBadge';

export function TeamBidPage() {
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
          <p className="muted">
            {players.length > 0 && <span>BID com {players.length} {players.length === 1 ? 'jogador' : 'jogadores'}. </span>}
            <Link to={`/times/${team.id}`}>Ver página do time</Link>
          </p>
          <RosterList players={players} />
        </>
      )}
    </QueryState>
  );
}
```

Em `apps/web/src/router.tsx`, antes do `*`:
```tsx
      { path: 'times', element: <TeamsPage /> },
      { path: 'times/:id', element: <TeamPage /> },
      { path: 'times/:id/bid', element: <TeamBidPage /> },
```
com os imports das três páginas.

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/web && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/web
```

---

### Task 7: Página do jogador e títulos

**Files:**
- Create: `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/pages/TitlesPage.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/test/player-titles.test.tsx`

**Interfaces:**
- Consumes: `usePlayer`, `useTitles`, `percent`, `positionLabel`, `formatDate`, `TeamBadge`
- Produces: rotas `/jogadores/:id` e `/titulos`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/player-titles.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlayerPageData, TitlesData } from '../src/api/types';
import { FALCOES, LEOES, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const player: PlayerPageData = {
  player: { id: 'p1', name: 'Ana' },
  currentTeam: LEOES,
  teamHistory: [
    { team: LEOES, joinedAt: '2026-09-01T00:00:00.000Z', leftAt: null },
    { team: FALCOES, joinedAt: '2026-01-01T00:00:00.000Z', leftAt: '2026-08-31T00:00:00.000Z' },
  ],
  stats: { playerId: 'p1', duels: 4, wins: 2, draws: 1, losses: 1, goalsFor: 9, goalsAgainst: 4, goalDiff: 5, winRate: 0.5 },
  duels: [
    {
      tournamentId: 'c1',
      tournamentName: 'Copa Outubro',
      matchId: 3,
      order: 6,
      team: LEOES,
      opponentTeam: TIGRES,
      opponent: { id: 'p9', name: 'Bia' },
      goalsFor: 1,
      goalsAgainst: 1,
      penaltiesFor: 5,
      penaltiesAgainst: 4,
      result: 'win',
      playedAt: '2026-10-10T22:00:00.000Z',
    },
  ],
  titles: [{ position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: LEOES }],
};

const titles: TitlesData = {
  ranking: [
    { team: LEOES, champion: 2, runnerUp: 0, third: 1 },
    { team: TIGRES, champion: 0, runnerUp: 2, third: 0 },
  ],
  titles: [
    { id: 'a', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: LEOES },
    { id: 'b', position: 2, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: TIGRES },
    { id: 'c', position: 1, year: 2025, tournamentId: null, tournamentName: 'Liga 2025', team: LEOES },
  ],
};

describe('player page', () => {
  it('shows the current team, numbers, duel history and titles', async () => {
    mockApi({ '/players/p1': player });
    renderRoute('/jogadores/p1');
    expect(await screen.findByRole('heading', { name: 'Ana', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Leões' })[0]).toHaveAttribute('href', '/times/t1');
    expect(screen.getByText('50%')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'Histórico de duelos' });
    const [entry] = within(history).getAllByRole('listitem');
    expect(entry).toHaveTextContent('V');
    expect(entry).toHaveTextContent('1 × 1 (5 × 4 nos pênaltis)');
    expect(entry).toHaveTextContent('Bia (Tigres)');
    expect(within(entry!).getByRole('link', { name: /Copa Outubro, desempate/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/3');
    expect(screen.getByText('Campeão')).toBeInTheDocument();
    expect(screen.getByText('Falcões')).toBeInTheDocument();
  });

  it('explains when the player has not played yet', async () => {
    mockApi({ '/players/p1': { ...player, duels: [], titles: [], stats: { ...player.stats, duels: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, winRate: 0 } } });
    renderRoute('/jogadores/p1');
    expect(await screen.findByText('Nenhum duelo jogado ainda.')).toBeInTheDocument();
  });
});

describe('titles page', () => {
  it('ranks teams and lists podiums by tournament', async () => {
    mockApi({ '/titles': titles });
    renderRoute('/titulos');
    const table = await screen.findByRole('table', { name: 'Ranking de títulos' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Leões201');
    expect(screen.getByRole('heading', { name: 'Copa Outubro (2026)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Liga 2025 (2025)' })).toBeInTheDocument();
  });

  it('explains when there are no titles yet', async () => {
    mockApi({ '/titles': { ranking: [], titles: [] } });
    renderRoute('/titulos');
    expect(await screen.findByText('Os títulos aparecem quando o primeiro campeonato for encerrado.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/web -- test/player-titles.test.tsx`
Expected: FAIL — rotas inexistentes (404).

- [ ] **Step 3: Implementar**

`apps/web/src/pages/PlayerPage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { usePlayer } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { formatDate, percent, positionLabel } from '../lib/format';

const RESULT = {
  win: { label: 'V', title: 'Vitória', className: 'chip chip-win' },
  draw: { label: 'E', title: 'Empate', className: 'chip' },
  loss: { label: 'D', title: 'Derrota', className: 'chip chip-loss' },
} as const;

export function PlayerPage() {
  const { id = '' } = useParams();
  const player = usePlayer(id);

  return (
    <QueryState query={player}>
      {(data) => (
        <>
          <header className="page-header">
            <h1>{data.player.name}</h1>
            <p className="muted">
              {data.currentTeam ? <Link to={`/times/${data.currentTeam.id}`}>{data.currentTeam.name}</Link> : 'Sem time no momento'}
            </p>
          </header>

          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{data.stats.duels}</span>
              <span className="stat-label">Duelos</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.wins}-{data.stats.draws}-{data.stats.losses}
              </span>
              <span className="stat-label">V-E-D</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.goalsFor}/{data.stats.goalsAgainst}
              </span>
              <span className="stat-label">Gols marcados/sofridos</span>
            </div>
            <div className="stat">
              <span className="stat-value">{percent(data.stats.winRate)}</span>
              <span className="stat-label">Aproveitamento</span>
            </div>
          </div>

          <h2>Duelos</h2>
          {data.duels.length === 0 ? (
            <p className="muted">Nenhum duelo jogado ainda.</p>
          ) : (
            <ul className="list" aria-label="Histórico de duelos">
              {data.duels.map((duel) => {
                const result = RESULT[duel.result];
                const round = duel.order === 6 ? 'desempate' : `${duel.order}º duelo`;
                return (
                  <li key={`${duel.tournamentId}-${duel.matchId}-${duel.order}`} className="row-link">
                    <span className={result.className} title={result.title}>
                      {result.label}
                    </span>
                    <span className="row-title">
                      {duel.goalsFor} × {duel.goalsAgainst}
                      {duel.penaltiesFor !== null && duel.penaltiesAgainst !== null && (
                        <> ({duel.penaltiesFor} × {duel.penaltiesAgainst} nos pênaltis)</>
                      )}{' '}
                      <span className="muted">
                        contra {duel.opponent.name} ({duel.opponentTeam.name})
                      </span>
                    </span>
                    <Link to={`/campeonatos/${duel.tournamentId}/jogos/${duel.matchId}`} className="row-meta">
                      {duel.tournamentName}, {round}
                      {duel.playedAt && <>, {formatDate(duel.playedAt)}</>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data.titles.length > 0 && (
            <>
              <h2>Títulos</h2>
              <ul className="list">
                {data.titles.map((title) => (
                  <li key={`${title.tournamentId}-${title.position}`} className="row-link">
                    <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                    <span className="row-title">{title.tournamentName}</span>
                    <span className="row-meta">
                      {title.team.name}, {title.year}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2>Times</h2>
          <ul className="list">
            {data.teamHistory.map((entry) => (
              <li key={`${entry.team.id}-${entry.joinedAt}`} className="row-link">
                <Link to={`/times/${entry.team.id}`} className="row-title">
                  {entry.team.name}
                </Link>
                <span className="row-meta">
                  {formatDate(entry.joinedAt)} até {entry.leftAt ? formatDate(entry.leftAt) : 'hoje'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </QueryState>
  );
}
```

`apps/web/src/pages/TitlesPage.tsx`:
```tsx
import { Link } from 'react-router';
import { useTitles } from '../api/queries';
import type { TitleEntry } from '../api/types';
import { QueryState } from '../components/QueryState';
import { TeamBadge } from '../components/TeamBadge';
import { positionLabel } from '../lib/format';

function groupByTournament(titles: TitleEntry[]) {
  const groups = new Map<string, TitleEntry[]>();
  for (const title of titles) {
    const key = `${title.tournamentId ?? title.tournamentName}-${title.year}`;
    groups.set(key, [...(groups.get(key) ?? []), title]);
  }
  return [...groups.values()].map((entries) => entries.sort((a, b) => a.position - b.position));
}

export function TitlesPage() {
  const titles = useTitles();
  return (
    <>
      <h1>Títulos</h1>
      <QueryState
        query={titles}
        isEmpty={(data) => data.titles.length === 0}
        empty={<p className="state">Os títulos aparecem quando o primeiro campeonato for encerrado.</p>}
      >
        {(data) => (
          <>
            <div className="table-wrap">
              <table aria-label="Ranking de títulos">
                <thead>
                  <tr>
                    <th scope="col" className="name">
                      Time
                    </th>
                    <th scope="col">Campeão</th>
                    <th scope="col">Vice</th>
                    <th scope="col">3º</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking.map((row) => (
                    <tr key={row.team.id}>
                      <td className="name">
                        <Link to={`/times/${row.team.id}`}>
                          <TeamBadge team={row.team} />
                          {row.team.name}
                        </Link>
                      </td>
                      <td>
                        <strong>{row.champion}</strong>
                      </td>
                      <td>{row.runnerUp}</td>
                      <td>{row.third}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {groupByTournament(data.titles).map((podium) => {
              const first = podium[0]!;
              return (
                <section key={first.id}>
                  <h2>
                    {first.tournamentName} ({first.year})
                  </h2>
                  <ul className="list">
                    {podium.map((title) => (
                      <li key={title.id}>
                        <Link to={`/times/${title.team.id}`} className="row-link">
                          <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                          <TeamBadge team={title.team} />
                          <span className="row-title">{title.team.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </QueryState>
    </>
  );
}
```

Em `apps/web/src/router.tsx`, antes do `*`:
```tsx
      { path: 'jogadores/:id', element: <PlayerPage /> },
      { path: 'titulos', element: <TitlesPage /> },
```
com os imports das duas páginas.

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
- Create: `apps/web/README.md` não é necessário; nenhuma alteração de código esperada (correções encontradas aqui entram com teste na task correspondente)

- [ ] **Step 1: Suíte completa e build**

Run: `npm test && npm run typecheck && npm run build -w @kickabout/web`
Expected: shared, api e web PASS; typecheck limpo; build sem erros.

- [ ] **Step 2: Dados de demonstração e servidores**

Com o Postgres no ar, subir API (`npm run dev:api`) e site (`npm run dev:web`), entrar como admin via `POST /api/auth/login` e criar pela API: 4 times com 6 jogadores, um campeonato de eliminatória simples iniciado e uma semifinal lançada com 6º duelo nos pênaltis.

- [ ] **Step 3: Verificação visual**

Abrir `http://localhost:5173` em 375px e 1280px de largura e conferir: início com placar grande, aba Chave desenhando o brackets-viewer no tema escuro, aba Jogos com nomes de rodada, página do confronto com barra de duelos (6º segmento âmbar) e pênaltis, BID com celulares em link `wa.me`, nomes longos sem estourar a largura (Review Focus 5). Registrar no ledger o que foi visto; problemas viram correções com teste.

- [ ] **Step 4: Commit do plano**

```bash
git add -A
git commit -m "feat(web): public site with tournaments, fixtures, teams, BID, players and titles"
```
