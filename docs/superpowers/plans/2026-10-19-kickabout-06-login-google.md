# Login com Google e papéis de usuário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualquer pessoa entra com Google como usuário comum; só organizadores (`role: 'admin'`) acessam o admin, e só eles promovem outros usuários.

**Architecture:** A API ganha papéis em `User` e passa a exigir `role === 'admin'` em `requireAdmin` (403 para usuário comum). `POST /api/auth/google` recebe o ID token do botão oficial do Google (Google Identity Services), verifica com `google-auth-library` (injetado como dependência para testes) e cria ou vincula o usuário. O site mostra o botão em `/entrar`, um menu de conta no topo e esconde tudo do admin de quem não é organizador; `/admin/usuarios` promove e rebaixa.

**Tech Stack:** Fastify 5, Prisma 6 (Postgres), zod 4, `google-auth-library` (nova), React 19, React Router 7, TanStack Query 5, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-kickabout-login-google-design.md`

## Global Constraints

- Branch `feat/google-login`; **um commit só no fim do plano** (Task 7). As tasks 1–6 não commitam.
- Versão alvo: **v1.7**, com seção nova no topo de `docs/VERSOES.md`.
- Papéis: `admin` (organizador) e `user`. Padrão do banco: `user`. Linhas existentes continuam `admin`.
- Mensagens (exatas):
  - 403 `FORBIDDEN`: "Sua conta não é de organizador."
  - 401 `GOOGLE_TOKEN_INVALID`: "Não foi possível entrar com o Google. Tente de novo."
  - 404 `GOOGLE_LOGIN_DISABLED`: "Login com Google não está habilitado."
  - 409 `GOOGLE_ACCOUNT_CONFLICT`: "Este email já está ligado a outra conta Google."
  - 409 `CANNOT_DEMOTE_SELF`: "Você não pode tirar o seu próprio papel de organizador."
  - 409 `LAST_ADMIN`: "É preciso ter pelo menos um organizador."
  - Falha ao carregar o script: "Não foi possível carregar o login do Google. Use email e senha ou tente de novo."
- Usuário comum não vê nenhum link, botão ou texto do admin; `/admin` mostra "Página não encontrada" no layout público.
- O login com email e senha continua igual; conta sem senha recebe "Email ou senha inválidos.".
- Dependências com versão exata (`--save-exact`), como o resto do `package.json`.
- Comandos de teste: API `npx vitest run <arquivo>` em `apps/api`; site `npx vitest run <arquivo>` em `apps/web`; tudo `npm test` e `npm run typecheck` na raiz.

## Review Focus

1. **Dois primeiros logins simultâneos com a mesma conta Google** (dois cliques, duas abas): os dois entram e existe um usuário só. Teste na Task 2.
2. **Email do Google em outra caixa** (`Admin@Kickabout.test`) que bate com o organizador existente: vincula e continua `admin`. Teste na Task 2.
3. **Usuário comum em cada família de rota de admin** (times, jogadores, campeonatos, resultados, títulos, usuários): sempre 403, nunca 200. Teste nas Tasks 1 e 3.
4. **Organizador rebaixado com o admin aberto:** a próxima leitura ou escrita dá 403 e a tela vira "Página não encontrada", sem a faixa do organizador. Teste na Task 5.
5. **Topo no celular de 320px** com o botão de conta: marca, 3 links e a foto cabem sem rolagem lateral. Conferência no navegador na Task 7.

---

### Task 1: Papéis na API

**Files:**
- Create: `apps/api/prisma/migrations/20261019120000_google_login/migration.sql`
- Modify: `apps/api/prisma/schema.prisma` (model `User`)
- Modify: `apps/api/src/auth/sessions.ts` (`AuthUser`, `findSessionUser`, novo `authUser`)
- Modify: `apps/api/src/auth/hooks.ts` (`requireAdmin`)
- Modify: `apps/api/src/auth/routes.ts` (login por senha)
- Modify: `apps/api/src/players/roster.ts` (`canSeePhones`)
- Modify: `apps/api/src/scripts/create-admin.ts`
- Modify: `apps/api/test/helpers.ts` (`loginAdmin`, novo `loginUser`)
- Test: `apps/api/test/roles.test.ts` (novo), `apps/api/test/auth.test.ts`, `apps/api/test/teams-players.test.ts`

**Interfaces:**
- Produces:
  - `interface AuthUser { id: string; email: string; name: string | null; avatarUrl: string | null; role: string }` em `sessions.ts`
  - `authUser(user: { id; email; name; avatarUrl; role }): AuthUser`
  - `startSession(reply: FastifyReply, prisma: PrismaClient, config: AppConfig, userId: string): Promise<void>` em `sessions.ts` (cria sessão e grava o cookie)
  - helper de teste `loginUser(app, email?): Promise<string>` (cookie de um usuário `role: 'user'` com senha `USER_PASSWORD`)

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/test/helpers.ts`: em `loginAdmin`, o `upsert` passa a gravar o papel (o padrão do banco vai mudar para `user`):

```ts
  await prisma.user.upsert({
    where: { email: ADMIN.email },
    create: { email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password), role: 'admin' },
    update: {},
  });
```

e, logo abaixo de `loginAdmin`:

```ts
export const USER_PASSWORD = 'senha-comum-123';

/** Cookie de um usuário comum (não organizador), com senha para entrar sem o Google. */
export async function loginUser(app: FastifyInstance, email = 'ana@kickabout.test'): Promise<string> {
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: await hashPassword(USER_PASSWORD), role: 'user' },
    update: {},
  });
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: USER_PASSWORD } });
  const cookie = res.cookies.find((c) => c.name === 'kb_session');
  if (!cookie) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  return `kb_session=${cookie.value}`;
}
```

`apps/api/test/roles.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTeam, createTestApp, loginAdmin, loginUser, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const FORBIDDEN = { error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } };

describe('roles', () => {
  it('new users default to the user role in the database', async () => {
    const user = await prisma.user.create({ data: { email: 'novo@kickabout.test' } });
    expect(user).toMatchObject({ role: 'user', passwordHash: null, googleId: null, name: null, avatarUrl: null, lastLoginAt: null });
  });

  it('refuses every family of admin routes to a regular user with 403', async () => {
    const admin = await loginAdmin(app);
    const team = await createTeam(app, admin, 'Leões');
    const { id: tournamentId } = (
      await app.inject({ method: 'POST', url: '/api/tournaments', headers: { cookie: admin }, payload: { name: 'C', format: 'round_robin' } })
    ).json();
    const cookie = await loginUser(app);

    const attempts = [
      { method: 'POST', url: '/api/teams', payload: { name: 'Tigres', shortName: 'TIG' } },
      { method: 'PATCH', url: `/api/teams/${team.id}`, payload: { name: 'X', shortName: 'X', crestUrl: null } },
      { method: 'GET', url: '/api/players' },
      { method: 'POST', url: '/api/players', payload: { name: 'Ana', phone: '11 912345678' } },
      { method: 'POST', url: '/api/tournaments', payload: { name: 'C', format: 'round_robin' } },
      { method: 'DELETE', url: `/api/tournaments/${tournamentId}` },
      { method: 'PUT', url: `/api/tournaments/${tournamentId}/fixtures/0/result`, payload: { mode: 'draft', duels: [] } },
      { method: 'POST', url: '/api/titles', payload: { teamId: team.id, tournamentName: 'X', position: 1, year: 2020 } },
    ] as const;
    for (const attempt of attempts) {
      const res = await app.inject({ ...attempt, headers: { cookie } });
      expect({ url: attempt.url, method: attempt.method, status: res.statusCode, body: res.json() }).toEqual({
        url: attempt.url,
        method: attempt.method,
        status: 403,
        body: FORBIDDEN,
      });
    }
    expect(await prisma.tournament.count()).toBe(1);
  });

  it('keeps 401 for visitors without a session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/teams', payload: { name: 'Tigres', shortName: 'TIG' } });
    expect(res.statusCode).toBe(401);
  });

  it('exposes name, avatar and role on /auth/me', async () => {
    const cookie = await loginUser(app);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toEqual({
      user: { id: expect.any(String), email: 'ana@kickabout.test', name: null, avatarUrl: null, role: 'user' },
    });
  });
});
```

