# Kickabout — Plano 2: API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/api`: API HTTP (Fastify + Prisma + PostgreSQL) com login do admin, times/jogadores/BID, campeonatos nos 3 formatos via brackets-manager, lançamento de resultados, classificação, estatísticas, finalização e títulos — tudo coberto por testes de integração contra Postgres real.

**Architecture:** `buildApp({ prisma, config })` monta um Fastify com rotas em `/api`, organizadas por domínio (`auth/`, `teams/`, `players/`, `tournaments/`, `fixtures/`, `titles/`). Regras de negócio vêm de `@kickabout/shared` (Plano 1). O estado das chaves de cada campeonato é um JSON em `Tournament.bracket`, manipulado pelo brackets-manager num banco em memória dentro de uma transação que trava a linha do campeonato. Testes usam `app.inject()` contra um banco `kickabout_test` no Postgres do Docker Compose.

**Tech Stack:** Node 22, TypeScript strict, Fastify 5.12.5, @fastify/cookie 11.1.2, Prisma 6.19.3 (PostgreSQL 16), Zod 4.6.5, @node-rs/argon2 2.2.1, brackets-manager 1.11.1 + brackets-memory-db 1.0.6 + brackets-model 1.7.0, tsx 4.23.15, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-15-kickabout-v1-design.md`

## Global Constraints

- Todas as rotas sob o prefixo `/api`. Leitura pública; escrita exige sessão de admin (`401 UNAUTHENTICATED` sem sessão).
- Erros: `{ "error": { "code": string, "message": string (pt-BR), "details"?: unknown } }`.
- Celular só aparece em endpoints de BID (`/teams/:id/roster`, `roster` em `/teams/:id`) e em `/players` (admin). Com `PHONE_VISIBILITY=authenticated`, visitante sem sessão não recebe `phone` nem `whatsappUrl`.
- Máximo de **20 jogadores ativos** por time (`MAX_ACTIVE_ROSTER`); 1 vínculo ativo por jogador.
- Regras de duelo, validação, classificação e estatísticas vêm **somente** de `@kickabout/shared` — não reimplementar.
- Mata-mata = formatos `single_elimination` e `double_elimination`; `round_robin` aceita empate.
- Chaves de eliminação: `size` = próxima potência de 2 com `balanceByes: true`.
- Senha com argon2; cookie de sessão `kb_session` httpOnly, `sameSite=lax`, `secure` em produção; token guardado no banco apenas como hash SHA-256.
- Versões de dependência exatamente as do Tech Stack.
- Commit único ao final do plano (preferência do usuário); os passos de commit por tarefa ficam como checkpoints de `git add`, sem commit.

## Review Focus

1. **Dois lançamentos simultâneos no mesmo campeonato** (duas abas) — o `SELECT … FOR UPDATE` serializa; nenhuma atualização da chave pode se perder. Testado na Task 5.
2. **Jogador transferido depois de jogar** — editar o resultado antigo continua aceitando-o (elenco ativo ∪ jogadores já lançados naquele confronto). Testado na Task 5.
3. **`PHONE_VISIBILITY=authenticated`** — nenhum endpoint público (detalhe de jogador, de confronto, estatísticas, BID) vaza o celular para visitante. Testado na Task 7.
4. **Número de times que não é potência de 2** (3 no mata-mata simples, 3 na dupla) — inicia com BYEs, termina e finaliza com pódio correto. Testado na Task 6.
5. **Cookie de sessão expirado ou inventado** — tratado como visitante (401 em rota admin), nunca erro 500. Testado na Task 2.

---

## File Structure

```
kickabout/
├── docker-compose.yml                 # Postgres 16 na porta 5433
├── docker/init-test-db.sql            # cria kickabout_test
└── apps/api/
    ├── package.json · tsconfig.json · vitest.config.ts · .env.example
    ├── prisma/schema.prisma · prisma/migrations/
    ├── src/
    │   ├── server.ts            # entrypoint
    │   ├── app.ts               # buildApp
    │   ├── config.ts            # loadConfig
    │   ├── deps.ts              # AppDeps
    │   ├── db.ts                # createPrisma, Db
    │   ├── errors.ts            # AppError, parse, handler, isUniqueViolation
    │   ├── dto.ts               # TeamRef, idParams, teamsById
    │   ├── auth/{password,sessions,hooks,routes}.ts
    │   ├── scripts/create-admin.ts
    │   ├── teams/routes.ts
    │   ├── players/{roster,routes}.ts
    │   ├── tournaments/{options,stage,bracket-store,bracket-view,podium,routes}.ts
    │   ├── fixtures/{detail,save-result,routes}.ts
    │   ├── stats/queries.ts
    │   └── titles/routes.ts
    └── test/
        ├── global-setup.ts · helpers.ts
        └── *.test.ts
```

---

### Task 1: Scaffold da API, banco e health check

**Files:**
- Create: `docker-compose.yml`, `docker/init-test-db.sql`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/.env.example`, `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/{config,deps,db,errors,dto,app,server}.ts`
- Create: `apps/api/test/global-setup.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/config.test.ts`, `apps/api/test/health.test.ts`

**Interfaces:**
- Produces:
  - `loadConfig(env?): AppConfig` — `AppConfig { port: number; databaseUrl: string; phoneVisibility: 'public' | 'authenticated'; sessionTtlDays: number; secureCookies: boolean }`
  - `AppDeps { prisma: PrismaClient; config: AppConfig }`; `type Db = PrismaClient | Prisma.TransactionClient`; `createPrisma(url)`
  - `class AppError(statusCode, code, message, details?)`; `notFound(what)`; `parse(schema, data)` (lança `400 INVALID_REQUEST`); `isUniqueViolation(error)`; `registerErrorHandler(app)`
  - `TeamRef { id; name; shortName; crestUrl: string | null }`, `teamRef(t)`, `teamRefSelect`, `idParams`, `teamsById(db, ids): Promise<Map<string, TeamRef>>`
  - `buildApp({ prisma, config, logger? }): FastifyInstance` — rotas em `/api`; `GET /api/health → { ok: true }`
  - test helpers: `prisma`, `testConfig(overrides)`, `createTestApp(overrides)`, `resetDb()`

- [ ] **Step 1: Docker Compose do Postgres**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kickabout
      POSTGRES_PASSWORD: kickabout
      POSTGRES_DB: kickabout
    ports:
      - "5433:5432"
    volumes:
      - kickabout-db:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro

volumes:
  kickabout-db:
```

`docker/init-test-db.sql`:
```sql
CREATE DATABASE kickabout_test OWNER kickabout;
```

Run: `docker compose up -d db && docker compose exec db psql -U kickabout -c '\l'`
Expected: lista inclui `kickabout` e `kickabout_test`.

- [ ] **Step 2: Pacote da API**

`apps/api/package.json`:
```json
{
  "name": "@kickabout/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "start": "tsx --env-file=.env src/server.ts",
    "create-admin": "tsx --env-file=.env src/scripts/create-admin.ts",
    "db:migrate": "prisma migrate dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@fastify/cookie": "11.1.2",
    "@kickabout/shared": "*",
    "@node-rs/argon2": "2.2.1",
    "@prisma/client": "6.19.3",
    "brackets-manager": "1.11.1",
    "brackets-memory-db": "1.0.6",
    "brackets-model": "1.7.0",
    "fastify": "5.12.5",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "prisma": "6.19.3",
    "tsx": "4.23.15"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`apps/api/.env.example`:
```
DATABASE_URL=postgresql://kickabout:kickabout@localhost:5433/kickabout
PORT=3333
PHONE_VISIBILITY=public
SESSION_TTL_DAYS=30
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://kickabout:kickabout@localhost:5433/kickabout_test';
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 3: Schema Prisma**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  role         String       @default("admin")
  createdAt    DateTime     @default(now())
  sessions     Session[]
  teams        Team[]
  tournaments  Tournament[]
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model Team {
  id          String            @id @default(cuid())
  name        String            @unique
  shortName   String
  crestUrl    String?
  ownerId     String
  owner       User              @relation(fields: [ownerId], references: [id])
  createdAt   DateTime          @default(now())
  memberships TeamMembership[]
  entries     TournamentEntry[]
  titles      Title[]
  fixturesAsA Fixture[]         @relation("FixtureTeamA")
  fixturesAsB Fixture[]         @relation("FixtureTeamB")
  duelsAsA    Duel[]            @relation("DuelTeamA")
  duelsAsB    Duel[]            @relation("DuelTeamB")
}

model Player {
  id          String           @id @default(cuid())
  name        String
  phone       String           @unique
  createdAt   DateTime         @default(now())
  memberships TeamMembership[]
  duelsAsA    Duel[]           @relation("DuelPlayerA")
  duelsAsB    Duel[]           @relation("DuelPlayerB")
}

model TeamMembership {
  id       String    @id @default(cuid())
  teamId   String
  team     Team      @relation(fields: [teamId], references: [id])
  playerId String
  player   Player    @relation(fields: [playerId], references: [id])
  joinedAt DateTime  @default(now())
  leftAt   DateTime?

  @@index([teamId, leftAt])
  @@index([playerId, leftAt])
}

enum TournamentFormat {
  single_elimination
  double_elimination
  round_robin
}

enum TournamentStatus {
  draft
  in_progress
  finished
}

enum FixtureStatus {
  draft
  completed
}

model Tournament {
  id         String            @id @default(cuid())
  name       String
  format     TournamentFormat
  status     TournamentStatus  @default(draft)
  options    Json
  bracket    Json?
  ownerId    String
  owner      User              @relation(fields: [ownerId], references: [id])
  createdAt  DateTime          @default(now())
  startedAt  DateTime?
  finishedAt DateTime?
  entries    TournamentEntry[]
  fixtures   Fixture[]
  titles     Title[]
}

model TournamentEntry {
  tournamentId String
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  teamId       String
  team         Team       @relation(fields: [teamId], references: [id])
  seed         Int

  @@id([tournamentId, teamId])
  @@unique([tournamentId, seed])
}

model Fixture {
  id           String        @id @default(cuid())
  tournamentId String
  tournament   Tournament    @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  bmMatchId    Int
  teamAId      String
  teamA        Team          @relation("FixtureTeamA", fields: [teamAId], references: [id])
  teamBId      String
  teamB        Team          @relation("FixtureTeamB", fields: [teamBId], references: [id])
  status       FixtureStatus
  isKnockout   Boolean
  scoreA       Int?
  scoreB       Int?
  winnerTeamId String?
  playedAt     DateTime?
  updatedAt    DateTime      @updatedAt
  duels        Duel[]

  @@unique([tournamentId, bmMatchId])
  @@index([status, playedAt])
}

model Duel {
  id         String  @id @default(cuid())
  fixtureId  String
  fixture    Fixture @relation(fields: [fixtureId], references: [id], onDelete: Cascade)
  order      Int
  playerAId  String
  playerA    Player  @relation("DuelPlayerA", fields: [playerAId], references: [id])
  playerBId  String
  playerB    Player  @relation("DuelPlayerB", fields: [playerBId], references: [id])
  teamAId    String
  teamA      Team    @relation("DuelTeamA", fields: [teamAId], references: [id])
  teamBId    String
  teamB      Team    @relation("DuelTeamB", fields: [teamBId], references: [id])
  goalsA     Int
  goalsB     Int
  penaltiesA Int?
  penaltiesB Int?

  @@unique([fixtureId, order])
  @@index([playerAId])
  @@index([playerBId])
}

model Title {
  id             String      @id @default(cuid())
  teamId         String
  team           Team        @relation(fields: [teamId], references: [id])
  tournamentId   String?
  tournament     Tournament? @relation(fields: [tournamentId], references: [id], onDelete: SetNull)
  tournamentName String
  position       Int
  year           Int
  createdAt      DateTime    @default(now())
}
```

- [ ] **Step 4: Instalar e criar a migração inicial (com índice parcial)**

Run (raiz): `cp apps/api/.env.example apps/api/.env && npm install`
Expected: instala sem vulnerabilidades críticas.

Run: `cd apps/api && npx prisma migrate dev --name init --create-only`
Expected: cria `prisma/migrations/<timestamp>_init/migration.sql`.

Acrescentar ao final do `migration.sql` gerado:
```sql
-- Um jogador só pode ter um vínculo ativo por vez.
CREATE UNIQUE INDEX "TeamMembership_one_active_per_player" ON "TeamMembership"("playerId") WHERE "leftAt" IS NULL;
```

Run: `npx prisma migrate dev`
Expected: migração aplicada no banco `kickabout`; Prisma Client gerado.

- [ ] **Step 5: Escrever os testes que falham**

`apps/api/test/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({ DATABASE_URL: 'postgresql://x' })).toEqual({
      port: 3333,
      databaseUrl: 'postgresql://x',
      phoneVisibility: 'public',
      sessionTtlDays: 30,
      secureCookies: false,
    });
  });

  it('reads overrides and enables secure cookies in production', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://x',
      PORT: '4000',
      PHONE_VISIBILITY: 'authenticated',
      SESSION_TTL_DAYS: '7',
      NODE_ENV: 'production',
    });
    expect(config).toMatchObject({ port: 4000, phoneVisibility: 'authenticated', sessionTtlDays: 7, secureCookies: true });
  });

  it('rejects a missing database url and an invalid phone visibility', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL');
    expect(() => loadConfig({ DATABASE_URL: 'x', PHONE_VISIBILITY: 'todos' })).toThrow('PHONE_VISIBILITY');
  });
});
```

`apps/api/test/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup() {
  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    stdio: 'inherit',
  });
}
```

`apps/api/test/helpers.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import type { AppConfig } from '../src/config';

export const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    databaseUrl: process.env.DATABASE_URL ?? '',
    phoneVisibility: 'public',
    sessionTtlDays: 30,
    secureCookies: false,
    ...overrides,
  };
}

export function createTestApp(overrides: Partial<AppConfig> = {}): FastifyInstance {
  return buildApp({ prisma, config: testConfig(overrides) });
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Duel", "Fixture", "Title", "TournamentEntry", "Tournament", "TeamMembership", "Player", "Team", "Session", "User" CASCADE',
  );
}
```

`apps/api/test/health.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

const app = createTestApp();
afterAll(() => app.close());

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api`
Expected: FAIL — `Cannot find module '../src/config'` / `'../src/app'`.

- [ ] **Step 7: Implementar**

`apps/api/src/config.ts`:
```ts
export type PhoneVisibility = 'public' | 'authenticated';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  phoneVisibility: PhoneVisibility;
  sessionTtlDays: number;
  secureCookies: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  const phoneVisibility = env.PHONE_VISIBILITY ?? 'public';
  if (phoneVisibility !== 'public' && phoneVisibility !== 'authenticated') {
    throw new Error(`PHONE_VISIBILITY inválida: ${phoneVisibility}`);
  }
  return {
    port: Number(env.PORT ?? 3333),
    databaseUrl,
    phoneVisibility,
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    secureCookies: env.NODE_ENV === 'production',
  };
}
```

`apps/api/src/db.ts`:
```ts
import { PrismaClient, type Prisma } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
```

`apps/api/src/deps.ts`:
```ts
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config';

export interface AppDeps {
  prisma: PrismaClient;
  config: AppConfig;
}
```

`apps/api/src/errors.ts`:
```ts
import { Prisma } from '@prisma/client';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} não encontrado.`);

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Dados inválidos.',
      result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    );
  }
  return result.data;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({ error: { code: (error as FastifyError).code ?? 'BAD_REQUEST', message: error.message } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Erro interno.' } });
  });
}
```

`apps/api/src/dto.ts`:
```ts
import { z } from 'zod';
import type { Db } from './db';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export const teamRefSelect = { id: true, name: true, shortName: true, crestUrl: true } as const;