Em `apps/api/test/auth.test.ts`, dentro do `describe('auth')`, acrescente:

```ts
  it('refuses password login for an account without a password, with the generic message', async () => {
    await prisma.user.create({ data: { email: 'google@kickabout.test', googleId: 'g-1' } });
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'google@kickabout.test', password: 'qualquer' } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } });
  });

  it('records the last login time', async () => {
    await loginAdmin(app);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });
```

Em `apps/api/test/teams-players.test.ts`, no teste `hides phones from visitors when PHONE_VISIBILITY=authenticated`, antes do `await privateApp.close();`:

```ts
    const regular = await loginUser(privateApp);
    const asUser = await privateApp.inject({ method: 'GET', url: `/api/teams/${team.id}/roster`, headers: { cookie: regular } });
    expect(asUser.json().players).toEqual([{ id: player.id, name: 'Ana' }]);
```

(importe `loginUser` de `./helpers`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npx vitest run test/roles.test.ts test/auth.test.ts test/teams-players.test.ts`
Expected: FAIL — `prisma.user.create` sem `passwordHash` falha na validação do Prisma (campo obrigatório) e `googleId`/`role: 'user'` não existem; os testes de 403 recebem 200/201.

- [ ] **Step 3: Migração e schema**

`apps/api/prisma/schema.prisma`, model `User`:

```prisma
model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String?
  googleId     String?      @unique
  name         String?
  avatarUrl    String?
  role         String       @default("user")
  lastLoginAt  DateTime?
  createdAt    DateTime     @default(now())
  sessions     Session[]
  teams        Team[]
  tournaments  Tournament[]
}
```

`apps/api/prisma/migrations/20261019120000_google_login/migration.sql`:

```sql
-- Login com Google e papéis: senha opcional, conta Google, perfil e novo padrão "user".
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
```

Run: `cd apps/api && npx prisma migrate dev` (aplica no banco de desenvolvimento e regenera o client).
Expected: "Applying migration `20261019120000_google_login`" e nenhuma migração nova gerada (o schema bate com o SQL). Se o Prisma propuser outra migração, o SQL acima está diferente do schema: corrija o SQL, não aceite a migração gerada.

- [ ] **Step 4: Sessão, permissões e login por senha**

`apps/api/src/auth/sessions.ts` — substitua `AuthUser` e `findSessionUser`, e acrescente `authUser` e `startSession`:

```ts
import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config';
import type { Db } from '../db';

export const SESSION_COOKIE = 'kb_session';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

export const authUser = (user: AuthUser): AuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
});
```

(mantenha `hashToken`, `createSession` e `deleteSession` como estão), e:

```ts
export async function findSessionUser(db: Db, token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return authUser(session.user);
}

/** Cria a sessão do usuário e grava o cookie (login por senha ou Google). */
export async function startSession(reply: FastifyReply, prisma: PrismaClient, config: AppConfig, userId: string) {
  const { token, expiresAt } = await createSession(prisma, userId, config.sessionTtlDays);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: expiresAt,
  });
}
```

`apps/api/src/auth/hooks.ts`, `requireAdmin`:

```ts
export async function requireAdmin(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.');
  if (request.user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Sua conta não é de organizador.');
}
```

`apps/api/src/auth/routes.ts`, rota `POST /auth/login`:

```ts
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = parse(loginBody, request.body);
    const found = await prisma.user.findUnique({ where: { email } });
    if (!found?.passwordHash || !(await verifyPassword(found.passwordHash, password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
    }
    const user = await prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } });
    await startSession(reply, prisma, config, user.id);
    return { user: authUser(user) };
  });
```

(imports: `authUser`, `startSession` de `./sessions`; `createSession` sai do import se não for mais usado.)

`apps/api/src/players/roster.ts`:

```ts
/** Celulares: públicos, ou só para organizadores com PHONE_VISIBILITY=authenticated. */
export const canSeePhones = (request: FastifyRequest, config: AppConfig): boolean =>
  config.phoneVisibility === 'public' || request.user?.role === 'admin';
```

`apps/api/src/scripts/create-admin.ts`, a linha do `upsert`:

```ts
await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, role: 'admin' },
  update: { passwordHash, role: 'admin' },
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/api && npx vitest run test/roles.test.ts test/auth.test.ts test/teams-players.test.ts`
Expected: PASS.

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

---

### Task 2: Login com Google na API

**Files:**
- Modify: `apps/api/package.json` (dependência `google-auth-library`)
- Modify: `apps/api/src/config.ts` (`googleClientId`)
- Modify: `apps/api/src/deps.ts` (`verifyGoogleToken`)
- Create: `apps/api/src/auth/google.ts`
- Modify: `apps/api/src/auth/routes.ts` (`GET /auth/config`, `POST /auth/google`)
- Modify: `apps/api/.env.example`
- Modify: `apps/api/test/helpers.ts` (`testConfig`, `createTestApp`)
- Test: `apps/api/test/google-login.test.ts` (novo), `apps/api/test/config.test.ts`

**Interfaces:**
- Consumes: `authUser`, `startSession` (Task 1).
- Produces:
  - `AppConfig.googleClientId: string | null`
  - `interface GoogleProfile { sub: string; email: string; emailVerified: boolean; name: string | null; picture: string | null }`
  - `type VerifyGoogleToken = (credential: string, clientId: string) => Promise<GoogleProfile>` (rejeita se o token for inválido)
  - `AppDeps.verifyGoogleToken?: VerifyGoogleToken`
  - `googleTokenVerifier(): VerifyGoogleToken` (real)
  - `signInWithGoogle(prisma: PrismaClient, profile: GoogleProfile): Promise<User>`
  - `createTestApp(overrides?: Partial<AppConfig>, deps?: Partial<Pick<AppDeps, 'verifyGoogleToken'>>)`
  - `GET /api/auth/config → { googleClientId: string | null }`
  - `POST /api/auth/google { credential } → { user: AuthUser }`

- [ ] **Step 1: Instalar a biblioteca**

Run: `npm install google-auth-library -w @kickabout/api --save-exact`
Expected: `apps/api/package.json` ganha `"google-auth-library": "<versão>"` sem `^`. Anote a versão no ledger.

- [ ] **Step 2: Escrever os testes que falham**

`apps/api/test/helpers.ts`:

```ts
import type { AppDeps } from '../src/deps';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    databaseUrl: process.env.DATABASE_URL ?? '',
    phoneVisibility: 'public',
    sessionTtlDays: 30,
    secureCookies: false,
    googleClientId: null,
    ...overrides,
  };
}

export function createTestApp(overrides: Partial<AppConfig> = {}, deps: Partial<Pick<AppDeps, 'verifyGoogleToken'>> = {}): FastifyInstance {
  return buildApp({ prisma, config: testConfig(overrides), ...deps });
}
```

`apps/api/test/config.test.ts`: no teste `applies defaults`, acrescente `googleClientId: null` ao objeto esperado; acrescente:

```ts
  it('reads the Google client id', () => {
    expect(loadConfig({ DATABASE_URL: 'x', GOOGLE_CLIENT_ID: ' abc.apps.googleusercontent.com ' }).googleClientId).toBe(
      'abc.apps.googleusercontent.com',
    );
    expect(loadConfig({ DATABASE_URL: 'x', GOOGLE_CLIENT_ID: '' }).googleClientId).toBeNull();
  });