export const teamRef = (team: TeamRef): TeamRef => ({
  id: team.id,
  name: team.name,
  shortName: team.shortName,
  crestUrl: team.crestUrl,
});

export const idParams = z.object({ id: z.string().min(1) });

export async function teamsById(db: Db, ids: Iterable<string>): Promise<Map<string, TeamRef>> {
  const teams = await db.team.findMany({ where: { id: { in: [...new Set(ids)] } }, select: teamRefSelect });
  return new Map(teams.map((team) => [team.id, teamRef(team)]));
}
```

`apps/api/src/app.ts`:
```ts
import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppDeps } from './deps';
import { registerErrorHandler } from './errors';

export function buildApp(deps: AppDeps & { logger?: boolean }): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  app.register(cookie);
  registerErrorHandler(app);

  app.register(
    async (api) => {
      api.get('/health', async () => ({ ok: true }));
    },
    { prefix: '/api' },
  );

  return app;
}
```

`apps/api/src/server.ts`:
```ts
import { buildApp } from './app';
import { loadConfig } from './config';
import { createPrisma } from './db';

const config = loadConfig();
const app = buildApp({ prisma: createPrisma(config.databaseUrl), config, logger: true });
await app.listen({ port: config.port, host: '0.0.0.0' });
```

- [ ] **Step 8: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: `config.test.ts` e `health.test.ts` PASS; typecheck de shared e api sem erros.

- [ ] **Step 9: Checkpoint**

```bash
git add docker-compose.yml docker apps/api package-lock.json
```

---

### Task 2: Autenticação do admin

**Files:**
- Create: `apps/api/src/auth/password.ts`, `apps/api/src/auth/sessions.ts`, `apps/api/src/auth/hooks.ts`, `apps/api/src/auth/routes.ts`, `apps/api/src/scripts/create-admin.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/auth.test.ts`

**Interfaces:**
- Consumes: `AppDeps`, `AppError`, `parse`
- Produces:
  - `hashPassword(pw)`, `verifyPassword(hash, pw)`
  - `SESSION_COOKIE = 'kb_session'`, `createSession(db, userId, ttlDays)`, `findSessionUser(db, token)`, `deleteSession(db, token)`
  - `AuthUser { id; email; role }`; `request.user: AuthUser | null`; `registerAuth(app, deps)`; `requireAdmin(request)` (preHandler, lança `401 UNAUTHENTICATED`)
  - Rotas: `POST /api/auth/login {email,password} → { user }` + cookie; `POST /api/auth/logout → { ok: true }`; `GET /api/auth/me → { user | null }`
  - test helpers: `ADMIN`, `loginAdmin(app): Promise<string>` (valor para o header `cookie`)

- [ ] **Step 1: Helper de login nos testes**

Acrescentar a `apps/api/test/helpers.ts`:
```ts
import { hashPassword } from '../src/auth/password';

export const ADMIN = { email: 'admin@kickabout.test', password: 'senha-forte-123' };

export async function loginAdmin(app: FastifyInstance): Promise<string> {
  await prisma.user.upsert({
    where: { email: ADMIN.email },
    create: { email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password) },
    update: {},
  });
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: ADMIN });
  const cookie = res.cookies.find((c) => c.name === 'kb_session');
  if (!cookie) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  return `kb_session=${cookie.value}`;
}
```

- [ ] **Step 2: Escrever o teste que falha**

`apps/api/test/auth.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/sessions';
import { ADMIN, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

describe('auth', () => {
  it('logs in, exposes /me and logs out', async () => {
    const cookie = await loginAdmin(app);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ user: { email: ADMIN.email, role: 'admin' } });

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.json()).toEqual({ user: null });
  });

  it('sets an httpOnly lax cookie and stores only the token hash', async () => {
    await loginAdmin(app);
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: ADMIN });
    const cookie = res.cookies.find((c) => c.name === 'kb_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    const session = await prisma.session.findUnique({ where: { id: hashToken(cookie!.value) } });
    expect(session).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: cookie!.value } })).toBeNull();
  });

  it('rejects wrong credentials with a Portuguese message', async () => {
    await loginAdmin(app);
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { ...ADMIN, password: 'errada' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } });
  });

  it('accepts the email in any case', async () => {
    await loginAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN.email.toUpperCase(), password: ADMIN.password },
    });
    expect(res.statusCode).toBe(200);
  });

  it('treats expired or forged session cookies as anonymous', async () => {
    const cookie = await loginAdmin(app);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(expired.json()).toEqual({ user: null });

    const forged = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: 'kb_session=inventado' } });
    expect(forged.statusCode).toBe(200);
    expect(forged.json()).toEqual({ user: null });
  });

  it('validates the login body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/auth.test.ts`
Expected: FAIL — `Cannot find module '../src/auth/sessions'` (ou `../src/auth/password` via helpers).

- [ ] **Step 4: Implementar**

`apps/api/src/auth/password.ts`:
```ts
import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password: string): Promise<string> => hash(password);

export const verifyPassword = (passwordHash: string, password: string): Promise<boolean> =>
  verify(passwordHash, password);
```

`apps/api/src/auth/sessions.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db';

export const SESSION_COOKIE = 'kb_session';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string, ttlDays: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function findSessionUser(db: Db, token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
```

`apps/api/src/auth/hooks.ts`:
```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppDeps } from '../deps';
import { AppError } from '../errors';
import { SESSION_COOKIE, findSessionUser, type AuthUser } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export function registerAuth(app: FastifyInstance, { prisma }: AppDeps) {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? await findSessionUser(prisma, token) : null;
  });
}

export async function requireAdmin(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.');
}
```

`apps/api/src/auth/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../deps';
import { AppError, parse } from '../errors';
import { verifyPassword } from './password';
import { SESSION_COOKIE, createSession, deleteSession } from './sessions';

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, { prisma, config }: AppDeps) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = parse(loginBody, request.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
    }
    const { token, expiresAt } = await createSession(prisma, user.id, config.sessionTtlDays);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/',
      expires: expiresAt,
    });
    return { user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(prisma, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', async (request) => ({ user: request.user }));
}
```

`apps/api/src/scripts/create-admin.ts`:
```ts
import { hashPassword } from '../auth/password';
import { loadConfig } from '../config';
import { createPrisma } from '../db';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 8) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres) no apps/api/.env.');
  process.exit(1);
}

const prisma = createPrisma(loadConfig().databaseUrl);
const passwordHash = await hashPassword(password);
await prisma.user.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
console.log(`Admin ${email} pronto.`);
await prisma.$disconnect();
```

Em `apps/api/src/app.ts`, dentro do plugin com prefixo `/api` (antes do `/health`):
```ts
      registerAuth(api, deps);
      registerAuthRoutes(api, deps);
```
com os imports:
```ts
import { registerAuth } from './auth/hooks';
import { registerAuthRoutes } from './auth/routes';
```

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/api
```

---

### Task 3: Times, jogadores e BID

**Files:**
- Create: `apps/api/src/players/roster.ts`, `apps/api/src/players/routes.ts`, `apps/api/src/teams/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/teams-players.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `AppError`, `parse`, `isUniqueViolation`, `teamRef`, `idParams`, `normalizePhone`, `whatsappUrl`, `MAX_ACTIVE_ROSTER`
- Produces:
  - `canSeePhones(request, config): boolean`
  - `rosterPlayer(player, showPhone): { id; name; phone?; whatsappUrl? }`
  - `activePlayers(db, teamId): Promise<Player[]>` (ordenado por nome); `activePlayerIds(db, teamId): Promise<string[]>`
  - `setPlayerTeam(tx, playerId, teamId | null)` — lança `409 ROSTER_FULL`
  - `findTeamOrThrow(db, id)`
  - Rotas:
    - `GET /api/teams → (TeamRef & { playerCount })[]`
    - `POST /api/teams` (admin) `{ name, shortName, crestUrl? } → 201 TeamRef & { playerCount: 0 }` — `409 TEAM_NAME_TAKEN`
    - `PATCH /api/teams/:id` (admin) → `TeamRef`
    - `GET /api/teams/:id/roster → { team: TeamRef, players: RosterPlayer[] }` (BID)
    - `GET /api/players?search=` (admin) → `{ id, name, phone, whatsappUrl, team: TeamRef | null }[]`
    - `POST /api/players` (admin) `{ name, phone, teamId? } → 201` mesma forma — `400 INVALID_PHONE`, `409 PHONE_TAKEN`, `409 ROSTER_FULL`
    - `PATCH /api/players/:id` (admin) `{ name?, phone? }`
    - `PUT /api/players/:id/team` (admin) `{ teamId: string | null } → { playerId, teamId }`
  - test helpers: `createTeam(app, cookie, name)`, `createPlayer(app, cookie, { name?, phone?, teamId? })`, `createTeamWithPlayers(app, cookie, name, count = 6)`

- [ ] **Step 1: Helpers de fábrica nos testes**

Acrescentar a `apps/api/test/helpers.ts`:
```ts
let phoneCounter = 0;
export const nextPhone = () => `11 9${String(++phoneCounter).padStart(8, '0')}`;

export interface TestTeam {
  id: string;
  name: string;
}
export interface TestPlayer {
  id: string;
  name: string;
}

export async function createTeam(app: FastifyInstance, cookie: string, name: string): Promise<TestTeam> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teams',
    headers: { cookie },
    payload: { name, shortName: name.slice(0, 3).toUpperCase() },
  });
  if (res.statusCode !== 201) throw new Error(`createTeam: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createPlayer(
  app: FastifyInstance,
  cookie: string,
  data: { name?: string; phone?: string; teamId?: string | null } = {},
): Promise<TestPlayer & { phone: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/players',
    headers: { cookie },
    payload: { name: data.name ?? `Jogador ${phoneCounter + 1}`, phone: data.phone ?? nextPhone(), teamId: data.teamId },
  });
  if (res.statusCode !== 201) throw new Error(`createPlayer: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createTeamWithPlayers(app: FastifyInstance, cookie: string, name: string, count = 6) {
  const team = await createTeam(app, cookie, name);
  const players: TestPlayer[] = [];
  for (let i = 1; i <= count; i++) players.push(await createPlayer(app, cookie, { name: `${name} ${i}`, teamId: team.id }));
  return { team, players };
}
```

- [ ] **Step 2: Escrever o teste que falha**

`apps/api/test/teams-players.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlayer, createTeam, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

describe('teams', () => {
  it('requires login to create', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/teams', payload: { name: 'Leões', shortName: 'LEO' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('creates, lists with player count and rejects duplicate names', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    await createPlayer(app, cookie, { teamId: team.id });

    const list = await app.inject({ method: 'GET', url: '/api/teams' });
    expect(list.json()).toEqual([{ id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null, playerCount: 1 }]);

    const dup = await app.inject({ method: 'POST', url: '/api/teams', headers: { cookie }, payload: { name: 'Leões', shortName: 'L2' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'TEAM_NAME_TAKEN' } });
  });

  it('updates a team', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/teams/${team.id}`,
      headers: { cookie },
      payload: { name: 'Leões FC', crestUrl: 'https://example.com/leoes.png' },
    });
    expect(res.json()).toMatchObject({ name: 'Leões FC', crestUrl: 'https://example.com/leoes.png' });
  });
});