```

`apps/api/test/google-login.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { GoogleProfile } from '../src/auth/google';
import { ADMIN, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const CLIENT_ID = 'kickabout-test.apps.googleusercontent.com';

/** Verificador falso: o "token" é o perfil em JSON; "invalido" é recusado; o destinatário precisa ser o nosso. */
async function fakeVerify(credential: string, clientId: string): Promise<GoogleProfile> {
  if (clientId !== CLIENT_ID || credential === 'invalido') throw new Error('token inválido');
  return JSON.parse(credential) as GoogleProfile;
}

const token = (overrides: Partial<GoogleProfile> = {}) =>
  JSON.stringify({ sub: 'g-ana', email: 'ana@gmail.com', emailVerified: true, name: 'Ana Souza', picture: 'https://foto/ana', ...overrides });

const app = createTestApp({ googleClientId: CLIENT_ID }, { verifyGoogleToken: fakeVerify });
afterAll(() => app.close());
beforeEach(resetDb);

const google = (credential: string, target = app) =>
  target.inject({ method: 'POST', url: '/api/auth/google', payload: { credential } });

describe('google login', () => {
  it('publishes the client id', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ googleClientId: CLIENT_ID });
  });

  it('creates a regular user on the first login and reuses it afterwards', async () => {
    const first = await google(token());
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({
      user: { id: expect.any(String), email: 'ana@gmail.com', name: 'Ana Souza', avatarUrl: 'https://foto/ana', role: 'user' },
    });
    const cookie = first.cookies.find((c) => c.name === 'kb_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `kb_session=${cookie!.value}` } });
    expect(me.json().user).toMatchObject({ email: 'ana@gmail.com', role: 'user' });

    const second = await google(token({ name: 'Ana S.', picture: 'https://foto/nova' }));
    expect(second.json().user).toMatchObject({ id: first.json().user.id, name: 'Ana S.', avatarUrl: 'https://foto/nova' });
    expect(await prisma.user.count()).toBe(1);
    const stored = await prisma.user.findFirstOrThrow();
    expect(stored).toMatchObject({ googleId: 'g-ana', passwordHash: null });
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it('links to the existing organizer by email, in any case, keeping the admin role', async () => {
    await loginAdmin(app);
    const res = await google(token({ sub: 'g-admin', email: ADMIN.email.toUpperCase(), name: 'Organizador' }));
    expect(res.json().user).toMatchObject({ email: ADMIN.email, role: 'admin', name: 'Organizador' });
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findFirstOrThrow()).googleId).toBe('g-admin');
  });

  it('refuses to relink an email already tied to another Google account', async () => {
    await google(token());
    const res = await google(token({ sub: 'g-outra' }));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'GOOGLE_ACCOUNT_CONFLICT', message: 'Este email já está ligado a outra conta Google.' } });
  });

  it('creates a single user when the first login arrives twice at once', async () => {
    const responses = await Promise.all([google(token()), google(token())]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuses invalid tokens and unverified emails', async () => {
    const message = { error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Não foi possível entrar com o Google. Tente de novo.' } };
    const invalid = await google('invalido');
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toEqual(message);
    const unverified = await google(token({ emailVerified: false }));
    expect(unverified.statusCode).toBe(401);
    expect(unverified.json()).toEqual(message);
    expect(await prisma.user.count()).toBe(0);
  });

  it('validates the body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/google', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('is disabled without GOOGLE_CLIENT_ID', async () => {
    const plain = createTestApp({}, { verifyGoogleToken: fakeVerify });
    expect((await plain.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ googleClientId: null });
    const res = await google(token(), plain);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'GOOGLE_LOGIN_DISABLED', message: 'Login com Google não está habilitado.' } });
    await plain.close();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/api && npx vitest run test/google-login.test.ts test/config.test.ts`
Expected: FAIL — `../src/auth/google` não existe; `googleClientId` ausente do config.

- [ ] **Step 4: Implementar**

`apps/api/src/config.ts`: em `AppConfig`, acrescente `googleClientId: string | null;` e, no retorno de `loadConfig`:

```ts
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null,
```

`apps/api/src/auth/google.ts`:

```ts
import type { PrismaClient, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../errors';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Confere o ID token do botão do Google e devolve o perfil; rejeita token inválido. */
export type VerifyGoogleToken = (credential: string, clientId: string) => Promise<GoogleProfile>;

/** Verificação real: assinatura, emissor, destinatário (clientId) e validade, pela biblioteca do Google. */
export function googleTokenVerifier(): VerifyGoogleToken {
  const client = new OAuth2Client();
  return async (credential, clientId) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error('Token do Google sem conta ou email.');
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  };
}

/**
 * Acha o usuário pela conta Google; senão, pelo email (é assim que o organizador atual passa a entrar com Google);
 * senão, cria um usuário comum. Atualiza nome, foto e último acesso.
 */
export async function signInWithGoogle(prisma: PrismaClient, profile: GoogleProfile): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const data = { name: profile.name, avatarUrl: profile.picture, lastLoginAt: new Date() };
  return prisma.$transaction(async (tx) => {
    const byGoogle = await tx.user.findUnique({ where: { googleId: profile.sub } });
    if (byGoogle) return tx.user.update({ where: { id: byGoogle.id }, data });
    const byEmail = await tx.user.findUnique({ where: { email } });
    if (byEmail?.googleId) {
      throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'Este email já está ligado a outra conta Google.');
    }
    if (byEmail) return tx.user.update({ where: { id: byEmail.id }, data: { ...data, googleId: profile.sub } });
    return tx.user.create({ data: { ...data, email, googleId: profile.sub, role: 'user' } });
  });
}
```

`apps/api/src/deps.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import type { VerifyGoogleToken } from './auth/google';
import type { AppConfig } from './config';

export interface AppDeps {
  prisma: PrismaClient;
  config: AppConfig;
  /** Verificação do token do Google; os testes passam uma falsa. Padrão: a real. */
  verifyGoogleToken?: VerifyGoogleToken;
}
```

`apps/api/src/auth/routes.ts` — a assinatura passa a desestruturar `verifyGoogleToken`, e entram as duas rotas:

```ts
const googleBody = z.object({ credential: z.string().min(1) });

const invalidGoogle = () => new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Não foi possível entrar com o Google. Tente de novo.');