describe('players and BID', () => {
  it('normalizes the phone and exposes it in the public BID with a WhatsApp link', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const player = await createPlayer(app, cookie, { name: 'Ana', phone: '(11) 98765-4321', teamId: team.id });
    expect(player.phone).toBe('+5511987654321');

    const bid = await app.inject({ method: 'GET', url: `/api/teams/${team.id}/roster` });
    expect(bid.json()).toEqual({
      team: { id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null },
      players: [{ id: player.id, name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' }],
    });
  });

  it('hides phones from visitors when PHONE_VISIBILITY=authenticated', async () => {
    const privateApp = createTestApp({ phoneVisibility: 'authenticated' });
    const cookie = await loginAdmin(privateApp);
    const team = await createTeam(privateApp, cookie, 'Leões');
    const player = await createPlayer(privateApp, cookie, { name: 'Ana', teamId: team.id });

    const anon = await privateApp.inject({ method: 'GET', url: `/api/teams/${team.id}/roster` });
    expect(anon.json().players).toEqual([{ id: player.id, name: 'Ana' }]);

    const admin = await privateApp.inject({ method: 'GET', url: `/api/teams/${team.id}/roster`, headers: { cookie } });
    expect(admin.json().players[0]).toHaveProperty('phone');
    await privateApp.close();
  });

  it('rejects invalid and duplicated phones', async () => {
    const cookie = await loginAdmin(app);
    const invalid = await app.inject({ method: 'POST', url: '/api/players', headers: { cookie }, payload: { name: 'X', phone: '123' } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'INVALID_PHONE' } });

    await createPlayer(app, cookie, { phone: '(11) 98765-4321' });
    const dup = await app.inject({ method: 'POST', url: '/api/players', headers: { cookie }, payload: { name: 'Y', phone: '+55 11 98765-4321' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'PHONE_TAKEN' } });
  });

  it('enforces the 20 active players limit', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    for (let i = 0; i < 20; i++) await createPlayer(app, cookie, { teamId: team.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/players',
      headers: { cookie },
      payload: { name: 'Vinte e um', phone: '11 91111-1111', teamId: team.id },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'ROSTER_FULL', message: 'O time já tem 20 jogadores ativos.' } });
    expect(await prisma.player.count()).toBe(20);
  });

  it('transfers a player keeping the membership history', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeam(app, cookie, 'Leões');
    const b = await createTeam(app, cookie, 'Tigres');
    const player = await createPlayer(app, cookie, { teamId: a.id });

    const res = await app.inject({ method: 'PUT', url: `/api/players/${player.id}/team`, headers: { cookie }, payload: { teamId: b.id } });
    expect(res.json()).toEqual({ playerId: player.id, teamId: b.id });

    const rosterA = await app.inject({ method: 'GET', url: `/api/teams/${a.id}/roster` });
    const rosterB = await app.inject({ method: 'GET', url: `/api/teams/${b.id}/roster` });
    expect(rosterA.json().players).toEqual([]);
    expect(rosterB.json().players.map((p: { id: string }) => p.id)).toEqual([player.id]);

    const memberships = await prisma.teamMembership.findMany({ where: { playerId: player.id }, orderBy: { joinedAt: 'asc' } });
    expect(memberships.map((m) => [m.teamId, m.leftAt === null])).toEqual([
      [a.id, false],
      [b.id, true],
    ]);
  });

  it('removes a player from his team with teamId null', async () => {
    const cookie = await loginAdmin(app);
    const a = await createTeam(app, cookie, 'Leões');
    const player = await createPlayer(app, cookie, { teamId: a.id });
    await app.inject({ method: 'PUT', url: `/api/players/${player.id}/team`, headers: { cookie }, payload: { teamId: null } });
    const roster = await app.inject({ method: 'GET', url: `/api/teams/${a.id}/roster` });
    expect(roster.json().players).toEqual([]);
  });

  it('lists and searches players for the admin only', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    await createPlayer(app, cookie, { name: 'Ana Souza', phone: '11 98765-4321', teamId: team.id });
    await createPlayer(app, cookie, { name: 'Bruno' });

    expect((await app.inject({ method: 'GET', url: '/api/players' })).statusCode).toBe(401);

    const byName = await app.inject({ method: 'GET', url: '/api/players?search=ana', headers: { cookie } });
    expect(byName.json()).toEqual([
      {
        id: expect.any(String),
        name: 'Ana Souza',
        phone: '+5511987654321',
        whatsappUrl: 'https://wa.me/5511987654321',
        team: { id: team.id, name: 'Leões', shortName: 'LEÕ', crestUrl: null },
      },
    ]);

    const byPhone = await app.inject({ method: 'GET', url: '/api/players?search=98765', headers: { cookie } });
    expect(byPhone.json()).toHaveLength(1);
  });

  it('edits a player name and phone', async () => {
    const cookie = await loginAdmin(app);
    const player = await createPlayer(app, cookie, { name: 'Ana' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/players/${player.id}`,
      headers: { cookie },
      payload: { name: 'Ana Souza', phone: '21 99999-0000' },
    });
    expect(res.json()).toMatchObject({ name: 'Ana Souza', phone: '+5521999990000' });
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/teams-players.test.ts`
Expected: FAIL — rotas inexistentes (`createTeam: 404 …`).

- [ ] **Step 4: Implementar**

`apps/api/src/players/roster.ts`:
```ts
import { MAX_ACTIVE_ROSTER, whatsappUrl } from '@kickabout/shared';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';
import type { Db } from '../db';
import { AppError, notFound } from '../errors';

export interface RosterPlayer {
  id: string;
  name: string;
  phone?: string;
  whatsappUrl?: string;
}

export const canSeePhones = (request: FastifyRequest, config: AppConfig): boolean =>
  config.phoneVisibility === 'public' || request.user !== null;

export function rosterPlayer(player: { id: string; name: string; phone: string }, showPhone: boolean): RosterPlayer {
  return showPhone
    ? { id: player.id, name: player.name, phone: player.phone, whatsappUrl: whatsappUrl(player.phone) }
    : { id: player.id, name: player.name };
}

export async function findTeamOrThrow(db: Db, id: string) {
  const team = await db.team.findUnique({ where: { id } });
  if (!team) throw notFound('Time');
  return team;
}

export async function activePlayers(db: Db, teamId: string) {
  const memberships = await db.teamMembership.findMany({
    where: { teamId, leftAt: null },
    include: { player: true },
    orderBy: { player: { name: 'asc' } },
  });
  return memberships.map((membership) => membership.player);
}

export async function activePlayerIds(db: Db, teamId: string): Promise<string[]> {
  const memberships = await db.teamMembership.findMany({ where: { teamId, leftAt: null }, select: { playerId: true } });
  return memberships.map((membership) => membership.playerId);
}

export async function setPlayerTeam(db: Db, playerId: string, teamId: string | null) {
  const current = await db.teamMembership.findFirst({ where: { playerId, leftAt: null } });
  if ((current?.teamId ?? null) === teamId) return;
  if (teamId) {
    const count = await db.teamMembership.count({ where: { teamId, leftAt: null } });
    if (count >= MAX_ACTIVE_ROSTER) {
      throw new AppError(409, 'ROSTER_FULL', `O time já tem ${MAX_ACTIVE_ROSTER} jogadores ativos.`);
    }
  }
  if (current) await db.teamMembership.update({ where: { id: current.id }, data: { leftAt: new Date() } });
  if (teamId) await db.teamMembership.create({ data: { teamId, playerId } });
}
```

`apps/api/src/teams/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { teamRef, idParams } from '../dto';
import { AppError, isUniqueViolation, parse } from '../errors';
import { activePlayers, canSeePhones, findTeamOrThrow, rosterPlayer } from '../players/roster';

const teamBody = z.object({
  name: z.string().trim().min(1).max(60),
  shortName: z.string().trim().min(1).max(5).toUpperCase(),
  crestUrl: z.url().nullable().optional(),
});

const nameTaken = () => new AppError(409, 'TEAM_NAME_TAKEN', 'Já existe um time com esse nome.');

export function registerTeamRoutes(app: FastifyInstance, { prisma, config }: AppDeps) {
  app.get('/teams', async () => {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { memberships: { where: { leftAt: null } } } } },
    });
    return teams.map((team) => ({ ...teamRef(team), playerCount: team._count.memberships }));
  });

  app.post('/teams', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(teamBody, request.body);
    try {
      const team = await prisma.team.create({
        data: { name: body.name, shortName: body.shortName, crestUrl: body.crestUrl ?? null, ownerId: request.user!.id },
      });
      return reply.status(201).send({ ...teamRef(team), playerCount: 0 });
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  });

  app.patch('/teams/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(teamBody.partial(), request.body);
    await findTeamOrThrow(prisma, id);
    try {
      return teamRef(await prisma.team.update({ where: { id }, data: body }));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  });

  app.get('/teams/:id/roster', async (request) => {
    const { id } = parse(idParams, request.params);
    const team = await findTeamOrThrow(prisma, id);
    const showPhone = canSeePhones(request, config);
    const players = await activePlayers(prisma, id);
    return { team: teamRef(team), players: players.map((player) => rosterPlayer(player, showPhone)) };
  });
}
```

`apps/api/src/players/routes.ts`:
```ts
import { normalizePhone, whatsappUrl } from '@kickabout/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { Db } from '../db';
import type { AppDeps } from '../deps';
import { idParams, teamRef } from '../dto';
import { AppError, isUniqueViolation, notFound, parse } from '../errors';
import { findTeamOrThrow, setPlayerTeam } from './roster';

const playerBody = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().min(1),
  teamId: z.string().min(1).nullable().optional(),
});
const playerPatch = playerBody.pick({ name: true, phone: true }).partial();
const teamBody = z.object({ teamId: z.string().min(1).nullable() });
const searchQuery = z.object({ search: z.string().trim().optional() });

function phoneOrThrow(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Número de celular inválido.');
  return phone;
}

const phoneTaken = () => new AppError(409, 'PHONE_TAKEN', 'Já existe um jogador com esse celular.');

async function adminPlayer(db: Db, id: string) {
  const player = await db.player.findUnique({
    where: { id },
    include: { memberships: { where: { leftAt: null }, include: { team: true } } },
  });
  if (!player) throw notFound('Jogador');
  const team = player.memberships[0]?.team;
  return {
    id: player.id,
    name: player.name,
    phone: player.phone,
    whatsappUrl: whatsappUrl(player.phone),
    team: team ? teamRef(team) : null,
  };
}

export function registerPlayerRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/players', { preHandler: requireAdmin }, async (request) => {
    const { search } = parse(searchQuery, request.query);
    const digits = search?.replace(/\D/g, '') ?? '';
    const players = await prisma.player.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              ...(digits ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : {},
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    return Promise.all(players.map((player) => adminPlayer(prisma, player.id)));
  });

  app.post('/players', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(playerBody, request.body);
    const phone = phoneOrThrow(body.phone);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const player = await tx.player.create({ data: { name: body.name, phone } });
        if (body.teamId) {
          await findTeamOrThrow(tx, body.teamId);
          await setPlayerTeam(tx, player.id, body.teamId);
        }
        return player.id;
      });
      return reply.status(201).send(await adminPlayer(prisma, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw phoneTaken();
      throw error;
    }
  });

  app.patch('/players/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(playerPatch, request.body);
    await adminPlayer(prisma, id);
    try {
      await prisma.player.update({
        where: { id },
        data: { name: body.name, phone: body.phone === undefined ? undefined : phoneOrThrow(body.phone) },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw phoneTaken();
      throw error;
    }
    return adminPlayer(prisma, id);
  });

  app.put('/players/:id/team', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { teamId } = parse(teamBody, request.body);
    await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id } });
      if (!player) throw notFound('Jogador');
      if (teamId) await findTeamOrThrow(tx, teamId);
      await setPlayerTeam(tx, id, teamId);
    });
    return { playerId: id, teamId };
  });
}
```

Em `apps/api/src/app.ts`, registrar depois das rotas de auth:
```ts
      registerTeamRoutes(api, deps);
      registerPlayerRoutes(api, deps);
```
com imports `import { registerTeamRoutes } from './teams/routes';` e `import { registerPlayerRoutes } from './players/routes';`.

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/api
```

---

### Task 4: Campeonatos — cadastro, inscrições e geração da chave

**Files:**
- Create: `apps/api/src/tournaments/options.ts`, `apps/api/src/tournaments/stage.ts`, `apps/api/src/tournaments/bracket-store.ts`, `apps/api/src/tournaments/bracket-view.ts`, `apps/api/src/tournaments/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/stage.test.ts`, `apps/api/test/bracket-view.test.ts`, `apps/api/test/tournaments.test.ts`

**Interfaces:**
- Consumes: `teamRef`, `teamRefSelect`, `teamsById`, `idParams`, `requireAdmin`, `AppError`, `notFound`, `parse`
- Produces:
  - `TournamentOptions { consolationFinal: boolean; grandFinalReset: boolean; roundRobinMode: 'simple' | 'double' }`; `optionsSchema`; `normalizeOptions(input?)`
  - `nextPowerOfTwo(n)`; `stageInput(t): InputStage` com `t = { id; name; format; options: TournamentOptions; entries: { team: { id; name } }[] }`; `MIN_TEAMS`
  - `BracketData` (= `Database` do brackets-model); `managerFor(data | null): Promise<BracketsManager>`; `withBracket(tx, tournamentId, fn)`
  - `MATCH_STATUS`; `MatchView { matchId; groupNumber; roundNumber; number; status; teamAId; teamBId; participantAId; participantBId; scoreA: number | null; scoreB: number | null }`; `teamIdByParticipant(data)`; `matchView(data, match)`; `listMatches(data)`; `findMatch(data, matchId)`; `isStageComplete(data)`; `laterCompletedMatchIds(data, matchId)`
  - `loadTournament(db, id)`; `tournamentDto(t)`
  - Rotas:
    - `GET /api/tournaments?status= → { id, name, format, status, teamCount, startedAt, finishedAt }[]`
    - `GET /api/tournaments/:id → TournamentDto` = `{ id, name, format, status, options, createdAt, startedAt, finishedAt, entries: { seed, team: TeamRef }[] }`
    - `POST /api/tournaments` (admin) `{ name, format, options? } → 201 TournamentDto`
    - `PATCH /api/tournaments/:id` (admin) `{ name?, format?, options? }` — formato/opções só em `draft` (`409 TOURNAMENT_LOCKED`)
    - `PUT /api/tournaments/:id/entries` (admin) `{ teamIds: string[] }` (ordem = seed) — só em `draft`; `400 UNKNOWN_TEAM`
    - `POST /api/tournaments/:id/start` (admin) → `TournamentDto` — `409 TOURNAMENT_ALREADY_STARTED`, `409 NOT_ENOUGH_TEAMS`
    - `GET /api/tournaments/:id/bracket → { data: BracketData | null }` (nomes dos participantes = nomes atuais dos times)
  - test helper: `createStartedTournament(app, cookie, { format, teams, options? })`

- [ ] **Step 1: Escrever os testes unitários que falham**

`apps/api/test/stage.test.ts`:
```ts
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
```

`apps/api/test/bracket-view.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { managerFor } from '../src/tournaments/bracket-store';
import { MATCH_STATUS, isStageComplete, laterCompletedMatchIds, listMatches } from '../src/tournaments/bracket-view';
import { normalizeOptions } from '../src/tournaments/options';
import { stageInput } from '../src/tournaments/stage';

async function seBracket(teams: number, consolationFinal = false) {
  const manager = await managerFor(null);
  await manager.create.stage(
    stageInput({
      id: 'x',
      name: 'Copa',
      format: 'single_elimination',
      options: normalizeOptions({ consolationFinal }),
      entries: Array.from({ length: teams }, (_, i) => ({ team: { id: `t${i}`, name: `Time ${i}` } })),
    }),
  );
  return manager;
}

const winA = { opponent1: { score: 3, result: 'win' as const }, opponent2: { score: 1 } };

describe('bracket view', () => {
  it('lists only matches with both teams known and maps them to team ids', async () => {
    const manager = await seBracket(3);
    const data = await manager.export();
    const matches = listMatches(data);
    // 3 times numa chave de 4: um BYE, logo só 1 confronto jogável na 1ª rodada.
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ roundNumber: 1, status: MATCH_STATUS.Ready, scoreA: null, scoreB: null });
    expect([matches[0]!.teamAId, matches[0]!.teamBId].sort()).toEqual(['t1', 't2']);
  });

  it('detects completion ignoring bye matches', async () => {
    const manager = await seBracket(3);
    let data = await manager.export();
    expect(isStageComplete(data)).toBe(false);
    for (let i = 0; i < 5; i++) {
      const ready = listMatches(await manager.export()).find((m) => m.status === MATCH_STATUS.Ready);
      if (!ready) break;
      await manager.update.match({ id: ready.matchId, ...winA });
    }
    data = await manager.export();
    expect(isStageComplete(data)).toBe(true);
  });

  it('lists later completed matches that block an edit', async () => {
    const manager = await seBracket(4);
    const [semi1, semi2] = listMatches(await manager.export());
    await manager.update.match({ id: semi1!.matchId, ...winA });
    await manager.update.match({ id: semi2!.matchId, ...winA });
    const final = listMatches(await manager.export()).find((m) => m.roundNumber === 2)!;
    await manager.update.match({ id: final.matchId, ...winA });
    expect(laterCompletedMatchIds(await manager.export(), semi1!.matchId)).toEqual([final.matchId]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/stage.test.ts test/bracket-view.test.ts`
Expected: FAIL — `Cannot find module '../src/tournaments/options'`.

- [ ] **Step 3: Implementar módulos puros**

`apps/api/src/tournaments/options.ts`:
```ts
import { z } from 'zod';

export const optionsSchema = z.object({
  consolationFinal: z.boolean().optional(),
  grandFinalReset: z.boolean().optional(),
  roundRobinMode: z.enum(['simple', 'double']).optional(),
});

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
}

export const normalizeOptions = (input: z.infer<typeof optionsSchema> = {}): TournamentOptions => ({
  consolationFinal: input.consolationFinal ?? false,
  grandFinalReset: input.grandFinalReset ?? false,
  roundRobinMode: input.roundRobinMode ?? 'simple',
});
```

`apps/api/src/tournaments/stage.ts`:
```ts
import type { TournamentFormat } from '@prisma/client';
import type { InputStage } from 'brackets-model';
import type { TournamentOptions } from './options';

export const MIN_TEAMS: Record<TournamentFormat, number> = {
  single_elimination: 2,
  double_elimination: 3,
  round_robin: 2,
};

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

export interface StageSource {
  id: string;
  name: string;
  format: TournamentFormat;
  options: TournamentOptions;
  entries: { team: { id: string; name: string } }[];
}

export function stageInput(t: StageSource): InputStage {
  const seeding = t.entries.map((entry) => ({ name: entry.team.name, teamId: entry.team.id }));
  const base = { tournamentId: t.id, name: t.name, seeding };
  switch (t.format) {
    case 'round_robin':
      return { ...base, type: 'round_robin', settings: { groupCount: 1, roundRobinMode: t.options.roundRobinMode } };
    case 'single_elimination':
      return {
        ...base,
        type: 'single_elimination',
        settings: { size: nextPowerOfTwo(seeding.length), balanceByes: true, consolationFinal: t.options.consolationFinal },
      };
    case 'double_elimination':
      return {
        ...base,
        type: 'double_elimination',
        settings: {
          size: nextPowerOfTwo(seeding.length),
          balanceByes: true,
          grandFinal: t.options.grandFinalReset ? 'double' : 'simple',
        },
      };
  }
}
```

`apps/api/src/tournaments/bracket-store.ts`:
```ts
import type { Prisma } from '@prisma/client';
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Database } from 'brackets-model';

export type BracketData = Database;

export async function managerFor(data: BracketData | null): Promise<BracketsManager> {
  const manager = new BracketsManager(new InMemoryDatabase());
  if (data) await manager.import(data);
  return manager;
}

/**
 * Executa `fn` sobre o bracket do campeonato e grava o resultado.
 * Deve ser chamado dentro de `prisma.$transaction`: a linha do campeonato fica travada até o commit.
 */
export async function withBracket<T>(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  fn: (manager: BracketsManager) => Promise<T>,
): Promise<T> {
  await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;
  const { bracket } = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { bracket: true } });
  const manager = await managerFor(bracket as unknown as BracketData | null);
  const result = await fn(manager);
  const data = await manager.export();
  await tx.tournament.update({ where: { id: tournamentId }, data: { bracket: data as unknown as Prisma.InputJsonValue } });
  return result;
}
```

`apps/api/src/tournaments/bracket-view.ts`:
```ts
import type { Match, Participant } from 'brackets-model';
import type { BracketData } from './bracket-store';

export const MATCH_STATUS = { Locked: 0, Waiting: 1, Ready: 2, Running: 3, Completed: 4, Archived: 5 } as const;

export interface MatchView {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  status: number;
  teamAId: string;
  teamBId: string;
  participantAId: number;
  participantBId: number;
  scoreA: number | null;
  scoreB: number | null;
}

export function teamIdByParticipant(data: BracketData): Map<number, string> {
  return new Map(data.participant.map((p) => [Number(p.id), (p as Participant & { teamId: string }).teamId]));
}

export function matchView(data: BracketData, match: Match): MatchView | null {
  const a = match.opponent1?.id;
  const b = match.opponent2?.id;
  if (a == null || b == null) return null;
  const teams = teamIdByParticipant(data);
  const teamAId = teams.get(Number(a));
  const teamBId = teams.get(Number(b));
  if (!teamAId || !teamBId) return null;
  return {
    matchId: Number(match.id),
    groupNumber: data.group.find((g) => g.id === match.group_id)?.number ?? 1,
    roundNumber: data.round.find((r) => r.id === match.round_id)?.number ?? 1,
    number: match.number,
    status: match.status,
    teamAId,
    teamBId,
    participantAId: Number(a),
    participantBId: Number(b),
    scoreA: match.opponent1?.score ?? null,
    scoreB: match.opponent2?.score ?? null,
  };
}

export function listMatches(data: BracketData): MatchView[] {
  return data.match.map((match) => matchView(data, match)).filter((view): view is MatchView => view !== null);
}

export function findMatch(data: BracketData, matchId: number): Match | undefined {
  return data.match.find((match) => Number(match.id) === matchId);
}

/** Completo quando toda partida é BYE ou já tem resultado. */
export function isStageComplete(data: BracketData): boolean {
  return data.match.every(
    (match) => match.opponent1 === null || match.opponent2 === null || match.status >= MATCH_STATUS.Completed,
  );
}

/** Partidas posteriores, já com resultado, que envolvem algum dos times da partida informada. */
export function laterCompletedMatchIds(data: BracketData, matchId: number): number[] {
  const match = findMatch(data, matchId);
  if (!match) return [];
  const participants = new Set(
    [match.opponent1?.id, match.opponent2?.id].filter((id) => id != null).map(Number),
  );
  return data.match
    .filter(
      (other) =>
        Number(other.id) > matchId &&
        other.status >= MATCH_STATUS.Completed &&
        [other.opponent1?.id, other.opponent2?.id].some((id) => id != null && participants.has(Number(id))),
    )
    .map((other) => Number(other.id));
}
```

- [ ] **Step 4: Rodar testes unitários**

Run: `npm test -w @kickabout/api -- test/stage.test.ts test/bracket-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Helper e teste de integração que falha**

Acrescentar a `apps/api/test/helpers.ts`:
```ts
export async function createStartedTournament(
  app: FastifyInstance,
  cookie: string,
  input: { format: 'single_elimination' | 'double_elimination' | 'round_robin'; teams: TestTeam[]; options?: Record<string, unknown>; name?: string },
) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie },
    payload: { name: input.name ?? 'Copa Teste', format: input.format, options: input.options },
  });
  if (created.statusCode !== 201) throw new Error(`create tournament: ${created.body}`);
  const { id } = created.json();
  await app.inject({
    method: 'PUT',
    url: `/api/tournaments/${id}/entries`,
    headers: { cookie },
    payload: { teamIds: input.teams.map((team) => team.id) },
  });
  const started = await app.inject({ method: 'POST', url: `/api/tournaments/${id}/start`, headers: { cookie } });
  if (started.statusCode !== 200) throw new Error(`start tournament: ${started.body}`);
  return started.json() as { id: string; format: string; status: string };
}
```

`apps/api/test/tournaments.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createStartedTournament, createTeam, createTestApp, loginAdmin, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function teams(cookie: string, n: number) {
  const list = [];
  for (let i = 1; i <= n; i++) list.push(await createTeam(app, cookie, `Time ${i}`));
  return list;
}

describe('tournaments', () => {
  it('creates a draft with default options and lists it', async () => {
    const cookie = await loginAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: { cookie },
      payload: { name: 'Copa', format: 'round_robin' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'Copa',
      format: 'round_robin',
      status: 'draft',
      options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
      entries: [],
    });

    const list = await app.inject({ method: 'GET', url: '/api/tournaments?status=draft' });
    expect(list.json()).toEqual([expect.objectContaining({ name: 'Copa', teamCount: 0, status: 'draft' })]);
  });

  it('sets entries in seed order and rejects unknown teams', async () => {
    const cookie = await loginAdmin(app);
    const [a, b] = await teams(cookie, 2);
    const { id } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'C', format: 'single_elimination' } })).json();

    const res = await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: [b!.id, a!.id] } });
    expect(res.json().entries.map((e: { seed: number; team: { id: string } }) => [e.seed, e.team.id])).toEqual([
      [1, b!.id],
      [2, a!.id],
    ]);

    const bad = await app.inject({ method: 'PUT', url: `/api/tournaments/${id}/entries`, headers: { cookie }, payload: { teamIds: ['nope'] } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'UNKNOWN_TEAM' } });
  });

  it('starts each format and exposes the bracket', async () => {
    const cookie = await loginAdmin(app);
    const list = await teams(cookie, 5);

    const se = await createStartedTournament(app, cookie, { format: 'single_elimination', teams: list });
    expect(se.status).toBe('in_progress');
    const bracket = (await app.inject({ method: 'GET', url: `/api/tournaments/${se.id}/bracket` })).json();
    expect(bracket.data.stage[0]).toMatchObject({ type: 'single_elimination', settings: expect.objectContaining({ size: 8 }) });
    expect(bracket.data.participant.map((p: { name: string }) => p.name)).toEqual(list.map((t) => t.name));

    const de = await createStartedTournament(app, cookie, { format: 'double_elimination', teams: list.slice(0, 3), name: 'D' });
    expect(de.status).toBe('in_progress');

    const rr = await createStartedTournament(app, cookie, { format: 'round_robin', teams: list.slice(0, 4), name: 'L' });
    const rrBracket = (await app.inject({ method: 'GET', url: `/api/tournaments/${rr.id}/bracket` })).json();
    expect(rrBracket.data.match).toHaveLength(6);
  });

  it('refuses to start twice, with too few teams, or to change format after start', async () => {
    const cookie = await loginAdmin(app);
    const [a, b, c] = await teams(cookie, 3);

    const { id: lonely } = (await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie }, payload: { name: 'S', format: 'double_elimination' } })).json();
    await app.inject({ method: 'PUT', url: `/api/tournaments/${lonely}/entries`, headers: { cookie }, payload: { teamIds: [a!.id, b!.id] } });
    const few = await app.inject({ method: 'POST', url: `/api/tournaments/${lonely}/start`, headers: { cookie } });
    expect(few.statusCode).toBe(409);
    expect(few.json()).toMatchObject({ error: { code: 'NOT_ENOUGH_TEAMS', message: 'São necessários pelo menos 3 times.' } });

    const t = await createStartedTournament(app, cookie, { format: 'round_robin', teams: [a!, b!, c!] });
    const again = await app.inject({ method: 'POST', url: `/api/tournaments/${t.id}/start`, headers: { cookie } });
    expect(again.json()).toMatchObject({ error: { code: 'TOURNAMENT_ALREADY_STARTED' } });

    const locked = await app.inject({ method: 'PATCH', url: `/api/tournaments/${t.id}`, headers: { cookie }, payload: { format: 'single_elimination' } });
    expect(locked.json()).toMatchObject({ error: { code: 'TOURNAMENT_LOCKED' } });

    const rename = await app.inject({ method: 'PATCH', url: `/api/tournaments/${t.id}`, headers: { cookie }, payload: { name: 'Novo nome' } });
    expect(rename.json()).toMatchObject({ name: 'Novo nome' });

    const entries = await app.inject({ method: 'PUT', url: `/api/tournaments/${t.id}/entries`, headers: { cookie }, payload: { teamIds: [a!.id] } });
    expect(entries.json()).toMatchObject({ error: { code: 'TOURNAMENT_LOCKED' } });
  });

  it('returns 404 for unknown tournaments', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tournaments/nao-existe' });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/tournaments.test.ts`
Expected: FAIL — `create tournament: …404…` / status 404.

- [ ] **Step 7: Implementar as rotas**

`apps/api/src/tournaments/routes.ts`:
```ts
import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { Db } from '../db';
import type { AppDeps } from '../deps';
import { idParams, teamRef, teamRefSelect, teamsById } from '../dto';
import { AppError, notFound, parse } from '../errors';
import { withBracket, type BracketData } from './bracket-store';
import { normalizeOptions, optionsSchema, type TournamentOptions } from './options';
import { MIN_TEAMS, stageInput } from './stage';

const formatSchema = z.enum(['single_elimination', 'double_elimination', 'round_robin']);
const createBody = z.object({ name: z.string().trim().min(1).max(80), format: formatSchema, options: optionsSchema.optional() });
const updateBody = createBody.partial();
const entriesBody = z.object({
  teamIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, 'Times repetidos.'),
});
const listQuery = z.object({ status: z.enum(['draft', 'in_progress', 'finished']).optional() });

export const tournamentInclude = {
  entries: { orderBy: { seed: 'asc' }, include: { team: { select: teamRefSelect } } },
} satisfies Prisma.TournamentInclude;

export type TournamentWithEntries = Prisma.TournamentGetPayload<{ include: typeof tournamentInclude }>;

export async function loadTournament(db: Db, id: string): Promise<TournamentWithEntries> {
  const tournament = await db.tournament.findUnique({ where: { id }, include: tournamentInclude });
  if (!tournament) throw notFound('Campeonato');
  return tournament;
}

export function tournamentDto(t: TournamentWithEntries) {
  return {
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    options: t.options as unknown as TournamentOptions,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
    entries: t.entries.map((entry) => ({ seed: entry.seed, team: teamRef(entry.team) })),
  };
}

const lockedError = (message: string) => new AppError(409, 'TOURNAMENT_LOCKED', message);

export function registerTournamentRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/tournaments', async (request) => {
    const { status } = parse(listQuery, request.query);
    const tournaments = await prisma.tournament.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { entries: true } } },
    });
    return tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      status: t.status,
      teamCount: t._count.entries,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
    }));
  });

  app.get('/tournaments/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.post('/tournaments', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(createBody, request.body);
    const created = await prisma.tournament.create({
      data: {
        name: body.name,
        format: body.format,
        options: normalizeOptions(body.options) as unknown as Prisma.InputJsonValue,
        ownerId: request.user!.id,
      },
    });
    return reply.status(201).send(tournamentDto(await loadTournament(prisma, created.id)));
  });

  app.patch('/tournaments/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(updateBody, request.body);
    const current = await loadTournament(prisma, id);
    if (current.status !== 'draft' && (body.format !== undefined || body.options !== undefined)) {
      throw lockedError('Formato e opções só podem ser alterados antes do início.');
    }
    await prisma.tournament.update({
      where: { id },
      data: {
        name: body.name,
        format: body.format,
        options:
          body.options === undefined
            ? undefined
            : (normalizeOptions({ ...(current.options as unknown as TournamentOptions), ...body.options }) as unknown as Prisma.InputJsonValue),
      },
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.put('/tournaments/:id/entries', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { teamIds } = parse(entriesBody, request.body);
    await prisma.$transaction(async (tx) => {
      const current = await loadTournament(tx, id);
      if (current.status !== 'draft') throw lockedError('As inscrições só podem ser alteradas antes do início.');
      const found = await tx.team.count({ where: { id: { in: teamIds } } });
      if (found !== teamIds.length) throw new AppError(400, 'UNKNOWN_TEAM', 'Algum time informado não existe.');
      await tx.tournamentEntry.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentEntry.createMany({ data: teamIds.map((teamId, index) => ({ tournamentId: id, teamId, seed: index + 1 })) });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.post('/tournaments/:id/start', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      const t = await loadTournament(tx, id);
      if (t.status !== 'draft') throw new AppError(409, 'TOURNAMENT_ALREADY_STARTED', 'O campeonato já foi iniciado.');
      const min = MIN_TEAMS[t.format];
      if (t.entries.length < min) throw new AppError(409, 'NOT_ENOUGH_TEAMS', `São necessários pelo menos ${min} times.`);
      await withBracket(tx, id, (manager) =>
        manager.create.stage(stageInput({ ...t, options: t.options as unknown as TournamentOptions })),
      );
      await tx.tournament.update({ where: { id }, data: { status: 'in_progress', startedAt: new Date() } });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });

  app.get('/tournaments/:id/bracket', async (request) => {
    const { id } = parse(idParams, request.params);
    const t = await loadTournament(prisma, id);
    const data = t.bracket as unknown as BracketData | null;
    if (!data) return { data: null };
    const teams = await teamsById(
      prisma,
      data.participant.map((p) => (p as { teamId: string }).teamId),
    );
    return {
      data: {
        ...data,
        participant: data.participant.map((p) => ({ ...p, name: teams.get((p as { teamId: string }).teamId)?.name ?? p.name })),
      },
    };
  });
}
```

Em `apps/api/src/app.ts`: `registerTournamentRoutes(api, deps);` com `import { registerTournamentRoutes } from './tournaments/routes';`.

- [ ] **Step 8: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 9: Checkpoint**

```bash
git add apps/api
```

---

### Task 5: Confrontos e lançamento de resultado

**Files:**
- Create: `apps/api/src/fixtures/detail.ts`, `apps/api/src/fixtures/save-result.ts`, `apps/api/src/fixtures/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/results.test.ts`

**Interfaces:**
- Consumes: `withBracket`, `managerFor`, `BracketData`, `findMatch`, `matchView`, `listMatches`, `laterCompletedMatchIds`, `loadTournament`, `activePlayers`, `activePlayerIds`, `teamsById`, `validateFixtureResult`, `computeFixtureScore`, `DuelInput`
- Produces:
  - `FixtureListItem { matchId; groupNumber; roundNumber; number; isKnockout; status: 'pending' | 'draft' | 'completed'; teamA: TeamRef; teamB: TeamRef; scoreA: number | null; scoreB: number | null }`
  - `FixtureDetail = FixtureListItem & { duels: { order; playerA: {id,name}; playerB: {id,name}; goalsA; goalsB; penaltiesA: number | null; penaltiesB: number | null }[]; rosterA?: {id,name}[]; rosterB?: {id,name}[] }` — `rosterA/B` só com sessão
  - `getFixtureDetail(db, tournamentId, matchId, includeRosters)`; `saveResult(prisma, tournamentId, matchId, input: { mode: 'draft' | 'final'; duels: DuelInput[] })`
  - Rotas:
    - `GET /api/tournaments/:id/fixtures → FixtureListItem[]`
    - `GET /api/tournaments/:id/fixtures/:matchId → FixtureDetail`
    - `PUT /api/tournaments/:id/fixtures/:matchId/result` (admin) `{ mode, duels } → FixtureDetail`
    - Erros: `409 TOURNAMENT_NOT_IN_PROGRESS`, `409 FIXTURE_NOT_READY`, `409 FIXTURE_ALREADY_COMPLETED`, `400 INVALID_RESULT` (`details` = `ValidationIssue[]`), `409 RESULT_LOCKED` (`details.blockingMatchIds`)
  - test helpers: `duelsPayload(playersA, playersB, results)`, `fixtures(app, tournamentId)`, `saveResult(app, cookie, tournamentId, matchId, mode, duels)`

Lado A = `opponent1` do brackets-manager; lado B = `opponent2`. Elenco aceito na validação = jogadores ativos do time ∪ jogadores já lançados naquele confronto (permite corrigir resultado antigo de jogador transferido).

- [ ] **Step 1: Helpers de teste**

Acrescentar a `apps/api/test/helpers.ts`:
```ts
/** results[i] = [golsA, golsB, pênaltisA?, pênaltisB?]; duelo i usa players[i] (6º duelo usa players[0]). */
export function duelsPayload(playersA: TestPlayer[], playersB: TestPlayer[], results: [number, number, number?, number?][]) {
  return results.map(([goalsA, goalsB, penaltiesA, penaltiesB], i) => ({
    order: i + 1,
    playerAId: (i < 5 ? playersA[i] : playersA[0])!.id,
    playerBId: (i < 5 ? playersB[i] : playersB[0])!.id,
    goalsA,
    goalsB,
    penaltiesA: penaltiesA ?? null,
    penaltiesB: penaltiesB ?? null,
  }));
}

export interface TestFixture {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  status: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  scoreA: number | null;
  scoreB: number | null;
}

export async function fixtures(app: FastifyInstance, tournamentId: string): Promise<TestFixture[]> {
  return (await app.inject({ method: 'GET', url: `/api/tournaments/${tournamentId}/fixtures` })).json();
}

export function saveResult(
  app: FastifyInstance,
  cookie: string,
  tournamentId: string,
  matchId: number,
  mode: 'draft' | 'final',
  duels: unknown[],
) {
  return app.inject({
    method: 'PUT',
    url: `/api/tournaments/${tournamentId}/fixtures/${matchId}/result`,
    headers: { cookie },
    payload: { mode, duels },
  });
}

export const A_WINS_3_1: [number, number][] = [[2, 0], [1, 0], [0, 1], [3, 1], [1, 1]];
export const B_WINS_3_1: [number, number][] = [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]];
export const TIED_2_2: [number, number][] = [[1, 0], [1, 0], [0, 1], [0, 2], [2, 2]];
```

- [ ] **Step 2: Escrever o teste que falha**

`apps/api/test/results.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  TIED_2_2,
  createStartedTournament,
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

async function setup(format: 'single_elimination' | 'double_elimination' | 'round_robin', count: number, options?: Record<string, unknown>) {
  const cookie = await loginAdmin(app);
  const squads = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team), options });
  const playersOf = (teamId: string): TestPlayer[] => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf };
}

describe('result entry', () => {
  it('saves a draft without touching the bracket, then confirms a round robin result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 3);
    const list = await fixtures(app, tournament.id);
    expect(list).toHaveLength(3);
    expect(list.every((f) => f.status === 'pending')).toBe(true);

    const [first] = list;
    const pA = playersOf(first!.teamA.id);
    const pB = playersOf(first!.teamB.id);

    const draft = await saveResult(app, cookie, tournament.id, first!.matchId, 'draft', duelsPayload(pA, pB, A_WINS_3_1.slice(0, 2)));
    expect(draft.statusCode).toBe(200);
    expect(draft.json()).toMatchObject({ status: 'draft', scoreA: null, duels: [{ order: 1 }, { order: 2 }] });
    expect((await fixtures(app, tournament.id))[0]).toMatchObject({ status: 'draft', scoreA: null });

    const final = await saveResult(app, cookie, tournament.id, first!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
    expect(final.json()).toMatchObject({ status: 'completed', scoreA: 3, scoreB: 1 });
    expect(final.json().duels).toHaveLength(5);
    expect((await fixtures(app, tournament.id))[0]).toMatchObject({ status: 'completed', scoreA: 3, scoreB: 1 });
  });

  it('accepts a round robin draw', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duelsPayload(playersOf(f!.teamA.id), playersOf(f!.teamB.id), TIED_2_2));
    expect(res.json()).toMatchObject({ status: 'completed', scoreA: 2, scoreB: 2 });
  });

  it('returns validation issues from the shared rules', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const pA = playersOf(f!.teamA.id);
    const duels = duelsPayload(pA, playersOf(f!.teamB.id), A_WINS_3_1);
    duels[1]!.playerAId = pA[0]!.id;
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'INVALID_RESULT', details: [{ code: 'PLAYER_REPEATED', path: 'duels.1.playerAId' }] },
    });
  });

  it('requires login to save', async () => {
    const { tournament } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const res = await app.inject({ method: 'PUT', url: `/api/tournaments/${tournament.id}/fixtures/${f!.matchId}/result`, payload: { mode: 'draft', duels: [] } });
    expect(res.statusCode).toBe(401);
  });

  it('requires the 6th duel in a tied knockout and advances the penalty winner', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    const pA = playersOf(semi1!.teamA.id);
    const pB = playersOf(semi1!.teamB.id);

    const missing = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, TIED_2_2));
    expect(missing.json()).toMatchObject({ error: { code: 'INVALID_RESULT', details: [{ code: 'TIEBREAKER_REQUIRED' }] } });

    const decided = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, [...TIED_2_2, [1, 1, 3, 4]]));
    expect(decided.json()).toMatchObject({ status: 'completed', scoreA: 2, scoreB: 3 });

    await saveResult(app, cookie, tournament.id, semi2!.matchId, 'final', duelsPayload(playersOf(semi2!.teamA.id), playersOf(semi2!.teamB.id), A_WINS_3_1));
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    expect([final.teamA.id, final.teamB.id]).toEqual([semi1!.teamB.id, semi2!.teamA.id]);
  });

  it('lets the winner change while the next match has no result', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    const pA = playersOf(semi1!.teamA.id);
    const pB = playersOf(semi1!.teamB.id);
    await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
    await saveResult(app, cookie, tournament.id, semi2!.matchId, 'final', duelsPayload(playersOf(semi2!.teamA.id), playersOf(semi2!.teamB.id), A_WINS_3_1));
    const swapped = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(pA, pB, [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]]));
    expect(swapped.json()).toMatchObject({ scoreA: 1, scoreB: 3 });
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    expect(final.teamA.id).toBe(semi1!.teamB.id);
  });

  it('blocks editing a knockout result once a later match has a result', async () => {
    const { cookie, tournament, playersOf } = await setup('single_elimination', 4);
    const [semi1, semi2] = await fixtures(app, tournament.id);
    for (const semi of [semi1!, semi2!]) {
      await saveResult(app, cookie, tournament.id, semi.matchId, 'final', duelsPayload(playersOf(semi.teamA.id), playersOf(semi.teamB.id), A_WINS_3_1));
    }
    const final = (await fixtures(app, tournament.id)).find((f) => f.roundNumber === 2)!;
    await saveResult(app, cookie, tournament.id, final.matchId, 'final', duelsPayload(playersOf(final.teamA.id), playersOf(final.teamB.id), A_WINS_3_1));

    const res = await saveResult(app, cookie, tournament.id, semi1!.matchId, 'final', duelsPayload(playersOf(semi1!.teamA.id), playersOf(semi1!.teamB.id), [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]]));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'RESULT_LOCKED', details: { blockingMatchIds: [final.matchId] } } });
  });

  it('refuses a draft over a completed result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const duels = duelsPayload(playersOf(f!.teamA.id), playersOf(f!.teamB.id), A_WINS_3_1);
    await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'draft', duels);
    expect(res.json()).toMatchObject({ error: { code: 'FIXTURE_ALREADY_COMPLETED' } });
  });

  it('sends the loser of a winners bracket match to the losers bracket', async () => {
    const { cookie, tournament, playersOf } = await setup('double_elimination', 4);
    const wbRound1 = (await fixtures(app, tournament.id)).filter((f) => f.groupNumber === 1 && f.roundNumber === 1);
    for (const f of wbRound1) {
      await saveResult(app, cookie, tournament.id, f.matchId, 'final', duelsPayload(playersOf(f.teamA.id), playersOf(f.teamB.id), A_WINS_3_1));
    }
    const lb = (await fixtures(app, tournament.id)).find((f) => f.groupNumber === 2)!;
    expect([lb.teamA.id, lb.teamB.id].sort()).toEqual(wbRound1.map((f) => f.teamB.id).sort());
  });

  it('shows rosters only to the admin in the fixture detail', async () => {
    const { cookie, tournament } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const url = `/api/tournaments/${tournament.id}/fixtures/${f!.matchId}`;
    const anon = (await app.inject({ method: 'GET', url })).json();
    expect(anon).not.toHaveProperty('rosterA');
    const admin = (await app.inject({ method: 'GET', url, headers: { cookie } })).json();
    expect(admin.rosterA).toHaveLength(6);
    expect(admin.rosterA[0]).toEqual({ id: expect.any(String), name: expect.any(String) });
  });

  it('serializes concurrent saves in the same tournament without losing bracket updates', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 4);
    const list = await fixtures(app, tournament.id);
    const responses = await Promise.all(
      list.slice(0, 3).map((f) => saveResult(app, cookie, tournament.id, f.matchId, 'final', duelsPayload(playersOf(f.teamA.id), playersOf(f.teamB.id), A_WINS_3_1))),
    );
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    const after = await fixtures(app, tournament.id);
    expect(after.filter((f) => f.scoreA === 3)).toHaveLength(3);
  });

  it('still accepts a transferred player when editing an old result', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 2);
    const [f] = await fixtures(app, tournament.id);
    const pA = playersOf(f!.teamA.id);
    const duels = duelsPayload(pA, playersOf(f!.teamB.id), A_WINS_3_1);
    await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);

    await app.inject({ method: 'PUT', url: `/api/players/${pA[0]!.id}/team`, headers: { cookie }, payload: { teamId: null } });
    duels[0]!.goalsA = 4;
    const res = await saveResult(app, cookie, tournament.id, f!.matchId, 'final', duels);
    expect(res.statusCode).toBe(200);
    expect(await prisma.duel.findFirst({ where: { order: 1 } })).toMatchObject({ goalsA: 4, playerAId: pA[0]!.id });
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/results.test.ts`
Expected: FAIL — `GET /fixtures` responde 404 (rota inexistente), `fixtures()` devolve o envelope de erro.

- [ ] **Step 4: Implementar**

`apps/api/src/fixtures/detail.ts`:
```ts
import type { Db } from '../db';
import { teamsById, type TeamRef } from '../dto';
import { AppError, notFound } from '../errors';
import { activePlayers } from '../players/roster';
import type { BracketData } from '../tournaments/bracket-store';
import { findMatch, listMatches, matchView, type MatchView } from '../tournaments/bracket-view';

export type FixtureStatusView = 'pending' | 'draft' | 'completed';

export interface FixtureListItem {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  number: number;
  isKnockout: boolean;
  status: FixtureStatusView;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

const toItem = (view: MatchView, isKnockout: boolean, status: FixtureStatusView, teams: Map<string, TeamRef>): FixtureListItem => ({
  matchId: view.matchId,
  groupNumber: view.groupNumber,
  roundNumber: view.roundNumber,
  number: view.number,
  isKnockout,
  status,
  teamA: teams.get(view.teamAId)!,
  teamB: teams.get(view.teamBId)!,
  scoreA: status === 'completed' ? view.scoreA : null,
  scoreB: status === 'completed' ? view.scoreB : null,
});

async function bracketOf(db: Db, tournamentId: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw notFound('Campeonato');
  return { tournament, data: tournament.bracket as unknown as BracketData | null };
}

export async function listFixtures(db: Db, tournamentId: string): Promise<FixtureListItem[]> {
  const { tournament, data } = await bracketOf(db, tournamentId);
  if (!data) return [];
  const views = listMatches(data);
  const saved = await db.fixture.findMany({ where: { tournamentId }, select: { bmMatchId: true, status: true } });
  const statusByMatch = new Map(saved.map((f) => [f.bmMatchId, f.status]));
  const teams = await teamsById(db, views.flatMap((v) => [v.teamAId, v.teamBId]));
  const isKnockout = tournament.format !== 'round_robin';
  return views.map((v) => toItem(v, isKnockout, statusByMatch.get(v.matchId) ?? 'pending', teams));
}

export async function getFixtureDetail(db: Db, tournamentId: string, matchId: number, includeRosters: boolean) {
  const { tournament, data } = await bracketOf(db, tournamentId);
  const raw = data ? findMatch(data, matchId) : undefined;
  if (!data || !raw) throw notFound('Confronto');
  const view = matchView(data, raw);
  if (!view) throw new AppError(409, 'FIXTURE_NOT_READY', 'Os dois times deste confronto ainda não estão definidos.');

  const fixture = await db.fixture.findUnique({
    where: { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } },
    include: {
      duels: {
        orderBy: { order: 'asc' },
        include: { playerA: { select: { id: true, name: true } }, playerB: { select: { id: true, name: true } } },
      },
    },
  });
  const teams = await teamsById(db, [view.teamAId, view.teamBId]);
  const item = toItem(view, tournament.format !== 'round_robin', fixture?.status ?? 'pending', teams);
  const detail = {
    ...item,
    duels: (fixture?.duels ?? []).map((duel) => ({
      order: duel.order,
      playerA: duel.playerA,
      playerB: duel.playerB,
      goalsA: duel.goalsA,
      goalsB: duel.goalsB,
      penaltiesA: duel.penaltiesA,
      penaltiesB: duel.penaltiesB,
    })),
  };
  if (!includeRosters) return detail;
  const pick = (players: { id: string; name: string }[]) => players.map(({ id, name }) => ({ id, name }));
  const [rosterA, rosterB] = await Promise.all([activePlayers(db, view.teamAId), activePlayers(db, view.teamBId)]);
  return { ...detail, rosterA: pick(rosterA), rosterB: pick(rosterB) };
}
```

`apps/api/src/fixtures/save-result.ts`:
```ts
import { computeFixtureScore, validateFixtureResult, type DuelInput } from '@kickabout/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError, notFound } from '../errors';
import { activePlayerIds } from '../players/roster';
import { withBracket, type BracketData } from '../tournaments/bracket-store';
import { findMatch, laterCompletedMatchIds, matchView } from '../tournaments/bracket-view';

export interface SaveResultInput {
  mode: 'draft' | 'final';
  duels: DuelInput[];
}

async function pruneStaleDrafts(tx: Prisma.TransactionClient, tournamentId: string, data: BracketData) {
  const drafts = await tx.fixture.findMany({ where: { tournamentId, status: 'draft' } });
  for (const draft of drafts) {
    const raw = findMatch(data, draft.bmMatchId);
    const view = raw ? matchView(data, raw) : null;
    if (!view || view.teamAId !== draft.teamAId || view.teamBId !== draft.teamBId) {
      await tx.fixture.delete({ where: { id: draft.id } });
    }
  }
}

export async function saveResult(prisma: PrismaClient, tournamentId: string, matchId: number, input: SaveResultInput) {
  await prisma.$transaction(
    async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw notFound('Campeonato');
      if (tournament.status !== 'in_progress') {
        throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      }
      const isKnockout = tournament.format !== 'round_robin';

      await withBracket(tx, tournamentId, async (manager) => {
        const data = await manager.export();
        const raw = findMatch(data, matchId);
        if (!raw) throw notFound('Confronto');
        const view = matchView(data, raw);
        if (!view) throw new AppError(409, 'FIXTURE_NOT_READY', 'Os dois times deste confronto ainda não estão definidos.');

        const key = { tournamentId_bmMatchId: { tournamentId, bmMatchId: matchId } };
        const existing = await tx.fixture.findUnique({ where: key, include: { duels: true } });
        if (input.mode === 'draft' && existing?.status === 'completed') {
          throw new AppError(409, 'FIXTURE_ALREADY_COMPLETED', 'Este confronto já tem resultado confirmado.');
        }

        const [activeA, activeB] = await Promise.all([activePlayerIds(tx, view.teamAId), activePlayerIds(tx, view.teamBId)]);
        const rosterA = [...activeA, ...(existing?.duels.map((d) => d.playerAId) ?? [])];
        const rosterB = [...activeB, ...(existing?.duels.map((d) => d.playerBId) ?? [])];
        const issues = validateFixtureResult({ mode: input.mode, isKnockout, duels: input.duels, rosterA, rosterB });
        if (issues.length > 0) throw new AppError(400, 'INVALID_RESULT', 'O resultado tem erros.', issues);

        const isFinal = input.mode === 'final';
        const score = computeFixtureScore(input.duels);
        if (isFinal) {
          const result = (side: 'A' | 'B') => (score.winner === null ? 'draw' : score.winner === side ? 'win' : 'loss');
          try {
            await manager.update.match({
              id: matchId,
              opponent1: { score: score.scoreA, result: result('A') },
              opponent2: { score: score.scoreB, result: result('B') },
            });
          } catch (error) {
            if (error instanceof Error && /locked/i.test(error.message)) {
              throw new AppError(
                409,
                'RESULT_LOCKED',
                'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Desfaça-os primeiro.',
                { blockingMatchIds: laterCompletedMatchIds(data, matchId) },
              );
            }
            throw error;
          }
        }

        const values = {
          teamAId: view.teamAId,
          teamBId: view.teamBId,
          isKnockout,
          status: isFinal ? ('completed' as const) : ('draft' as const),
          scoreA: isFinal ? score.scoreA : null,
          scoreB: isFinal ? score.scoreB : null,
          winnerTeamId: isFinal && score.winner ? (score.winner === 'A' ? view.teamAId : view.teamBId) : null,
          playedAt: isFinal ? new Date() : null,
        };
        const fixture = await tx.fixture.upsert({
          where: key,
          create: { tournamentId, bmMatchId: matchId, ...values },
          update: values,
        });
        await tx.duel.deleteMany({ where: { fixtureId: fixture.id } });
        await tx.duel.createMany({
          data: input.duels.map((duel) => ({
            fixtureId: fixture.id,
            order: duel.order,
            playerAId: duel.playerAId,
            playerBId: duel.playerBId,
            teamAId: view.teamAId,
            teamBId: view.teamBId,
            goalsA: duel.goalsA,
            goalsB: duel.goalsB,
            penaltiesA: duel.penaltiesA ?? null,
            penaltiesB: duel.penaltiesB ?? null,
          })),
        });

        if (isFinal) await pruneStaleDrafts(tx, tournamentId, await manager.export());
      });
    },
    { timeout: 15_000 },
  );
}
```

`apps/api/src/fixtures/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { parse } from '../errors';
import { getFixtureDetail, listFixtures } from './detail';
import { saveResult } from './save-result';

const tournamentParams = z.object({ id: z.string().min(1) });
const fixtureParams = tournamentParams.extend({ matchId: z.coerce.number().int().min(0) });
const duelSchema = z.object({
  order: z.number(),
  playerAId: z.string().min(1),
  playerBId: z.string().min(1),
  goalsA: z.number(),
  goalsB: z.number(),
  penaltiesA: z.number().nullable().optional(),
  penaltiesB: z.number().nullable().optional(),
});
const resultBody = z.object({ mode: z.enum(['draft', 'final']), duels: z.array(duelSchema).max(6) });

export function registerFixtureRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/tournaments/:id/fixtures', async (request) => {
    const { id } = parse(tournamentParams, request.params);
    return listFixtures(prisma, id);
  });

  app.get('/tournaments/:id/fixtures/:matchId', async (request) => {
    const { id, matchId } = parse(fixtureParams, request.params);
    return getFixtureDetail(prisma, id, matchId, request.user !== null);
  });

  app.put('/tournaments/:id/fixtures/:matchId/result', { preHandler: requireAdmin }, async (request) => {
    const { id, matchId } = parse(fixtureParams, request.params);
    const body = parse(resultBody, request.body);
    await saveResult(prisma, id, matchId, body);
    return getFixtureDetail(prisma, id, matchId, true);
  });
}
```

Em `apps/api/src/app.ts`: `registerFixtureRoutes(api, deps);` com `import { registerFixtureRoutes } from './fixtures/routes';`.

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 6: Checkpoint**

```bash
git add apps/api
```

---

### Task 6: Classificação, estatísticas do campeonato, finalização e títulos

**Files:**
- Create: `apps/api/src/stats/queries.ts`, `apps/api/src/tournaments/podium.ts`, `apps/api/src/titles/routes.ts`
- Modify: `apps/api/src/tournaments/routes.ts`, `apps/api/src/app.ts`
- Test: `apps/api/test/podium.test.ts`, `apps/api/test/standings-titles.test.ts`

**Interfaces:**
- Consumes: `computeStandings`, `aggregatePlayerStats`, `managerFor`, `isStageComplete`, `teamIdByParticipant`, `loadTournament`, `teamsById`
- Produces:
  - `toDuelInput(duel)`, `completedFixtures(db, where)` (inclui `duels` em ordem e `tournament {id,name}`, ordenado por `playedAt desc`), `toFixtureRecord(f)`
  - `PodiumEntry { teamId: string; position: 1 | 2 | 3 }`; `eliminationPodium(standings, teamOf)`; `roundRobinPodium(rows)`
  - Rotas:
    - `GET /api/tournaments/:id/standings → (StandingRow & { team: TeamRef })[]` (vazio fora do round robin)
    - `GET /api/tournaments/:id/stats → (PlayerStats & { player: {id,name}; team: TeamRef | null })[]`
    - `POST /api/tournaments/:id/finish` (admin) → `TournamentDto` — `409 TOURNAMENT_NOT_IN_PROGRESS`, `409 TOURNAMENT_NOT_COMPLETE`
    - `GET /api/titles → { ranking: { team: TeamRef; champion; runnerUp; third }[]; titles: { id; position; year; tournamentId: string | null; tournamentName; team: TeamRef }[] }`
    - `POST /api/titles` (admin) `{ teamId, tournamentName, position: 1|2|3, year } → 201`
    - `DELETE /api/titles/:id` (admin) — `409 TITLE_FROM_TOURNAMENT` para títulos gerados por campeonato

Pódio: round robin = 3 primeiros da classificação; eliminação = `finalStandings` da biblioteca: rank 1 → campeão, rank 2 → vice, rank 3 só se exatamente um time tiver rank 3 (disputa de 3º lugar ou eliminatória dupla).

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/test/podium.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { eliminationPodium, roundRobinPodium } from '../src/tournaments/podium';

const teamOf = new Map([
  [0, 'a'],
  [1, 'b'],
  [2, 'c'],
  [3, 'd'],
]);

describe('eliminationPodium', () => {
  it('uses ranks 1, 2 and a single rank 3', () => {
    expect(
      eliminationPodium(
        [
          { id: 2, rank: 1 },
          { id: 0, rank: 2 },
          { id: 3, rank: 3 },
          { id: 1, rank: 4 },
        ],
        teamOf,
      ),
    ).toEqual([
      { teamId: 'c', position: 1 },
      { teamId: 'a', position: 2 },
      { teamId: 'd', position: 3 },
    ]);
  });

  it('skips third place when two teams share rank 3', () => {
    expect(
      eliminationPodium(
        [
          { id: 0, rank: 1 },
          { id: 1, rank: 2 },
          { id: 2, rank: 3 },
          { id: 3, rank: 3 },
        ],
        teamOf,
      ),
    ).toEqual([
      { teamId: 'a', position: 1 },
      { teamId: 'b', position: 2 },
    ]);
  });
});

describe('roundRobinPodium', () => {
  it('takes the top three rows', () => {
    const rows = ['x', 'y', 'z', 'w'].map((teamId) => ({ teamId }));
    expect(roundRobinPodium(rows)).toEqual([
      { teamId: 'x', position: 1 },
      { teamId: 'y', position: 2 },
      { teamId: 'z', position: 3 },
    ]);
  });
});
```

`apps/api/test/standings-titles.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  createStartedTournament,
  createTeam,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
  type TestPlayer,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function playAll(cookie: string, tournamentId: string, playersOf: (id: string) => TestPlayer[]) {
  for (let i = 0; i < 20; i++) {
    const pending = (await fixtures(app, tournamentId)).find((f) => f.status === 'pending');
    if (!pending) return;
    const res = await saveResult(app, cookie, tournamentId, pending.matchId, 'final', duelsPayload(playersOf(pending.teamA.id), playersOf(pending.teamB.id), A_WINS_3_1));
    if (res.statusCode !== 200) throw new Error(res.body);
  }
}

async function setup(format: 'single_elimination' | 'double_elimination' | 'round_robin', count: number, options?: Record<string, unknown>) {
  const cookie = await loginAdmin(app);
  const squads = [];
  for (let i = 1; i <= count; i++) squads.push(await createTeamWithPlayers(app, cookie, `Time ${i}`));
  const tournament = await createStartedTournament(app, cookie, { format, teams: squads.map((s) => s.team), options, name: 'Copa 2026' });
  const playersOf = (teamId: string) => squads.find((s) => s.team.id === teamId)!.players;
  return { cookie, tournament, playersOf, squads };
}

const finish = (cookie: string, id: string) => app.inject({ method: 'POST', url: `/api/tournaments/${id}/finish`, headers: { cookie } });

describe('standings, stats and finish', () => {
  it('computes round robin standings and leaderboard, then finishes with a podium', async () => {
    const { cookie, tournament, playersOf } = await setup('round_robin', 3);

    const early = await finish(cookie, tournament.id);
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_COMPLETE' } });

    await playAll(cookie, tournament.id, playersOf);

    const standings = (await app.inject({ method: 'GET', url: `/api/tournaments/${tournament.id}/standings` })).json();
    expect(standings).toHaveLength(3);
    expect(standings[0]).toMatchObject({ position: 1, played: 2, team: { name: expect.any(String) } });

    const stats = (await app.inject({ method: 'GET', url: `/api/tournaments/${tournament.id}/stats` })).json();
    expect(stats[0]).toMatchObject({ player: { name: expect.any(String) }, team: { name: expect.any(String) } });
    expect(stats[0].goalsFor).toBeGreaterThanOrEqual(stats[1].goalsFor);

    const done = await finish(cookie, tournament.id);
    expect(done.json()).toMatchObject({ status: 'finished' });

    const titles = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titles.titles.map((t: { position: number; team: { id: string } }) => [t.position, t.team.id])).toEqual(
      standings.map((row: { position: number; team: { id: string } }) => [row.position, row.team.id]),
    );
    expect(titles.ranking[0]).toMatchObject({ team: { id: standings[0].team.id }, champion: 1, runnerUp: 0, third: 0 });

    const again = await finish(cookie, tournament.id);
    expect(again.json()).toMatchObject({ error: { code: 'TOURNAMENT_NOT_IN_PROGRESS' } });
  });

  it('awards third place only with a consolation final', async () => {
    const withThird = await setup('single_elimination', 4, { consolationFinal: true });
    await playAll(withThird.cookie, withThird.tournament.id, withThird.playersOf);
    await finish(withThird.cookie, withThird.tournament.id);
    const titlesWith = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titlesWith.titles.map((t: { position: number }) => t.position).sort()).toEqual([1, 2, 3]);

    await resetDb();
    const without = await setup('single_elimination', 4);
    await playAll(without.cookie, without.tournament.id, without.playersOf);
    await finish(without.cookie, without.tournament.id);
    const titlesWithout = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
    expect(titlesWithout.titles.map((t: { position: number }) => t.position).sort()).toEqual([1, 2]);
  });

  it('finishes non power-of-two brackets with byes', async () => {
    for (const format of ['single_elimination', 'double_elimination'] as const) {
      await resetDb();
      const { cookie, tournament, playersOf } = await setup(format, 3);
      await playAll(cookie, tournament.id, playersOf);
      const res = await finish(cookie, tournament.id);
      expect(res.json()).toMatchObject({ status: 'finished' });
      const titles = (await app.inject({ method: 'GET', url: '/api/titles' })).json();
      expect(titles.titles.some((t: { position: number }) => t.position === 1)).toBe(true);
    }
  });
});

describe('historical titles', () => {
  it('creates and deletes manual titles but protects tournament titles', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    const created = await app.inject({
      method: 'POST',
      url: '/api/titles',
      headers: { cookie },
      payload: { teamId: team.id, tournamentName: 'Copa 2024', position: 1, year: 2024 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ tournamentId: null, tournamentName: 'Copa 2024', team: { id: team.id } });

    const del = await app.inject({ method: 'DELETE', url: `/api/titles/${created.json().id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);

    const { cookie: c2, tournament, playersOf } = await setup('round_robin', 2);
    await playAll(c2, tournament.id, playersOf);
    await finish(c2, tournament.id);
    const [fromTournament] = (await app.inject({ method: 'GET', url: '/api/titles' })).json().titles;
    const blocked = await app.inject({ method: 'DELETE', url: `/api/titles/${fromTournament.id}`, headers: { cookie: c2 } });
    expect(blocked.json()).toMatchObject({ error: { code: 'TITLE_FROM_TOURNAMENT' } });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/podium.test.ts test/standings-titles.test.ts`
Expected: FAIL — `Cannot find module '../src/tournaments/podium'`.

- [ ] **Step 3: Implementar**

`apps/api/src/stats/queries.ts`:
```ts
import type { DuelInput, FixtureRecord } from '@kickabout/shared';
import type { Duel, Prisma } from '@prisma/client';
import type { Db } from '../db';

export const toDuelInput = (duel: Duel): DuelInput => ({
  order: duel.order,
  playerAId: duel.playerAId,
  playerBId: duel.playerBId,
  goalsA: duel.goalsA,
  goalsB: duel.goalsB,
  penaltiesA: duel.penaltiesA,
  penaltiesB: duel.penaltiesB,
});

export function completedFixtures(db: Db, where: Prisma.FixtureWhereInput) {
  return db.fixture.findMany({
    where: { ...where, status: 'completed' },
    include: { duels: { orderBy: { order: 'asc' } }, tournament: { select: { id: true, name: true } } },
    orderBy: { playedAt: 'desc' },
  });
}

export const toFixtureRecord = (fixture: { teamAId: string; teamBId: string; duels: Duel[] }): FixtureRecord => ({
  teamAId: fixture.teamAId,
  teamBId: fixture.teamBId,
  duels: fixture.duels.map(toDuelInput),
});
```

`apps/api/src/tournaments/podium.ts`:
```ts
export interface PodiumEntry {
  teamId: string;
  position: 1 | 2 | 3;
}

export function eliminationPodium(
  standings: { id: number | string; rank: number }[],
  teamOf: Map<number, string>,
): PodiumEntry[] {
  const withRank = (rank: number) =>
    standings
      .filter((s) => s.rank === rank)
      .map((s) => teamOf.get(Number(s.id)))
      .filter((teamId): teamId is string => teamId !== undefined);
  const podium: PodiumEntry[] = [];
  const [first] = withRank(1);
  if (first) podium.push({ teamId: first, position: 1 });
  const [second] = withRank(2);
  if (second) podium.push({ teamId: second, position: 2 });
  const thirds = withRank(3);
  if (thirds.length === 1) podium.push({ teamId: thirds[0]!, position: 3 });
  return podium;
}

export function roundRobinPodium(rows: { teamId: string }[]): PodiumEntry[] {
  return rows.slice(0, 3).map((row, index) => ({ teamId: row.teamId, position: (index + 1) as 1 | 2 | 3 }));
}
```

Acrescentar a `apps/api/src/tournaments/routes.ts` (imports + rotas dentro de `registerTournamentRoutes`):
```ts
import { aggregatePlayerStats, computeStandings } from '@kickabout/shared';
import { completedFixtures, toDuelInput, toFixtureRecord } from '../stats/queries';
import { managerFor } from './bracket-store';
import { isStageComplete, teamIdByParticipant } from './bracket-view';
import { eliminationPodium, roundRobinPodium, type PodiumEntry } from './podium';
```
```ts
  app.get('/tournaments/:id/standings', async (request) => {
    const { id } = parse(idParams, request.params);
    const t = await loadTournament(prisma, id);
    if (t.format !== 'round_robin') return [];
    const fixtures = await completedFixtures(prisma, { tournamentId: id });
    const rows = computeStandings(t.entries.map((e) => e.team.id), fixtures.map(toFixtureRecord));
    const teams = new Map(t.entries.map((e) => [e.team.id, teamRef(e.team)]));
    return rows.map((row) => ({ ...row, team: teams.get(row.teamId)! }));
  });

  app.get('/tournaments/:id/stats', async (request) => {
    const { id } = parse(idParams, request.params);
    await loadTournament(prisma, id);
    const duels = (await completedFixtures(prisma, { tournamentId: id })).flatMap((f) => f.duels);
    const teamOfPlayer = new Map<string, string>();
    for (const duel of [...duels].reverse()) {
      teamOfPlayer.set(duel.playerAId, duel.teamAId);
      teamOfPlayer.set(duel.playerBId, duel.teamBId);
    }
    const stats = aggregatePlayerStats(duels.map(toDuelInput));
    const players = await prisma.player.findMany({
      where: { id: { in: stats.map((s) => s.playerId) } },
      select: { id: true, name: true },
    });
    const playerById = new Map(players.map((p) => [p.id, p]));
    const teams = await teamsById(prisma, teamOfPlayer.values());
    return stats.map((s) => ({
      ...s,
      player: playerById.get(s.playerId)!,
      team: teams.get(teamOfPlayer.get(s.playerId) ?? '') ?? null,
    }));
  });

  app.post('/tournaments/:id/finish', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await prisma.$transaction(async (tx) => {
      const t = await loadTournament(tx, id);
      if (t.status !== 'in_progress') throw new AppError(409, 'TOURNAMENT_NOT_IN_PROGRESS', 'O campeonato não está em andamento.');
      const data = t.bracket as unknown as BracketData;
      if (!isStageComplete(data)) throw new AppError(409, 'TOURNAMENT_NOT_COMPLETE', 'Ainda há confrontos sem resultado.');

      let podium: PodiumEntry[];
      if (t.format === 'round_robin') {
        const fixtures = await completedFixtures(tx, { tournamentId: id });
        podium = roundRobinPodium(computeStandings(t.entries.map((e) => e.team.id), fixtures.map(toFixtureRecord)));
      } else {
        const manager = await managerFor(data);
        const standings = await manager.get.finalStandings(data.stage[0]!.id);
        podium = eliminationPodium(standings, teamIdByParticipant(data));
      }

      const year = new Date().getFullYear();
      await tx.title.createMany({
        data: podium.map((entry) => ({ teamId: entry.teamId, tournamentId: id, tournamentName: t.name, position: entry.position, year })),
      });
      await tx.tournament.update({ where: { id }, data: { status: 'finished', finishedAt: new Date() } });
    });
    return tournamentDto(await loadTournament(prisma, id));
  });
```

`apps/api/src/titles/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { idParams, teamRef, teamRefSelect, type TeamRef } from '../dto';
import { AppError, notFound, parse } from '../errors';
import { findTeamOrThrow } from '../players/roster';

const titleBody = z.object({
  teamId: z.string().min(1),
  tournamentName: z.string().trim().min(1).max(80),
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  year: z.number().int().min(1990).max(2100),
});

const titleInclude = { team: { select: teamRefSelect } } as const;

const titleDto = (title: { id: string; position: number; year: number; tournamentId: string | null; tournamentName: string; team: TeamRef }) => ({
  id: title.id,
  position: title.position,
  year: title.year,
  tournamentId: title.tournamentId,
  tournamentName: title.tournamentName,
  team: teamRef(title.team),
});

export function registerTitleRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/titles', async () => {
    const titles = await prisma.title.findMany({
      include: titleInclude,
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }, { position: 'asc' }],
    });
    const ranking = new Map<string, { team: TeamRef; champion: number; runnerUp: number; third: number }>();
    for (const title of titles) {
      const row = ranking.get(title.teamId) ?? { team: teamRef(title.team), champion: 0, runnerUp: 0, third: 0 };
      if (title.position === 1) row.champion++;
      else if (title.position === 2) row.runnerUp++;
      else row.third++;
      ranking.set(title.teamId, row);
    }
    return {
      ranking: [...ranking.values()].sort(
        (a, b) => b.champion - a.champion || b.runnerUp - a.runnerUp || b.third - a.third || a.team.name.localeCompare(b.team.name),
      ),
      titles: titles.map(titleDto),
    };
  });

  app.post('/titles', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parse(titleBody, request.body);
    await findTeamOrThrow(prisma, body.teamId);
    const title = await prisma.title.create({ data: body, include: titleInclude });
    return reply.status(201).send(titleDto(title));
  });

  app.delete('/titles/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) throw notFound('Título');
    if (title.tournamentId) {
      throw new AppError(409, 'TITLE_FROM_TOURNAMENT', 'Títulos gerados por campeonato não podem ser apagados.');
    }
    await prisma.title.delete({ where: { id } });
    return { ok: true };
  });
}
```

Em `apps/api/src/app.ts`: `registerTitleRoutes(api, deps);` com `import { registerTitleRoutes } from './titles/routes';`.

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npm test -w @kickabout/api && npm run typecheck`
Expected: todos PASS; sem erros de tipo.

- [ ] **Step 5: Checkpoint**

```bash
git add apps/api
```

---

### Task 7: Páginas públicas de time e jogador, últimos resultados

**Files:**
- Modify: `apps/api/src/teams/routes.ts`, `apps/api/src/players/routes.ts`, `apps/api/src/fixtures/routes.ts`, `apps/api/src/stats/queries.ts`
- Test: `apps/api/test/public-pages.test.ts`

**Interfaces:**
- Consumes: `completedFixtures`, `toFixtureRecord`, `toDuelInput`, `aggregateTeamStats`, `aggregatePlayerStats`, `duelOutcome`, `activePlayers`, `rosterPlayer`, `canSeePhones`, `teamsById`
- Produces:
  - `FixtureSummary { tournamentId; tournamentName; matchId; teamA: TeamRef; teamB: TeamRef; scoreA: number; scoreB: number; playedAt }`; `fixtureSummaries(db, fixtures)`
  - Rotas:
    - `GET /api/teams/:id → { team: TeamRef; roster: RosterPlayer[]; stats: TeamStats; titles: { id; position; year; tournamentId; tournamentName }[]; recentFixtures: FixtureSummary[] (até 10); tournaments: { id; name; format; status }[] }`
    - `GET /api/players/:id` (público, **sem celular**) → `{ player: {id,name}; currentTeam: TeamRef | null; teamHistory: { team: TeamRef; joinedAt; leftAt }[]; stats: PlayerStats; duels: PlayerDuel[]; titles: { position; year; tournamentId; tournamentName; team: TeamRef }[] }`
    - `PlayerDuel { tournamentId; tournamentName; matchId; order; team: TeamRef; opponentTeam: TeamRef; opponent: {id,name}; goalsFor; goalsAgainst; penaltiesFor: number | null; penaltiesAgainst: number | null; result: 'win' | 'draw' | 'loss'; playedAt }`
    - `GET /api/fixtures/recent?limit=10 → FixtureSummary[]`

Títulos do jogador = títulos de campeonato do time pelo qual ele jogou pelo menos um duelo naquele campeonato (títulos históricos não entram).

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/test/public-pages.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  A_WINS_3_1,
  createStartedTournament,
  createTeamWithPlayers,
  createTestApp,
  duelsPayload,
  fixtures,
  loginAdmin,
  resetDb,
  saveResult,
} from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

async function playedFinal(targetApp = app) {
  const cookie = await loginAdmin(targetApp);
  const home = await createTeamWithPlayers(targetApp, cookie, 'Leões');
  const away = await createTeamWithPlayers(targetApp, cookie, 'Tigres');
  const tournament = await createStartedTournament(targetApp, cookie, { format: 'single_elimination', teams: [home.team, away.team], name: 'Copa 2026' });
  const [final] = await fixtures(targetApp, tournament.id);
  const [pA, pB] = final!.teamA.id === home.team.id ? [home.players, away.players] : [away.players, home.players];
  await saveResult(targetApp, cookie, tournament.id, final!.matchId, 'final', duelsPayload(pA, pB, A_WINS_3_1));
  await targetApp.inject({ method: 'POST', url: `/api/tournaments/${tournament.id}/finish`, headers: { cookie } });
  const winner = final!.teamA.id === home.team.id ? home : away;
  const loser = winner === home ? away : home;
  return { cookie, tournament, winner, loser, final: final! };
}

describe('public pages', () => {
  it('shows a team page with roster, stats, titles and recent fixtures', async () => {
    const { winner } = await playedFinal();
    const res = await app.inject({ method: 'GET', url: `/api/teams/${winner.team.id}` });
    const body = res.json();
    expect(body.team).toMatchObject({ id: winner.team.id, name: winner.team.name });
    expect(body.roster).toHaveLength(6);
    expect(body.roster[0]).toHaveProperty('whatsappUrl');
    expect(body.stats).toMatchObject({ fixtures: { played: 1, wins: 1 }, duels: { played: 5, wins: 3, draws: 1, losses: 1 }, goalsFor: 7, goalsAgainst: 3 });
    expect(body.titles).toEqual([expect.objectContaining({ position: 1, tournamentName: 'Copa 2026' })]);
    expect(body.recentFixtures).toEqual([expect.objectContaining({ tournamentName: 'Copa 2026', scoreA: 3, scoreB: 1 })]);
    expect(body.tournaments).toEqual([expect.objectContaining({ name: 'Copa 2026', status: 'finished' })]);
  });

  it('shows a player page with stats, duel history and titles, without the phone', async () => {
    const { winner, loser } = await playedFinal();
    const scorer = winner.players[0]!;
    const res = await app.inject({ method: 'GET', url: `/api/players/${scorer.id}` });
    const body = res.json();
    expect(body.player).toEqual({ id: scorer.id, name: scorer.name });
    expect(body.currentTeam).toMatchObject({ id: winner.team.id });
    expect(body.teamHistory).toEqual([expect.objectContaining({ team: expect.objectContaining({ id: winner.team.id }), leftAt: null })]);
    expect(body.stats).toMatchObject({ playerId: scorer.id, duels: 1, wins: 1, goalsFor: 2, goalsAgainst: 0 });
    expect(body.duels).toEqual([
      expect.objectContaining({ order: 1, result: 'win', goalsFor: 2, goalsAgainst: 0, opponent: { id: loser.players[0]!.id, name: loser.players[0]!.name } }),
    ]);
    expect(body.titles).toEqual([expect.objectContaining({ position: 1, team: expect.objectContaining({ id: winner.team.id }) })]);
    expect(res.body).not.toContain('+55');
  });

  it('returns zero stats for a player who never played', async () => {
    const cookie = await loginAdmin(app);
    const { players } = await createTeamWithPlayers(app, cookie, 'Leões', 1);
    const body = (await app.inject({ method: 'GET', url: `/api/players/${players[0]!.id}` })).json();
    expect(body.stats).toMatchObject({ duels: 0, wins: 0, winRate: 0 });
    expect(body.duels).toEqual([]);
  });

  it('lists recent completed fixtures', async () => {
    await playedFinal();
    const res = await app.inject({ method: 'GET', url: '/api/fixtures/recent?limit=5' });
    expect(res.json()).toEqual([expect.objectContaining({ tournamentName: 'Copa 2026', scoreA: 3, scoreB: 1 })]);
  });

  it('never leaks phones to visitors when PHONE_VISIBILITY=authenticated', async () => {
    const privateApp = createTestApp({ phoneVisibility: 'authenticated' });
    const { tournament, winner, final } = await playedFinal(privateApp);
    const urls = [
      `/api/teams/${winner.team.id}`,
      `/api/teams/${winner.team.id}/roster`,
      `/api/players/${winner.players[0]!.id}`,
      `/api/tournaments/${tournament.id}/fixtures/${final.matchId}`,
      `/api/tournaments/${tournament.id}/stats`,
      '/api/fixtures/recent',
    ];
    for (const url of urls) {
      const res = await privateApp.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).not.toContain('+55');
      expect(res.body, url).not.toContain('wa.me');
    }
    await privateApp.close();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @kickabout/api -- test/public-pages.test.ts`
Expected: FAIL — `GET /api/teams/:id` e `/api/players/:id` respondem 404.

- [ ] **Step 3: Implementar**

Acrescentar a `apps/api/src/stats/queries.ts`:
```ts
import { teamsById, type TeamRef } from '../dto';

export interface FixtureSummary {
  tournamentId: string;
  tournamentName: string;
  matchId: number;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number;
  scoreB: number;
  playedAt: Date | null;
}

export async function fixtureSummaries(
  db: Db,
  fixtures: Awaited<ReturnType<typeof completedFixtures>>,
): Promise<FixtureSummary[]> {
  const teams = await teamsById(db, fixtures.flatMap((f) => [f.teamAId, f.teamBId]));
  return fixtures.map((f) => ({
    tournamentId: f.tournament.id,
    tournamentName: f.tournament.name,
    matchId: f.bmMatchId,
    teamA: teams.get(f.teamAId)!,
    teamB: teams.get(f.teamBId)!,
    scoreA: f.scoreA ?? 0,
    scoreB: f.scoreB ?? 0,
    playedAt: f.playedAt,
  }));
}
```

Acrescentar a `apps/api/src/teams/routes.ts` (imports + rota):
```ts
import { aggregateTeamStats } from '@kickabout/shared';
import { completedFixtures, fixtureSummaries, toFixtureRecord } from '../stats/queries';
```
```ts
  app.get('/teams/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const team = await findTeamOrThrow(prisma, id);
    const showPhone = canSeePhones(request, config);
    const [players, fixtures, titles, entries] = await Promise.all([
      activePlayers(prisma, id),
      completedFixtures(prisma, { OR: [{ teamAId: id }, { teamBId: id }] }),
      prisma.title.findMany({ where: { teamId: id }, orderBy: [{ year: 'desc' }, { position: 'asc' }] }),
      prisma.tournamentEntry.findMany({ where: { teamId: id }, include: { tournament: true }, orderBy: { tournament: { createdAt: 'desc' } } }),
    ]);
    return {
      team: teamRef(team),
      roster: players.map((player) => rosterPlayer(player, showPhone)),
      stats: aggregateTeamStats(id, fixtures.map(toFixtureRecord)),
      titles: titles.map((t) => ({ id: t.id, position: t.position, year: t.year, tournamentId: t.tournamentId, tournamentName: t.tournamentName })),
      recentFixtures: await fixtureSummaries(prisma, fixtures.slice(0, 10)),
      tournaments: entries.map((e) => ({ id: e.tournament.id, name: e.tournament.name, format: e.tournament.format, status: e.tournament.status })),
    };
  });
```

Acrescentar a `apps/api/src/players/routes.ts` (imports + rota):
```ts
import { aggregatePlayerStats, duelOutcome } from '@kickabout/shared';
import { teamsById } from '../dto';
import { toDuelInput } from '../stats/queries';
```
```ts
  app.get('/players/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const player = await prisma.player.findUnique({
      where: { id },
      include: { memberships: { include: { team: true }, orderBy: { joinedAt: 'desc' } } },
    });
    if (!player) throw notFound('Jogador');

    const duels = await prisma.duel.findMany({
      where: { OR: [{ playerAId: id }, { playerBId: id }], fixture: { status: 'completed' } },
      include: {
        fixture: { include: { tournament: { select: { id: true, name: true } } } },
        playerA: { select: { id: true, name: true } },
        playerB: { select: { id: true, name: true } },
      },
      orderBy: [{ fixture: { playedAt: 'desc' } }, { order: 'asc' }],
    });
    const teams = await teamsById(prisma, duels.flatMap((d) => [d.teamAId, d.teamBId]));

    const stats = aggregatePlayerStats(duels.map(toDuelInput)).find((s) => s.playerId === id) ?? {
      playerId: id,
      duels: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      winRate: 0,
    };

    const history = duels.map((duel) => {
      const isA = duel.playerAId === id;
      const outcome = duelOutcome(toDuelInput(duel));
      return {
        tournamentId: duel.fixture.tournament.id,
        tournamentName: duel.fixture.tournament.name,
        matchId: duel.fixture.bmMatchId,
        order: duel.order,
        team: teams.get(isA ? duel.teamAId : duel.teamBId)!,
        opponentTeam: teams.get(isA ? duel.teamBId : duel.teamAId)!,
        opponent: isA ? duel.playerB : duel.playerA,
        goalsFor: isA ? duel.goalsA : duel.goalsB,
        goalsAgainst: isA ? duel.goalsB : duel.goalsA,
        penaltiesFor: isA ? duel.penaltiesA : duel.penaltiesB,
        penaltiesAgainst: isA ? duel.penaltiesB : duel.penaltiesA,
        result: outcome === 'draw' ? 'draw' : (outcome === 'A') === isA ? 'win' : 'loss',
        playedAt: duel.fixture.playedAt,
      };
    });

    const playedFor = new Set(duels.map((d) => `${d.fixture.tournamentId}:${d.playerAId === id ? d.teamAId : d.teamBId}`));
    const candidateTitles = await prisma.title.findMany({
      where: { tournamentId: { in: [...new Set(duels.map((d) => d.fixture.tournamentId))] } },
      include: { team: true },
      orderBy: [{ year: 'desc' }, { position: 'asc' }],
    });
    const titles = candidateTitles
      .filter((t) => playedFor.has(`${t.tournamentId}:${t.teamId}`))
      .map((t) => ({ position: t.position, year: t.year, tournamentId: t.tournamentId, tournamentName: t.tournamentName, team: teamRef(t.team) }));

    const current = player.memberships.find((m) => m.leftAt === null);
    return {
      player: { id: player.id, name: player.name },
      currentTeam: current ? teamRef(current.team) : null,
      teamHistory: player.memberships.map((m) => ({ team: teamRef(m.team), joinedAt: m.joinedAt, leftAt: m.leftAt })),
      stats,
      duels: history,
      titles,
    };
  });
```

Acrescentar a `apps/api/src/fixtures/routes.ts` (imports + rota):
```ts
import { completedFixtures, fixtureSummaries } from '../stats/queries';
```
```ts
  const recentQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

  app.get('/fixtures/recent', async (request) => {
    const { limit } = parse(recentQuery, request.query);
    const fixtures = await completedFixtures(prisma, {});
    return fixtureSummaries(prisma, fixtures.slice(0, limit));
  });
```

> Nota: `completedFixtures(prisma, {})` carrega todos os confrontos concluídos; se o volume crescer, trocar por uma consulta com `take`. Aceitável na v1.

- [ ] **Step 4: Rodar a suíte completa e typecheck**

Run: `npm test && npm run typecheck`
Expected: todas as suítes de `@kickabout/shared` e `@kickabout/api` PASS; sem erros de tipo.

- [ ] **Step 5: Verificação manual do servidor**

Run: `cd apps/api && ADMIN_EMAIL=admin@local.dev ADMIN_PASSWORD=trocar-esta-senha npx tsx --env-file=.env src/scripts/create-admin.ts && (npx tsx --env-file=.env src/server.ts &) && sleep 3 && curl -s localhost:3333/api/health`
Expected: `Admin admin@local.dev pronto.` e `{"ok":true}`. Encerrar o servidor depois.

- [ ] **Step 6: Commit do plano**

```bash
git add -A
git commit -m "feat(api): Fastify + Prisma API for teams, tournaments, results and titles"
```