export function registerAuthRoutes(app: FastifyInstance, { prisma, config, verifyGoogleToken }: AppDeps) {
  const verify = verifyGoogleToken ?? googleTokenVerifier();

  app.get('/auth/config', async () => ({ googleClientId: config.googleClientId }));

  app.post('/auth/google', async (request, reply) => {
    if (!config.googleClientId) throw new AppError(404, 'GOOGLE_LOGIN_DISABLED', 'Login com Google não está habilitado.');
    const { credential } = parse(googleBody, request.body);
    let profile: GoogleProfile;
    try {
      profile = await verify(credential, config.googleClientId);
    } catch {
      throw invalidGoogle();
    }
    if (!profile.emailVerified) throw invalidGoogle();
    // Dois primeiros logins ao mesmo tempo: o segundo bate no índice único e, na nova tentativa, acha o usuário.
    const user = await signInWithGoogle(prisma, profile).catch((error: unknown) => {
      if (isUniqueViolation(error)) return signInWithGoogle(prisma, profile);
      throw error;
    });
    await startSession(reply, prisma, config, user.id);
    return { user: authUser(user) };
  });

  // ... login (Task 1), logout e me como estão
```

(imports: `googleTokenVerifier`, `signInWithGoogle`, `type GoogleProfile` de `./google`; `isUniqueViolation` de `../errors`.)

`apps/api/.env.example`, no fim:

```
# Login com Google: Client ID do Google Cloud (Credenciais > ID do cliente OAuth > Aplicativo da Web). Vazio = desligado.
GOOGLE_CLIENT_ID=
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/api && npx vitest run test/google-login.test.ts test/config.test.ts test/auth.test.ts`
Expected: PASS.

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

---

### Task 3: Usuários (promover e rebaixar)

**Files:**
- Create: `apps/api/src/users/routes.ts`
- Modify: `apps/api/src/app.ts` (registrar)
- Test: `apps/api/test/users.test.ts` (novo)

**Interfaces:**
- Consumes: `requireAdmin` com 403 (Task 1); `loginUser` (Task 1).
- Produces:
  - `GET /api/users → UserListItem[]`, com `UserListItem = { id, email, name, avatarUrl, role, hasPassword: boolean, hasGoogle: boolean, lastLoginAt: string | null, createdAt: string }`
  - `PATCH /api/users/:id { role: 'admin' | 'user' } → UserListItem`

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/test/users.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, createTestApp, loginAdmin, loginUser, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const list = (cookie: string) => app.inject({ method: 'GET', url: '/api/users', headers: { cookie } });
const setRole = (cookie: string, id: string, role: string) =>
  app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: { cookie }, payload: { role } });
const idOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

describe('users', () => {
  it('lists users newest first with how they sign in', async () => {
    const admin = await loginAdmin(app);
    await loginUser(app, 'ana@kickabout.test');
    await prisma.user.create({ data: { email: 'bia@gmail.com', googleId: 'g-bia', name: 'Bia', avatarUrl: 'https://foto/bia' } });

    const res = await list(admin);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({ email: 'bia@gmail.com', name: 'Bia', role: 'user', hasGoogle: true, hasPassword: false, lastLoginAt: null }),
      expect.objectContaining({ email: 'ana@kickabout.test', role: 'user', hasGoogle: false, hasPassword: true, lastLoginAt: expect.any(String) }),
      expect.objectContaining({ email: ADMIN.email, role: 'admin', hasPassword: true }),
    ]);
    expect(res.json()[0]).not.toHaveProperty('passwordHash');
    expect(res.json()[0]).not.toHaveProperty('googleId');
  });

  it('promotes a user, who then reaches the admin routes', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const res = await setRole(admin, await idOf('ana@kickabout.test'), 'admin');
    expect(res.json()).toMatchObject({ email: 'ana@kickabout.test', role: 'admin' });
    expect((await list(ana)).statusCode).toBe(200);
  });

  it('demotes another organizer, who loses access on the next request', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const anaId = await idOf('ana@kickabout.test');
    await setRole(admin, anaId, 'admin');
    expect((await setRole(admin, anaId, 'user')).json()).toMatchObject({ role: 'user' });
    expect((await list(ana)).statusCode).toBe(403);
  });

  it('refuses demoting yourself', async () => {
    const admin = await loginAdmin(app);
    const res = await setRole(admin, await idOf(ADMIN.email), 'user');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'CANNOT_DEMOTE_SELF', message: 'Você não pode tirar o seu próprio papel de organizador.' } });
  });

  it('never leaves the system without an organizer, even with two demotions at once', async () => {
    const admin = await loginAdmin(app);
    const ana = await loginUser(app);
    const adminId = await idOf(ADMIN.email);
    const anaId = await idOf('ana@kickabout.test');
    await setRole(admin, anaId, 'admin');

    const [one, two] = await Promise.all([setRole(admin, anaId, 'user'), setRole(ana, adminId, 'user')]);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { role: 'admin' } })).toBe(1);
    const refused = one.statusCode === 409 ? one : two;
    expect(refused.json()).toEqual({ error: { code: 'LAST_ADMIN', message: 'É preciso ter pelo menos um organizador.' } });
  });

  it('validates the role and returns 404 for unknown users', async () => {
    const admin = await loginAdmin(app);
    expect((await setRole(admin, await idOf(ADMIN.email), 'dono')).statusCode).toBe(400);
    const missing = await setRole(admin, 'nao-existe', 'admin');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
  });

  it('is only for organizers', async () => {
    await loginAdmin(app);
    const ana = await loginUser(app);
    expect((await list(ana)).statusCode).toBe(403);
    expect((await setRole(ana, await idOf('ana@kickabout.test'), 'admin')).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/users' })).statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npx vitest run test/users.test.ts`
Expected: FAIL — `/api/users` responde 404 "Rota não encontrada.".

- [ ] **Step 3: Implementar**

`apps/api/src/users/routes.ts`:

```ts
import type { User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/hooks';
import type { AppDeps } from '../deps';
import { idParams } from '../dto';
import { AppError, notFound, parse } from '../errors';

const roleBody = z.object({ role: z.enum(['admin', 'user']) });

const userDto = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
  hasPassword: user.passwordHash !== null,
  hasGoogle: user.googleId !== null,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

export function registerUserRoutes(app: FastifyInstance, { prisma }: AppDeps) {
  app.get('/users', { preHandler: requireAdmin }, async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(userDto);
  });

  app.patch('/users/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { role } = parse(roleBody, request.body);
    const updated = await prisma.$transaction(async (tx) => {
      // Trava os organizadores: dois rebaixamentos ao mesmo tempo não podem zerar a lista.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'admin' FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw notFound('Usuário');
      if (role === 'user' && user.role === 'admin') {
        if (id === request.user!.id) {
          throw new AppError(409, 'CANNOT_DEMOTE_SELF', 'Você não pode tirar o seu próprio papel de organizador.');
        }
        if (admins.length <= 1) throw new AppError(409, 'LAST_ADMIN', 'É preciso ter pelo menos um organizador.');
      }
      return tx.user.update({ where: { id }, data: { role } });
    });
    return userDto(updated);
  });
}
```

`apps/api/src/app.ts`: importe `registerUserRoutes` de `./users/routes` e chame `registerUserRoutes(api, deps);` depois de `registerTitleRoutes(api, deps);`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npx vitest run test/users.test.ts`
Expected: PASS (7 testes).

Run: `cd apps/api && npx vitest run` (suíte da API inteira)
Expected: PASS.

---

### Task 4: Site — tipos, cliente e página Entrar com o botão do Google

**Files:**
- Modify: `apps/web/src/api/types.ts` (`AuthUser`, `UserListItem`)
- Modify: `apps/web/src/api/admin.ts` (`loginWithGoogle`, `setUserRole`)
- Modify: `apps/web/src/api/queries.ts` (`useAuthConfig`, `useUsers`)
- Modify: `apps/web/src/lib/redirect.ts` (`isSafePath`, `afterSignIn`)
- Create: `apps/web/src/components/GoogleButton.tsx`
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/web/src/styles/components.css`
- Modify: `apps/web/test/data.ts` (`ADMIN`, novo `REGULAR`)
- Test: `apps/web/test/google-login.test.tsx` (novo), `apps/web/test/auth.test.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/config`, `POST /api/auth/google` (Task 2); `GET/PATCH /api/users` (Task 3).
- Produces:
  - `type Role = 'admin' | 'user'`; `interface AuthUser { id; email; name: string | null; avatarUrl: string | null; role: Role }`
  - `interface UserListItem { id; email; name: string | null; avatarUrl: string | null; role: Role; hasPassword: boolean; hasGoogle: boolean; lastLoginAt: string | null; createdAt: string }`
  - `loginWithGoogle(credential: string): Promise<{ user: AuthUser }>`; `setUserRole(id: string, role: Role): Promise<UserListItem>`
  - `useAuthConfig()` (chave `['auth-config']`); `useUsers()` (chave `['users']`)
  - `isSafePath(target: string | null): target is string`; `afterSignIn(user: { role: string }, target: string | null): string`
  - `<GoogleButton clientId onCredential />`
  - dados de teste `ADMIN` (com `name: null, avatarUrl: null`) e `REGULAR` (`role: 'user'`, `name: 'Ana Souza'`)

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/test/data.ts`:

```ts
export const ADMIN = { id: 'u1', email: 'admin@kickabout.local', name: null, avatarUrl: null, role: 'admin' as const };
export const REGULAR = { id: 'u2', email: 'ana@gmail.com', name: 'Ana Souza', avatarUrl: null, role: 'user' as const };
```

`apps/web/test/google-login.test.tsx`:

```ts
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { afterSignIn } from '../src/lib/redirect';
import { ADMIN, REGULAR } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const CLIENT_ID = 'kickabout-test.apps.googleusercontent.com';

/** `window.google` falso: o botão renderizado chama o callback com um token. */
function fakeGoogle() {
  const seen: { clientId?: string; options?: Record<string, unknown> } = {};
  let callback: ((response: { credential: string }) => void) | undefined;
  vi.stubGlobal('google', {
    accounts: {
      id: {
        initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => {
          seen.clientId = options.client_id;
          callback = options.callback;
        },
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => {
          seen.options = options;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Fazer login com o Google';
          button.onclick = () => callback?.({ credential: 'token-do-google' });
          parent.append(button);
        },
      },
    },
  });
  return seen;
}

function signInAs(user: typeof ADMIN | typeof REGULAR, extra: Record<string, unknown> = {}) {
  let current: typeof user | null = null;
  return mockApi({
    '/auth/me': () => ({ user: current }),
    '/auth/config': { googleClientId: CLIENT_ID },
    'POST /auth/google': () => {
      current = user;
      return { user };
    },
    '/fixtures/recent?limit=8': [],
    '/tournaments?status=in_progress': [],
    ...extra,
  });
}

describe('afterSignIn', () => {
  it('sends organizers to the requested page or the admin, and regular users away from the admin', () => {
    expect(afterSignIn(ADMIN, '/admin/times')).toBe('/admin/times');
    expect(afterSignIn(ADMIN, null)).toBe('/admin');
    expect(afterSignIn(REGULAR, '/times/t1')).toBe('/times/t1');
    expect(['/admin', '/admin/times', '/admin?x=1', null, '//evil.com'].map((target) => afterSignIn(REGULAR, target))).toEqual(
      Array(5).fill('/'),
    );
    expect(afterSignIn(REGULAR, '/administracao')).toBe('/administracao');
  });
});

describe('sign in with Google', () => {
  it('shows the Google button with the configured client id, above the password form', async () => {
    const seen = fakeGoogle();
    signInAs(REGULAR);
    renderRoute('/entrar');
    expect(await screen.findByRole('button', { name: 'Fazer login com o Google' })).toBeInTheDocument();
    expect(seen.clientId).toBe(CLIENT_ID);
    expect(seen.options).toMatchObject({ theme: 'filled_black', text: 'signin_with', locale: 'pt-BR' });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByText(/organizador/i)).toBeNull();
  });

  it('signs a regular user in and goes home, even when coming from the admin', async () => {
    fakeGoogle();
    const fetchMock = signInAs(REGULAR);
    const { router } = renderRoute('/entrar?voltar=%2Fadmin');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/google')).toEqual([{ credential: 'token-do-google' }]);
  });

  it('signs an organizer in and goes to the requested admin page', async () => {
    fakeGoogle();
    signInAs(ADMIN, { '/teams': [] });
    const { router } = renderRoute('/entrar?voltar=%2Fadmin%2Ftimes');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/times'));
  });

  it('shows the API message when Google sign-in is refused', async () => {
    fakeGoogle();
    mockApi({
      '/auth/me': { user: null },
      '/auth/config': { googleClientId: CLIENT_ID },
      'POST /auth/google': () =>
        new Response(
          JSON.stringify({ error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Não foi possível entrar com o Google. Tente de novo.' } }),
          { status: 401 },
        ),
    });
    renderRoute('/entrar');
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer login com o Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar com o Google. Tente de novo.');
  });

  it('hides the Google button when the server has no client id', async () => {
    fakeGoogle();
    mockApi({ '/auth/me': { user: null }, '/auth/config': { googleClientId: null } });
    renderRoute('/entrar');
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fazer login com o Google' })).toBeNull());
  });

  it('explains when the Google script cannot load', async () => {
    mockApi({ '/auth/me': { user: null }, '/auth/config': { googleClientId: CLIENT_ID } });
    renderRoute('/entrar');
    await waitFor(() => expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull());
    document.querySelector('script[src="https://accounts.google.com/gsi/client"]')!.dispatchEvent(new Event('error'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o login do Google. Use email e senha ou tente de novo.',
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
```

Em `apps/web/test/auth.test.tsx`, acrescente ao `describe('sign in')`:

```ts
  it('sends a regular user who signs in with a password to the home page', async () => {
    let user: typeof REGULAR | null = null;
    mockApi({
      '/auth/me': () => ({ user }),
      'POST /auth/login': () => {
        user = REGULAR;
        return { user: REGULAR };
      },
      '/fixtures/recent?limit=8': [],
      '/tournaments?status=in_progress': [],
    });
    const { router } = renderRoute('/entrar?voltar=%2Fadmin');
    await screen.findByRole('heading', { name: 'Entrar' });
    signIn('ana@gmail.com', 'segredo123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
```

(importe `REGULAR` de `./data`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/google-login.test.tsx test/auth.test.tsx`
Expected: FAIL — `afterSignIn` não existe; a página não tem o botão do Google.

- [ ] **Step 3: Implementar**

`apps/web/src/api/types.ts`, troque `AuthUser`:

```ts
export type Role = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
}

/** Usuário como a tela de usuários do admin vê. */
export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  hasPassword: boolean;
  hasGoogle: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
```

`apps/web/src/api/admin.ts` (importe `Role` e `UserListItem` de `./types`), depois de `logout`:

```ts
export const loginWithGoogle = (credential: string) => apiRequest<{ user: AuthUser }>('POST', '/auth/google', { credential });
export const setUserRole = (id: string, role: Role) => apiRequest<UserListItem>('PATCH', `/users/${id}`, { role });
```

`apps/web/src/api/queries.ts` (importe `UserListItem`), depois de `useMe`:

```ts
/** Configuração pública do login; não muda enquanto a página está aberta. */
export const useAuthConfig = () =>
  useQuery({
    queryKey: ['auth-config'],
    queryFn: () => apiGet<{ googleClientId: string | null }>('/auth/config'),
    staleTime: Infinity,
  });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => apiGet<UserListItem[]>('/users') });
```

`apps/web/src/lib/redirect.ts`:

```ts
/** Caminho interno (`/algo`), sem truques para sair do site. */
export function isSafePath(target: string | null): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') && !/[\u0000-\u001f\u007f]/.test(target);
}

/** Só aceita caminhos internos (`/algo`); qualquer outro destino volta para o admin. */
export function safeRedirect(target: string | null): string {
  return isSafePath(target) ? target : '/admin';
}

const isAdminPath = (path: string) => /^\/admin(?:[/?#]|$)/.test(path);

/** Destino depois de entrar: organizador vai para o pedido (ou o admin); usuário comum nunca vai para o admin. */
export function afterSignIn(user: { role: string }, target: string | null): string {
  if (user.role === 'admin') return safeRedirect(target);
  return isSafePath(target) && !isAdminPath(target) ? target : '/';
}
```

`apps/web/src/components/GoogleButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let loading: Promise<void> | null = null;

/** Carrega o script do Google uma vez; se falhar, a próxima tentativa carrega de novo. */
function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      loading = null;
      script.remove();
      reject(new Error('Script do Google não carregou.'));
    });
    document.head.append(script);
  });
  return loading;
}

/** Botão oficial "Fazer login com o Google" (Google Identity Services). Entrega o ID token em `onCredential`. */
export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    loadGoogle().then(
      () => {
        const google = window.google;
        if (!active || !container.current || !google) return;
        google.accounts.id.initialize({ client_id: clientId, callback: (response) => callback.current(response.credential) });
        google.accounts.id.renderButton(container.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'pt-BR',
        });
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [clientId]);

  if (failed) {
    return (
      <p className="state state-error" role="alert">
        Não foi possível carregar o login do Google. Use email e senha ou tente de novo.
      </p>
    );
  }
  return <div ref={container} className="google-button" />;
}
```

`apps/web/src/pages/LoginPage.tsx` (arquivo inteiro):

```tsx
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { login, loginWithGoogle } from '../api/admin';
import { useApiMutation } from '../api/mutation';
import { useAuthConfig, useMe } from '../api/queries';
import type { AuthUser } from '../api/types';
import { FormError } from '../components/FormError';
import { GoogleButton } from '../components/GoogleButton';
import { afterSignIn } from '../lib/redirect';

export function LoginPage() {
  const [params] = useSearchParams();
  const target = params.get('voltar');
  const navigate = useNavigate();
  const me = useMe();
  const config = useAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const withPassword = useApiMutation((vars: { email: string; password: string }) => login(vars.email, vars.password));
  const withGoogle = useApiMutation(loginWithGoogle);
  const done = ({ user }: { user: AuthUser }) => navigate(afterSignIn(user, target), { replace: true });

  if (me.data?.user) return <Navigate to={afterSignIn(me.data.user, target)} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    withPassword.mutate({ email, password }, { onSuccess: done });
  };

  const clientId = config.data?.googleClientId;

  return (
    <section className="narrow">
      <h1>Entrar</h1>
      {clientId && (
        <div className="signin-google">
          <FormError error={withGoogle.error} />
          <GoogleButton clientId={clientId} onCredential={(credential) => withGoogle.mutate(credential, { onSuccess: done })} />
          <p className="signin-or">ou</p>
        </div>
      )}
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
        <FormError error={withPassword.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={withPassword.isPending}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
```

`apps/web/src/styles/components.css`, no fim:

```css
/* Entrar: botão do Google em cima, "ou" separando do formulário de senha */
.signin-google {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.google-button {
  min-height: 44px;
}

.signin-or {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--muted);
  font-size: var(--step--1);
}

.signin-or::before,
.signin-or::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--line);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/google-login.test.tsx test/auth.test.tsx`
Expected: PASS. Os testes antigos de `auth.test.tsx` continuam passando (sem `/auth/config` no mock, a API falsa responde 404 e o botão não aparece).

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros (o `role: string` antigo dos dados de teste virou `'admin' as const`).

---

### Task 5: Site — topo com a conta e admin escondido de quem não é organizador

**Files:**
- Create: `apps/web/src/api/use-sign-out.ts`
- Create: `apps/web/src/components/AccountMenu.tsx`
- Modify: `apps/web/src/components/Layout.tsx`
- Modify: `apps/web/src/pages/admin/AdminLayout.tsx`
- Modify: `apps/web/src/api/query-client.ts` (403 em leituras)
- Modify: `apps/web/src/styles/components.css`
- Test: `apps/web/test/account.test.tsx` (novo), `apps/web/test/app.test.tsx`

**Interfaces:**
- Consumes: `AuthUser`, `REGULAR`, `ADMIN` (Task 4).
- Produces:
  - `useSignOut(): UseMutationResult` — sai, esquece a sessão e vai para `/`
  - `<AccountMenu user={AuthUser} />`
  - `AdminLayout` só renderiza o admin para `role === 'admin'`; usuário comum vê `<NotFoundPage />`

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/web/test/app.test.tsx`, troque o teste `links to the organizer area from the footer` por:

```ts
  it('offers sign in from the footer to visitors', async () => {
    mockApi({ '/auth/me': { user: null } });
    renderRoute('/rota-que-nao-existe');
    expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByText(/organizador/i)).toBeNull();
  });
```

`apps/web/test/account.test.tsx`:

```ts
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, REGULAR } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const HOME = { '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] };

describe('account in the top bar', () => {
  it('shows a regular user their name and sign out, with no trace of the admin', async () => {
    let user: typeof REGULAR | null = REGULAR;
    const fetchMock = mockApi({
      ...HOME,
      '/auth/me': () => ({ user }),
      'POST /auth/logout': () => {
        user = null;
        return { ok: true };
      },
    });
    const { router } = renderRoute('/times');
    const account = await screen.findByRole('group', { name: 'Conta de Ana Souza' });
    expect(within(account).getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/organizador/i);

    fireEvent.click(within(account).getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sentBodies(fetchMock, 'POST /auth/logout')).toHaveLength(1);
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('gives organizers a link to the organizer area', async () => {
    mockApi({ ...HOME, '/auth/me': { user: ADMIN } });
    renderRoute('/');
    const account = await screen.findByRole('group', { name: 'Conta de admin@kickabout.local' });
    expect(within(account).getByRole('link', { name: 'Área do organizador' })).toHaveAttribute('href', '/admin');
  });

  it('shows the Google photo when there is one', async () => {
    mockApi({ ...HOME, '/auth/me': { user: { ...REGULAR, avatarUrl: 'https://foto/ana' } } });
    renderRoute('/');
    const account = await screen.findByRole('group', { name: 'Conta de Ana Souza' });
    expect(account.querySelector('img')).toHaveAttribute('src', 'https://foto/ana');
  });
});

describe('admin for regular users', () => {
  it('shows the standard not found page inside the public layout', async () => {
    mockApi({ '/auth/me': { user: REGULAR } });
    renderRoute('/admin/times');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Administração' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver site' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/organizador/i);
  });

  it('hides the admin as soon as an organizer is demoted (403 on a read)', async () => {
    let user: typeof ADMIN | typeof REGULAR = ADMIN;
    mockApi({
      '/auth/me': () => ({ user }),
      '/teams': () => {
        user = REGULAR;
        return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } }), { status: 403 });
      },
    });
    renderRoute('/admin/times');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Administração' })).toBeNull();
  });

  it('hides the admin when a write comes back 403', async () => {
    let user: typeof ADMIN | typeof REGULAR = ADMIN;
    mockApi({
      '/auth/me': () => ({ user }),
      '/teams': [],
      'POST /teams': () => {
        user = REGULAR;
        return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sua conta não é de organizador.' } }), { status: 403 });
      },
    });
    renderRoute('/admin/times');
    const form = await screen.findByRole('form', { name: 'Novo time' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Tigres' } });
    fireEvent.change(within(form).getByLabelText(/Tag/), { target: { value: 'TIG' } });
    fireEvent.click(within(form).getByRole('button', { name: /Cadastrar|Criar/ }));
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
  });
});
```

(Antes de rodar, confira em `AdminTeamsPage.tsx` o `aria-label` do formulário de time e o texto do botão; ajuste as duas consultas do último teste para os nomes reais, sem mudar o que o teste afirma.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/account.test.tsx test/app.test.tsx`
Expected: FAIL — não há grupo "Conta de …"; o rodapé ainda diz "Área do organizador"; `/admin/times` com usuário comum mostra a faixa do organizador.

- [ ] **Step 3: Implementar**

`apps/web/src/api/use-sign-out.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from './admin';
import { forgetSession } from './session';

/** Sair: encerra a sessão na API, esquece os dados logados e volta para o início. */
export function useSignOut() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      forgetSession(client);
      navigate('/');
    },
  });
}
```

`apps/web/src/components/AccountMenu.tsx`:

```tsx
import { useRef } from 'react';
import { Link } from 'react-router';
import type { AuthUser } from '../api/types';
import { useSignOut } from '../api/use-sign-out';

/** Conta no topo: foto (ou inicial) e primeiro nome; o menu tem "Área do organizador" só para organizador, e "Sair". */
export function AccountMenu({ user }: { user: AuthUser }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const signOut = useSignOut();
  const label = user.name ?? user.email;
  const firstName = label.split(/[\s@]/)[0];
  const close = () => menu.current?.removeAttribute('open');

  return (
    <details ref={menu} className="account" aria-label={`Conta de ${label}`}>
      <summary>
        {user.avatarUrl ? (
          <img className="account-photo" src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" />
        ) : (
          <span className="account-photo account-initial" aria-hidden="true">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="account-name">{firstName}</span>
      </summary>
      <div className="account-menu">
        {user.role === 'admin' && (
          <Link to="/admin" onClick={close}>
            Área do organizador
          </Link>
        )}
        <button type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          Sair
        </button>
      </div>
    </details>
  );
}
```

`apps/web/src/components/Layout.tsx` (arquivo inteiro):

```tsx
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/queries';
import { AccountMenu } from './AccountMenu';

export function Layout() {
  const user = useMe().data?.user ?? null;
  // Na área do organizador, a barra dele (AdminLayout) substitui o menu público. Para quem não é organizador,
  // /admin é uma página inexistente qualquer, com o layout público.
  const inAdmin = /^\/admin(\/|$)/.test(useLocation().pathname) && user?.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          <img src="/logo.png" alt="" width={60} height={40} />
        </Link>
        {inAdmin ? (
          <Link to="/" className="topbar-exit">
            Ver site
          </Link>
        ) : (
          <>
            <nav aria-label="Principal" className="mainnav">
              <NavLink to="/campeonatos">Campeonatos</NavLink>
              <NavLink to="/times">Times</NavLink>
              <NavLink to="/titulos">Títulos</NavLink>
            </nav>
            {user && <AccountMenu user={user} />}
          </>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
      {!inAdmin && !user && (
        <footer className="footer">
          <Link to="/entrar">Entrar</Link>
        </footer>
      )}
    </div>
  );
}
```

`apps/web/src/pages/admin/AdminLayout.tsx` (arquivo inteiro):

```tsx
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../api/queries';
import { useSignOut } from '../../api/use-sign-out';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { NotFoundPage } from '../NotFoundPage';

/**
 * Tudo em /admin exige um organizador. Sem sessão, vai para /entrar e volta para cá depois.
 * Usuário comum vê a página de "não encontrada", como em qualquer endereço que não existe.
 */
export function AdminLayout() {
  const me = useMe();
  const location = useLocation();
  const exit = useSignOut();

  return (
    <QueryState query={me}>
      {({ user }) =>
        user?.role === 'admin' ? (
          <>
            <div className="admin-bar">
              <nav aria-label="Administração" className="admin-nav">
                <NavLink to="/admin" end className="admin-home">
                  Organizador
                </NavLink>
                <NavLink to="/admin/campeonatos">Campeonatos</NavLink>
                <NavLink to="/admin/times">Times</NavLink>
                <NavLink to="/admin/jogadores">Jogadores</NavLink>
                <NavLink to="/admin/titulos">Títulos</NavLink>
                <NavLink to="/admin/usuarios">Usuários</NavLink>
              </nav>
              <button type="button" className="admin-exit" disabled={exit.isPending} onClick={() => exit.mutate()}>
                Sair
              </button>
            </div>
            <FormError error={exit.error} />
            <Outlet />
          </>
        ) : user ? (
          <NotFoundPage />
        ) : exit.isPending || exit.isSuccess ? null : (
          // Saindo por vontade própria: vai para o início, não para o login.
          <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
        )
      }
    </QueryState>
  );
}
```

(O link "Usuários" aponta para a rota que a Task 6 cria; até lá ela cai no `*` do admin.)

`apps/web/src/api/query-client.ts`, no `onError` do `QueryCache`:

```ts
      onError: (error, query) => {
        if (!(error instanceof ApiError) || query.queryKey[0] === 'me') return;
        // Sessão expirada numa página do admin que só lê: vai para o login, como numa escrita.
        if (error.status === 401) forgetSession(client);
        // Perdeu o papel de organizador: busca a sessão de novo e o admin some.
        if (error.status === 403) void client.invalidateQueries({ queryKey: ['me'] });
      },
```

(As escritas já buscam `/auth/me` de novo: `useApiMutation` invalida todas as consultas ao terminar.)

`apps/web/src/styles/components.css`, no fim:

```css
/* Conta no topo: foto ou inicial; o nome some nos celulares para caber com o menu */
.account {
  position: relative;
  flex: none;
}

.account summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  list-style: none;
  cursor: pointer;
  color: var(--chalk);
  font-weight: 600;
}

.account summary::-webkit-details-marker {
  display: none;
}

.account-photo {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--line);
}

.account-initial {
  background: var(--surface);
  color: var(--grass);
  font-family: var(--font-display);
  font-weight: 700;
}

.account[open] .account-photo {
  border-color: var(--grass);
}

.account-menu {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-2));
  display: grid;
  min-width: 12rem;
  padding: var(--space-2) 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.account-menu a,
.account-menu button {
  padding: var(--space-2) var(--space-4);
  color: var(--chalk);
  font: inherit;
  text-align: left;
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
}

.account-menu a:hover,
.account-menu button:hover {
  background: var(--bg);
}

@media (max-width: 479px) {
  .account-name {
    display: none;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/account.test.tsx test/app.test.tsx test/auth.test.tsx`
Expected: PASS.

Run: `cd apps/web && npx vitest run` (suíte do site inteira)
Expected: PASS. Se algum teste antigo procurava "Área do organizador" no rodapé, ele já foi trocado no Step 1; não há outros (conferido no planejamento: só `app.test.tsx`).

---

### Task 6: Site — tela de usuários

**Files:**
- Create: `apps/web/src/pages/admin/AdminUsersPage.tsx`
- Modify: `apps/web/src/admin-routes.tsx`
- Test: `apps/web/test/admin-users.test.tsx` (novo)

**Interfaces:**
- Consumes: `useUsers`, `setUserRole`, `UserListItem` (Task 4); `useMe`; `ConfirmButton`; `formatDate`.
- Produces: rota `/admin/usuarios`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/admin-users.test.tsx`:

```ts
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserListItem } from '../src/api/types';
import { ADMIN, SIGNED_IN } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const row = (overrides: Partial<UserListItem>): UserListItem => ({
  id: 'x',
  email: 'x@kickabout.local',
  name: null,
  avatarUrl: null,
  role: 'user',
  hasPassword: false,
  hasGoogle: true,
  lastLoginAt: '2026-10-18T12:00:00.000Z',
  createdAt: '2026-10-18T12:00:00.000Z',
  ...overrides,
});

const users = [
  row({ id: 'u2', email: 'ana@gmail.com', name: 'Ana Souza' }),
  row({ id: 'u3', email: 'bia@gmail.com', name: 'Bia', role: 'admin', hasPassword: true, lastLoginAt: null }),
  row({ id: ADMIN.id, email: ADMIN.email, role: 'admin', hasPassword: true, hasGoogle: false }),
];

describe('admin users', () => {
  it('lists users with how they sign in and their role', async () => {
    mockApi({ ...SIGNED_IN, '/users': users });
    renderRoute('/admin/usuarios');
    const list = await screen.findByRole('list', { name: 'Usuários' });
    const [ana, bia, me] = within(list).getAllByRole('listitem');
    expect(ana).toHaveTextContent('Ana Souza');
    expect(ana).toHaveTextContent('ana@gmail.com');
    expect(ana).toHaveTextContent('Google');
    expect(ana).toHaveTextContent('Usuário');
    expect(bia).toHaveTextContent('Google e senha');
    expect(bia).toHaveTextContent('Nunca entrou');
    expect(bia).toHaveTextContent('Organizador');
    expect(me).toHaveTextContent('Sem nome');
    expect(me).toHaveTextContent('Senha');
    expect(within(me).queryByRole('button')).toBeNull();
    expect(within(me).getByText('Você')).toBeInTheDocument();
  });

  it('promotes a user after confirming', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/users': users,
      'PATCH /users/u2': (body: { role: string }) => ({ ...users[0], ...body }),
    });
    renderRoute('/admin/usuarios');
    fireEvent.click(await screen.findByRole('button', { name: 'Tornar Ana Souza organizador' }));
    expect(sentBodies(fetchMock, 'PATCH /users/u2')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: tornar organizador' }));
    await screen.findByRole('button', { name: 'Tornar Ana Souza organizador' });
    expect(sentBodies(fetchMock, 'PATCH /users/u2')).toEqual([{ role: 'admin' }]);
  });

  it('demotes another organizer after confirming and shows API errors', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/users': users,
      'PATCH /users/u3': () =>
        new Response(JSON.stringify({ error: { code: 'LAST_ADMIN', message: 'É preciso ter pelo menos um organizador.' } }), { status: 409 }),
    });
    renderRoute('/admin/usuarios');
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Bia de organizador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: remover organizador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('É preciso ter pelo menos um organizador.');
    expect(sentBodies(fetchMock, 'PATCH /users/u3')).toEqual([{ role: 'user' }]);
  });

  it('is linked from the organizer bar', async () => {
    mockApi({ ...SIGNED_IN, '/users': users, '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] });
    renderRoute('/admin');
    const nav = await screen.findByRole('navigation', { name: 'Administração' });
    expect(within(nav).getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/admin-users.test.tsx`
Expected: FAIL — `/admin/usuarios` mostra "Página não encontrada" (sem lista "Usuários"); o último teste já passa por causa da Task 5.

- [ ] **Step 3: Implementar**

`apps/web/src/pages/admin/AdminUsersPage.tsx`:

```tsx
import { setUserRole } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useMe, useUsers } from '../../api/queries';
import type { Role, UserListItem } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { formatDate } from '../../lib/format';

const signInMethod = (user: UserListItem) =>
  user.hasGoogle && user.hasPassword ? 'Google e senha' : user.hasGoogle ? 'Google' : 'Senha';

/** Organizadores promovem e rebaixam usuários. A API impede rebaixar a si mesmo e ficar sem organizador. */
export function AdminUsersPage() {
  const me = useMe().data?.user;
  const users = useUsers();
  const change = useApiMutation((vars: { id: string; role: Role }) => setUserRole(vars.id, vars.role));

  return (
    <>
      <h1>Usuários</h1>
      <p className="muted">Quem entra com o Google começa como usuário comum. Só organizadores acessam esta área.</p>
      <FormError error={change.error} />
      <QueryState query={users}>
        {(list) => (
          <ul aria-label="Usuários">
            {list.map((user) => {
              const label = user.name ?? user.email;
              return (
                <li key={user.id} className="admin-row">
                  {user.avatarUrl ? (
                    <img className="account-photo" src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="account-photo account-initial" aria-hidden="true">
                      {label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="row-title">
                    {user.name ?? 'Sem nome'}
                    <span className="muted"> {user.email}</span>
                  </span>
                  <span className="muted">{signInMethod(user)}</span>
                  <span className="muted">{user.lastLoginAt ? `Último acesso ${formatDate(user.lastLoginAt)}` : 'Nunca entrou'}</span>
                  <span className={user.role === 'admin' ? 'chip chip-win' : 'chip'}>
                    {user.role === 'admin' ? 'Organizador' : 'Usuário'}
                  </span>
                  {user.id === me?.id ? (
                    <span className="muted">Você</span>
                  ) : user.role === 'admin' ? (
                    <ConfirmButton
                      name={`Remover ${label} de organizador`}
                      label="Remover organizador"
                      confirmLabel="Confirmar: remover organizador"
                      danger
                      disabled={change.isPending}
                      onConfirm={() => change.mutate({ id: user.id, role: 'user' })}
                    />
                  ) : (
                    <ConfirmButton
                      name={`Tornar ${label} organizador`}
                      label="Tornar organizador"
                      confirmLabel="Confirmar: tornar organizador"
                      disabled={change.isPending}
                      onConfirm={() => change.mutate({ id: user.id, role: 'admin' })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </>
  );
}
```

`apps/web/src/admin-routes.tsx`: importe `AdminUsersPage` e acrescente `{ path: 'usuarios', element: <AdminUsersPage /> },` antes do `*`.

Nota (spec 4.4, "único organizador"): como só um organizador vê esta tela, uma linha de organizador que não é a sua implica pelo menos dois organizadores; o caso "botão desabilitado por ser o único" não acontece na tela. A API garante a regra (Task 3). Não implemente o estado desabilitado.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/admin-users.test.tsx`
Expected: PASS (4 testes).

---

### Task 7: Documentação, conferência no navegador e commit

**Files:**
- Modify: `docs/VERSOES.md` (seção v1.7 no topo)

- [ ] **Step 1: VERSOES**

Acrescente acima de `## v1.6` (mantendo o `---` entre seções):

```markdown
## v1.7 — 2026-10-19

Login com Google e papéis de usuário. Spec: `docs/superpowers/specs/2026-10-19-kickabout-login-google-design.md`.

- **Entrar com Google:** a página Entrar ganhou o botão "Fazer login com o Google", acima do formulário de email e senha, que continua igual.
- **Qualquer pessoa entra:** quem entra com o Google pela primeira vez vira **usuário comum**. Por enquanto, o usuário comum só fica logado (foto e nome no topo, com "Sair").
- **Organizadores:**
  - só organizadores acessam o admin; o admin que já existia continua organizador;
  - se o organizador entrar com uma conta Google do mesmo email, cai na mesma conta;
  - um organizador promove e rebaixa usuários na tela nova **Usuários** do admin, com confirmação em dois cliques;
  - ninguém tira o próprio papel, e o sistema nunca fica sem organizador.
- **Admin escondido:** usuário comum não vê nenhum link para o admin, e `/admin` mostra "Página não encontrada". O rodapé passou a dizer "Entrar" (só para quem não está logado), e organizadores chegam ao admin pelo menu da conta no topo.
- **Celulares com `PHONE_VISIBILITY=authenticated`:** só organizadores veem (antes, bastava estar logado).
- **API:**
  - `GET /auth/config` e `POST /auth/google`;
  - `GET /users` e `PATCH /users/:id` (só organizador);
  - usuário comum recebe 403 "Sua conta não é de organizador." nas rotas do admin;
  - `/auth/me` devolve também `name` e `avatarUrl`.
- **Migração:** `20261019120000_google_login` (senha opcional, conta Google, nome, foto, último acesso; papel padrão `user`).
- **Como ligar o botão do Google:**
  1. Em console.cloud.google.com, crie um projeto e configure a tela de consentimento OAuth (tipo "Externo").
  2. Em Credenciais, crie um "ID do cliente OAuth" do tipo "Aplicativo da Web".
  3. Em "Origens JavaScript autorizadas", adicione `http://localhost:5173` e o endereço de produção. Não precisa de URI de redirecionamento.
  4. Copie o Client ID para `GOOGLE_CLIENT_ID` em `apps/api/.env` e reinicie a API. Sem ele, o site mostra só email e senha.
```

- [ ] **Step 2: Suíte inteira e tipos**

Run: `npm run typecheck` e `npm test` (na raiz)
Expected: tudo verde. Registre os totais de shared, api e web.

- [ ] **Step 3: Conferência no navegador (Review Focus 5)**

Com a API e o site rodando (`npm run dev:api`, `npm run dev:web`), entre como organizador por email e senha e abra `/` em iframes de 320px e 375px de largura: marca, "Campeonatos", "Times", "Títulos" e a inicial da conta cabem na linha, sem rolagem lateral (`document.documentElement.scrollWidth <= innerWidth`). Abra o menu da conta e confira que ele não sai da tela. Se não couber, reduza o `gap` do `.mainnav` no `@media (max-width: 359px)` e registre a mudança no ledger.

- [ ] **Step 4: Commit (único do plano)**

```bash
git add -A
git commit -m "feat: Google sign-in with organizer and user roles (v1.7)

Anyone can sign in with Google as a regular user; only organizers reach the
admin, which is hidden from everyone else. Organizers promote and demote
users on the new Usuários page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
